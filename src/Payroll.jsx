import { useState } from 'react'
import styles from './Payroll.module.css'

const n = v => parseFloat(v) || 0

function fmt(val) {
  if (!val && val !== 0) return '—'
  return (val < 0 ? '-AED ' : 'AED ') + Math.abs(val).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// UAE: No income tax, no SS for expats
// Employer costs: End-of-service gratuity provision, medical insurance (mandatory)
// GPSSA applies only to UAE nationals (employer 12.5%, employee 5%)
// We model a typical expat-majority workforce (most retail staff in Dubai are expats)
const UAE_EMPLOYER_COSTS = [
  { key: 'medical',   label: 'Mandatory Medical Insurance (est.)',  rate: 0.08   },  // ~8% of salary
  { key: 'wps',       label: 'WPS Admin / Banking Fee (est.)',      rate: 0.005  },  // Wages Protection System
]

function calcEmployee({ role, count, rate, hoursPerWeek = 48, gratuityRate = 500 }) {
  const weeklyGross = n(rate) * n(hoursPerWeek)
  const annualGross = weeklyGross * 52

  // UAE: No income tax, no employee SS deductions for expats
  // Only deduction: voluntary savings / company policy (none by default)
  const totalDeduct = 0
  const weeklyNet   = weeklyGross - totalDeduct

  // Employer burden
  const empTaxes       = UAE_EMPLOYER_COSTS.reduce((s, t) => s + weeklyGross * t.rate, 0)
  const gratuityWeekly = n(gratuityRate) / 4.33
  const totalEmployerCost = weeklyGross + empTaxes + gratuityWeekly

  return {
    role, count: n(count), rate: n(rate), hoursPerWeek: n(hoursPerWeek),
    weeklyGross, annualGross,
    totalDeduct, weeklyNet, empTaxes, gratuityWeekly, totalEmployerCost,
  }
}

export default function Payroll({ cashiers, cashierRate, cooks, cookRate, stockBoys, stockRate, dblRate }) {
  const [hoursOverride, setHoursOverride] = useState({ cashiers: '48', cooks: '48', stockBoys: '48' })

  const roles = [
    { key: 'cashiers',  role: 'Cashiers',     count: cashiers,  rate: cashierRate, hoursKey: 'cashiers'  },
    { key: 'cooks',     role: 'Cooks / Deli', count: cooks,     rate: cookRate,    hoursKey: 'cooks'     },
    { key: 'stockBoys', role: 'Stock Boys',   count: stockBoys, rate: stockRate,   hoursKey: 'stockBoys' },
  ]

  const calcs = roles.map(r => calcEmployee({
    role: r.role, count: r.count, rate: r.rate,
    hoursPerWeek: hoursOverride[r.hoursKey],
    gratuityRate: dblRate,
  }))

  const totals = {
    count:             calcs.reduce((s, c) => s + c.count, 0),
    weeklyGross:       calcs.reduce((s, c) => s + c.weeklyGross * c.count, 0),
    totalDeduct:       calcs.reduce((s, c) => s + c.totalDeduct * c.count, 0),
    weeklyNet:         calcs.reduce((s, c) => s + c.weeklyNet * c.count, 0),
    empTaxes:          calcs.reduce((s, c) => s + (c.empTaxes + c.gratuityWeekly) * c.count, 0),
    totalEmployerCost: calcs.reduce((s, c) => s + c.totalEmployerCost * c.count, 0),
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Payroll summary</h2>
          <p className={styles.pageSub}>Weekly payroll breakdown per role — UAE labour law. No income tax for expat employees. Gratuity provision per UAE Labour Law (21 days/year for first 5 years). Medical insurance mandatory under DHA regulations.</p>
        </div>
      </div>

      <div className={styles.summaryRow}>
        {[
          { label: 'Total employees',       val: totals.count,             color: '#6a9fcb', isMoney: false },
          { label: 'Weekly gross payroll',  val: totals.weeklyGross,       color: '#0D7377', isMoney: true  },
          { label: 'Total withholdings',    val: totals.totalDeduct,       color: '#d47060', isMoney: true  },
          { label: 'Total net take-home',   val: totals.weeklyNet,         color: '#5db88a', isMoney: true  },
          { label: 'Employer burden',       val: totals.empTaxes,          color: '#9b85c4', isMoney: true  },
          { label: 'Total employer cost',   val: totals.totalEmployerCost, color: '#d47060', isMoney: true  },
        ].map(({ label, val, color, isMoney }) => (
          <div key={label} className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{label}</span>
            <span className={styles.summaryVal} style={{ color }}>{isMoney ? fmt(val) : val}</span>
            <span className={styles.summarySub}>weekly</span>
          </div>
        ))}
      </div>

      {calcs.map((c, i) => (
        <div key={c.role} className={styles.roleCard}>
          <div className={styles.roleHeader}>
            <span className={styles.roleTitle}>{c.role}</span>
            <div className={styles.roleHours}>
              <span className={styles.roleHoursLabel}>Hrs/week:</span>
              <input
                type="number" min="1" max="60"
                value={hoursOverride[roles[i].hoursKey]}
                onChange={e => setHoursOverride(p => ({ ...p, [roles[i].hoursKey]: e.target.value }))}
                className={styles.hoursInput}
              />
            </div>
            <span className={styles.roleCount}>{c.count} employee{c.count !== 1 ? 's' : ''} · AED {c.rate}/hr</span>
          </div>

          <div className={styles.roleTable}>
            <div className={styles.roleTableHead}>
              <span>Item</span>
              <span>Per employee / wk</span>
              <span>All {c.role} / wk</span>
            </div>
            {[
              { label: 'Gross pay (no income tax — UAE)',        val: c.weeklyGross,        total: c.weeklyGross * c.count,        color: '#0D7377' },
              { label: '✓ Take-home (same as gross for expats)', val: c.weeklyNet,          total: c.weeklyNet * c.count,          color: '#5db88a', bold: true },
              { label: '+ Medical insurance provision (8%)',     val: c.empTaxes * (0.08 / (0.08 + 0.005)), total: c.empTaxes * c.count * (0.08 / (0.08 + 0.005)), color: '#9b85c4' },
              { label: '+ WPS admin fee (0.5%)',                 val: c.empTaxes * (0.005 / (0.08 + 0.005)), total: c.empTaxes * c.count * (0.005 / (0.08 + 0.005)), color: '#9b85c4' },
              { label: '+ EoS gratuity provision',               val: c.gratuityWeekly,     total: c.gratuityWeekly * c.count,     color: '#9b85c4' },
              { label: 'Total employer cost',                    val: c.totalEmployerCost,  total: c.totalEmployerCost * c.count,  color: '#d47060', bold: true },
            ].map(({ label, val, total, color, bold }) => (
              <div key={label} className={styles.roleTableRow}>
                <span style={{ fontWeight: bold ? 500 : 400, color: bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</span>
                <span style={{ color, fontWeight: bold ? 500 : 400 }}>{fmt(val)}</span>
                <span style={{ color, fontWeight: bold ? 500 : 400 }}>{fmt(total)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className={styles.taxCard}>
        <div className={styles.taxTitle}>Employer cost breakdown (per employee per week) — UAE Labour Law</div>
        <div className={styles.taxGrid}>
          {UAE_EMPLOYER_COSTS.map(t => (
            <div key={t.key} className={styles.taxRow}>
              <span className={styles.taxLabel}>{t.label}</span>
              <div className={styles.taxBars}>
                {calcs.map(c => (
                  <div key={c.role} className={styles.taxBarItem}>
                    <span className={styles.taxBarRole}>{c.role}</span>
                    <span className={styles.taxBarAmt}>{fmt(c.weeklyGross * t.rate)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className={styles.taxRow}>
            <span className={styles.taxLabel}>EoS Gratuity Provision (monthly AED {n(dblRate)}/staff)</span>
            <div className={styles.taxBars}>
              {calcs.map(c => (
                <div key={c.role} className={styles.taxBarItem}>
                  <span className={styles.taxBarRole}>{c.role}</span>
                  <span className={styles.taxBarAmt}>{fmt(c.gratuityWeekly)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
