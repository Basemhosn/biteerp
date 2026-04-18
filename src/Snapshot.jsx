import { useState } from 'react'
import styles from './Snapshot.module.css'

function fmt(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const abs = Math.abs(val)
  let s
  if (abs >= 1_000_000) s = (abs / 1_000_000).toFixed(2) + 'M'
  else if (abs >= 1_000) s = (abs / 1_000).toFixed(1) + 'K'
  else s = Math.round(abs).toString()
  return (val < 0 ? '-AED ' : 'AED ') + s
}

export default function Snapshot({
  // All the current calc state
  period, revenue, gross, netBeforeTax, netAfterTax, totalTax,
  foodCOGS, totalOpex, oneTimeCost, blendedMargin,
  deliRevWk, alcRevWk, bevRevWk, snackRevWk, grocRevWk,
  weeklyRev, weeklyCOGS,
  rentVal, salaryVal, equityVal, techVal, insVal, elecVal, gasVal, dblVal,
  keyfoodRevFee, keyfoodMktFee,
  taxLines, mult,
  // raw inputs for encoding
  inputs,
}) {
  const [copied, setCopied] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const periodLabel = { weekly: '/wk', monthly: '/mo', quarterly: '/qtr', annual: '/yr' }[period]
  const periodName  = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', annual: 'Annual' }[period]
  const date = new Date().toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' })

  // Encode all inputs into a base64 URL param
  const generateURL = () => {
    const payload = btoa(JSON.stringify({ ...inputs, period, ts: Date.now() }))
    const url = `${window.location.origin}${window.location.pathname}?snapshot=${payload}`
    return url
  }

  const copyLink = async () => {
    const url = generateURL()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const pctOf = (part, whole) => whole > 0 ? Math.round((part / whole) * 100) + '%' : '—'

  const sections = [
    {
      title: 'Revenue',
      rows: [
        { label: 'Deli / Grab n Go / Hot Bar', val: deliRevWk  * mult, color: '#0D7377' },
        { label: 'Alcohol',                     val: alcRevWk   * mult, color: '#6a9fcb' },
        { label: 'Bev (non-alcoholic)',          val: bevRevWk   * mult, color: '#5db88a' },
        { label: 'Snacks',                       val: snackRevWk * mult, color: '#d47060' },
        { label: 'Grocery',                      val: grocRevWk  * mult, color: '#9b85c4' },
        { label: 'Total Revenue', val: revenue, bold: true, color: '#6a9fcb' },
      ],
    },
    {
      title: 'Cost of goods sold',
      rows: [
        { label: 'Total COGS', val: -foodCOGS, color: '#d47060' },
        { label: 'Gross Profit', val: gross, bold: true, color: gross >= 0 ? '#5db88a' : '#d47060' },
        { label: 'Gross margin', val: pctOf(gross, revenue), isText: true },
      ],
    },
    {
      title: 'Operating expenses',
      rows: [
        { label: `Keyfood Revenue Share`,   val: -keyfoodRevFee,  color: '#d47060' },
        { label: `Keyfood Marketing Share`, val: -keyfoodMktFee,  color: '#d47060' },
        { label: 'Rent',                    val: -rentVal,         color: '#d47060' },
        { label: 'Salary',                  val: -salaryVal,       color: '#d47060' },
        { label: 'Technology',              val: -techVal,         color: '#d47060' },
        { label: 'Employee Insurance',      val: -insVal,          color: '#d47060' },
        { label: 'Electricity',             val: -elecVal,         color: '#d47060' },
        { label: 'Gas',                     val: -gasVal,          color: '#d47060' },
        { label: 'DBL',                     val: -dblVal,          color: '#d47060' },
        { label: 'Co-op Equity (annual)',   val: -equityVal,       color: '#d47060' },
        { label: 'Initiation (one-time)',   val: -oneTimeCost,     color: '#888' },
        { label: 'Net Before Tax', val: netBeforeTax, bold: true, color: netBeforeTax >= 0 ? '#5db88a' : '#d47060' },
      ],
    },
    {
      title: 'Taxes',
      rows: [
        ...taxLines.map(t => ({ label: `${t.label} (${(t.rate*100).toFixed(2)}%)`, val: -t.amount, color: '#d47060' })),
        { label: 'Net After Tax', val: netAfterTax, bold: true, color: netAfterTax >= 0 ? '#5db88a' : '#d47060' },
        { label: 'Net margin', val: pctOf(netAfterTax, revenue), isText: true },
      ],
    },
  ]

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Shareable snapshot</h2>
          <p className={styles.pageSub}>Generate a read-only link with your current numbers. Anyone with the link can view the snapshot — no editing access.</p>
        </div>
        <div className={styles.actions}>
          <button className={styles.previewBtn} onClick={() => setShowPreview(v => !v)}>
            {showPreview ? 'Hide preview' : 'Preview snapshot'}
          </button>
          <button className={`${styles.copyBtn} ${copied ? styles.copied : ''}`} onClick={copyLink}>
            {copied ? '✓ Link copied!' : '⤴ Copy shareable link'}
          </button>
        </div>
      </div>

      {/* Info card */}
      <div className={styles.infoCard}>
        <div className={styles.infoIcon}>ℹ</div>
        <div>
          <p className={styles.infoText}>The link encodes all your current calculator inputs into the URL. Recipients see a frozen read-only view — changes you make later won't affect the shared link. Share it with your Keyfood rep, investors, or co-op partners.</p>
          <p className={styles.infoPIN} style={{ marginTop: 6 }}>Note: The shared link bypasses the PIN lock so recipients can view without a password.</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className={styles.statsGrid}>
        {[
          { label: 'Period',         val: periodName,              color: 'var(--text-primary)' },
          { label: 'Revenue',        val: fmt(revenue),            color: '#6a9fcb' },
          { label: 'Gross profit',   val: fmt(gross),              color: gross >= 0 ? '#5db88a' : '#d47060' },
          { label: 'Net after tax',  val: fmt(netAfterTax),        color: netAfterTax >= 0 ? '#5db88a' : '#d47060' },
          { label: 'Gross margin',   val: pctOf(gross, revenue),   color: 'var(--text-primary)' },
          { label: 'Net margin',     val: pctOf(netAfterTax, revenue), color: 'var(--text-primary)' },
        ].map(({ label, val, color }) => (
          <div key={label} className={styles.statCard}>
            <span className={styles.statLabel}>{label}</span>
            <span className={styles.statVal} style={{ color }}>{val}</span>
          </div>
        ))}
      </div>

      {/* Preview */}
      {showPreview && (
        <div className={styles.preview}>
          <div className={styles.previewHeader}>
            <div className={styles.previewLogoRow}>
              <img src="/logo.png" alt="" className={styles.previewLogo} />
              <div>
                <div className={styles.previewTitle}>BiteERP</div>
                <div className={styles.previewMeta}>P&L Snapshot · {periodName} View · {date}</div>
              </div>
            </div>
            <span className={styles.previewBadge}>Read-only</span>
          </div>

          {sections.map(sec => (
            <div key={sec.title} className={styles.previewSection}>
              <div className={styles.previewSectionTitle}>{sec.title}</div>
              {sec.rows.map(row => (
                <div key={row.label} className={`${styles.previewRow} ${row.bold ? styles.previewRowBold : ''}`}>
                  <span className={styles.previewRowLabel}>{row.label}</span>
                  <span className={styles.previewRowVal} style={{ color: row.color }}>
                    {row.isText ? row.val : fmt(row.val)}
                  </span>
                </div>
              ))}
            </div>
          ))}

          <div className={styles.previewFooter}>
            Generated {date} · BiteERP · UAE · Est. 2025
          </div>
        </div>
      )}
    </div>
  )
}
