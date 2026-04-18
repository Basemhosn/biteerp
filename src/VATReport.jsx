import { useState, useEffect } from 'react'
import { getVATSummary, loadCompanyProfile } from './supabase.js'

const n = v => parseFloat(v) || 0
const fmt = v => 'AED ' + n(v).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function VATReport({ restaurantId }) {
  const today   = new Date()
  const [year,  setYear]    = useState(today.getFullYear())
  const [month, setMonth]   = useState(today.getMonth() + 1)
  const [data,  setData]    = useState(null)
  const [comp,  setComp]    = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!restaurantId) return
    loadCompanyProfile(restaurantId).then(setComp).catch(() => {})
  }, [restaurantId])

  const load = async () => {
    setLoading(true)
    try { setData(await getVATSummary(restaurantId, year, month)) }
    catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { if (restaurantId) load() }, [restaurantId, year, month])

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

  const printReport = () => {
    if (!data) return
    const { totals } = data
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>VAT Return ${MONTHS[month-1]} ${year}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;padding:32px;max-width:600px;margin:0 auto}
    h1{font-size:20px;color:#0D7377;margin-bottom:4px}.sub{font-size:12px;color:#666;margin-bottom:20px}
    .box{border:1px solid #0D7377;border-radius:6px;padding:16px;margin-bottom:16px}
    .boxTitle{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0D7377;margin-bottom:12px}
    .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:.5px solid #eee;font-size:13px}
    .row:last-child{border-bottom:none}.rowBig{display:flex;justify-content:space-between;padding:8px 0;font-size:15px;font-weight:700;color:#0D7377}
    .note{font-size:10px;color:#999;margin-top:16px;text-align:center}</style></head><body>
    <h1>VAT Return — فاتورة ضريبية القيمة المضافة</h1>
    <div class="sub">${comp?.name ?? 'Restaurant'} · ${comp?.trn ? 'TRN: '+comp.trn+' · ' : ''}${MONTHS[month-1]} ${year}</div>
    <div class="box">
      <div class="boxTitle">Output tax (Sales)</div>
      <div class="row"><span>Standard-rated supplies (5%)</span><span>${fmt(totals.totalRevenue)}</span></div>
      <div class="row"><span>VAT collected on sales</span><span>${fmt(totals.totalVAT)}</span></div>
      <div class="row"><span>Zero-rated supplies</span><span>AED 0.00</span></div>
      <div class="row"><span>Exempt supplies</span><span>AED 0.00</span></div>
      <div class="rowBig"><span>Total output tax</span><span>${fmt(totals.totalVAT)}</span></div>
    </div>
    <div class="box">
      <div class="boxTitle">Sales breakdown</div>
      <div class="row"><span>Cash sales</span><span>${fmt(totals.cashSales)}</span></div>
      <div class="row"><span>Card sales</span><span>${fmt(totals.cardSales)}</span></div>
      <div class="row"><span>Total transactions</span><span>${totals.orderCount}</span></div>
      <div class="rowBig"><span>Total revenue collected</span><span>${fmt(totals.totalCollection)}</span></div>
    </div>
    <div class="note">This report is generated from BiteERP transaction records. File with FTA by the due date for ${MONTHS[month-1]} ${year}.</div>
    </body></html>`
    const w = window.open('', '_blank')
    w.document.write(html); w.document.close()
    setTimeout(() => w.print(), 300)
  }

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>VAT Report</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>FTA-ready VAT summary from actual POS transactions.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={month} onChange={e => setMonth(+e.target.value)}
            style={{ background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: 'var(--font-body)' }}>
            {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}
            style={{ background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: 'var(--font-body)' }}>
            {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <button onClick={printReport} disabled={!data}
            style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>
            🖨 Print / Export
          </button>
        </div>
      </div>

      {/* Company TRN warning */}
      {!comp?.trn && (
        <div style={{ background: 'rgba(230,126,34,0.08)', border: '0.5px solid rgba(230,126,34,0.3)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: '#e67e22', marginBottom: '1rem' }}>
          ⚠ No TRN set. Go to <strong>Settings → Company</strong> to add your UAE Tax Registration Number.
        </div>
      )}

      {loading ? (
        <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
      ) : data ? (
        <>
          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
            {[
              { label: 'Net revenue',       val: fmt(data.totals.totalRevenue),    color: 'var(--accent)'  },
              { label: 'VAT collected',      val: fmt(data.totals.totalVAT),        color: '#c0392b'        },
              { label: 'Total collected',    val: fmt(data.totals.totalCollection), color: 'var(--text-primary)' },
              { label: 'Cash sales',         val: fmt(data.totals.cashSales),       color: 'var(--text-primary)' },
              { label: 'Card sales',         val: fmt(data.totals.cardSales),       color: 'var(--text-primary)' },
              { label: 'Transactions',       val: data.totals.orderCount,           color: 'var(--text-primary)' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: k.color, marginBottom: 3 }}>{k.val}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* VAT breakdown box */}
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              FTA VAT Return Summary — {MONTHS[month-1]} {year}
            </div>
            {[
              { label: 'Standard-rated supplies (5%)',      val: fmt(data.totals.totalRevenue),    bold: false },
              { label: 'Output tax (VAT collected)',        val: fmt(data.totals.totalVAT),        bold: false, color: '#c0392b' },
              { label: 'Zero-rated supplies',               val: 'AED 0.00',                       bold: false },
              { label: 'Exempt supplies',                   val: 'AED 0.00',                       bold: false },
              { label: 'Input tax (VAT on purchases)',      val: 'AED 0.00',                       bold: false, note: 'Link purchase receipts to accounting' },
              { label: 'Net VAT payable to FTA',            val: fmt(data.totals.totalVAT),        bold: true, color: '#c0392b' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '0.5px solid var(--border)', fontSize: 13, fontWeight: r.bold ? 600 : 400 }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {r.label}
                  {r.note && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>({r.note})</span>}
                </span>
                <span style={{ color: r.color ?? 'var(--text-primary)', fontFamily: r.bold ? 'var(--font-display)' : undefined, fontSize: r.bold ? 16 : undefined }}>{r.val}</span>
              </div>
            ))}
          </div>

          {/* Transaction log */}
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Invoice #','Date','Net (AED)','VAT (AED)','Total (AED)','Method'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.orders.map((o, i) => (
                  <tr key={i}>
                    <td style={{ padding: '9px 12px', fontFamily: 'var(--font-mono)', color: 'var(--accent)', borderBottom: '0.5px solid var(--border)' }}>{o.invoice_number ?? '—'}</td>
                    <td style={{ padding: '9px 12px', fontSize: 11, color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{new Date(o.closed_at).toLocaleDateString('en-AE')}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)' }}>{fmt((n(o.subtotal) - n(o.discount)) / 1.05)}</td>
                    <td style={{ padding: '9px 12px', color: '#c0392b', borderBottom: '0.5px solid var(--border)' }}>{fmt(n(o.vat_amount))}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600, color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)' }}>{fmt(n(o.total))}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '0.5px solid var(--border)' }}>
                      <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{o.payment_method}</span>
                    </td>
                  </tr>
                ))}
                {data.orders.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>
                    No transactions for {MONTHS[month-1]} {year}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
