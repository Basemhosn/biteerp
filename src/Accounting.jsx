import { useState, useEffect, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import { loadChartOfAccounts, seedChartOfAccounts, upsertAccount, loadJournalEntries, createJournalEntry, getPLStatement, getTrialBalance } from './supabase.js'
import styles from './Accounting.module.css'

const n = v => parseFloat(v) || 0
const fmt = v => 'AED ' + n(v).toFixed(2)
const fmtSigned = v => (v >= 0 ? '' : '-') + 'AED ' + Math.abs(n(v)).toFixed(2)

const ACCOUNT_TYPES = ['asset','liability','equity','revenue','expense']
const TYPE_COLORS = {
  asset:     '#2980b9', liability: '#c0392b', equity: '#8e44ad',
  revenue:   '#27ae60', expense:   '#e67e22'
}

export default function Accounting({ restaurantId, userId, activeTab }) {
  const [tab,      setTab]      = useState(activeTab ?? 'pl')
  const [accounts, setAccounts] = useState([])
  const [entries,  setEntries]  = useState([])
  const [pl,       setPL]       = useState(null)
  const [trial,    setTrial]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [seeding,  setSeeding]  = useState(false)

  // New journal entry
  const [showJE,   setShowJE]   = useState(false)
  const [jeDesc,   setJeDesc]   = useState('')
  const [jeLines,  setJeLines]  = useState([
    { account_id: '', debit: '', credit: '', description: '' },
    { account_id: '', debit: '', credit: '', description: '' },
  ])
  const [saving,   setSaving]   = useState(false)

  // New account
  const [showAcct, setShowAcct] = useState(false)
  const [editAcct, setEditAcct] = useState({ code: '', name: '', type: 'expense', sub_type: '' })

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    reload()
  }, [restaurantId])

  useEffect(() => {
    if (activeTab) setTab(activeTab)
  }, [activeTab])

  async function reload() {
    setLoading(true)
    try {
      const [accts, jEntries, plData, trialData] = await Promise.all([
        loadChartOfAccounts(restaurantId),
        loadJournalEntries(restaurantId, 50),
        getPLStatement(restaurantId),
        getTrialBalance(restaurantId),
      ])
      setAccounts(accts); setEntries(jEntries); setPL(plData); setTrial(trialData)
    } catch (e) { console.error(e) }
    } finally {
      setLoading(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try { await seedChartOfAccounts(restaurantId); await reload() }
    catch (e) { alert(e.message) }
    setSeeding(false)
  }

  const submitJE = async () => {
    const valid = jeLines.filter(l => l.account_id && (n(l.debit) > 0 || n(l.credit) > 0))
    const totalDebit  = valid.reduce((s, l) => s + n(l.debit), 0)
    const totalCredit = valid.reduce((s, l) => s + n(l.credit), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) { alert(`Entry doesn't balance. Debits: ${fmt(totalDebit)}, Credits: ${fmt(totalCredit)}`); return }
    if (!jeDesc.trim()) { alert('Enter a description'); return }
    setSaving(true)
    try {
      await createJournalEntry(restaurantId, jeDesc, valid.map(l => ({
        account_id: l.account_id, description: l.description,
        debit: n(l.debit), credit: n(l.credit),
      })), 'manual', null, userId)
      setShowJE(false); setJeDesc('')
      setJeLines([{ account_id: '', debit: '', credit: '', description: '' }, { account_id: '', debit: '', credit: '', description: '' }])
      await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const saveAcct = async () => {
    if (!editAcct.code || !editAcct.name) return
    setSaving(true)
    try { await upsertAccount(restaurantId, editAcct); setShowAcct(false); setEditAcct({ code: '', name: '', type: 'expense', sub_type: '' }); await reload() }
    catch (e) { alert(e.message) }
    setSaving(false)
  }

  const jeDebitTotal  = jeLines.reduce((s, l) => s + n(l.debit), 0)
  const jeCreditTotal = jeLines.reduce((s, l) => s + n(l.credit), 0)
  const jeBalanced    = Math.abs(jeDebitTotal - jeCreditTotal) < 0.01 && jeDebitTotal > 0

  // Group accounts by type
  const acctsByType = useMemo(() => {
    const g = {}
    for (const a of accounts) {
      if (!g[a.type]) g[a.type] = []
      g[a.type].push(a)
    }
    return g
  }, [accounts])

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading accounting…</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Accounting</h2>
          <p className={styles.pageSub}>Chart of accounts, journal entries, P&L, balance sheet and trial balance.</p>
        </div>
        <div className={styles.topActions}>
          {tab === 'journal' && <button className={styles.newBtn} onClick={() => setShowJE(true)}>+ Journal entry</button>}
          {tab === 'coa' && <button className={styles.newBtn} onClick={() => { setShowAcct(true); setEditAcct({ code: '', name: '', type: 'expense', sub_type: '' }) }}>+ Account</button>}
          {tab === 'coa' && accounts.length === 0 && (
            <button className={styles.seedBtn} onClick={handleSeed} disabled={seeding}>
              {seeding ? 'Setting up…' : '⚡ Setup UAE chart of accounts'}
            </button>
          )}
        </div>
      </div>



      {/* ── P&L STATEMENT ── */}
      {tab === 'pl' && pl && (
        <div className={styles.statementCard}>
          <div className={styles.statementTitle}>Profit & Loss Statement</div>
          {pl.revenue.length === 0 && pl.expenses.length === 0 ? (
            <div className={styles.emptyState}>
              No accounting data yet. Entries will appear here automatically as you use the POS, receive purchase orders, and log expenses.
              <br/><br/>
              To get started, go to <strong>Chart of Accounts</strong> and click "Setup UAE chart of accounts".
            </div>
          ) : (
            <>
              <StatementSection title="Revenue" rows={pl.revenue} total={pl.totals.totalRevenue} color="#27ae60" />
              <StatementSection title="Cost of Goods Sold" rows={pl.cogs} total={pl.totals.totalCOGS} color="#e67e22" />
              <div className={styles.subtotalRow}>
                <span>Gross Profit</span>
                <span style={{ color: pl.totals.grossProfit >= 0 ? '#27ae60' : '#c0392b' }}>
                  {fmt(pl.totals.grossProfit)}
                </span>
              </div>
              <StatementSection title="Operating Expenses" rows={pl.expenses} total={pl.totals.totalExpenses} color="#c0392b" />
              <div className={styles.netRow}>
                <span>Net Profit / Loss</span>
                <span style={{ color: pl.totals.netProfit >= 0 ? '#27ae60' : '#c0392b' }}>
                  {fmt(pl.totals.netProfit)}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── BALANCE SHEET ── */}
      {tab === 'balance' && (
        <div className={styles.statementCard}>
          <div className={styles.statementTitle}>Balance Sheet</div>
          {trial.length === 0 ? (
            <div className={styles.emptyState}>No data yet. Set up your chart of accounts and post journal entries to see your balance sheet.</div>
          ) : (
            <>
              <StatementSection title="Assets" rows={trial.filter(r => r.type === 'asset')} total={trial.filter(r => r.type === 'asset').reduce((s, r) => s + r.balance, 0)} color="#2980b9" />
              <StatementSection title="Liabilities" rows={trial.filter(r => r.type === 'liability')} total={trial.filter(r => r.type === 'liability').reduce((s, r) => s + r.balance, 0)} color="#c0392b" />
              <StatementSection title="Equity" rows={trial.filter(r => r.type === 'equity')} total={trial.filter(r => r.type === 'equity').reduce((s, r) => s + r.balance, 0)} color="#8e44ad" />
            </>
          )}
        </div>
      )}

      {/* ── TRIAL BALANCE ── */}
      {tab === 'trial' && (
        <div className={styles.tableCard}>
          <table className={styles.table}>
            <thead><tr>
              <th>Code</th><th>Account</th><th>Type</th><th style={{ textAlign: 'right' }}>Debit</th><th style={{ textAlign: 'right' }}>Credit</th><th style={{ textAlign: 'right' }}>Balance</th>
            </tr></thead>
            <tbody>
              {trial.map((a, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{a.code}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</td>
                  <td><span className={styles.typeBadge} style={{ background: TYPE_COLORS[a.type] + '18', color: TYPE_COLORS[a.type] }}>{a.type}</span></td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: 12 }}>{a.debit > 0 ? fmt(a.debit) : '—'}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: 12 }}>{a.credit > 0 ? fmt(a.credit) : '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: a.balance >= 0 ? 'var(--text-primary)' : '#c0392b' }}>{fmt(a.balance)}</td>
                </tr>
              ))}
              {trial.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>No data yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── JOURNAL ENTRIES ── */}
      {tab === 'journal' && (
        <div>
          {showJE && (
            <div className={styles.formCard}>
              <div className={styles.formTitle}>New journal entry</div>
              <div className={styles.field} style={{ marginBottom: 14 }}>
                <label className={styles.label}>Description *</label>
                <input value={jeDesc} onChange={e => setJeDesc(e.target.value)} className={styles.input} placeholder="e.g. Monthly rent payment" autoFocus />
              </div>
              <div className={styles.jeTable}>
                <div className={styles.jeHeader}>
                  <span>Account</span><span>Line description</span><span>Debit</span><span>Credit</span><span></span>
                </div>
                {jeLines.map((line, i) => (
                  <div key={i} className={styles.jeLine}>
                    <select value={line.account_id} onChange={e => setJeLines(prev => prev.map((l, idx) => idx === i ? { ...l, account_id: e.target.value } : l))} className={styles.lineInput}>
                      <option value="">— Account —</option>
                      {ACCOUNT_TYPES.map(type => (
                        <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
                          {(acctsByType[type] ?? []).map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <input value={line.description} onChange={e => setJeLines(prev => prev.map((l, idx) => idx === i ? { ...l, description: e.target.value } : l))} className={styles.lineInput} placeholder="Description" />
                    <input type="number" min="0" step="0.01" value={line.debit}
                      onChange={e => setJeLines(prev => prev.map((l, idx) => idx === i ? { ...l, debit: e.target.value, credit: '' } : l))}
                      className={styles.lineInput} placeholder="0.00" />
                    <input type="number" min="0" step="0.01" value={line.credit}
                      onChange={e => setJeLines(prev => prev.map((l, idx) => idx === i ? { ...l, credit: e.target.value, debit: '' } : l))}
                      className={styles.lineInput} placeholder="0.00" />
                    <button onClick={() => setJeLines(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
                <button onClick={() => setJeLines(prev => [...prev, { account_id: '', debit: '', credit: '', description: '' }])}
                  className={styles.addLineBtn}>+ Add line</button>
              </div>
              <div className={styles.jeBalance}>
                <span>Debits: <strong style={{ color: jeBalanced ? '#27ae60' : '#c0392b' }}>{fmt(jeDebitTotal)}</strong></span>
                <span>Credits: <strong style={{ color: jeBalanced ? '#27ae60' : '#c0392b' }}>{fmt(jeCreditTotal)}</strong></span>
                {!jeBalanced && jeDebitTotal > 0 && <span style={{ color: '#c0392b', fontSize: 11 }}>⚠ Entry doesn't balance</span>}
                {jeBalanced && <span style={{ color: '#27ae60', fontSize: 11 }}>✓ Balanced</span>}
              </div>
              <div className={styles.formActions}>
                <button className={styles.saveBtn} onClick={submitJE} disabled={saving || !jeBalanced}>{saving ? 'Posting…' : 'Post entry'}</button>
                <button className={styles.cancelBtn} onClick={() => setShowJE(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className={styles.tableCard}>
            <table className={styles.table}>
              <thead><tr><th>Entry #</th><th>Date</th><th>Description</th><th>Source</th><th>Lines</th><th>Debits</th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent)' }}>{e.entry_number}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleDateString('en-AE')}</td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{e.description}</td>
                    <td><span className={styles.sourceBadge}>{e.source}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{e.journal_lines?.length ?? 0}</td>
                    <td style={{ color: 'var(--accent)', fontSize: 12 }}>{fmt(e.journal_lines?.reduce((s, l) => s + n(l.debit), 0))}</td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>No journal entries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CHART OF ACCOUNTS ── */}
      {tab === 'coa' && (
        <COATab
          accounts={accounts}
          acctsByType={acctsByType}
          showAcct={showAcct}
          setShowAcct={setShowAcct}
          editAcct={editAcct}
          setEditAcct={setEditAcct}
          saveAcct={saveAcct}
          saving={saving}
          restaurantId={restaurantId}
          onReload={reload}
        />
      )}
    </div>
  )
}

function StatementSection({ title, rows, total, color }) {
  if (!rows?.length && total === 0) return null
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color, marginBottom: 8 }}>{title}</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', fontSize: 13, color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)' }}>
          <span style={{ paddingLeft: 12 }}>{r.name}</span>
          <span>{fmt(r.balance)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', background: 'var(--bg-input)', borderRadius: '0 0 var(--radius) var(--radius)' }}>
        <span>Total {title}</span>
        <span style={{ color }}>{fmt(total)}</span>
      </div>
    </div>
  )
}

// ── Chart of Accounts Tab ─────────────────────────────────────
function COATab({ accounts, acctsByType, showAcct, setShowAcct, editAcct, setEditAcct, saveAcct, saving, restaurantId, onReload }) {
  const fileRef = useRef()
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const downloadTemplate = () => {
    const rows = [
      ['Code', 'Name', 'Type', 'Sub-type'],
      ['1000', 'Cash & Bank',        'asset',     'cash'],
      ['4000', 'Sales Revenue',      'revenue',   'sales'],
      ['5000', 'Cost of Goods Sold', 'expense',   'cogs'],
      ['6010', 'Salaries & Wages',   'expense',   'payroll'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 12 }, { wch: 15 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Chart of Accounts')
    XLSX.writeFile(wb, 'biteerp-coa-template.xlsx')
  }

  const handleImport = async (file) => {
    if (!file) return
    setImporting(true); setImportMsg('')
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const wb   = XLSX.read(e.target.result, { type: 'binary' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        const data = rows.slice(1).filter(r => r[0] && r[1])
        let imported = 0
        for (const row of data) {
          try {
            const { supabase } = await import('./supabase.js')
            await supabase.from('accounts').upsert({
              restaurant_id: restaurantId,
              code:     row[0]?.toString().trim(),
              name:     row[1]?.toString().trim(),
              type:     row[2]?.toString().toLowerCase().trim() || 'expense',
              sub_type: row[3]?.toString().trim() || null,
            }, { onConflict: 'restaurant_id,code' })
            imported++
          } catch {}
        }
        setImportMsg(`✓ Imported ${imported} accounts`)
        setImporting(false)
        onReload()
      }
      reader.readAsBinaryString(file)
    } catch (e) { setImportMsg('Error: ' + e.message); setImporting(false) }
  }

  return (
    <div>
      {accounts.length === 0 && (
        <div style={{ padding: '1.25rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          No accounts yet. Click <strong>⚡ Setup UAE chart of accounts</strong> above to auto-create 35 pre-configured accounts, or import your own from a file.
        </div>
      )}

      {/* Import bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={downloadTemplate} style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '6px 12px', background: 'transparent', border: '0.5px dashed var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>
          ↓ Download template
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={importing} style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '6px 12px', background: 'var(--accent-dim)', border: '0.5px solid var(--accent)', borderRadius: 'var(--radius)', color: 'var(--accent)', cursor: 'pointer' }}>
          {importing ? 'Importing…' : '↑ Import from file'}
        </button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
          onChange={e => handleImport(e.target.files[0])} />
        {importMsg && <span style={{ fontSize: 12, color: importMsg.startsWith('✓') ? '#27ae60' : '#c0392b' }}>{importMsg}</span>}
      </div>

      {/* Add / Edit form */}
      {showAcct && (
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 12 }}>
            {editAcct.id ? 'Edit account' : 'New account'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
            {[
              { label: 'Code *',    field: 'code',     placeholder: 'e.g. 6300',        type: 'text'   },
              { label: 'Name *',    field: 'name',     placeholder: 'e.g. Delivery Fees', type: 'text' },
            ].map(({ label, field, placeholder, type }) => (
              <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</label>
                <input type={type} value={editAcct[field] ?? ''} placeholder={placeholder}
                  onChange={e => setEditAcct(p => ({ ...p, [field]: e.target.value }))}
                  style={{ background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' }} />
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Type *</label>
              <select value={editAcct.type ?? 'expense'} onChange={e => setEditAcct(p => ({ ...p, type: e.target.value }))}
                style={{ background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)' }}>
                {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sub-type</label>
              <input value={editAcct.sub_type ?? ''} placeholder="cogs / opex / payroll…"
                onChange={e => setEditAcct(p => ({ ...p, sub_type: e.target.value }))}
                style={{ background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveAcct} disabled={saving}
              style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 20px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : editAcct.id ? 'Save changes' : 'Add account'}
            </button>
            <button onClick={() => setShowAcct(false)}
              style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '9px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Accounts grouped by type */}
      {ACCOUNT_TYPES.map(type => {
        const typeAccts = acctsByType[type] ?? []
        if (!typeAccts.length) return null
        return (
          <div key={type} style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: TYPE_COLORS[type], marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              {type.charAt(0).toUpperCase() + type.slice(1)}s
              <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>{typeAccts.length} accounts</span>
            </div>
            <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['Code', 'Name', 'Type', 'Sub-type', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {typeAccts.map(a => (
                    <tr key={a.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: TYPE_COLORS[type], fontWeight: 600 }}>{a.code}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 500, color: 'var(--text-primary)' }}>{a.name}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: TYPE_COLORS[type] + '18', color: TYPE_COLORS[type] }}>
                          {a.type}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-muted)' }}>{a.sub_type ?? '—'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <button
                          onClick={() => { setEditAcct({ ...a }); setShowAcct(true) }}
                          style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 10px', border: '0.5px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                          ✏ Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
