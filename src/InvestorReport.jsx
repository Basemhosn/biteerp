import { useCallback } from 'react'
import styles from './InvestorReport.module.css'

const n = v => parseFloat(v) || 0

function fmt(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const abs = Math.abs(val)
  let s
  if (abs >= 1_000_000) s = (abs / 1_000_000).toFixed(2) + 'M'
  else if (abs >= 1_000) s = (abs / 1_000).toFixed(1) + 'K'
  else s = Math.round(abs).toString()
  return (val < 0 ? '-AED ' : 'AED ') + s
}

function fmtFull(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return (val < 0 ? '-AED ' : 'AED ') + Math.abs(val).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(part, whole) {
  if (!whole) return '—'
  return Math.round((part / whole) * 100) + '%'
}

export default function InvestorReport({
  period, revenue, gross, netBeforeTax, netAfterTax, totalTax,
  foodCOGS, totalOpex, oneTimeCost, blendedMargin,
  weeklyRev, weeklyCOGS, mult,
  rentVal, salaryVal, techVal, insVal, elecVal, coolingVal, gratuityVal,
  franRevFee, franMktFee, licenceVal,
  taxLines,
  inputs,
}) {
  const date = new Date().toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' })
  const periodLabel = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual' }[period] ?? 'Weekly'

  const annualRev    = weeklyRev  * 52
  const annualNet    = (netAfterTax / mult) * 52
  const annualCOGS   = weeklyCOGS * 52
  const roi          = oneTimeCost > 0 ? Math.round((annualNet / oneTimeCost) * 100) : null
  const paybackWeeks = netAfterTax > 0 ? Math.ceil(oneTimeCost / (netAfterTax / mult)) : null

  const generatePDF = useCallback(() => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>BiteERP — Investor Report</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500;600&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'DM Sans',sans-serif;color:#1a1917;background:#fff;font-size:12px;line-height:1.6}
.cover{background:linear-gradient(135deg,#0a3d3f 0%,#0D7377 100%);color:#f0ede8;padding:60px 48px;min-height:200px}
.cover-tag{font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:#9b9690;margin-bottom:12px}
.cover-title{font-family:'DM Serif Display',serif;font-size:36px;line-height:1.2;margin-bottom:8px}
.cover-sub{font-size:14px;color:#9b9690}
.cover-meta{margin-top:28px;display:flex;gap:32px}
.cover-meta-item{display:flex;flex-direction:column;gap:3px}
.cover-meta-label{font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#5e5b57}
.cover-meta-val{font-family:'DM Serif Display',serif;font-size:22px;color:#5EC4C8}
.cover-meta-sub{font-size:10px;color:#9b9690}
.body{padding:36px 48px}
.sec-title{font-size:9px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#9b9690;margin:28px 0 12px;padding-bottom:6px;border-bottom:0.5px solid #e5e3de}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:8px}
.kpi{border:0.5px solid #e5e3de;border-radius:8px;padding:12px 14px}
.kpi-label{font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#aaa;margin-bottom:4px}
.kpi-val{font-family:'DM Serif Display',serif;font-size:20px}
.kpi-sub{font-size:10px;color:#aaa;margin-top:2px}
.blue{color:#1a5fa0}.green{color:#1a7a50}.red{color:#b84a30}.amber{color:#0a5c60}
table{width:100%;border-collapse:collapse;margin-bottom:4px}
tr{border-bottom:0.5px solid #ede9e3}
td,th{padding:7px 10px}
th{font-size:9px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#aaa;text-align:left}
td:last-child,th:last-child{text-align:right;font-weight:500}
.revenue-row td:last-child{color:#1a5fa0}
.cost-row td:last-child{color:#888}
.profit-row td{background:#f0faf5;font-weight:600}
.profit-row td:last-child{color:#1a7a50}
.loss-row td{background:#fdf1ee;font-weight:600}
.loss-row td:last-child{color:#b84a30}
.tax-row td:last-child{color:#b84a30}
.indent td:first-child{padding-left:22px;color:#666;font-weight:400}
.highlight-box{background:#f7f5f0;border-left:3px solid #0D7377;border-radius:0 6px 6px 0;padding:14px 18px;margin:16px 0}
.highlight-title{font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0a5c60;margin-bottom:6px}
.highlight-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
.highlight-item{display:flex;flex-direction:column;gap:2px}
.highlight-label{font-size:9px;color:#aaa}
.highlight-val{font-size:14px;font-weight:600;color:#0a5c60}
.footer{margin-top:40px;padding-top:14px;border-top:0.5px solid #e5e3de;display:flex;justify-content:space-between;font-size:9px;color:#bbb}
.disclaimer{margin-top:20px;font-size:9px;color:#aaa;line-height:1.6;font-style:italic}
@media print{body{padding:0}.body{padding:28px 36px}}
</style></head><body>

<div class="cover">
  <div class="cover-tag">Confidential — For investor use only</div>
  <div class="cover-title">BiteERP</div>
  <div class="cover-sub">Financial Overview &nbsp;·&nbsp; ${date} &nbsp;·&nbsp; All figures in AED</div>
  <div class="cover-meta">
    <div class="cover-meta-item">
      <span class="cover-meta-label">Annual revenue</span>
      <span class="cover-meta-val">${fmt(annualRev)}</span>
      <span class="cover-meta-sub">projected</span>
    </div>
    <div class="cover-meta-item">
      <span class="cover-meta-label">Net margin</span>
      <span class="cover-meta-val">${pct(netAfterTax / mult, weeklyRev)}</span>
      <span class="cover-meta-sub">after UAE taxes</span>
    </div>
    <div class="cover-meta-item">
      <span class="cover-meta-label">Setup recovery</span>
      <span class="cover-meta-val">${paybackWeeks ? paybackWeeks + ' wks' : 'TBD'}</span>
      <span class="cover-meta-sub">from net profit</span>
    </div>
    ${roi !== null ? `<div class="cover-meta-item"><span class="cover-meta-label">1st year ROI</span><span class="cover-meta-val">${roi}%</span><span class="cover-meta-sub">on setup investment</span></div>` : ''}
  </div>
</div>

<div class="body">
  <div class="sec-title">Key performance indicators — ${periodLabel} view</div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Revenue</div><div class="kpi-val blue">${fmt(revenue)}</div><div class="kpi-sub">COGS ${blendedMargin}% of rev</div></div>
    <div class="kpi"><div class="kpi-label">Gross profit</div><div class="kpi-val ${gross >= 0 ? 'green' : 'red'}">${fmt(gross)}</div><div class="kpi-sub">${pct(gross, revenue)} margin</div></div>
    <div class="kpi"><div class="kpi-label">Net before tax</div><div class="kpi-val ${netBeforeTax >= 0 ? 'green' : 'red'}">${fmt(netBeforeTax)}</div><div class="kpi-sub">${pct(netBeforeTax, revenue)} margin</div></div>
    <div class="kpi"><div class="kpi-label">Net after tax</div><div class="kpi-val ${netAfterTax >= 0 ? 'green' : 'red'}">${fmt(netAfterTax)}</div><div class="kpi-sub">${pct(netAfterTax, revenue)} margin</div></div>
  </div>

  <div class="highlight-box">
    <div class="highlight-title">Investment summary</div>
    <div class="highlight-grid">
      <div class="highlight-item"><span class="highlight-label">Total setup investment</span><span class="highlight-val">${fmtFull(oneTimeCost)}</span></div>
      <div class="highlight-item"><span class="highlight-label">Projected annual net</span><span class="highlight-val">${fmt(annualNet)}</span></div>
      <div class="highlight-item"><span class="highlight-label">Break-even timeline</span><span class="highlight-val">${paybackWeeks ? paybackWeeks + ' weeks' : 'Not yet profitable'}</span></div>
    </div>
  </div>

  <div class="sec-title">Revenue breakdown</div>
  <table>
    <tr class="revenue-row indent"><td>Hot Food / Shawarma / Deli</td><td>${fmtFull(n(inputs?.deliCost) * (1 + n(inputs?.deliMarkup) / 100) * mult)}</td></tr>
    <tr class="revenue-row indent"><td>Fresh Juices & Smoothies</td><td>${fmtFull(n(inputs?.alcCost) * (1 + n(inputs?.alcMarkup) / 100) * mult)}</td></tr>
    <tr class="revenue-row indent"><td>Beverages (non-alcoholic)</td><td>${fmtFull(n(inputs?.bevCost) * (1 + n(inputs?.bevMarkup) / 100) * mult)}</td></tr>
    <tr class="revenue-row indent"><td>Snacks & Confectionery</td><td>${fmtFull(n(inputs?.snackCost) * (1 + n(inputs?.snackMarkup) / 100) * mult)}</td></tr>
    <tr class="revenue-row indent"><td>Grocery & Household</td><td>${fmtFull(n(inputs?.grocCost) * (1 + n(inputs?.grocMarkup) / 100) * mult)}</td></tr>
    <tr class="${gross >= 0 ? 'profit' : 'loss'}-row"><td><strong>Total Revenue</strong></td><td>${fmtFull(revenue)}</td></tr>
  </table>

  <div class="sec-title">Profit & loss statement</div>
  <table>
    <tr><th>Line item</th><th>${periodLabel}</th></tr>
    <tr class="revenue-row"><td>Total Revenue</td><td>${fmtFull(revenue)}</td></tr>
    <tr class="cost-row indent"><td>Cost of Goods Sold</td><td>(${fmtFull(foodCOGS)})</td></tr>
    <tr class="${gross >= 0 ? 'profit' : 'loss'}-row"><td><strong>Gross Profit</strong></td><td>${fmtFull(gross)}</td></tr>
    <tr class="cost-row indent"><td>Franchise fees (revenue + marketing)</td><td>(${fmtFull(franRevFee + franMktFee)})</td></tr>
    <tr class="cost-row indent"><td>Rent</td><td>(${fmtFull(rentVal)})</td></tr>
    <tr class="cost-row indent"><td>Staff salaries</td><td>(${fmtFull(salaryVal)})</td></tr>
    <tr class="cost-row indent"><td>DEWA Electricity</td><td>(${fmtFull(elecVal)})</td></tr>
    <tr class="cost-row indent"><td>District Cooling</td><td>(${fmtFull(coolingVal)})</td></tr>
    <tr class="cost-row indent"><td>Technology / POS</td><td>(${fmtFull(techVal)})</td></tr>
    <tr class="cost-row indent"><td>Insurance</td><td>(${fmtFull(insVal)})</td></tr>
    <tr class="cost-row indent"><td>EoS Gratuity Provision</td><td>(${fmtFull(gratuityVal)})</td></tr>
    <tr class="cost-row indent"><td>Trade Licence (pro-rated)</td><td>(${fmtFull(licenceVal)})</td></tr>
    <tr class="cost-row indent"><td>Fit-out / Setup (one-time)</td><td>(${fmtFull(oneTimeCost)})</td></tr>
    <tr class="${netBeforeTax >= 0 ? 'profit' : 'loss'}-row"><td><strong>Net Before Tax</strong></td><td>${fmtFull(netBeforeTax)}</td></tr>
    ${taxLines?.map(t => `<tr class="tax-row indent"><td>${t.label}</td><td>(${fmtFull(t.amount)})</td></tr>`).join('') ?? ''}
    <tr class="tax-row"><td><strong>Total UAE Tax & Levies</strong></td><td>(${fmtFull(totalTax)})</td></tr>
    <tr class="${netAfterTax >= 0 ? 'profit' : 'loss'}-row"><td><strong>Net After Tax</strong></td><td>${fmtFull(netAfterTax)}</td></tr>
  </table>

  <div class="sec-title">UAE regulatory overview</div>
  <table>
    <tr><th>Obligation</th><th>Rate / Detail</th></tr>
    <tr><td>Corporate Tax</td><td>9% on taxable profit above AED 375,000</td></tr>
    <tr><td>VAT (standard rated)</td><td>5% on prepared food, beverages, snacks</td></tr>
    <tr><td>VAT (zero rated)</td><td>0% on basic grocery / fresh produce</td></tr>
    <tr><td>Municipality Fee</td><td>5% levy</td></tr>
    <tr><td>End-of-Service Gratuity</td><td>21 days per year for first 5 years (UAE Labour Law)</td></tr>
    <tr><td>Mandatory Medical Insurance</td><td>Required for all employees (DHA regulation)</td></tr>
    <tr><td>Wages Protection System</td><td>WPS compliance required for all payroll</td></tr>
  </table>

  <div class="disclaimer">
    This report has been generated from the BiteERP tool and is based on projected figures entered by the operator.
    All amounts are in UAE Dirhams (AED). This document is confidential and intended solely for the named recipient.
    It does not constitute financial advice. Actual results may differ materially from projections.
  </div>

  <div class="footer">
    <span>BiteERP · UAE · Confidential</span>
    <span>Generated ${date}</span>
  </div>
</div>
</body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 700)
  }, [revenue, gross, netBeforeTax, netAfterTax, totalTax, foodCOGS, totalOpex, oneTimeCost, weeklyRev, weeklyCOGS, mult, period, taxLines, inputs, annualRev, annualNet, roi, paybackWeeks, rentVal, salaryVal, techVal, insVal, elecVal, coolingVal, gratuityVal, franRevFee, franMktFee, licenceVal])

  const annualNetCalc  = (netAfterTax / mult) * 52
  const grossMarginPct = revenue > 0 ? Math.round((gross / revenue) * 100) : 0
  const netMarginPct   = revenue > 0 ? Math.round((netAfterTax / revenue) * 100) : 0

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Investor / partner report</h2>
          <p className={styles.pageSub}>One-click PDF formatted for presenting to investors, bank managers, or business partners. Pulls live from your Calculator.</p>
        </div>
        <button className={styles.pdfBtn} onClick={generatePDF}>
          <span>↓</span> Generate PDF
        </button>
      </div>

      {/* Preview card */}
      <div className={styles.previewCard}>
        <div className={styles.previewHeader}>
          <div>
            <div className={styles.previewTitle}>BiteERP</div>
            <div className={styles.previewSub}>Financial Overview · {date} · AED</div>
          </div>
          <div className={styles.previewBadge}>{periodLabel} view</div>
        </div>

        <div className={styles.kpiRow}>
          {[
            { label: 'Revenue',       val: fmt(revenue),     sub: `COGS ${blendedMargin}%`,         color: '#6a9fcb' },
            { label: 'Gross profit',  val: fmt(gross),       sub: grossMarginPct + '% margin',      color: gross >= 0 ? '#5db88a' : '#d47060' },
            { label: 'Net after tax', val: fmt(netAfterTax), sub: netMarginPct + '% margin',        color: netAfterTax >= 0 ? '#5db88a' : '#d47060' },
            { label: 'Annual net',    val: fmt(annualNetCalc), sub: 'projected',                    color: annualNetCalc >= 0 ? '#5db88a' : '#d47060' },
            { label: 'Setup invest.', val: fmt(oneTimeCost), sub: paybackWeeks ? paybackWeeks + ' wk recovery' : '—', color: '#0D7377' },
            { label: 'Est. 1yr ROI',  val: roi !== null ? roi + '%' : '—', sub: 'on setup cost',   color: roi > 0 ? '#5db88a' : '#d47060' },
          ].map(({ label, val, sub, color }) => (
            <div key={label} className={styles.kpiCard}>
              <span className={styles.kpiLabel}>{label}</span>
              <span className={styles.kpiVal} style={{ color }}>{val}</span>
              <span className={styles.kpiSub}>{sub}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.infoRow}>
        <div className={styles.infoCard}>
          <div className={styles.infoTitle}>What's included in the PDF</div>
          {[
            'Cover page with headline KPIs',
            'Investment summary with break-even timeline',
            'Full revenue breakdown by category',
            'Complete P&L statement',
            'UAE regulatory & tax overview',
            'Confidentiality disclaimer',
          ].map(item => (
            <div key={item} className={styles.infoItem}>
              <span className={styles.infoCheck}>✓</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
        <div className={styles.infoCard}>
          <div className={styles.infoTitle}>Before sharing</div>
          {[
            'Review all Calculator inputs are up to date',
            'Verify your period setting (weekly vs monthly)',
            'Consult a UAE-licensed accountant for final figures',
            'This report is based on projections, not audited accounts',
            'Mark as confidential when distributing',
          ].map(item => (
            <div key={item} className={styles.infoItem}>
              <span className={styles.infoWarn}>!</span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
