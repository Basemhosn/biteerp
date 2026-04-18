import { useState, useEffect } from 'react'
import {
  loadBranches, saveBranch, deleteBranch,
  loadBranchTransfers, createBranchTransfer, sendBranchTransfer, receiveBranchTransfer,
  getBranchInventorySummary, loadBranchIngredients,
  loadCompanyGroups, saveCompanyGroup, linkRestaurantToGroup, loadGroupCompanies,
} from './supabase.js'

const fmt = v => 'AED ' + (parseFloat(v) || 0).toFixed(2)
const n   = v => parseFloat(v) || 0

const STATUS_STYLE = {
  draft:     { bg: 'var(--bg-input)',          color: 'var(--text-muted)', label: 'Draft'     },
  sent:      { bg: 'rgba(230,126,34,0.1)',      color: '#e67e22',           label: 'In Transit'},
  received:  { bg: 'rgba(39,174,96,0.1)',       color: '#27ae60',           label: 'Received'  },
  cancelled: { bg: 'rgba(192,57,43,0.1)',       color: '#c0392b',           label: 'Cancelled' },
}

export default function MultiBranch({ restaurantId, userId, session, initialSection = 'branches', activeBranch, onBranchChange }) {
  const [section, setSection] = useState(initialSection) // branches | transfers | companies | summary
  const [branches,    setBranches]    = useState([])
  const [transfers,   setTransfers]   = useState([])
  const [inventory,   setInventory]   = useState([])
  const [companies,   setCompanies]   = useState([])
  const [groups,      setGroups]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [saving,      setSaving]      = useState(false)

  // Branch form
  const BLANK_BRANCH = { name: '', code: '', address: '', city: '', phone: '', manager_name: '', is_main: false }
  const [branchForm,  setBranchForm]  = useState(BLANK_BRANCH)
  const [editingBranch, setEditingBranch] = useState(false)

  // Transfer form
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [tfForm, setTfForm] = useState({ from: '', to: '', notes: '' })
  const [tfLines, setTfLines] = useState([{ ingredient_name: '', quantity_sent: '', unit: 'kg', cost_per_unit: '' }])
  const [branchIngredients, setBranchIngredients] = useState([])

  // Receive modal
  const [receiveModal, setReceiveModal] = useState(null)
  const [receiveLines, setReceiveLines] = useState([])

  // Company group form
  const BLANK_GROUP = { name: '', description: '' }
  const [groupForm,   setGroupForm]   = useState(BLANK_GROUP)
  const [editingGroup,setEditingGroup]= useState(false)

  const isOwner   = session?.role === 'owner'
  const isManager = session?.role === 'owner' || session?.role === 'manager'

  useEffect(() => { if (restaurantId) reload() }, [restaurantId, section])

  async function reload() {
    setLoading(true)
    try {
      if (section === 'branches' || section === 'transfers' || section === 'summary') {
        const b = await loadBranches(restaurantId).catch(() => [])
        setBranches(b)
        if (section === 'transfers') {
          const t = await loadBranchTransfers(restaurantId).catch(() => [])
          setTransfers(t)
        }
        if (section === 'summary') {
          const inv = await getBranchInventorySummary(restaurantId).catch(() => [])
          setInventory(inv)
        }
      }
      if (section === 'companies') {
        const g = await loadCompanyGroups(userId).catch(() => [])
        setGroups(g)
      }
    } catch (e) { console.error('MultiBranch reload:', e) }
    finally { setLoading(false) }
  }

  // ── Branch CRUD ───────────────────────────────────────────
  const submitBranch = async () => {
    if (!branchForm.name?.trim()) { alert('Branch name required'); return }
    setSaving(true)
    try {
      await saveBranch(restaurantId, branchForm)
      setBranchForm(BLANK_BRANCH); setEditingBranch(false)
      await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleDeleteBranch = async (id) => {
    if (!confirm('Deactivate this branch?')) return
    await deleteBranch(id); await reload()
  }

  // ── Transfer ──────────────────────────────────────────────
  const loadFromIngredients = async (branchId) => {
    if (!branchId) return
    const ings = await loadBranchIngredients(restaurantId, branchId)
    setBranchIngredients(ings)
  }

  const submitTransfer = async () => {
    if (!tfForm.from || !tfForm.to) { alert('Select source and destination branch'); return }
    if (tfForm.from === tfForm.to)  { alert('Source and destination must be different'); return }
    const lines = tfLines.filter(l => l.ingredient_name && n(l.quantity_sent) > 0)
    if (!lines.length) { alert('Add at least one item to transfer'); return }
    setSaving(true)
    try {
      await createBranchTransfer(restaurantId, tfForm.from, tfForm.to, lines, tfForm.notes, userId)
      setShowTransferForm(false)
      setTfForm({ from: '', to: '', notes: '' })
      setTfLines([{ ingredient_name: '', quantity_sent: '', unit: 'kg', cost_per_unit: '' }])
      await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleSend = async (transfer) => {
    if (!confirm('Mark this transfer as sent?')) return
    await sendBranchTransfer(transfer.id, userId); await reload()
  }

  const openReceive = (transfer) => {
    setReceiveModal(transfer)
    setReceiveLines(transfer.branch_transfer_lines?.map(l => ({ ...l, quantity_received: l.quantity_sent })) ?? [])
  }

  const handleReceive = async () => {
    if (!receiveModal) return
    setSaving(true)
    try {
      await receiveBranchTransfer(receiveModal.id, receiveLines, userId)
      setReceiveModal(null); await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  // ── Company group ─────────────────────────────────────────
  const submitGroup = async () => {
    if (!groupForm.name?.trim()) { alert('Group name required'); return }
    setSaving(true)
    try {
      await saveCompanyGroup(userId, groupForm)
      setGroupForm(BLANK_GROUP); setEditingGroup(false); await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const SI = { background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' }
  const SL = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: 5 }
  const SF = { display: 'flex', flexDirection: 'column', gap: 5 }
  const SC = { background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 12 }
  const btn = (accent, danger) => ({ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: accent ? 500 : 400, padding: '8px 16px', background: danger ? 'rgba(192,57,43,0.1)' : accent ? 'var(--accent)' : 'transparent', border: danger ? '0.5px solid rgba(192,57,43,0.3)' : accent ? 'none' : '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: danger ? '#c0392b' : accent ? '#fff' : 'var(--text-muted)', cursor: 'pointer' })

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
  if (error) return (
    <div style={{ padding: '2rem' }}>
      <div style={{ color: '#c0392b', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>⚠ Error: {error}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
        The database table for this feature doesn't exist yet.<br/>
        Run <strong>MASTER_MISSING.sql</strong> in Supabase SQL Editor.
      </div>
      <button onClick={reload} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>↻ Retry</button>
    </div>
  )

  return (
    <div>

      {/* ══ BRANCHES ════════════════════════════════════════ */}
      {section === 'branches' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>Branches</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Each branch shares the same TRN, chart of accounts, and P&L. Inventory is tracked per branch.</p>
            </div>
            {isManager && (
              <button onClick={() => { setBranchForm(BLANK_BRANCH); setEditingBranch(true) }} style={btn(true)}>+ Add branch</button>
            )}
          </div>

          {/* Add/Edit form */}
          {editingBranch && (
            <div style={{ ...SC, borderTop: '2px solid var(--accent)', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                {branchForm.id ? 'Edit branch' : 'New branch'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
                {[
                  { label: 'Branch name *', field: 'name',         ph: 'e.g. Dubai Mall'       },
                  { label: 'Branch code',   field: 'code',         ph: 'e.g. DXB-01'           },
                  { label: 'Phone',         field: 'phone',        ph: '+971 4 XXX XXXX'        },
                  { label: 'Manager',       field: 'manager_name', ph: 'Branch manager name'    },
                  { label: 'Address',       field: 'address',      ph: 'Street address'         },
                  { label: 'City',          field: 'city',         ph: 'Dubai'                  },
                ].map(f => (
                  <div key={f.field} style={SF}>
                    <label style={SL}>{f.label}</label>
                    <input value={branchForm[f.field] ?? ''} onChange={e => setBranchForm(p => ({ ...p, [f.field]: e.target.value }))} style={SI} placeholder={f.ph} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={branchForm.is_main ?? false}
                    onChange={e => setBranchForm(p => ({ ...p, is_main: e.target.checked }))} />
                  Mark as main / headquarters branch
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={submitBranch} disabled={saving} style={btn(true)}>{saving ? 'Saving…' : branchForm.id ? 'Save changes' : 'Create branch'}</button>
                <button onClick={() => setEditingBranch(false)} style={btn(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Branch cards */}
          {branches.length === 0 && !editingBranch && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-surface)', border: '0.5px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
              No branches yet. Add your first branch to enable branch-level inventory and POS tracking.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {branches.map(b => (
              <div key={b.id} style={{ ...SC, marginBottom: 0, position: 'relative', borderLeft: b.is_main ? '3px solid var(--accent)' : '0.5px solid var(--border)' }}>
                {b.is_main && <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, padding: '2px 8px', background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 4, fontWeight: 600 }}>HQ</div>}
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{b.name}</div>
                {b.code && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>{b.code}</div>}
                {[
                  { label: 'Manager', val: b.manager_name },
                  { label: 'Phone',   val: b.phone        },
                  { label: 'Address', val: b.address ? `${b.address}${b.city ? ', '+b.city : ''}` : null },
                ].filter(r => r.val).map(r => (
                  <div key={r.label} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)', minWidth: 60 }}>{r.label}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{r.val}</span>
                  </div>
                ))}
                {isManager && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <button onClick={() => { setBranchForm({ ...b }); setEditingBranch(true) }} style={{ ...btn(false), fontSize: 11, padding: '4px 10px' }}>Edit</button>
                    {!b.is_main && <button onClick={() => handleDeleteBranch(b.id)} style={{ ...btn(false, true), fontSize: 11, padding: '4px 10px' }}>Remove</button>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* What sharing means */}
          {branches.length > 0 && (
            <div style={{ marginTop: 16, padding: '14px 16px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>How branches work:</div>
              <div>✓ <strong>Shared:</strong> Chart of accounts · P&L · VAT reporting · Contacts · Menu · Recipes</div>
              <div>✓ <strong>Per branch:</strong> Inventory levels · POS orders · Cash sessions · Cashier shifts · Bank statements</div>
              <div>✓ <strong>Transfers:</strong> Move stock between branches via the Stock Transfers tab</div>
            </div>
          )}
        </div>
      )}

      {/* ══ STOCK TRANSFERS ═════════════════════════════════ */}
      {section === 'transfers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>Stock Transfers</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Move inventory between branches. Sending deducts source, receiving credits destination.</p>
            </div>
            <button onClick={() => setShowTransferForm(true)} style={btn(true)}>+ New transfer</button>
          </div>

          {/* New transfer form */}
          {showTransferForm && (
            <div style={{ ...SC, borderTop: '2px solid var(--accent)', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>New stock transfer</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div style={SF}>
                  <label style={SL}>From branch *</label>
                  <select value={tfForm.from} onChange={e => { setTfForm(p => ({ ...p, from: e.target.value })); loadFromIngredients(e.target.value) }} style={SI}>
                    <option value="">— select —</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div style={SF}>
                  <label style={SL}>To branch *</label>
                  <select value={tfForm.to} onChange={e => setTfForm(p => ({ ...p, to: e.target.value }))} style={SI}>
                    <option value="">— select —</option>
                    {branches.filter(b => b.id !== tfForm.from).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div style={SF}>
                  <label style={SL}>Notes</label>
                  <input value={tfForm.notes} onChange={e => setTfForm(p => ({ ...p, notes: e.target.value }))} style={SI} placeholder="Optional notes" />
                </div>
              </div>

              {/* Transfer lines */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Items to transfer</div>
                {tfLines.map((line, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
                    <div style={SF}>
                      {i === 0 && <label style={SL}>Ingredient / Item</label>}
                      {branchIngredients.length > 0 ? (
                        <select value={line.ingredient_name} onChange={e => {
                          const ing = branchIngredients.find(x => x.name === e.target.value)
                          const updated = [...tfLines]
                          updated[i] = { ...updated[i], ingredient_name: e.target.value, ingredient_id: ing?.id, unit: ing?.unit || 'kg', cost_per_unit: ing?.cost_per_unit || '' }
                          setTfLines(updated)
                        }} style={SI}>
                          <option value="">— select —</option>
                          {branchIngredients.map(ing => <option key={ing.id} value={ing.name}>{ing.name} ({ing.unit}) — {ing.stock_qty} in stock</option>)}
                        </select>
                      ) : (
                        <input value={line.ingredient_name} onChange={e => { const u=[...tfLines]; u[i]={...u[i],ingredient_name:e.target.value}; setTfLines(u) }} style={SI} placeholder="Item name" />
                      )}
                    </div>
                    <div style={SF}>
                      {i === 0 && <label style={SL}>Quantity</label>}
                      <input type="number" min="0" value={line.quantity_sent} onChange={e => { const u=[...tfLines]; u[i]={...u[i],quantity_sent:e.target.value}; setTfLines(u) }} style={SI} placeholder="0" />
                    </div>
                    <div style={SF}>
                      {i === 0 && <label style={SL}>Unit</label>}
                      <input value={line.unit} onChange={e => { const u=[...tfLines]; u[i]={...u[i],unit:e.target.value}; setTfLines(u) }} style={SI} placeholder="kg" />
                    </div>
                    <div style={SF}>
                      {i === 0 && <label style={SL}>Cost/unit</label>}
                      <input type="number" min="0" value={line.cost_per_unit} onChange={e => { const u=[...tfLines]; u[i]={...u[i],cost_per_unit:e.target.value}; setTfLines(u) }} style={SI} placeholder="AED" />
                    </div>
                    <button onClick={() => setTfLines(p => p.filter((_,j)=>j!==i))} style={{ ...btn(false,true), padding: '7px 10px', alignSelf: 'flex-end' }}>✕</button>
                  </div>
                ))}
                <button onClick={() => setTfLines(p => [...p, { ingredient_name: '', quantity_sent: '', unit: 'kg', cost_per_unit: '' }])}
                  style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 12px', background: 'var(--accent-dim)', border: '0.5px solid var(--accent)', borderRadius: 'var(--radius)', color: 'var(--accent)', cursor: 'pointer' }}>
                  + Add item
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={submitTransfer} disabled={saving} style={btn(true)}>{saving ? 'Creating…' : 'Create transfer'}</button>
                <button onClick={() => setShowTransferForm(false)} style={btn(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Transfers list */}
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                {['Ref','From','To','Items','Total value','Status','Date','Actions'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {transfers.map(t => {
                  const ss  = STATUS_STYLE[t.status] ?? STATUS_STYLE.draft
                  const val = (t.branch_transfer_lines ?? []).reduce((s, l) => s + n(l.quantity_sent) * n(l.cost_per_unit), 0)
                  return (
                    <tr key={t.id}>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>{t.transfer_number}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{t.from_branch?.name ?? '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{t.to_branch?.name ?? '—'}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{(t.branch_transfer_lines ?? []).length}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--accent)', fontWeight: 500, borderBottom: '0.5px solid var(--border)' }}>{fmt(val)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: ss.bg, color: ss.color }}>{ss.label}</span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{new Date(t.created_at).toLocaleDateString('en-AE')}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {t.status === 'draft' && (
                            <button onClick={() => handleSend(t)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 8px', background: 'rgba(230,126,34,0.1)', border: '0.5px solid rgba(230,126,34,0.3)', borderRadius: 4, color: '#e67e22', cursor: 'pointer' }}>
                              Send →
                            </button>
                          )}
                          {t.status === 'sent' && (
                            <button onClick={() => openReceive(t)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 8px', background: 'rgba(39,174,96,0.1)', border: '0.5px solid rgba(39,174,96,0.3)', borderRadius: 4, color: '#27ae60', cursor: 'pointer' }}>
                              ✓ Receive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {transfers.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>No transfers yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ INVENTORY SUMMARY ═══════════════════════════════ */}
      {section === 'summary' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>Inventory by Branch</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Overview of stock levels across all branches.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {inventory.map(b => (
              <div key={b.id} style={{ ...SC, marginBottom: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>{b.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: 'SKUs',          val: b.ingredient_count,    color: 'var(--accent)'  },
                    { label: 'Stock value',   val: fmt(b.total_value),    color: 'var(--accent)'  },
                    { label: 'Low stock',     val: b.low_stock,           color: b.low_stock > 0 ? '#c0392b' : '#27ae60' },
                  ].map(k => (
                    <div key={k.label}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: k.color }}>{k.val}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{k.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {inventory.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: 13 }}>No branches with inventory data yet</div>}
          </div>
        </div>
      )}

      {/* ══ COMPANIES ═══════════════════════════════════════ */}
      {section === 'companies' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>Company Groups</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Group multiple companies under one account. Each company has its own TRN, COA, P&L, and bank accounts.</p>
            </div>
            {isOwner && <button onClick={() => { setGroupForm(BLANK_GROUP); setEditingGroup(true) }} style={btn(true)}>+ New company group</button>}
          </div>

          {/* Explanation */}
          <div style={{ background: 'rgba(13,115,119,0.06)', border: '0.5px solid rgba(13,115,119,0.2)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 16, fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Multi-company vs multi-branch</div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: 12 }}>
              <div><strong style={{ color: 'var(--text-primary)' }}>Multi-branch</strong> — Same legal entity, different locations. Shared TRN, shared chart of accounts, consolidated P&L. Separate inventory and POS per branch.</div>
              <div style={{ marginTop: 6 }}><strong style={{ color: 'var(--text-primary)' }}>Multi-company</strong> — Different legal entities with separate TRNs. Each company has its own independent accounting, bank accounts, and VAT reporting. Switch between companies using the company selector at the top.</div>
            </div>
          </div>

          {editingGroup && (
            <div style={{ ...SC, borderTop: '2px solid var(--accent)', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>New company group</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div style={SF}>
                  <label style={SL}>Group name *</label>
                  <input value={groupForm.name} onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))} style={SI} placeholder="e.g. Basem Hospitality Group" autoFocus />
                </div>
                <div style={SF}>
                  <label style={SL}>Description</label>
                  <input value={groupForm.description ?? ''} onChange={e => setGroupForm(p => ({ ...p, description: e.target.value }))} style={SI} placeholder="Optional" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={submitGroup} disabled={saving} style={btn(true)}>{saving ? 'Saving…' : 'Create group'}</button>
                <button onClick={() => setEditingGroup(false)} style={btn(false)}>Cancel</button>
              </div>
            </div>
          )}

          {groups.map(g => (
            <div key={g.id} style={SC}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{g.name}</div>
                  {g.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{g.description}</div>}
                </div>
                <span style={{ fontSize: 11, padding: '3px 10px', background: 'var(--accent-dim)', color: 'var(--accent)', borderRadius: 4 }}>
                  {(g.restaurants ?? []).length} companies
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {(g.restaurants ?? []).map(r => (
                  <div key={r.id} style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius)', border: r.is_headquarters ? '1px solid var(--accent)' : '0.5px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{r.name}</span>
                      {r.is_headquarters && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>HQ</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.city}, {r.country}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10 }}>
                To add a company to this group, go to Settings → Company and link it to this group.
              </div>
            </div>
          ))}

          {groups.length === 0 && !editingGroup && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-surface)', border: '0.5px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
              No company groups yet. Create one to manage multiple legal entities under one BiteERP account.
            </div>
          )}
        </div>
      )}

      {/* ══ RECEIVE TRANSFER MODAL ══════════════════════════ */}
      {receiveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }} onClick={() => setReceiveModal(null)}>
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 520, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Receive transfer {receiveModal.transfer_number}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Confirm quantities received. Discrepancies are recorded.</div>
              </div>
              <button onClick={() => setReceiveModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ overflow: 'auto', flex: 1, padding: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>
                  {['Item','Sent','Received'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {receiveLines.map((line, i) => (
                    <tr key={line.id}>
                      <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)', fontWeight: 500, color: 'var(--text-primary)' }}>{line.ingredient_name}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)', color: 'var(--text-muted)' }}>{line.quantity_sent} {line.unit}</td>
                      <td style={{ padding: '8px 10px', borderBottom: '0.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="number" min="0" value={line.quantity_received} onChange={e => setReceiveLines(p => p.map((l,j) => j===i ? {...l, quantity_received: parseFloat(e.target.value)||0} : l))}
                            style={{ ...SI, width: 90, padding: '5px 8px' }} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{line.unit}</span>
                          {n(line.quantity_received) < n(line.quantity_sent) && (
                            <span style={{ fontSize: 10, color: '#c0392b', fontWeight: 500 }}>−{(n(line.quantity_sent)-n(line.quantity_received)).toFixed(2)} short</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 16px', borderTop: '0.5px solid var(--border)', display: 'flex', gap: 8 }}>
              <button onClick={handleReceive} disabled={saving}
                style={{ ...btn(true), flex: 1, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Processing…' : '✓ Confirm receipt'}
              </button>
              <button onClick={() => setReceiveModal(null)} style={btn(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
