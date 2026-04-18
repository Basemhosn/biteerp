import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase.js'
import {
  loadInvoices, saveInvoice, postInvoice,
  markInvoicePaid, cancelInvoice, getInvoiceSummary,
  searchContacts, loadCompanyProfile,
} from './supabase.js'

const n = v => parseFloat(v) || 0

async function generateInvoiceNumber(restaurantId, type) {
  const prefix = type === 'invoice' ? 'INV' : 'BILL'
  const year   = new Date().getFullYear()
  const { count } = await supabase.from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId).eq('type', type)
  return `${prefix}/${year}/${String((count ?? 0) + 1).padStart(4, '0')}`
}
const fmt = v => 'AED ' + n(v).toFixed(2)
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-AE', { day:'numeric', month:'short', year:'numeric' }) : '—'

const STATUS = {
  draft:     { bg: 'var(--bg-input)',        color: 'var(--text-muted)',  label: 'Draft'     },
  posted:    { bg: 'rgba(41,128,185,0.1)',   color: '#2980b9',            label: 'Posted'    },
  paid:      { bg: 'rgba(39,174,96,0.1)',    color: '#27ae60',            label: 'Paid'      },
  cancelled: { bg: 'rgba(192,57,43,0.1)',    color: '#c0392b',            label: 'Cancelled' },
  overdue:   { bg: 'rgba(192,57,43,0.08)',   color: '#c0392b',            label: 'Overdue'   },
}

const BLANK_LINE = { product_name: '', account_ref: '', quantity: 1, unit_price: '', uom: 'Units', notes: '' }

export default function InvoicesModule({ restaurantId, userId, session, type = 'invoice' }) {
  const isInvoice  = type === 'invoice'
  const label      = isInvoice ? 'Invoice' : 'Bill'
  const pluralLabel= isInvoice ? 'Invoices' : 'Bills'

  const [view,      setView]      = useState('list')  // list | form | detail
  const [invoices,  setInvoices]  = useState([])
  const [selInv,    setSelInv]    = useState(null)
  const [summary,   setSummary]   = useState({})
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [company,   setCompany]   = useState(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [search,       setSearch]       = useState('')

  // Form state
  const BLANK_FORM = { type, partner_name: '', contact_id: null, invoice_date: new Date().toISOString().slice(0,10), due_date: '', number: '', notes: '', status: 'draft' }
  const [form,      setForm]      = useState(BLANK_FORM)
  const [lines,     setLines]     = useState([{ ...BLANK_LINE }])

  // Contact search
  const [contactSearch, setContactSearch]   = useState('')
  const [contactResults,setContactResults]  = useState([])
  const [payModal,  setPayModal]  = useState(false)
  const [payMethod, setPayMethod] = useState('bank_transfer')

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    reload()
    loadCompanyProfile(restaurantId).then(setCompany).catch(() => {})
  }, [restaurantId, type])

  async function reload() {
    setLoading(true)
    try {
      const [invs, summ] = await Promise.all([
        loadInvoices(restaurantId, type),
        getInvoiceSummary(restaurantId, type),
      ])
      setInvoices(invs)
      setSummary(summ)
    } catch (e) { console.error(e) }
    } finally {
      setLoading(false)
    }
  }

  const openNew = () => {
    setForm({ ...BLANK_FORM })
    setLines([{ ...BLANK_LINE }])
    setContactSearch(''); setContactResults([])
    setView('form')
  }

  const openEdit = (inv) => {
    setForm({ ...inv })
    setLines(inv.invoice_lines?.length ? inv.invoice_lines.map(l => ({ ...l })) : [{ ...BLANK_LINE }])
    setContactSearch(inv.partner_name || '')
    setView('form')
  }

  const openDetail = (inv) => { setSelInv(inv); setView('detail') }

  // Line management
  const updateLine = (i, field, val) => setLines(p => p.map((l, j) => j === i ? { ...l, [field]: val } : l))
  const addLine    = () => setLines(p => [...p, { ...BLANK_LINE }])
  const removeLine = (i) => setLines(p => p.filter((_, j) => j !== i))

  // Computed totals
  const subtotal = lines.reduce((s, l) => s + n(l.quantity) * n(l.unit_price), 0)
  const vatAmt   = subtotal * 0.05
  const total    = subtotal + vatAmt

  // Contact search
  const handleContactSearch = async (q) => {
    setContactSearch(q)
    setForm(p => ({ ...p, partner_name: q, contact_id: null }))
    if (q.length < 2) { setContactResults([]); return }
    const results = await searchContacts(restaurantId, q, isInvoice ? 'customer' : 'supplier')
    setContactResults(results)
  }

  const selectContact = (c) => {
    setForm(p => ({ ...p, partner_name: c.name, contact_id: c.id }))
    setContactSearch(c.name); setContactResults([])
  }

  // Save
  const handleSave = async (andPost = false) => {
    if (!form.partner_name?.trim()) { alert(`${isInvoice ? 'Customer' : 'Supplier'} required`); return }
    if (!lines.some(l => l.product_name && n(l.unit_price) > 0)) { alert('Add at least one line item with price'); return }
    setSaving(true)
    try {
      const saved = await saveInvoice(restaurantId, form, lines, userId)
      if (andPost && saved) await postInvoice(saved.id, restaurantId, userId)
      await reload()
      setView('list')
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleCreditNote = async (inv) => {
    if (!confirm(`Create a credit note reversing ${label} ${inv.number}?`)) return
    setSaving(true)
    try {
      const creditNum = await generateInvoiceNumber(restaurantId, type)
      const { data: cn } = await supabase.from('invoices').insert({
        restaurant_id: restaurantId, type,
        number: `CN-${inv.number}`,
        contact_id: inv.contact_id, partner_name: inv.partner_name,
        invoice_date: new Date().toISOString().slice(0,10),
        subtotal: -inv.subtotal, vat_amount: -inv.vat_amount, total: -inv.total,
        status: 'posted', notes: `Credit note for ${inv.number}`,
        created_by: userId,
      }).select().single()
      if (cn) {
        const lines = inv.invoice_lines ?? []
        if (lines.length) {
          await supabase.from('invoice_lines').insert(lines.map(l => ({
            invoice_id: cn.id,
            product_name: l.product_name, account_ref: l.account_ref,
            quantity: -(l.quantity || 1), unit_price: l.unit_price,
            subtotal: -(l.subtotal || 0), uom: l.uom,
          })))
        }
      }
      await reload(); setView('list')
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handlePost = async (inv) => {
    if (!confirm(`Post ${label} ${inv.number}? This will create a journal entry.`)) return
    setSaving(true)
    try { await postInvoice(inv.id, restaurantId, userId); await reload() }
    catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handlePay = async () => {
    if (!selInv) return
    setSaving(true)
    try {
      await markInvoicePaid(selInv.id, restaurantId, payMethod, userId)
      setPayModal(false); await reload()
      setSelInv(prev => ({ ...prev, status: 'paid' }))
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleCancel = async (inv) => {
    if (!confirm(`Cancel ${label} ${inv.number}?`)) return
    await cancelInvoice(inv.id); await reload()
  }

  // Print invoice
  const printInvoice = (inv) => {
    const linesHtml = (inv.invoice_lines ?? []).map(l => `
      <tr>
        <td>${l.product_name || '—'}</td>
        <td style="text-align:right">${n(l.quantity)}</td>
        <td style="text-align:right">${l.uom || 'Units'}</td>
        <td style="text-align:right">${fmt(l.unit_price)}</td>
        <td style="text-align:right">${fmt(n(l.quantity) * n(l.unit_price))}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <title>${label} ${inv.number}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;padding:32px;max-width:700px;margin:0 auto}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #0D7377}
      .company-name{font-size:22px;font-weight:800;color:#0D7377}.invoice-title{font-size:28px;font-weight:800;color:#0D7377;text-align:right}
      .invoice-num{font-size:14px;color:#666;text-align:right}.meta{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:20px 0}
      .meta-block label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;color:#999;display:block;margin-bottom:4px}
      table{width:100%;border-collapse:collapse;margin:20px 0}thead th{background:#0D7377;color:#fff;padding:8px 10px;text-align:left;font-size:11px;font-weight:600}
      tbody td{padding:8px 10px;border-bottom:.5px solid #e8e8e8;font-size:12px}
      .totals{margin-left:auto;width:280px}.trow{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;color:#444}
      .trow-big{display:flex;justify-content:space-between;padding:8px 0;font-size:16px;font-weight:700;color:#0D7377;border-top:1.5px solid #0D7377;margin-top:6px}
      .status-badge{display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;background:${inv.status==='paid'?'#eaf6ee':'#eaf4fb'};color:${inv.status==='paid'?'#27ae60':'#2980b9'}}
      .footer{margin-top:24px;padding-top:16px;border-top:.5px solid #e8e8e8;font-size:10px;color:#999;text-align:center}
    </style></head><body>
    <div class="header">
      <div><div class="company-name">${company?.trade_name ?? company?.name ?? 'BiteERP'}</div>
        ${company?.address_line1 ? `<div style="color:#666;margin-top:4px">${company.address_line1}, ${company.city ?? 'Dubai'}, UAE</div>` : ''}
        ${company?.trn ? `<div style="color:#666">TRN: ${company.trn}</div>` : ''}
      </div>
      <div><div class="invoice-title">${isInvoice ? 'TAX INVOICE' : 'VENDOR BILL'}</div>
        <div class="invoice-num">${inv.number}</div>
        <div style="margin-top:6px"><span class="status-badge">${inv.status?.toUpperCase()}</span></div>
      </div>
    </div>
    <div class="meta">
      <div class="meta-block"><label>${isInvoice ? 'Bill to' : 'Supplier'}</label><strong style="font-size:14px">${inv.partner_name}</strong>
        ${inv.contacts?.email ? `<div style="color:#666;margin-top:2px">${inv.contacts.email}</div>` : ''}
        ${inv.contacts?.trn ? `<div style="color:#666">TRN: ${inv.contacts.trn}</div>` : ''}
      </div>
      <div class="meta-block">
        <label>${label} date</label><div>${fmtDate(inv.invoice_date)}</div>
        ${inv.due_date ? `<label style="margin-top:8px">Due date</label><div>${fmtDate(inv.due_date)}</div>` : ''}
      </div>
    </div>
    <table>
      <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${linesHtml}</tbody>
    </table>
    <div class="totals">
      <div class="trow"><span>Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
      <div class="trow"><span>VAT (5%)</span><span>${fmt(inv.vat_amount)}</span></div>
      <div class="trow-big"><span>Total</span><span>${fmt(inv.total)}</span></div>
    </div>
    ${inv.notes ? `<div style="margin-top:16px;padding:12px;background:#f8fffe;border-radius:6px;font-size:12px;color:#555"><strong>Notes:</strong> ${inv.notes}</div>` : ''}
    <div class="footer">
      ${company?.trn ? `TRN: ${company.trn} · ` : ''}This is a computer-generated ${label.toLowerCase()}.${company?.phone ? ` · ${company.phone}` : ''}
    </div>
    </body></html>`
    const w = window.open('', '_blank', 'width=780,height=900')
    w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400)
  }

  // Filtered list
  const filtered = invoices.filter(inv => {
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter ||
      (statusFilter === 'overdue' && inv.status === 'posted' && inv.due_date && new Date(inv.due_date) < new Date())
    const matchSearch = !search || inv.partner_name?.toLowerCase().includes(search.toLowerCase()) || inv.number?.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const SI = { background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' }
  const SL = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading {pluralLabel}…</div>

  return (
    <div>
      {/* ══ LIST VIEW ══════════════════════════════════════ */}
      {view === 'list' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>
                {isInvoice ? 'Customer Invoices' : 'Supplier Bills'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {isInvoice ? 'FTA-compliant tax invoices linked to customers, auto-posted to accounting.' : 'Vendor bills linked to suppliers, tracked in payables and partner ledger.'}
              </p>
            </div>
            <button onClick={openNew}
              style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 18px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>
              + New {label}
            </button>
          </div>

          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
            {[
              { label: 'Draft',   ...summary.draft,   color: 'var(--text-muted)', key: 'draft'   },
              { label: 'Posted',  ...summary.posted,  color: '#2980b9',            key: 'posted'  },
              { label: 'Paid',    ...summary.paid,    color: '#27ae60',            key: 'paid'    },
              { label: 'Overdue', ...summary.overdue, color: '#c0392b',            key: 'overdue' },
            ].map(k => (
              <div key={k.key} onClick={() => setStatusFilter(k.key === statusFilter ? 'all' : k.key)}
                style={{ background: 'var(--bg-surface)', border: `0.5px solid ${statusFilter === k.key ? k.color : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: k.color, marginBottom: 2 }}>{fmt(k.total ?? 0)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{k.count ?? 0} {k.label}</div>
              </div>
            ))}
          </div>

          {/* Search + filter */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${pluralLabel.toLowerCase()} or ${isInvoice ? 'customer' : 'supplier'}…`}
              style={{ ...SI, width: 260 }} />
            <div style={{ display: 'flex', gap: 4 }}>
              {['all','draft','posted','paid','overdue','cancelled'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '5px 10px', borderRadius: 999, border: '0.5px solid var(--border)', background: statusFilter === s ? 'var(--accent-dim)' : 'transparent', color: statusFilter === s ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', textTransform: 'capitalize' }}>
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                {[`${label} #`, isInvoice ? 'Customer' : 'Supplier', 'Date', 'Due date', 'Amount', 'VAT', 'Total', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(inv => {
                  const isOverdue = inv.status === 'posted' && inv.due_date && new Date(inv.due_date) < new Date()
                  const ss = isOverdue ? STATUS.overdue : STATUS[inv.status] ?? STATUS.draft
                  return (
                    <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(inv)}>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>{inv.number}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{inv.partner_name}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{fmtDate(inv.invoice_date)}</td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: isOverdue ? '#c0392b' : 'var(--text-muted)', fontWeight: isOverdue ? 600 : 400, borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{fmtDate(inv.due_date)}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)' }}>{fmt(inv.subtotal)}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{fmt(inv.vat_amount)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{fmt(inv.total)}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: ss.bg, color: ss.color }}>{isOverdue ? 'Overdue' : ss.label}</span>
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                          {inv.status === 'draft' && (
                            <button onClick={() => handlePost(inv)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 8px', background: 'rgba(41,128,185,0.1)', border: '0.5px solid rgba(41,128,185,0.3)', borderRadius: 4, color: '#2980b9', cursor: 'pointer' }}>Post</button>
                          )}
                          {inv.status === 'posted' && (
                            <button onClick={() => { setSelInv(inv); setPayModal(true) }} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 8px', background: 'rgba(39,174,96,0.1)', border: '0.5px solid rgba(39,174,96,0.3)', borderRadius: 4, color: '#27ae60', cursor: 'pointer' }}>
                              💰 Pay
                            </button>
                          )}
                          <button onClick={() => printInvoice(inv)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 8px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>🖨</button>
                          {inv.status === 'draft' && (
                            <button onClick={() => openEdit(inv)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 8px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer' }}>Edit</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: 13 }}>
                    {search || statusFilter !== 'all' ? 'No results match your filter' : `No ${pluralLabel.toLowerCase()} yet — create your first one or import from the Import module`}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ DETAIL VIEW ════════════════════════════════════ */}
      {view === 'detail' && selInv && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => setView('list')} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 2 }}>{selInv.number}</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selInv.partner_name} · {fmtDate(selInv.invoice_date)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {selInv.status === 'draft' && <button onClick={() => handlePost(selInv)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '8px 16px', background: '#2980b9', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>Post {label}</button>}
              {selInv.status === 'posted' && <button onClick={() => setPayModal(true)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '8px 16px', background: '#27ae60', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>💰 Register payment</button>}
              {selInv.status === 'posted' && <button onClick={() => handleCreditNote(selInv)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'rgba(142,68,173,0.1)', border: '0.5px solid rgba(142,68,173,0.3)', borderRadius: 'var(--radius)', color: '#8e44ad', cursor: 'pointer' }}>↩ Credit note</button>}
              <button onClick={() => printInvoice(selInv)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer' }}>🖨 Print</button>
              {selInv.status === 'draft' && <button onClick={() => openEdit(selInv)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>Edit</button>}
              {selInv.status === 'draft' && <button onClick={() => handleCancel(selInv)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 12px', background: 'transparent', border: '0.5px solid rgba(192,57,43,0.3)', borderRadius: 'var(--radius)', color: '#c0392b', cursor: 'pointer' }}>Cancel</button>}
            </div>
          </div>

          {/* Status + Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            {[
              { label: 'Status',       val: (() => { const ss = STATUS[selInv.status] ?? STATUS.draft; return <span style={{ fontSize: 13, fontWeight: 600, padding: '3px 10px', borderRadius: 4, background: ss.bg, color: ss.color }}>{ss.label}</span> })() },
              { label: isInvoice ? 'Customer' : 'Supplier', val: selInv.partner_name },
              { label: `${label} date`, val: fmtDate(selInv.invoice_date) },
              { label: 'Due date',     val: fmtDate(selInv.due_date) },
              { label: `${label} #`,   val: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{selInv.number}</span> },
            ].map((r, i) => (
              <div key={i} style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{r.label}</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{r.val}</div>
              </div>
            ))}
          </div>

          {/* Lines */}
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                {['Description','Account','Qty','Unit','Unit Price','Amount'].map(h => (
                  <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Description' || h === 'Account' ? 'left' : 'right', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(selInv.invoice_lines ?? []).map((l, i) => (
                  <tr key={i}>
                    <td style={{ padding: '9px 12px', fontWeight: 500, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{l.product_name || '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{l.account_ref || '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)' }}>{n(l.quantity)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{l.uom}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)' }}>{fmt(l.unit_price)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{fmt(n(l.quantity)*n(l.unit_price))}</td>
                  </tr>
                ))}
                {/* Totals */}
                {[
                  { label: 'Subtotal', val: fmt(selInv.subtotal), bold: false },
                  { label: 'VAT (5%)', val: fmt(selInv.vat_amount), bold: false },
                  { label: 'Total',    val: fmt(selInv.total), bold: true },
                ].map(r => (
                  <tr key={r.label}>
                    <td colSpan={5} style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12, borderBottom: '0.5px solid var(--border)' }}>{r.label}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: r.bold ? 700 : 500, fontSize: r.bold ? 14 : 12, color: r.bold ? 'var(--accent)' : 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{r.val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selInv.notes && <div style={{ padding: '12px 16px', background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', fontSize: 13, color: 'var(--text-secondary)' }}><strong>Notes:</strong> {selInv.notes}</div>}
        </div>
      )}

      {/* ══ FORM VIEW ══════════════════════════════════════ */}
      {view === 'form' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)' }}>{form.id ? `Edit ${label}` : `New ${label}`}</h2>
            <button onClick={() => setView('list')} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', marginBottom: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
              {/* Partner */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, position: 'relative' }}>
                <label style={SL}>{isInvoice ? 'Customer' : 'Supplier'} *</label>
                <input value={contactSearch} onChange={e => handleContactSearch(e.target.value)}
                  style={SI} placeholder={`Search ${isInvoice ? 'customer' : 'supplier'}…`} autoFocus />
                {contactResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: 160, overflowY: 'auto' }}>
                    {contactResults.map(c => (
                      <div key={c.id} onClick={() => selectContact(c)}
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '0.5px solid var(--border)', fontSize: 13 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.phone ?? ''}{c.email ? ' · '+c.email : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={SL}>{label} date *</label>
                <input type="date" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))} style={SI} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={SL}>Due date</label>
                <input type="date" value={form.due_date ?? ''} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} style={SI} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={SL}>{label} number (auto if blank)</label>
                <input value={form.number ?? ''} onChange={e => setForm(p => ({ ...p, number: e.target.value }))} style={SI} placeholder={`Auto: ${isInvoice?'INV':'BILL'}/2026/0001`} />
              </div>
            </div>

            {/* Lines */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>Line items</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['Description *','Account','Qty','Unit','Unit Price (AED) *',''].map((h,i) => (
                    <th key={i} style={{ padding: '7px 8px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      {[
                        { field: 'product_name', ph: 'Product or service description', wide: true },
                        { field: 'account_ref',  ph: 'e.g. 400101 Sales Account' },
                        { field: 'quantity',     ph: '1', type: 'number' },
                        { field: 'uom',          ph: 'Units' },
                        { field: 'unit_price',   ph: '0.00', type: 'number' },
                      ].map(col => (
                        <td key={col.field} style={{ padding: '4px 4px', borderBottom: '0.5px solid var(--border)' }}>
                          <input type={col.type ?? 'text'} value={l[col.field] ?? ''} placeholder={col.ph}
                            onChange={e => updateLine(i, col.field, e.target.value)}
                            style={{ ...SI, padding: '6px 8px', fontSize: 12 }} />
                        </td>
                      ))}
                      <td style={{ padding: '4px 4px', borderBottom: '0.5px solid var(--border)', textAlign: 'right', fontSize: 12, color: 'var(--accent)', fontWeight: 500, minWidth: 90 }}>
                        {fmt(n(l.quantity)*n(l.unit_price))}
                        {lines.length > 1 && <button onClick={() => removeLine(i)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 6, fontSize: 13 }}>✕</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addLine} style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 12px', background: 'var(--accent-dim)', border: '0.5px solid var(--accent)', borderRadius: 'var(--radius)', color: 'var(--accent)', cursor: 'pointer', marginTop: 8 }}>+ Add line</button>
            </div>

            {/* Totals preview */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <div style={{ width: 260, background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
                {[['Subtotal', fmt(subtotal)], ['VAT (5%)', fmt(vatAmt)], ['Total', fmt(total)]].map(([l, v], i) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: i === 2 ? 14 : 12, fontWeight: i === 2 ? 700 : 400, color: i === 2 ? 'var(--accent)' : 'var(--text-secondary)', borderTop: i === 2 ? '0.5px solid var(--border)' : 'none', marginTop: i === 2 ? 6 : 0, paddingTop: i === 2 ? 8 : 4 }}>
                    <span>{l}</span><span>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
              <label style={SL}>Notes</label>
              <textarea value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                style={{ ...SI, resize: 'vertical', minHeight: 60 }} placeholder="Payment terms, delivery notes…" />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleSave(false)} disabled={saving} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '10px 20px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer' }}>Save draft</button>
              <button onClick={() => handleSave(true)} disabled={saving} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '10px 20px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : `Save & Post ${label}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ PAYMENT MODAL ══════════════════════════════════ */}
      {payModal && (selInv || true) && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }} onClick={() => setPayModal(false)}>
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 380, padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Register payment</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{selInv?.number} · {fmt(selInv?.total)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
              <label style={SL}>Payment method</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={SI}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
                <option value="credit_note">Credit Note</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handlePay} disabled={saving} style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '10px', background: '#27ae60', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Processing…' : `✓ Mark as paid`}
              </button>
              <button onClick={() => setPayModal(false)} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '10px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
