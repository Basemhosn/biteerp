import { useState, useEffect, useRef } from 'react'
import { loadQuotations, createQuotation, confirmQuotation, loadReceipts, createReceiptFromPO, validateReceipt, loadIngredients, loadSuppliers, loadCompanyProfile, updatePOStatus, loadIngredientPriceHistory } from './supabase.js'
import styles from './PurchaseOrders.module.css'

const n = v => parseFloat(v) || 0
const fmt = v => 'AED ' + n(v).toFixed(2)

const STATUS_STYLES = {
  draft:     { bg: 'rgba(127,140,141,0.12)', color: '#7f8c8d', label: 'Draft'     },
  sent:      { bg: 'rgba(41,128,185,0.12)',  color: '#2980b9', label: 'Sent'      },
  partial:   { bg: 'rgba(230,126,34,0.12)',  color: '#e67e22', label: 'Partial'   },
  received:  { bg: 'rgba(39,174,96,0.12)',   color: '#27ae60', label: 'Received'  },
  cancelled: { bg: 'rgba(192,57,43,0.12)',   color: '#c0392b', label: 'Cancelled' },
  validated: { bg: 'rgba(39,174,96,0.12)',   color: '#27ae60', label: 'Validated' },
}

export default function PurchaseOrders({ restaurantId, userId, activeTab }) {
  const [tab,         setTab]         = useState(activeTab ?? 'quotations')
  const [quotations,  setQuotations]  = useState([])
  const [receipts,    setReceipts]    = useState([])
  const [ingredients, setIngredients] = useState([])
  const [suppliers,   setSuppliers]   = useState([])
  const [company,     setCompany]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [view,        setView]        = useState('list') // list | new | detail | receipt
  const [selDoc,      setSelDoc]      = useState(null)
  const [saving,      setSaving]      = useState(false)
  const printRef = useRef()

  // New quotation form
  const [suppId,      setSuppId]      = useState('')
  const [expDate,     setExpDate]     = useState('')
  const [payTerms,    setPayTerms]    = useState('')
  const [poNotes,     setPoNotes]     = useState('')
  const [lines,       setLines]       = useState([{ ingredient_id: '', description: '', qty_ordered: '', unit: 'kg', unit_cost: '' }])
  const [priceHistory, setPriceHistory] = useState({}) // keyed by ingredient_id

  // Receipt validation
  const [recLines,    setRecLines]    = useState([])

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
      const [q, r, ings, sups, comp] = await Promise.all([
        loadQuotations(restaurantId),
        loadReceipts(restaurantId),
        loadIngredients(restaurantId),
        loadSuppliers(restaurantId),
        loadCompanyProfile(restaurantId),
      ])
      setQuotations(q); setReceipts(r); setIngredients(ings)
      setSuppliers(sups); setCompany(comp)
    } catch (e) { console.error(e) }
    } finally {
      setLoading(false)
    }
  }

  // ── Line management ───────────────────────────────────────
  const addLine = () => setLines(p => [...p, { ingredient_id: '', description: '', qty_ordered: '', unit: 'kg', unit_cost: '' }])
  const delLine = (i) => setLines(p => p.filter((_, idx) => idx !== i))
  const updateLine = (i, f, v) => setLines(p => p.map((l, idx) => idx === i ? { ...l, [f]: v } : l))
  const autofill = async (i, ingId) => {
    const ing = ingredients.find(x => x.id === ingId)
    setLines(p => p.map((l, idx) => idx === i ? { ...l, ingredient_id: ingId, description: ing?.name ?? l.description, unit: ing?.unit ?? l.unit, unit_cost: ing?.cost_per_unit ?? l.unit_cost } : l))
    // Load price history for this ingredient
    if (ingId && restaurantId && !priceHistory[ingId]) {
      try {
        const hist = await loadIngredientPriceHistory(restaurantId, ingId, 3)
        if (hist.length > 0) setPriceHistory(p => ({ ...p, [ingId]: hist }))
      } catch {}
    }
  }

  const subtotal  = lines.reduce((s, l) => s + n(l.qty_ordered) * n(l.unit_cost), 0)
  const vatAmt    = subtotal * 0.05
  const total     = subtotal + vatAmt

  // ── Submit quotation ──────────────────────────────────────
  const submitQuotation = async () => {
    const valid = lines.filter(l => l.description?.trim() && n(l.qty_ordered) > 0)
    if (!valid.length) { alert('Add at least one line item'); return }
    setSaving(true)
    try {
      await createQuotation(restaurantId, suppId || null, valid, { paymentTerms: payTerms || company?.po_terms, notes: poNotes || company?.po_notes, expectedDate: expDate || null }, userId)
      resetForm(); await reload(); setView('list')
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  function resetForm() {
    setSuppId(''); setExpDate(''); setPayTerms(''); setPoNotes('')
    setLines([{ ingredient_id: '', description: '', qty_ordered: '', unit: 'kg', unit_cost: '' }])
  }

  // ── Confirm quotation → PO ────────────────────────────────
  const handleConfirm = async (id) => {
    if (!confirm('Confirm this quotation as a Purchase Order?')) return
    setSaving(true)
    try { await confirmQuotation(id, userId); await reload() }
    catch (e) { alert(e.message) }
    setSaving(false)
  }

  // ── Create receipt from PO ────────────────────────────────
  const handleCreateReceipt = async (po) => {
    setSaving(true)
    try {
      const receipt = await createReceiptFromPO(po.id, restaurantId, userId)
      await reload()
      const fresh = await loadReceipts(restaurantId)
      const r = fresh.find(x => x.id === receipt.id)
      setRecLines(r?.receipt_lines?.map(l => ({ ...l })) ?? [])
      setSelDoc(r); setView('receipt'); setTab('receipts')
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  // ── Validate receipt ──────────────────────────────────────
  const handleValidate = async () => {
    if (!confirm('Validate receipt? This will update your inventory stock levels.')) return
    setSaving(true)
    try {
      await validateReceipt(selDoc.id, recLines, userId, restaurantId)
      setView('list'); setSelDoc(null); await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  // ── Print / PDF ───────────────────────────────────────────
  const printDoc = (doc) => {
    const supp  = suppliers.find(s => s.id === doc.supplier_id)
    const isQt  = doc.doc_type === 'quotation'
    const lines = doc.po_lines ?? []

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <title>${isQt ? 'Quotation' : 'Purchase Order'} ${doc.po_number}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 40px; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom: 2px solid #0D7377; }
      .logo { max-height:70px; max-width:200px; object-fit:contain; }
      .logoPlaceholder { font-size:22px; font-weight:800; color:#0D7377; }
      .docInfo { text-align:right; }
      .docType { font-size:22px; font-weight:700; color:#0D7377; margin-bottom:4px; }
      .docNum { font-size:14px; color:#666; }
      .docDate { font-size:12px; color:#999; margin-top:2px; }
      .parties { display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-bottom:28px; }
      .partyLabel { font-size:9px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#999; margin-bottom:6px; }
      .partyName { font-size:14px; font-weight:600; color:#1a1a1a; margin-bottom:3px; }
      .partyDetail { font-size:11px; color:#666; line-height:1.6; }
      table { width:100%; border-collapse:collapse; margin-bottom:24px; }
      thead th { background:#0D7377; color:white; padding:9px 12px; text-align:left; font-size:11px; font-weight:600; letter-spacing:0.04em; }
      thead th:last-child, thead th:nth-last-child(2), thead th:nth-last-child(3) { text-align:right; }
      tbody td { padding:9px 12px; border-bottom:0.5px solid #e8e8e8; font-size:12px; }
      tbody td:last-child, tbody td:nth-last-child(2), tbody td:nth-last-child(3) { text-align:right; }
      tbody tr:hover td { background:#f9fffe; }
      .totals { display:flex; flex-direction:column; align-items:flex-end; gap:4px; margin-bottom:28px; }
      .totalRow { display:flex; justify-content:space-between; gap:40px; font-size:12px; color:#666; min-width:260px; }
      .totalRowFinal { display:flex; justify-content:space-between; gap:40px; font-size:15px; font-weight:700; color:#0D7377; min-width:260px; padding-top:8px; border-top:1.5px solid #0D7377; margin-top:4px; }
      .footer { border-top:0.5px solid #e8e8e8; padding-top:16px; display:flex; justify-content:space-between; gap:24px; }
      .terms { flex:1; }
      .termsLabel { font-size:9px; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#999; margin-bottom:4px; }
      .termsText { font-size:11px; color:#666; line-height:1.5; }
      .bank { text-align:right; }
      @media print { body { padding:20px; } }
    </style></head><body>
    <div class="header">
      <div>${company?.logo_url ? `<img src="${company.logo_url}" class="logo" alt="Logo"/>` : `<div class="logoPlaceholder">${company?.name ?? 'BiteERP'}</div>`}</div>
      <div class="docInfo">
        <div class="docType">${isQt ? 'QUOTATION' : 'PURCHASE ORDER'}</div>
        <div class="docNum">${doc.po_number}</div>
        <div class="docDate">${new Date(doc.created_at).toLocaleDateString('en-AE', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        ${doc.expected_date ? `<div class="docDate">Expected: ${new Date(doc.expected_date).toLocaleDateString('en-AE', { day: 'numeric', month: 'long', year: 'numeric' })}</div>` : ''}
      </div>
    </div>
    <div class="parties">
      <div>
        <div class="partyLabel">From</div>
        <div class="partyName">${company?.name ?? 'Your Company'}</div>
        <div class="partyDetail">
          ${company?.address_line1 ? company.address_line1 + '<br/>' : ''}
          ${company?.address_line2 ? company.address_line2 + ', ' : ''}${company?.city ?? 'Dubai'}, UAE<br/>
          ${company?.phone ? 'Tel: ' + company.phone + '<br/>' : ''}
          ${company?.email ? company.email + '<br/>' : ''}
          ${company?.trn ? 'TRN: ' + company.trn : ''}
        </div>
      </div>
      <div>
        <div class="partyLabel">To</div>
        <div class="partyName">${supp?.name ?? 'Supplier'}</div>
        <div class="partyDetail">
          ${supp?.contact ? supp.contact + '<br/>' : ''}
          ${supp?.phone ? 'Tel: ' + supp.phone + '<br/>' : ''}
          ${supp?.email ?? ''}
        </div>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Unit Price (AED)</th><th>Total (AED)</th>
      </tr></thead>
      <tbody>
        ${lines.map((l, i) => `<tr>
          <td>${i + 1}</td>
          <td>${l.description}</td>
          <td style="text-align:right">${n(l.qty_ordered).toFixed(2)}</td>
          <td>${l.unit}</td>
          <td style="text-align:right">${n(l.unit_cost).toFixed(2)}</td>
          <td style="text-align:right">${(n(l.qty_ordered) * n(l.unit_cost)).toFixed(2)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="totals">
      <div class="totalRow"><span>Subtotal</span><span>AED ${n(doc.subtotal).toFixed(2)}</span></div>
      <div class="totalRow"><span>VAT (5%)</span><span>AED ${n(doc.vat_amount).toFixed(2)}</span></div>
      <div class="totalRowFinal"><span>Total</span><span>AED ${n(doc.total).toFixed(2)}</span></div>
    </div>
    <div class="footer">
      <div class="terms">
        ${company?.po_terms ? `<div class="termsLabel">Payment Terms</div><div class="termsText">${company.po_terms}</div>` : ''}
        ${company?.po_notes ? `<div class="termsLabel" style="margin-top:10px">Notes</div><div class="termsText">${company.po_notes}</div>` : ''}
      </div>
      ${company?.bank_name ? `<div class="bank">
        <div class="termsLabel">Bank Details</div>
        <div class="termsText">${company.bank_name}<br/>${company.bank_iban ?? ''}<br/>${company.bank_swift ?? ''}</div>
      </div>` : ''}
    </div>
    </body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    setTimeout(() => { w.print() }, 300)
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>

  return (
    <div className={styles.wrap}>


      {/* ── QUOTATIONS LIST ── */}
      {tab === 'quotations' && view === 'list' && (
        <div>
          <div className={styles.topRow}>
            <div>
              <h2 className={styles.pageTitle}>Quotations</h2>
              <p className={styles.pageSub}>Create supplier quotations with your company branding. Confirm to convert to a Purchase Order.</p>
            </div>
            <button className={styles.newBtn} onClick={() => setView('new')}>+ New quotation</button>
          </div>
          <DocTable
            docs={quotations.filter(q => q.doc_type === 'quotation')}
            suppliers={suppliers}
            onPrint={printDoc}
            onConfirm={handleConfirm}
            onReceipt={handleCreateReceipt}
            onCancel={id => updatePOStatus(id, 'cancelled').then(reload)}
            type="quotation"
            saving={saving}
          />
        </div>
      )}

      {/* ── PO LIST ── */}
      {tab === 'orders' && view === 'list' && (
        <div>
          <div className={styles.topRow}>
            <div>
              <h2 className={styles.pageTitle}>Purchase Orders</h2>
              <p className={styles.pageSub}>Confirmed POs sent to suppliers. Create a Receipt when goods arrive.</p>
            </div>
          </div>
          <DocTable
            docs={quotations.filter(q => q.doc_type === 'po')}
            suppliers={suppliers}
            onPrint={printDoc}
            onReceipt={handleCreateReceipt}
            onCancel={id => updatePOStatus(id, 'cancelled').then(reload)}
            type="po"
            saving={saving}
          />
        </div>
      )}

      {/* ── RECEIPTS LIST ── */}
      {tab === 'receipts' && view === 'list' && (
        <div>
          <div className={styles.topRow}>
            <div>
              <h2 className={styles.pageTitle}>Receipts</h2>
              <p className={styles.pageSub}>Validate received goods. Confirming a receipt updates your inventory stock levels automatically.</p>
            </div>
          </div>
          <ReceiptList
            receipts={receipts}
            suppliers={suppliers}
            onOpen={(r) => {
              setSelDoc(r)
              setRecLines(r.receipt_lines?.map(l => ({ ...l })) ?? [])
              setView('receipt')
            }}
          />
        </div>
      )}

      {/* ── NEW QUOTATION FORM ── */}
      {view === 'new' && (
        <div>
          <div className={styles.topRow}>
            <div>
              <h2 className={styles.pageTitle}>New quotation</h2>
              {!company?.name && (
                <p style={{ fontSize: 12, color: '#c0392b', marginTop: 4 }}>
                  ⚠ Complete your company profile in Settings → Company for your branding to appear on documents.
                </p>
              )}
            </div>
            <button className={styles.backBtn} onClick={() => { setView('list'); resetForm() }}>← Back</button>
          </div>

          {/* Header */}
          <div className={styles.formCard}>
            <div className={styles.docPreviewHeader}>
              <div className={styles.docPreviewLogo}>
                {company?.logo_url
                  ? <img src={company.logo_url} alt="Logo" style={{ maxHeight: 56, maxWidth: 160, objectFit: 'contain' }} />
                  : <div className={styles.logoPlaceholder}>{company?.name ?? 'Your Company'}</div>
                }
                <div className={styles.docCompanyInfo}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{company?.name ?? '—'}</div>
                  {company?.address_line1 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{company.address_line1}{company.address_line2 ? ', ' + company.address_line2 : ''}</div>}
                  {company?.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{company.phone}</div>}
                  {company?.trn && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>TRN: {company.trn}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={styles.docTypeLabel}>QUOTATION</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Auto-numbered on save</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{new Date().toLocaleDateString('en-AE', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
              </div>
            </div>

            <div className={styles.formRow}>
              <div className={styles.field}>
                <label className={styles.label}>Supplier</label>
                <select value={suppId} onChange={e => setSuppId(e.target.value)} className={styles.input}>
                  <option value="">— Select supplier —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Expected delivery</label>
                <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className={styles.input} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Payment terms</label>
                <input value={payTerms} onChange={e => setPayTerms(e.target.value)} className={styles.input}
                  placeholder={company?.po_terms ? 'Using company default' : '30 days net'} />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className={styles.formCard}>
            <div className={styles.linesSectionHeader}>
              <span className={styles.sectionLabel}>Line items</span>
              <button className={styles.addLineBtn} onClick={addLine}>+ Add line</button>
            </div>
            <div className={styles.linesTable}>
              <div className={styles.linesHeader}>
                <span>Ingredient</span><span>Description</span>
                <span>Qty</span><span>Unit</span>
                <span>Unit cost (AED)</span><span>Total</span><span></span>
              </div>
              {lines.map((line, i) => (
                <div key={i} className={styles.lineRow}>
                  <select value={line.ingredient_id} onChange={e => autofill(i, e.target.value)} className={styles.lineInput}>
                    <option value="">— Link ingredient —</option>
                    {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name}</option>)}
                  </select>
                  <input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)}
                    className={styles.lineInput} placeholder="Description *" />
                  <input type="number" min="0" step="0.01" value={line.qty_ordered}
                    onChange={e => updateLine(i, 'qty_ordered', e.target.value)} className={styles.lineInput} placeholder="0" />
                  <input value={line.unit} onChange={e => updateLine(i, 'unit', e.target.value)}
                    className={styles.lineInput} placeholder="kg" style={{ width: 60 }} />
                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <input type="number" min="0" step="0.01" value={line.unit_cost}
                      onChange={e => updateLine(i, 'unit_cost', e.target.value)} className={styles.lineInput} placeholder="0.00" />
                    {line.ingredient_id && priceHistory[line.ingredient_id]?.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {priceHistory[line.ingredient_id].map((h, hi) => {
                          const isHigher = n(line.unit_cost) > n(h.unit_cost)
                          const isLower  = n(line.unit_cost) < n(h.unit_cost) && n(line.unit_cost) > 0
                          return (
                            <button key={hi} title={`${h.supplier_name} — ${new Date(h.date).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' })}`}
                              onClick={() => updateLine(i, 'unit_cost', h.unit_cost)}
                              style={{
                                fontFamily: 'var(--font-body)', fontSize: 10, padding: '1px 6px',
                                borderRadius: 4, border: '0.5px solid var(--border)', cursor: 'pointer',
                                background: 'var(--bg-input)', color: isHigher ? '#d47060' : isLower ? '#5db88a' : 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                              }}>
                              {isHigher ? '▲' : isLower ? '▼' : '='} AED {n(h.unit_cost).toFixed(2)}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <span className={styles.lineTotal}>{fmt(n(line.qty_ordered) * n(line.unit_cost))}</span>
                  <button className={styles.lineDelBtn} onClick={() => delLine(i)}>✕</button>
                </div>
              ))}
            </div>

            <div className={styles.totalsBlock}>
              <div className={styles.totalRow}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              <div className={styles.totalRow}><span>VAT (5%)</span><span>{fmt(vatAmt)}</span></div>
              <div className={styles.totalRowBig}><span>Total</span><span>{fmt(total)}</span></div>
            </div>
          </div>

          {/* Notes */}
          <div className={styles.formCard}>
            <label className={styles.label}>Notes / instructions to supplier</label>
            <textarea value={poNotes} onChange={e => setPoNotes(e.target.value)} rows={3}
              placeholder={company?.po_notes || 'e.g. Please deliver between 8am–12pm'}
              style={{ background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%', resize: 'vertical', marginTop: 6 }} />
          </div>

          <div className={styles.formActions}>
            <button className={styles.saveBtn} onClick={submitQuotation} disabled={saving}>
              {saving ? 'Saving…' : 'Save quotation'}
            </button>
            <button className={styles.cancelBtn} onClick={() => { setView('list'); resetForm() }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── RECEIPT VALIDATION ── */}
      {view === 'receipt' && selDoc && (
        <div>
          <div className={styles.topRow}>
            <div>
              <h2 className={styles.pageTitle}>Receipt — {selDoc.receipt_number}</h2>
              <p className={styles.pageSub}>
                {selDoc.suppliers?.name ?? 'Supplier'} ·
                Linked to: {selDoc.purchase_orders?.po_number ?? '—'} ·
                Status: <strong style={{ color: STATUS_STYLES[selDoc.status]?.color }}>{STATUS_STYLES[selDoc.status]?.label}</strong>
              </p>
            </div>
            <button className={styles.backBtn} onClick={() => { setView('list'); setSelDoc(null) }}>← Back</button>
          </div>

          {selDoc.status === 'validated' && (
            <div style={{ background: 'rgba(39,174,96,0.08)', border: '0.5px solid rgba(39,174,96,0.3)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 14, fontSize: 13, color: '#27ae60' }}>
              ✓ This receipt has been validated. Inventory has been updated.
            </div>
          )}

          <div className={styles.formCard}>
            <div className={styles.linesTable}>
              <div className={styles.linesHeader} style={{ gridTemplateColumns: '2fr 80px 80px 80px 100px 100px' }}>
                <span>Item</span><span>Expected</span><span>Received</span>
                <span>Unit</span><span>Unit cost</span><span>Total</span>
              </div>
              {recLines.map((line, i) => (
                <div key={line.id} className={styles.lineRow} style={{ gridTemplateColumns: '2fr 80px 80px 80px 100px 100px' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{line.description}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{n(line.qty_expected).toFixed(2)} {line.unit}</span>
                  {selDoc.status === 'validated' ? (
                    <span style={{ fontWeight: 600, color: '#27ae60' }}>{n(line.qty_received).toFixed(2)}</span>
                  ) : (
                    <input type="number" min="0" step="0.001" value={line.qty_received}
                      onChange={e => setRecLines(p => p.map((l, idx) => idx === i ? { ...l, qty_received: e.target.value } : l))}
                      className={styles.lineInput} style={{ width: 70 }} />
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{line.unit}</span>
                  <span style={{ color: 'var(--accent)', fontSize: 12 }}>{fmt(line.unit_cost)}</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 500 }}>
                    {fmt(n(line.qty_received) * n(line.unit_cost))}
                  </span>
                </div>
              ))}
            </div>

            <div className={styles.totalsBlock} style={{ marginTop: 12 }}>
              <div className={styles.totalRowBig}>
                <span>Total received value</span>
                <span>{fmt(recLines.reduce((s, l) => s + n(l.qty_received) * n(l.unit_cost), 0))}</span>
              </div>
            </div>
          </div>

          {selDoc.status !== 'validated' && (
            <div className={styles.formActions}>
              <button className={styles.validateBtn} onClick={handleValidate} disabled={saving}>
                {saving ? 'Validating…' : '✓ Validate receipt & update inventory'}
              </button>
              <button className={styles.cancelBtn} onClick={() => { setView('list'); setSelDoc(null) }}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Document table sub-component ─────────────────────────────
function DocTable({ docs, suppliers, onPrint, onConfirm, onReceipt, onCancel, type, saving }) {
  if (!docs.length) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-surface)', border: '0.5px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
      No {type === 'quotation' ? 'quotations' : 'purchase orders'} yet
    </div>
  )
  return (
    <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['Number','Supplier','Date','Expected','Lines','Subtotal','Total','Status',''].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.map(d => {
            const sc = STATUS_STYLES[d.status] ?? STATUS_STYLES.draft
            return (
              <tr key={d.id}>
                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 600, borderBottom: '0.5px solid var(--border)' }}>{d.po_number}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{d.suppliers?.name ?? '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{new Date(d.created_at).toLocaleDateString('en-AE')}</td>
                <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{d.expected_date ? new Date(d.expected_date).toLocaleDateString('en-AE') : '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{d.po_lines?.length ?? 0}</td>
                <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>{fmt(d.subtotal)}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--accent)', borderBottom: '0.5px solid var(--border)' }}>{fmt(d.total)}</td>
                <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: sc.bg, color: sc.color }}>{sc.label}</span>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button onClick={() => onPrint(d)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 9px', border: '0.5px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>🖨 Print</button>
                    {type === 'quotation' && d.status === 'draft' && onConfirm && (
                      <button onClick={() => onConfirm(d.id)} disabled={saving} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 9px', border: '0.5px solid #27ae60', borderRadius: 4, background: 'rgba(39,174,96,0.1)', color: '#27ae60', cursor: 'pointer' }}>✓ Confirm PO</button>
                    )}
                    {(d.status === 'sent' || d.status === 'partial') && onReceipt && (
                      <button onClick={() => onReceipt(d)} disabled={saving} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 9px', border: '0.5px solid var(--accent)', borderRadius: 4, background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer' }}>+ Receipt</button>
                    )}
                    {!['received','cancelled','validated'].includes(d.status) && onCancel && (
                      <button onClick={() => onCancel(d.id)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 9px', border: '0.5px solid rgba(192,57,43,0.3)', borderRadius: 4, background: 'transparent', color: '#c0392b', cursor: 'pointer' }}>Cancel</button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Receipt list sub-component ────────────────────────────────
function ReceiptList({ receipts, suppliers, onOpen }) {
  if (!receipts.length) return (
    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-surface)', border: '0.5px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
      No receipts yet. Create one from a confirmed Purchase Order.
    </div>
  )
  return (
    <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {['Receipt #','Supplier','PO Ref','Date','Lines','Status',''].map(h => (
              <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {receipts.map(r => {
            const sc = STATUS_STYLES[r.status] ?? STATUS_STYLES.draft
            return (
              <tr key={r.id}>
                <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 600, borderBottom: '0.5px solid var(--border)' }}>{r.receipt_number}</td>
                <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{r.suppliers?.name ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '0.5px solid var(--border)' }}>{r.purchase_orders?.po_number ?? '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 11, borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleDateString('en-AE')}</td>
                <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{r.receipt_lines?.length ?? 0}</td>
                <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 4, background: sc.bg, color: sc.color }}>{sc.label}</span>
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                  <button onClick={() => onOpen(r)} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 10px', border: '0.5px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {r.status === 'validated' ? 'View' : '→ Validate'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
