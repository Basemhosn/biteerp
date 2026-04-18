import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import styles from './App.module.css'
import Dashboard from './Dashboard.jsx'
import LiveDashboard from './LiveDashboard.jsx'
import Scenarios from './Scenarios.jsx'
import BreakevenChart from './BreakevenChart.jsx'
import Payroll from './Payroll.jsx'
import Loan from './Loan.jsx'
import Cashflow from './Cashflow.jsx'
import Growth from './Growth.jsx'
import Login, { ChangePinModal } from './Login.jsx'
import Snapshot from './Snapshot.jsx'
import { useAutoSave } from './useAutoSave.js'
import POSTerminal from './POSTerminal.jsx'
import PromotionsManager from './PromotionsManager.jsx'
import VATReport from './VATReport.jsx'
import Customers from './Customers.jsx'
import ContactsApp from './ContactsApp.jsx'
import ImportApp from './ImportApp.jsx'
import MultiBranch from './MultiBranch.jsx'
import InvoicesModule from './InvoicesModule.jsx'
import AccountingDashboard from './AccountingDashboard.jsx'
import BankReconciliation from './BankReconciliation.jsx'
import StaffModule from './StaffModule.jsx'
import UsersAccess from './UsersAccess.jsx'
import Chatter from './Chatter.jsx'
import AuditTrail from './AuditTrail.jsx'
import POSPermissions from './POSPermissions.jsx'
import HardwareSettings from './HardwareSettings.jsx'
import AppHome from './AppHome.jsx'
import Settings from './Settings.jsx'
import RecipeEngine from './RecipeEngine.jsx'
import Inventory from './Inventory.jsx'
import PurchaseOrders from './PurchaseOrders.jsx'
import Accounting from './Accounting.jsx'
import MenuBuilder from './MenuBuilder.jsx'
import TableManager from './TableManager.jsx'
import { signOut, loadCalculatorState } from './supabase.js'
import { useOnlineStatus } from './useOnlineStatus.js'
import { LANGUAGES, useTranslation, t as translate } from './i18n.js'
import VATSummary from './VATSummary.jsx'
import SupplierTracker from './SupplierTracker.jsx'
import WastageTracker from './WastageTracker.jsx'
import PLHistory from './PLHistory.jsx'
import InvestorReport from './InvestorReport.jsx'
import DailySalesLog from './DailySalesLog.jsx'
import StaffScheduler from './StaffScheduler.jsx'
import ExpenseTracker from './ExpenseTracker.jsx'
import CategoryBreakeven from './CategoryBreakeven.jsx'
import CurrencyConverter from './CurrencyConverter.jsx'
import RamadanMode from './RamadanMode.jsx'
import CompetitorBenchmarks from './CompetitorBenchmarks.jsx'
import EODReport from './EODReport.jsx'
import DeliveryOrders from './DeliveryOrders.jsx'
import Onboarding from './Onboarding.jsx'
import NotificationBell from './NotificationBell.jsx'

const PERIODS = [
  { key: 'weekly',    label: 'Weekly',    mult: 1    },
  { key: 'monthly',   label: 'Monthly',   mult: 4.33 },
  { key: 'quarterly', label: 'Quarterly', mult: 13   },
  { key: 'annual',    label: 'Annual',    mult: 52   },
]

// UAE Tax Structure
const TAXES = [
  { key: 'corpTax',  label: 'UAE Corporate Tax (9%)',         rate: 0.09   },
  { key: 'vat',      label: 'VAT on taxable supplies (5%)',   rate: 0.05   },
  { key: 'municFee', label: 'Municipality Fee (5%)',          rate: 0.05   },
  { key: 'gpssa',    label: 'GPSSA Employer Contrib. (est.)', rate: 0.0375 },
]

const n = v => parseFloat(v) || 0

function fmt(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const abs = Math.abs(val)
  let s
  if (abs >= 1_000_000) s = (abs / 1_000_000).toFixed(2) + 'M'
  else if (abs >= 1_000)  s = (abs / 1_000).toFixed(1) + 'K'
  else                    s = Math.round(abs).toString()
  return (val < 0 ? '-AED ' : 'AED ') + s
}

function fmtFull(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return (val < 0 ? '-AED ' : 'AED ') + Math.abs(val).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(part, whole) {
  if (!whole) return null
  return Math.round((part / whole) * 100) + '%'
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div className={styles.metricCard} data-color={color}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue} data-color={color}>{value || '—'}</span>
      {sub && <span className={styles.metricSub}>{sub}</span>}
    </div>
  )
}

function BRow({ label, value, variant, pill, indent }) {
  return (
    <div className={styles.brow} data-variant={variant}>
      <span className={styles.browLabel}>
        {indent && <span className={styles.browIndent} />}
        {label}
        {pill && <span className={styles.pill}>{pill}</span>}
      </span>
      <span className={styles.browValue} data-variant={variant}>{value || '—'}</span>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [period, setPeriod] = useState('weekly')
  const [tab, setTab] = useState('home')
  const [theme, setTheme] = useState(() => localStorage.getItem('biteerp-theme') ?? 'dark')
  const [lang,  setLang]  = useState(() => typeof window !== 'undefined' ? (localStorage.getItem('biteerp-lang') ?? 'en') : 'en')
  const [activeBranch, setActiveBranch] = useState(null) // { id, name } of selected branch
  const [chatterOpen, setChatterOpen]   = useState(false)
  const [langMenuOpen, setLangMenuOpen]  = useState(false)
  const langMenuRef = useRef(null)
  const { isOnline, isSyncing, pendingCnt, syncQueue } = useOnlineStatus()
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const setLanguage = (code) => {
    const langDef = LANGUAGES.find(l => l.code === code) ?? LANGUAGES[0]
    setLang(code)
    localStorage.setItem('biteerp-lang', code)
    document.documentElement.setAttribute('lang', code)
    document.documentElement.setAttribute('dir', langDef.dir)
    // Save to profile if logged in
    if (session?.userId) {
      import('./supabase.js').then(({ updateProfile }) =>
        updateProfile(session.userId, { lang_preference: code }).catch(() => {})
      )
    }
  }
  const toggleLang = () => {
    const idx  = LANGUAGES.findIndex(l => l.code === lang)
    const next = LANGUAGES[(idx + 1) % LANGUAGES.length]
    setLanguage(next.code)
  }

  // Close lang menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target)) setLangMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Apply lang/dir on mount
  useEffect(() => {
    document.documentElement.setAttribute('lang', lang)
    const langDef = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0]
    document.documentElement.setAttribute('dir', langDef.dir)
  }, [lang])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('biteerp-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }
  const [showChangePIN, setShowChangePIN] = useState(false)

  const handleLogin = (sess) => {
    setSession(sess)
    // Apply user's saved language preference
    if (sess?.lang && sess.lang !== lang) setLanguage(sess.lang)
    // Ping online status on login
    if (sess?.userId) {
      import('./supabase.js').then(({ pingOnline }) => {
        pingOnline(sess.userId).catch(() => {})
        setInterval(() => pingOnline(sess.userId).catch(() => {}), 60_000)
      })
    }
    if (sess?.userId) { import('./supabase.js').then(m => m.pingOnline(sess.userId)).catch(()=>{}) }
    // Load calculator state from Supabase
    if (sess.restaurantId) {
      loadCalculatorState(sess.restaurantId).then(state => {
        if (!state) return
        const s = state
      if (s.period)       setPeriod(s.period)
      if (s.initCost)     setInitCost(s.initCost)
      if (s.licenceCost)  setLicenceCost(s.licenceCost)
      if (s.deliCost)     setDeliCost(s.deliCost)
      if (s.deliMarkup)   setDeliMarkup(s.deliMarkup)
      if (s.juiceCost)    setJuiceCost(s.juiceCost)
      if (s.juiceMarkup)  setJuiceMarkup(s.juiceMarkup)
      if (s.bevCost)      setBevCost(s.bevCost)
      if (s.bevMarkup)    setBevMarkup(s.bevMarkup)
      if (s.snackCost)    setSnackCost(s.snackCost)
      if (s.snackMarkup)  setSnackMarkup(s.snackMarkup)
      if (s.grocCost)     setGrocCost(s.grocCost)
      if (s.grocMarkup)   setGrocMarkup(s.grocMarkup)
      if (s.rentCost)     setRentCost(s.rentCost)
      if (s.techCost)     setTechCost(s.techCost)
      if (s.insCost)      setInsCost(s.insCost)
      if (s.elecCost)     setElecCost(s.elecCost)
      if (s.coolingCost)  setCoolingCost(s.coolingCost)
      if (s.franRev)      setFranRev(s.franRev)
      if (s.franMkt)      setFranMkt(s.franMkt)
      if (s.cashiers)     setCashiers(s.cashiers)
      if (s.cashierRate)  setCashierRate(s.cashierRate)
      if (s.cooks)        setCooks(s.cooks)
      if (s.cookRate)     setCookRate(s.cookRate)
      if (s.stockBoys)    setStockBoys(s.stockBoys)
      if (s.stockRate)    setStockRate(s.stockRate)
      if (s.gratuityRate) setGratuityRate(s.gratuityRate)
      if (s.categories && Array.isArray(s.categories) && s.categories.length > 0) setCategories(s.categories)
      }).catch(() => {})
    }
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const [initCost,     setInitCost]     = useState('150000')
  const [licenceCost,  setLicenceCost]  = useState('35000')

  const DEFAULT_CATS = [
    { id: 'deli',  name: 'Hot Food / Deli',    cost: '25000', markup: '55'  },
    { id: 'juice', name: 'Fresh Juices',        cost: '6000',  markup: '200' },
    { id: 'bev',   name: 'Beverages',           cost: '8000',  markup: '120' },
    { id: 'snack', name: 'Snacks',              cost: '10000', markup: '80'  },
    { id: 'groc',  name: 'Grocery',             cost: '12000', markup: '35'  },
  ]
  const [categories, setCategories] = useState(DEFAULT_CATS)

  // Legacy aliases for backward compat with downstream components
  const deliCost    = categories[0]?.cost    ?? '0'
  const deliMarkup  = categories[0]?.markup  ?? '0'
  const juiceCost   = categories[1]?.cost    ?? '0'
  const juiceMarkup = categories[1]?.markup  ?? '0'
  const bevCost     = categories[2]?.cost    ?? '0'
  const bevMarkup   = categories[2]?.markup  ?? '0'
  const snackCost   = categories[3]?.cost    ?? '0'
  const snackMarkup = categories[3]?.markup  ?? '0'
  const grocCost    = categories[4]?.cost    ?? '0'
  const grocMarkup  = categories[4]?.markup  ?? '0'

  const [rentCost,    setRentCost]    = useState('5500')
  const [techCost,    setTechCost]    = useState('2000')
  const [insCost,     setInsCost]     = useState('3500')
  const [elecCost,    setElecCost]    = useState('9000')
  const [coolingCost, setCoolingCost] = useState('5000')

  const [franRev, setFranRev] = useState('2.5')
  const [franMkt, setFranMkt] = useState('1.5')

  const [cashiers,     setCashiers]     = useState('3')
  const [cashierRate,  setCashierRate]  = useState('18')
  const [cooks,        setCooks]        = useState('4')
  const [cookRate,     setCookRate]     = useState('25')
  const [stockBoys,    setStockBoys]    = useState('2')
  const [stockRate,    setStockRate]    = useState('15')
  const [gratuityRate, setGratuityRate] = useState('500')

  const mult = PERIODS.find(p => p.key === period)?.mult ?? 1
  const periodLabel = { weekly: '/wk', monthly: '/mo', quarterly: '/qtr', annual: '/yr' }[period]

  // Dynamic category calculations
  const catRevenues = categories.map(c => n(c.cost) * (1 + n(c.markup) / 100))
  const weeklyRev   = catRevenues.reduce((s, r) => s + r, 0)
  const weeklyCOGS  = categories.reduce((s, c) => s + n(c.cost), 0)

  // Legacy aliases for downstream components
  const deliRevWk  = catRevenues[0] ?? 0
  const juiceRevWk = catRevenues[1] ?? 0
  const bevRevWk   = catRevenues[2] ?? 0
  const snackRevWk = catRevenues[3] ?? 0
  const grocRevWk  = catRevenues[4] ?? 0

  const revenue  = weeklyRev  * mult
  const foodCOGS = weeklyCOGS * mult
  const gross    = revenue - foodCOGS

  const franRevFee = revenue * (n(franRev) / 100)
  const franMktFee = revenue * (n(franMkt) / 100)

  const moToMult   = mo => (n(mo) / 4.33) * mult
  const rentVal    = n(rentCost)    * mult
  const techVal    = moToMult(techCost)
  const insVal     = moToMult(insCost)
  const elecVal    = moToMult(elecCost)
  const coolingVal = moToMult(coolingCost)

  // UAE: 48 hrs/week standard work week
  const cashierWk = n(cashiers)  * n(cashierRate) * 48
  const cookWk    = n(cooks)     * n(cookRate)    * 48
  const stockWk   = n(stockBoys) * n(stockRate)   * 48
  const salaryVal = (cashierWk + cookWk + stockWk) * mult

  const totalEmp    = n(cashiers) + n(cooks) + n(stockBoys)
  const gratuityVal = (totalEmp * n(gratuityRate) / 4.33) * mult

  const oneTimeCost = n(initCost)
  const licenceVal  = (n(licenceCost) / 52) * mult

  const totalOpex    = franRevFee + franMktFee + rentVal + salaryVal + techVal + insVal + elecVal + coolingVal + gratuityVal + licenceVal
  const netBeforeTax = gross - totalOpex - oneTimeCost

  const taxBase     = Math.max(0, netBeforeTax)
  const taxLines    = TAXES.map(t => ({ ...t, amount: taxBase * t.rate }))
  const totalTax    = taxLines.reduce((s, t) => s + t.amount, 0)
  const netAfterTax = netBeforeTax - totalTax

  const blendedMargin = revenue > 0 ? Math.round((foodCOGS / revenue) * 100) : 0

  const saveState = useMemo(() => ({
    period, initCost, licenceCost, categories,
    rentCost, techCost, insCost, elecCost, coolingCost, franRev, franMkt,
    cashiers, cashierRate, cooks, cookRate, stockBoys, stockRate, gratuityRate,
  }), [period, initCost, licenceCost, categories,
    rentCost, techCost, insCost, elecCost, coolingCost, franRev, franMkt,
    cashiers, cashierRate, cooks, cookRate, stockBoys, stockRate, gratuityRate])

  useAutoSave(session, saveState)

  const exportCSV = useCallback(() => {
    const pName = PERIODS.find(p => p.key === period)?.label ?? 'Weekly'
    const date  = new Date().toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' })
    const rows  = [
      ['BiteERP'],
      ['Period: ' + pName],
      ['Generated: ' + date],
      ['Currency: AED'],
      [],
      ['Category', 'Item', 'Amount (AED)'],
      ['Revenue', 'Hot Food / Shawarma / Deli', fmtFull(deliRevWk * mult)],
      ['Revenue', 'Fresh Juices & Smoothies', fmtFull(juiceRevWk * mult)],
      ['Revenue', 'Beverages (non-alcoholic)', fmtFull(bevRevWk * mult)],
      ['Revenue', 'Snacks & Confectionery', fmtFull(snackRevWk * mult)],
      ['Revenue', 'Grocery & Household', fmtFull(grocRevWk * mult)],
      ['Revenue', 'TOTAL REVENUE', fmtFull(revenue)],
      [],
      ['COGS', 'Deli COGS', fmtFull(-n(deliCost) * mult)],
      ['COGS', 'Juices COGS', fmtFull(-n(juiceCost) * mult)],
      ['COGS', 'Bev COGS', fmtFull(-n(bevCost) * mult)],
      ['COGS', 'Snacks COGS', fmtFull(-n(snackCost) * mult)],
      ['COGS', 'Grocery COGS', fmtFull(-n(grocCost) * mult)],
      ['COGS', 'TOTAL COGS', fmtFull(-foodCOGS)],
      [],
      ['GROSS PROFIT', '', fmtFull(gross)],
      [],
      ['Franchise', 'Revenue Share (' + n(franRev) + '%)', fmtFull(-franRevFee)],
      ['Franchise', 'Marketing Share (' + n(franMkt) + '%)', fmtFull(-franMktFee)],
      ['Opex', 'Rent', fmtFull(-rentVal)],
      ['Opex', 'Cashiers x' + n(cashiers) + ' @ AED ' + n(cashierRate) + '/hr', fmtFull(-cashierWk * mult)],
      ['Opex', 'Cooks/Deli x' + n(cooks) + ' @ AED ' + n(cookRate) + '/hr', fmtFull(-cookWk * mult)],
      ['Opex', 'Stock Boys x' + n(stockBoys) + ' @ AED ' + n(stockRate) + '/hr', fmtFull(-stockWk * mult)],
      ['Opex', 'Technology / POS', fmtFull(-techVal)],
      ['Opex', 'Insurance', fmtFull(-insVal)],
      ['Opex', 'DEWA Electricity', fmtFull(-elecVal)],
      ['Opex', 'District Cooling', fmtFull(-coolingVal)],
      ['Opex', 'EoS Gratuity Provision (' + totalEmp + ' staff)', fmtFull(-gratuityVal)],
      ['One-Time', 'Fit-out / Setup Cost', fmtFull(-n(initCost))],
      ['Annual', 'Trade Licence (pro-rated)', fmtFull(-licenceVal)],
      [],
      ['NET BEFORE TAX', '', fmtFull(netBeforeTax)],
      [],
      ...taxLines.map(t => ['Tax', t.label + ' (' + (t.rate * 100).toFixed(2) + '%)', fmtFull(-t.amount)]),
      ['TOTAL TAX & LEVIES', '', fmtFull(-totalTax)],
      [],
      ['NET AFTER TAX', '', fmtFull(netAfterTax)],
    ]
    const csv  = rows.map(r => r.map(c => '"' + String(c ?? '') + '"').join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'biteerp-pl-' + period + '-' + new Date().toISOString().slice(0, 10) + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [period, revenue, foodCOGS, gross, deliRevWk, juiceRevWk, bevRevWk, snackRevWk, grocRevWk, franRevFee, franMktFee, rentVal, cashierWk, cookWk, stockWk, techVal, insVal, elecVal, coolingVal, gratuityVal, netBeforeTax, taxLines, totalTax, netAfterTax, mult])

  const exportPDF = useCallback(() => {
    const pName = PERIODS.find(p => p.key === period)?.label ?? 'Weekly'
    const date  = new Date().toLocaleDateString('en-AE', { year: 'numeric', month: 'long', day: 'numeric' })
    const tr    = (label, val, cls = '') => '<tr class="' + cls + '"><td>' + label + '</td><td>' + val + '</td></tr>'
    const html  = '<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>BiteERP P&L</title><style>@import url(\'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@300;400;500&display=swap\');*{margin:0;padding:0;box-sizing:border-box}body{font-family:\'DM Sans\',sans-serif;color:#1a1917;padding:40px;font-size:12px;line-height:1.5}.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:14px;border-bottom:1.5px solid #e5e3de}.title{font-family:\'DM Serif Display\',serif;font-size:22px}.meta{font-size:11px;color:#888;margin-top:3px}.badge{background:#e8f5f5;border:1px solid #5EC4C8;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:500;color:#0a5c60}.summary{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:22px}.card{border:1px solid #e5e3de;border-radius:8px;padding:11px 13px}.clabel{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#aaa;margin-bottom:2px}.cval{font-family:\'DM Serif Display\',serif;font-size:18px}.csub{font-size:10px;color:#aaa;margin-top:1px}.blue .cval{color:#1a5fa0}.green .cval{color:#1a7a50}.red .cval{color:#b84a30}.sec{font-size:9px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:#aaa;margin:18px 0 5px}table{width:100%;border-collapse:collapse}tr{border-bottom:.5px solid #ede9e3}td{padding:6px 10px}td:last-child{text-align:right;font-weight:500}.sub td{background:#f7f5f1;font-weight:500}.revenue td:last-child{color:#1a5fa0}.cost td:last-child{color:#777}.profit td{background:#edf7f2}.profit td:last-child{color:#1a7a50}.loss td{background:#fdf1ee}.loss td:last-child{color:#b84a30}.tax td:last-child{color:#b84a30}.indent td:first-child{padding-left:20px;color:#666}.ftr{margin-top:28px;padding-top:12px;border-top:1px solid #e5e3de;font-size:10px;color:#bbb;display:flex;justify-content:space-between}@media print{body{padding:20px}}</style></head><body>'
      + '<div class="hdr"><div><div class="title">BiteERP</div><div class="meta">P&amp;L Report &nbsp;&middot;&nbsp; ' + date + ' &nbsp;&middot;&nbsp; Currency: AED</div></div><div class="badge">' + pName + ' View</div></div>'
      + '<div class="summary"><div class="card blue"><div class="clabel">Revenue</div><div class="cval">' + fmtFull(revenue) + '</div><div class="csub">COGS margin ' + blendedMargin + '%</div></div>'
      + '<div class="card ' + (gross >= 0 ? 'green' : 'red') + '"><div class="clabel">Gross Profit</div><div class="cval">' + fmtFull(gross) + '</div><div class="csub">' + (pct(gross, revenue) ?? '') + ' margin</div></div>'
      + '<div class="card ' + (netAfterTax >= 0 ? 'green' : 'red') + '"><div class="clabel">Net After Tax</div><div class="cval">' + fmtFull(netAfterTax) + '</div><div class="csub">' + (pct(netAfterTax, revenue) ?? '') + ' margin</div></div></div>'
      + '<div class="sec">Revenue</div><table>'
      + tr('Hot Food / Shawarma / Deli (+' + n(deliMarkup) + '% markup)', fmtFull(deliRevWk * mult), 'revenue indent')
      + tr('Fresh Juices & Smoothies (+' + n(juiceMarkup) + '% markup)', fmtFull(juiceRevWk * mult), 'revenue indent')
      + tr('Beverages non-alcoholic (+' + n(bevMarkup) + '% markup)', fmtFull(bevRevWk * mult), 'revenue indent')
      + tr('Snacks & Confectionery (+' + n(snackMarkup) + '% markup)', fmtFull(snackRevWk * mult), 'revenue indent')
      + tr('Grocery & Household (+' + n(grocMarkup) + '% markup)', fmtFull(grocRevWk * mult), 'revenue indent')
      + tr('<strong>Total Revenue</strong>', fmtFull(revenue), 'sub')
      + '</table><div class="sec">Cost of Goods Sold</div><table>'
      + tr('Deli COGS', fmtFull(-n(deliCost) * mult), 'cost indent')
      + tr('Juices COGS', fmtFull(-n(juiceCost) * mult), 'cost indent')
      + tr('Bev COGS', fmtFull(-n(bevCost) * mult), 'cost indent')
      + tr('Snacks COGS', fmtFull(-n(snackCost) * mult), 'cost indent')
      + tr('Grocery COGS', fmtFull(-n(grocCost) * mult), 'cost indent')
      + tr('<strong>Gross Profit</strong>', fmtFull(gross), gross >= 0 ? 'profit' : 'loss')
      + '</table><div class="sec">Operating Expenses</div><table>'
      + tr('Revenue Share — Franchise (' + n(franRev) + '%)', fmtFull(-franRevFee), 'cost indent')
      + tr('Marketing Share — Franchise (' + n(franMkt) + '%)', fmtFull(-franMktFee), 'cost indent')
      + tr('Rent', fmtFull(-rentVal), 'cost indent')
      + tr('Cashiers x' + n(cashiers) + ' @ AED ' + n(cashierRate) + '/hr', fmtFull(-cashierWk * mult), 'cost indent')
      + tr('Cooks/Deli x' + n(cooks) + ' @ AED ' + n(cookRate) + '/hr', fmtFull(-cookWk * mult), 'cost indent')
      + tr('Stock Boys x' + n(stockBoys) + ' @ AED ' + n(stockRate) + '/hr', fmtFull(-stockWk * mult), 'cost indent')
      + tr('Technology / POS', fmtFull(-techVal), 'cost indent')
      + tr('Insurance', fmtFull(-insVal), 'cost indent')
      + tr('DEWA Electricity', fmtFull(-elecVal), 'cost indent')
      + tr('District Cooling (Emicool / Empower)', fmtFull(-coolingVal), 'cost indent')
      + tr('End-of-Service Gratuity Provision (' + totalEmp + ' staff)', fmtFull(-gratuityVal), 'cost indent')
      + tr('Fit-out / Setup Cost (one-time)', fmtFull(-n(initCost)), 'cost indent')
      + tr('Trade Licence (annual, pro-rated)', fmtFull(-licenceVal), 'cost indent')
      + tr('<strong>Net Before Tax</strong>', fmtFull(netBeforeTax), netBeforeTax >= 0 ? 'profit' : 'loss')
      + '</table><div class="sec">UAE Taxes & Levies</div><table>'
      + taxLines.map(t => tr(t.label + ' (' + (t.rate * 100).toFixed(2) + '%)', fmtFull(-t.amount), 'tax indent')).join('')
      + tr('<strong>Total Tax & Levies</strong>', fmtFull(-totalTax), 'sub')
      + tr('<strong>Net After Tax</strong>', fmtFull(netAfterTax), netAfterTax >= 0 ? 'profit' : 'loss')
      + '</table><div class="ftr"><span>BiteERP · UAE · Est. 2025 · All amounts in AED</span><span>Generated ' + date + '</span></div></body></html>'
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 600)
  }, [period, revenue, foodCOGS, gross, deliRevWk, juiceRevWk, bevRevWk, snackRevWk, grocRevWk, franRevFee, franMktFee, rentVal, cashierWk, cookWk, stockWk, techVal, insVal, elecVal, coolingVal, gratuityVal, netBeforeTax, taxLines, totalTax, netAfterTax, mult, blendedMargin])

  const [sidebarOpen,  setSidebarOpen]  = useState(false)
  const [openSections, setOpenSections] = useState({})
  const [activeGroup,  setActiveGroup]  = useState(null) // tracks which group is selected in second bar

  const NAV = [

    /* ── Dashboard ── */
    { key: 'dashboard', label: 'Dashboard', icon: '▦', children: null },

    /* ── Point of Sale ── */
    { key: 'pos', label: 'POS', icon: '🧾', children: [
      { key: 'pos_terminal',    label: 'Terminal',    group: 'Sell'  },
      { key: 'pos_menu',        label: 'Menu',        group: 'Sell'  },
      { key: 'pos_promotions',  label: 'Promotions',  group: 'Sell'  },
      { key: 'pos_tables',      label: 'Tables',      group: 'Setup' },
      { key: 'pos_scheduling',  label: 'Scheduling',  group: 'Setup' },
      { key: 'pos_permissions',    label: 'Permissions',  group: 'Setup'       },
      { key: 'pos_hardware',       label: 'Hardware',     group: 'Setup'       },
    ]},

    /* ── Purchase ── */
    { key: 'purchasing', label: 'Purchase', icon: '🛒', children: [
      { key: 'pur_orders',         label: 'Quotations',       group: 'Orders'    },
      { key: 'suppliers',          label: 'Suppliers',        group: 'Suppliers' },
    ]},

    /* ── Sales ── */
    { key: 'sales', label: 'Sales', icon: '💼', children: [
      { key: 'sales_orders',       label: 'Orders',         group: 'Sales'      },
      { key: 'sales_promotions',   label: 'Promotions',     group: 'Sales'      },
      { key: 'sales_delivery',     label: 'Delivery',       group: 'Operations' },
      { key: 'sales_eod',          label: 'End of Day',     group: 'Operations' },
    ]},

    /* ── Inventory ── */
    { key: 'inventory', label: 'Inventory', icon: '📦', children: [
      { key: 'inv_stock',      label: 'Stock Levels',  group: 'Stock'    },
      { key: 'inv_movements',  label: 'Movements',     group: 'Stock'    },
      { key: 'inv_valuation',  label: 'Valuation',     group: 'Stock'    },
      { key: 'inv_wastage',    label: 'Wastage',         group: 'Quality'   },
      { key: 'inv_benchmarks', label: 'Benchmarks',      group: 'Quality'   },
      { key: 'inv_transfers',  label: 'Branch Transfers', group: 'Transfers' },
      { key: 'inv_summary',    label: 'Branch Summary',   group: 'Transfers' },
    ]},

    /* ── Production ── */
    { key: 'production', label: 'Manufacturing', icon: '🏭', children: [
      { key: 'prod_ingredients', label: 'Ingredients',     group: 'Materials' },
      { key: 'prod_subrecipes',  label: 'Sub-recipes',     group: 'Recipes'   },
      { key: 'prod_recipes',     label: 'Recipes',         group: 'Recipes'   },
      { key: 'prod_links',       label: 'Menu Links',      group: 'Recipes'   },
      { key: 'prod_log',         label: 'Production Log',  group: 'Output'    },
    ]},

    /* ── Accounting ── */
    { key: 'accounting', label: 'Accounting', icon: '📊', children: [
      /* ── Operations: day-to-day transactions ── */
      { key: 'acc_home',       label: 'Overview',           group: 'Operations'  },
      { key: 'acc_invoices',   label: 'Invoices',          group: 'Operations'  },
      { key: 'acc_bills',      label: 'Bills',             group: 'Operations'  },
      { key: 'acc_journal',    label: 'Journal Entries',   group: 'Operations'  },
      { key: 'acc_sales_log',  label: 'Daily Sales',       group: 'Operations'  },
      { key: 'acc_expenses',   label: 'Expenses',          group: 'Operations'  },
      { key: 'acc_payroll',    label: 'Payroll',           group: 'Operations'  },
      /* ── Reporting: live financial statements ── */
      { key: 'acc_pl',         label: 'P&L Statement',     group: 'Reporting'   },
      { key: 'acc_balance',    label: 'Balance Sheet',     group: 'Reporting'   },
      { key: 'acc_trial',      label: 'Trial Balance',     group: 'Reporting'   },
      { key: 'acc_coa',        label: 'Chart of Accounts', group: 'Reporting'   },
      { key: 'acc_vat',        label: 'VAT',               group: 'Reporting'   },
      /* ── Historical Data: time-series snapshots ── */
      { key: 'acc_pl_history', label: 'P&L History',       group: 'Historical Data' },
      { key: 'acc_cat_pl',     label: 'Category P&L',      group: 'Historical Data' },
      /* ── Forecast ── */
      { key: 'acc_forecast',   label: 'Overview',          group: 'Forecast'    },
      { key: 'acc_calculator', label: 'Calculator',        group: 'Forecast'    },
      { key: 'acc_growth',     label: 'Growth',            group: 'Forecast'    },
      { key: 'acc_cashflow',   label: 'Cash Flow',         group: 'Forecast'    },
      { key: 'acc_scenarios',  label: 'Scenarios',         group: 'Forecast'    },
      { key: 'acc_ramadan',    label: 'Ramadan',           group: 'Forecast'    },
      /* ── Tools ── */
      { key: 'acc_loan',       label: 'Loan',              group: 'Tools'       },
      { key: 'acc_currency',   label: 'Currency',          group: 'Tools'       },
      { key: 'acc_benchmarks', label: 'Benchmarks',        group: 'Tools'       },
      { key: 'acc_export',     label: 'Export',            group: 'Tools'       },
      { key: 'acc_audit',          label: 'Audit Trail',        group: 'Tools'       },
      { key: 'acc_reconcile',      label: 'Bank Reconciliation',group: 'Tools'       },
    ]},

    /* ── Contacts ── */
    { key: 'contacts', label: 'Contacts', icon: '👥', children: [
      { key: 'contacts_customers', label: 'Customers',     group: 'CRM'         },
      { key: 'contacts_suppliers', label: 'Suppliers',     group: 'CRM'         },
      { key: 'contacts_loyalty',   label: 'Loyalty',       group: 'CRM'         },
      { key: 'contacts_promos',    label: 'Promotions',    group: 'CRM'         },
    ]},

    /* ── Import ── */
    { key: 'import', label: 'Import', icon: '📥', children: null },


    /* ── Settings ── */
    { key: 'settings', label: 'Settings', icon: '⚙', children: [
      { key: 'settings_main',     label: 'General',         group: 'Account'  },
      { key: 'settings_staff',    label: 'Staff & HR',      group: 'Account'  },
      { key: 'settings_users',    label: 'Users & Access',  group: 'Account'  },
      { key: 'settings_chatter',  label: 'Team Chat',       group: 'Account'  },
      { key: 'settings_branches', label: 'Branches',        group: 'Account'  },
      { key: 'settings_companies',label: 'Companies',       group: 'Account'  },
    ]},
  ]

  const TAB_TITLES = {
    dashboard:          'Dashboard',
    // POS
    pos_terminal:       'POS Terminal',
    pos_menu:           'Menu Builder',
    pos_recipes:        'Recipes',
    pos_tables:         'Tables',
    pos_scheduling:     'Staff Scheduling',
    pos_promotions:     'Promotions & Discounts',
    pos_permissions:    'POS Permissions',
    pos_hardware:       'Hardware & Integrations',
    acc_audit:          'Audit Trail',
    // Purchase
    pur_orders:         'Quotations',
    suppliers:          'Suppliers',
    // Sales
    sales_orders:       'Sales Orders',
    sales_promotions:   'Promotions & Discounts',
    sales_delivery:     'Delivery Orders',
    sales_eod:          'End of Day Report',
    // Inventory
    inv_stock:          'Stock Levels',
    inv_movements:      'Stock Movements',
    inv_valuation:      'Inventory Valuation',
    inv_wastage:        'Wastage Tracker',
    inv_benchmarks:     'Competitor Benchmarks',
    // Production
    prod_ingredients:   'Ingredients',
    prod_subrecipes:    'Sub-recipes',
    prod_recipes:       'Recipes',
    prod_links:         'Menu Links',
    prod_log:           'Manufacturing Log',
    // Accounting — Reporting
    acc_pl:             'P&L Statement',
    acc_balance:        'Balance Sheet',
    acc_trial:          'Trial Balance',
    acc_journal:        'Journal Entries',
    acc_coa:            'Chart of Accounts',
    acc_vat:            'VAT Filing',
    // Accounting — Forecast
    acc_forecast:       'Forecast Overview',
    acc_calculator:     'Calculator',
    acc_growth:         'Growth Projection',
    acc_cashflow:       'Cash Flow',
    acc_scenarios:      'Scenarios & Break-even',
    acc_ramadan:        'Ramadan Feature',
    // Accounting — Operations
    acc_sales_log:      'Daily Sales',
    acc_expenses:       'Expenses',
    acc_payroll:        'Payroll',
    // Accounting — Reports
    acc_pl_history:     'P&L History',
    acc_cat_pl:         'Category P&L',
    // Accounting — Tools
    acc_loan:           'Loan Calculator',
    acc_currency:       'Currency Converter',
    acc_benchmarks:     'Competitor Benchmarks',
    acc_export:         'Export',
    // Settings
    contacts_customers:  'Customers',
    contacts_suppliers:  'Suppliers',
    contacts_loyalty:    'Loyalty Programme',
    contacts_promos:     'Promotions',
    import:             'Data Import',
    inv_transfers:      'Branch Transfers',
    inv_summary:        'Inventory by Branch',
    settings_main:      'Settings',
    settings_chatter:   'Team Chat',
    settings_branches:  'Branch Management',
    settings_companies: 'Company Groups',
    acc_home:           'Accounting',
    acc_invoices:       'Customer Invoices',
    acc_reconcile:      'Bank Reconciliation',
    settings_staff:     'Staff & HR',
    settings_users:     'Users & Access',
    acc_bills:          'Supplier Bills',
    settings:           'Settings',
  }

  // Track which parent sections are expanded

  const getParentKey = (tabKey) => {
    for (const item of NAV) {
      if (item.children?.some(c => c.key === tabKey)) return item.key
    }
    return null
  }
  const activeParent = getParentKey(tab)

  // Reset active group when module changes — placed AFTER activeParent declaration
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setActiveGroup(null) }, [activeParent])

  // Third nav: groups within the active module
  const activeModuleNav  = NAV.find(n => n.key === activeParent || n.key === tab)

  // Cross-app quick links — each key is the EXACT tab that renders the right module+section
  const QUICK_LINKS = {
    pos:        [
      { key: 'contacts_customers', label: '👥 Customers'    },  // → Contacts › Customers
      { key: 'contacts_promos',    label: '🎟 Promotions'   },  // → Contacts › Promotions
      { key: 'acc_invoices',       label: '🧾 Invoices'     },  // → Accounting › Invoices
      { key: 'acc_expenses',       label: '💸 Expenses'     },  // → Accounting › Expenses
    ],
    purchasing: [
      { key: 'contacts_suppliers', label: '🏭 Suppliers'    },  // → Contacts › Suppliers
      { key: 'acc_bills',          label: '📄 Bills'        },  // → Accounting › Bills
      { key: 'inv_stock',          label: '📦 Stock Levels' },  // → Inventory › Stock
    ],
    sales:      [
      { key: 'contacts_customers', label: '👥 Customers'    },  // → Contacts › Customers
      { key: 'contacts_loyalty',   label: '🏆 Loyalty'      },  // → Contacts › Loyalty
      { key: 'acc_invoices',       label: '🧾 Invoices'     },  // → Accounting › Invoices
      { key: 'acc_vat',            label: '🧮 VAT Report'   },  // → Accounting › VAT
    ],
    inventory:  [
      { key: 'pur_orders',         label: '🛒 Purchase Orders' }, // → Purchase › Orders
      { key: 'suppliers',          label: '🏭 Suppliers'    },  // → Purchase › Suppliers
      { key: 'prod_recipes',       label: '⚗️ Recipes'      },  // → Production › Recipes
    ],
    production: [
      { key: 'inv_stock',          label: '📦 Stock Levels' },  // → Inventory › Stock
      { key: 'inv_movements',      label: '📋 Movements'    },  // → Inventory › Movements
      { key: 'pos_menu',           label: '🍽 Menu Builder' },  // → POS › Menu
    ],
    accounting: [
      { key: 'contacts_customers', label: '👥 Customers'    },  // → Contacts › Customers
      { key: 'contacts_suppliers', label: '🏭 Suppliers'    },  // → Contacts › Suppliers
      { key: 'pos_terminal',       label: '🍽 POS Terminal' },  // → POS › Terminal
      { key: 'pur_orders',         label: '🛒 Purchase'     },  // → Purchase › Orders
    ],
    contacts:   [
      { key: 'acc_invoices',       label: '🧾 Invoices'     },  // → Accounting › Invoices
      { key: 'acc_bills',          label: '📄 Bills'        },  // → Accounting › Bills
      { key: 'pur_orders',         label: '🛒 Purchase Orders' }, // → Purchase › Orders
      { key: 'pos_terminal',       label: '🍽 POS Terminal' },  // → POS › Terminal
    ],
    settings:   [
      { key: 'settings_branches',  label: '🏪 Branches'    },  // → Settings › Branches
      { key: 'settings_companies', label: '🏢 Companies'   },  // → Settings › Companies
    ],
  }
  const activeQuickLinks = QUICK_LINKS[activeParent] ?? []

  const hasGroups        = activeModuleNav?.children?.some(c => c.group)
  const moduleGroups     = hasGroups ? [...new Set(activeModuleNav.children.map(c => c.group).filter(Boolean))] : []
  // Auto-select group based on active tab
  const tabGroup         = activeModuleNav?.children?.find(c => c.key === tab)?.group ?? null
  const displayGroup     = activeGroup && moduleGroups.includes(activeGroup) ? activeGroup : tabGroup ?? moduleGroups[0] ?? null
  const thirdNavItems    = hasGroups && displayGroup
    ? activeModuleNav.children.filter(c => c.group === displayGroup)
    : []
  const showThirdNav     = hasGroups && moduleGroups.length > 0


  return (
    <>
      {!session && (
        <Login onLogin={handleLogin} />
      )}
      {session && (
      <div className={styles.page}>

        {/* ── PRIMARY TOP NAVBAR ── */}
        <header className={styles.topNav}>

          {/* App grid / home button */}
          <button className={styles.topNavHome} onClick={() => setTab('home')} title="Home">
            ⊞
          </button>

          {/* Logo */}
          <div className={styles.topNavLogo} onClick={() => setTab('home')} style={{ cursor: 'pointer' }}>
            <svg viewBox="0 0 200 44" width="120" height="27" xmlns="http://www.w3.org/2000/svg">
              <text x="0" y="34" fontFamily="Inter, -apple-system, sans-serif" fontWeight="800" fontSize="38" letterSpacing="-2" fill="#ffffff">bite</text>
              <circle cx="126" cy="16" r="6" fill="rgba(255,255,255,0.55)"/>
              <text x="134" y="34" fontFamily="Inter, -apple-system, sans-serif" fontWeight="800" fontSize="38" letterSpacing="-2" fill="rgba(255,255,255,0.85)">erp</text>
            </svg>
          </div>

          {/* Module tabs */}
          <nav className={styles.topNavModules}>
            {NAV.filter(n => n.key !== 'home').map(({ key: navKey, label, icon, children }) => {
              const isActive = tab === navKey || activeParent === navKey || (children?.some(c => c.key === tab))
              return (
                <button
                  key={navKey}
                  className={styles.topNavModule}
                  data-active={isActive}
                  data-pos={navKey === 'pos'}
                  onClick={() => {
                    if (children) {
                      setTab(children[0].key)
                      setOpenSections(prev => ({ ...prev, [navKey]: true }))
                    } else {
                      setTab(navKey)
                    }
                  }}
                >
                  <span className={styles.topNavModuleIcon}>{icon}</span>
                  {label}
                </button>
              )
            })}
          </nav>

          {/* Right actions */}
          <div className={styles.topNavRight}>
            {/* Offline indicator */}
            {!isOnline && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(192,57,43,0.2)', color: '#ff6b6b', fontWeight: 500 }}>
                ⚡ Offline
              </span>
            )}
            {isSyncing && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(230,126,34,0.2)', color: '#ffa94d', fontWeight: 500 }}>
                ↺ Syncing…
              </span>
            )}
            {isOnline && pendingCnt > 0 && (
              <button onClick={syncQueue} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, background: 'rgba(230,126,34,0.2)', color: '#ffa94d', fontWeight: 500, border: 'none', cursor: 'pointer' }}>
                ↺ {pendingCnt} queued
              </button>
            )}
            {/* Language toggle */}
            {/* Language selector */}
            <div style={{ position: 'relative' }} ref={langMenuRef}>
              <button className={styles.topNavBtn}
                onClick={() => setLangMenuOpen(p => !p)}
                title="Language / اللغة / भाषा"
                style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                {LANGUAGES.find(l => l.code === lang)?.flag ?? '🌐'}
                <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
              </button>
              {langMenuOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                  background: 'var(--bg-surface)', border: '0.5px solid var(--border)',
                  borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  zIndex: 500, overflow: 'hidden', minWidth: 150,
                }}>
                  {LANGUAGES.map(l => (
                    <button key={l.code} onClick={() => { setLanguage(l.code); setLangMenuOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '10px 14px', background: lang === l.code ? 'var(--accent-dim)' : 'transparent',
                        border: 'none', cursor: 'pointer', fontFamily: l.font ?? 'var(--font-body)',
                        fontSize: 13, color: lang === l.code ? 'var(--accent)' : 'var(--text-primary)',
                        fontWeight: lang === l.code ? 600 : 400,
                      }}>
                      <span style={{ fontSize: 16 }}>{l.flag}</span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 13 }}>{l.label}</div>
                        {l.code !== 'en' && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{l.code === 'ar' ? 'Arabic' : 'Hindi'}</div>}
                      </div>
                      {lang === l.code && <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {session && (
              <button
                onClick={() => setChatterOpen(p => !p)}
                title="Team chat"
                style={{
                  background: chatterOpen ? 'rgba(255,255,255,0.15)' : 'transparent',
                  border: 'none', cursor: 'pointer', padding: '6px 8px',
                  borderRadius: 8, position: 'relative',
                  color: 'rgba(255,255,255,0.8)', fontSize: 17, lineHeight: 1,
                  transition: 'background 0.15s',
                }}
              >
                💬
              </button>
            )}
            {session && <NotificationBell restaurantId={session?.restaurantId} onNavigate={setTab} />}
            <button className={styles.topNavBtn} onClick={toggleTheme} title="Toggle theme">
              {theme === 'dark' ? '☀' : '🌙'}
            </button>
            <div className={styles.topNavAvatar} title={session?.fullName ?? session?.email}
              onClick={() => setTab('settings')}>
              {(session?.fullName ?? session?.email ?? 'U')[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* ── SECONDARY BAR: groups OR flat items ── */}
        <div className={styles.subNav}>
          {hasGroups ? (
            // Show group names as clickable tabs
            moduleGroups.map(group => (
              <button
                key={group}
                className={styles.subNavItem}
                data-active={displayGroup === group}
                data-crossapp={['Quick Access','Accounting','Contacts','Inventory','Replenish','Transactions','Menu'].includes(group)}
                onClick={() => {
                  setActiveGroup(group)
                  const first = activeModuleNav.children.find(c => c.group === group)
                  if (first) setTab(first.key)
                }}
              >
                {['Quick Access','Accounting','Contacts','Inventory','Replenish','Transactions','Menu'].includes(group) ? '↗ ' : ''}{group}
              </button>
            ))
          ) : activeModuleNav?.children ? (
            activeModuleNav.children.map(({ key: ck, label: cl }) => (
              <button key={ck} className={styles.subNavItem} data-active={tab === ck} onClick={() => setTab(ck)}>
                {cl}
              </button>
            ))
          ) : (
            <div className={styles.subNavBreadcrumb}>
              <span className={styles.subNavBreadcrumbActive}>{TAB_TITLES[tab] ?? tab}</span>
            </div>
          )}
        </div>

        {/* ── THIRD BAR: pages within selected group ── */}
        {showThirdNav && thirdNavItems.length > 0 && (
          <div className={styles.thirdNav}>
            {thirdNavItems.map(({ key: ck, label: cl }) => (
              <button key={ck} className={styles.thirdNavItem} data-active={tab === ck} onClick={() => setTab(ck)}>
                {cl}
              </button>
            ))}
          </div>
        )}

        {/* ── MOBILE TOPBAR ── */}
        {sidebarOpen && <div className={styles.mobileOverlay} onClick={() => setSidebarOpen(false)} />}
        <div className={styles.mobileTopbar}>
          <button className={styles.hamburger} onClick={() => setSidebarOpen(v => !v)}>☰</button>
          <svg viewBox="0 0 200 44" width="100" height="22" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="34" fontFamily="Inter, -apple-system, sans-serif" fontWeight="800" fontSize="38" letterSpacing="-2" fill="rgba(255,255,255,0.95)">bite</text>
            <circle cx="126" cy="16" r="6" fill="rgba(255,255,255,0.5)"/>
            <text x="134" y="34" fontFamily="Inter, -apple-system, sans-serif" fontWeight="800" fontSize="38" letterSpacing="-2" fill="rgba(255,255,255,0.85)">erp</text>
          </svg>
        </div>

        {/* ── MOBILE DRAWER ── */}
        <div className={styles.mobileSidebar} data-open={sidebarOpen}>
          <div className={styles.sidebarHeader}>
            <div className={styles.brandSub}>Restaurant & Hospitality ERP</div>
          </div>
          {NAV.map(({ key: navKey, label, icon, children }) => {
            const isActive = tab === navKey || activeParent === navKey || children?.some(c => c.key === tab)
            return (
              <div key={navKey} className={styles.mobileNavGroup}>
                <button
                  className={styles.mobileNavHeader}
                  data-active={isActive}
                  onClick={() => {
                    if (children) {
                      setOpenSections(prev => ({ ...prev, [navKey]: !openSections[navKey] }))
                    } else {
                      setTab(navKey); setSidebarOpen(false)
                    }
                  }}
                >
                  <span>{icon}</span> {label}
                </button>
                {children && (openSections[navKey] || isActive) && (
                  <div className={styles.mobileNavChildren}>
                    {children.map(({ key: ck, label: cl }) => (
                      <button key={ck} className={styles.mobileNavChild} data-active={tab === ck}
                        onClick={() => { setTab(ck); setSidebarOpen(false) }}>
                        {cl}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <div className={styles.sidebarFooter}>
            <div className={styles.sidebarFooterRow}>
              <span className={styles.userBadge}>
                <span className={styles.userBadgeName}>{session?.fullName ?? session?.email}</span>
                <span className={styles.adminTag}>{session?.role}</span>
              </span>
            </div>
            <div className={styles.iconBtnRow}>
              <button className={styles.themeBtn} onClick={toggleTheme}>{theme === 'dark' ? '☀' : '🌙'}</button>
              <button className={styles.themeBtn} onClick={toggleLang}>{LANGUAGES.find(l => l.code === lang)?.flag ?? '🌐'}</button>
              <button className={styles.themeBtn} onClick={async () => { await signOut(); setSession(null) }}>🔒</button>
            </div>
          </div>
        </div>

        {/* ── PAGE BODY ── */}
        <div className={`${styles.pageBody} ${showThirdNav && thirdNavItems.length > 0 ? styles.pageBodyWithThird : ''}`}>
          <main className={styles.main}>
        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <LiveDashboard restaurantId={session?.restaurantId} session={session} weeklyRev={weeklyRev} netAfterTax={netAfterTax} totalOpex={totalOpex} mult={mult} onNavigate={setTab} />
        )}

        {/* ── POS ── */}
        {tab === 'pos_terminal' && (
          <POSTerminal restaurantId={session?.restaurantId} userId={session?.userId} session={session} />
        )}
        {tab === 'pos_menu' && (
          <MenuBuilder restaurantId={session?.restaurantId} userId={session?.userId} />
        )}
        {tab === 'pos_recipes' && (
          <RecipeEngine restaurantId={session?.restaurantId} userId={session?.userId} />
        )}
        {tab === 'pos_promotions' && (
          <PromotionsManager restaurantId={session?.restaurantId} userId={session?.userId} />
        )}
        {tab === 'pos_permissions' && (
          <POSPermissions restaurantId={session?.restaurantId} session={session} />
        )}
        {tab === 'pos_hardware' && (
          <HardwareSettings restaurantId={session?.restaurantId} session={session} />
        )}

        {tab === 'pos_scheduling' && (
          <StaffScheduler salaryVal={salaryVal} mult={mult} />
        )}

        {tab === 'pos_tables' && (
          <TableManager restaurantId={session?.restaurantId} />
        )}

        {/* ── PURCHASE ── */}
        {(tab === 'pur_orders' || tab === 'suppliers') && (
          <PurchaseOrders
            key={tab}
            restaurantId={session?.restaurantId}
            userId={session?.userId}
            activeTab={tab === 'suppliers' ? 'suppliers' : 'quotations'}
          />
        )}

        {/* ── SALES ── */}
        {tab === 'sales_orders' && (
          <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💼</div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 8 }}>Sales Orders</h2>
            <p style={{ fontSize: 14, maxWidth: 400, margin: '0 auto' }}>B2B sales orders and invoicing — coming soon.</p>
          </div>
        )}
        {tab === 'sales_customers' && (
          <Customers restaurantId={session?.restaurantId} userId={session?.userId} />
        )}
        {tab === 'sales_loyalty' && (
          <Customers restaurantId={session?.restaurantId} userId={session?.userId} activeTab='loyalty' />
        )}
        {tab === 'sales_promotions' && (
          <PromotionsManager restaurantId={session?.restaurantId} userId={session?.userId} />
        )}
        {tab === 'sales_delivery' && (
          <DeliveryOrders restaurantId={session?.restaurantId} userId={session?.userId} />
        )}
        {tab === 'sales_eod' && (
          <EODReport restaurantId={session?.restaurantId} session={session} />
        )}


        {/* ── INVENTORY ── */}
        {(tab === 'inv_stock' || tab === 'inv_movements' || tab === 'inv_valuation') && (
          <Inventory key={tab} restaurantId={session?.restaurantId} userId={session?.userId}
            activeTab={{ inv_stock: 'stock', inv_movements: 'movements', inv_valuation: 'valuation' }[tab]} />
        )}
        {tab === 'inv_wastage' && (
          <WastageTracker deliCost={deliCost} juiceCost={juiceCost} bevCost={bevCost} snackCost={snackCost} grocCost={grocCost} />
        )}
        {tab === 'inv_benchmarks' && (
          <CompetitorBenchmarks weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS} totalOpex={totalOpex} mult={mult} salaryVal={salaryVal} rentVal={rentVal} elecVal={elecVal} />
        )}

        {/* ── PRODUCTION ── */}
        {(tab === 'prod_recipes' || tab === 'prod_subrecipes' || tab === 'prod_log' || tab === 'prod_ingredients' || tab === 'prod_links') && (
          <RecipeEngine key={tab} restaurantId={session?.restaurantId} userId={session?.userId}
            activeTab={{ prod_recipes: 'recipes', prod_subrecipes: 'subrecipes', prod_log: 'production', prod_ingredients: 'ingredients', prod_links: 'links' }[tab]} />
        )}

        {/* ── ACCOUNTING ── */}
        {tab === 'acc_home' && (
          <AccountingDashboard restaurantId={session?.restaurantId} onNavigate={setTab} />
        )}

        {tab === 'acc_invoices' && (
          <InvoicesModule restaurantId={session?.restaurantId} userId={session?.userId} session={session} type="invoice" />
        )}
        {tab === 'acc_bills' && (
          <InvoicesModule restaurantId={session?.restaurantId} userId={session?.userId} session={session} type="bill" />
        )}

        {(tab === 'acc_pl' || tab === 'acc_balance' || tab === 'acc_trial' || tab === 'acc_journal' || tab === 'acc_coa') && (
          <Accounting key={tab} restaurantId={session?.restaurantId} userId={session?.userId}
            activeTab={{ acc_pl: 'pl', acc_balance: 'balance', acc_trial: 'trial', acc_journal: 'journal', acc_coa: 'coa' }[tab]} />
        )}
        {tab === 'acc_vat' && (
          <VATReport restaurantId={session?.restaurantId} />
        )}
        {tab === 'acc_forecast' && (
          <Dashboard period={period} setPeriod={setPeriod} periodLabel={periodLabel} revenue={revenue} gross={gross} netBeforeTax={netBeforeTax} netAfterTax={netAfterTax} totalTax={totalTax} foodCOGS={foodCOGS} totalOpex={totalOpex} oneTimeCost={oneTimeCost} deliRevWk={deliRevWk} alcRevWk={juiceRevWk} bevRevWk={bevRevWk} snackRevWk={snackRevWk} grocRevWk={grocRevWk} weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS} rentVal={rentVal} salaryVal={salaryVal} techVal={techVal} insVal={insVal} elecVal={elecVal} gasVal={coolingVal} dblVal={gratuityVal} keyfoodRevFee={franRevFee} keyfoodMktFee={franMktFee} taxBase={taxBase} mult={mult} PERIODS={PERIODS}
            categories={categories} />
        )}
        {tab === 'acc_reconcile' && (
          <BankReconciliation restaurantId={session?.restaurantId} userId={session?.userId} />
        )}

        {tab === 'acc_audit' && (
          <AuditTrail restaurantId={session?.restaurantId} session={session} />
        )}
        {tab === 'acc_payroll' && (
          <Payroll cashiers={cashiers} cashierRate={cashierRate} cooks={cooks} cookRate={cookRate} stockBoys={stockBoys} stockRate={stockRate} dblRate={gratuityRate} />
        )}

        {tab === 'acc_benchmarks' && (
          <CompetitorBenchmarks weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS} totalOpex={totalOpex} mult={mult} salaryVal={salaryVal} rentVal={rentVal} elecVal={elecVal} />
        )}
        {tab === 'acc_growth' && (
          <Growth weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS} totalOpex={totalOpex} mult={mult} oneTimeCost={oneTimeCost} />
        )}
        {tab === 'acc_cashflow' && (
          <Cashflow weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS} totalOpex={totalOpex} mult={mult} oneTimeCost={oneTimeCost} weeklyNet={netAfterTax / mult} />
        )}
        {tab === 'acc_scenarios' && (
          <Scenarios currentScenario={{ weeklyRev, weeklyCOGS, weeklyOpex: totalOpex / mult, oneTime: oneTimeCost }} />
        )}
        {tab === 'acc_ramadan' && (
          <RamadanMode weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS} totalOpex={totalOpex} mult={mult} deliRevWk={deliRevWk} juiceRevWk={juiceRevWk} bevRevWk={bevRevWk} snackRevWk={snackRevWk} grocRevWk={grocRevWk} />
        )}
        {tab === 'acc_sales_log' && (
          <DailySalesLog weeklyRev={weeklyRev} />
        )}
        {tab === 'acc_expenses' && (
          <ExpenseTracker totalOpex={totalOpex} mult={mult} />
        )}
        {tab === 'acc_loan' && (
          <Loan oneTimeCost={oneTimeCost} />
        )}
        {tab === 'acc_currency' && (
          <CurrencyConverter deliCost={deliCost} juiceCost={juiceCost} bevCost={bevCost} snackCost={snackCost} grocCost={grocCost} rentCost={rentCost} />
        )}
        {tab === 'acc_pl_history' && (
          <PLHistory period={period} revenue={revenue} gross={gross} netAfterTax={netAfterTax} totalTax={totalTax} foodCOGS={foodCOGS} totalOpex={totalOpex} restaurantId={session?.restaurantId} userId={session?.userId} />
        )}
        {tab === 'acc_cat_pl' && (
          <CategoryBreakeven deliCost={deliCost} deliMarkup={deliMarkup} juiceCost={juiceCost} juiceMarkup={juiceMarkup} bevCost={bevCost} bevMarkup={bevMarkup} snackCost={snackCost} snackMarkup={snackMarkup} grocCost={grocCost} grocMarkup={grocMarkup} totalOpex={totalOpex} mult={mult} oneTimeCost={oneTimeCost} />
        )}

        {tab === 'acc_export' && (
          <div>
            <Snapshot period={period} revenue={revenue} gross={gross} netBeforeTax={netBeforeTax} netAfterTax={netAfterTax} totalTax={totalTax} foodCOGS={foodCOGS} totalOpex={totalOpex} oneTimeCost={oneTimeCost} blendedMargin={blendedMargin} deliRevWk={deliRevWk} alcRevWk={juiceRevWk} bevRevWk={bevRevWk} snackRevWk={snackRevWk} grocRevWk={grocRevWk} weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS} rentVal={rentVal} salaryVal={salaryVal} equityVal={licenceVal} techVal={techVal} insVal={insVal} elecVal={elecVal} gasVal={coolingVal} dblVal={gratuityVal} keyfoodRevFee={franRevFee} keyfoodMktFee={franMktFee} taxLines={taxLines} mult={mult} inputs={{ deliCost, deliMarkup, alcCost: juiceCost, alcMarkup: juiceMarkup, bevCost, bevMarkup, snackCost, snackMarkup, grocCost, grocMarkup, rentCost, techCost, insCost, elecCost, gasCost: coolingCost, keyfoodRev: franRev, keyfoodMkt: franMkt, cashiers, cashierRate, cooks, cookRate, stockBoys, stockRate, dblRate: gratuityRate, initCost, equityCost: licenceCost }} />
          </div>
        )}

        {tab === 'home' && (
          <>
            <Onboarding restaurantId={session?.restaurantId} onNavigate={setTab} />
            <div style={{ marginTop: '2rem' }}>
              <AppHome onNavigate={setTab} session={session} />
            </div>
          </>
        )}



        {(tab === 'contacts_customers' || tab === 'contacts_suppliers' || tab === 'contacts_loyalty' || tab === 'contacts_promos') && (
          <ContactsApp
            restaurantId={session?.restaurantId}
            userId={session?.userId}
            session={session}
            initialSection={tab === 'contacts_suppliers' ? 'suppliers' : tab === 'contacts_loyalty' ? 'loyalty' : tab === 'contacts_promos' ? 'promotions' : 'customers'}
          />
        )}

        {tab === 'import' && (
          <ImportApp restaurantId={session?.restaurantId} userId={session?.userId} session={session} />
        )}

        {(tab === 'inv_transfers' || tab === 'inv_summary') && (
          <MultiBranch
            restaurantId={session?.restaurantId}
            userId={session?.userId}
            session={session}
            initialSection={tab === 'inv_transfers' ? 'transfers' : 'summary'}
          />
        )}



        {tab === 'settings_staff' && (
          <StaffModule restaurantId={session?.restaurantId} userId={session?.userId} session={session} />
        )}

        {tab === 'settings_users' && (
          <UsersAccess restaurantId={session?.restaurantId} userId={session?.userId} session={session} />
        )}

        {(tab === 'settings_branches' || tab === 'settings_companies') && (
          <MultiBranch
            restaurantId={session?.restaurantId}
            userId={session?.userId}
            session={session}
            initialSection={tab === 'settings_companies' ? 'companies' : 'branches'}
          />
        )}

        {(tab === 'settings' || tab === 'settings_main') && (
          <Settings
            session={session}
            onSessionUpdate={setSession}
          />
        )}


        {/* FORECAST subpages */}
        {tab === 'forecast_overview' && (
          <Dashboard
            period={period} setPeriod={setPeriod} periodLabel={periodLabel}
            revenue={revenue} gross={gross} netBeforeTax={netBeforeTax}
            netAfterTax={netAfterTax} totalTax={totalTax}
            foodCOGS={foodCOGS} totalOpex={totalOpex} oneTimeCost={oneTimeCost}
            deliRevWk={deliRevWk} alcRevWk={juiceRevWk} bevRevWk={bevRevWk}
            snackRevWk={snackRevWk} grocRevWk={grocRevWk}
            weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS}
            rentVal={rentVal} salaryVal={salaryVal} techVal={techVal}
            insVal={insVal} elecVal={elecVal} gasVal={coolingVal} dblVal={gratuityVal}
            keyfoodRevFee={franRevFee} keyfoodMktFee={franMktFee}
            taxBase={taxBase} mult={mult} PERIODS={PERIODS}
            categories={categories}
          />
        )}

        {tab === 'forecast_scenarios' && (
          <div>
            <Scenarios currentScenario={{ weeklyRev, weeklyCOGS, weeklyOpex: totalOpex / mult, oneTime: oneTimeCost }} />
            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '0.5px solid var(--border)' }}>
              <BreakevenChart weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS} totalOpex={totalOpex} mult={mult} oneTimeCost={oneTimeCost} netAfterTax={netAfterTax} TAXES_RATE={0.19} />
            </div>
          </div>
        )}
        {tab === 'forecast_cashflow' && (
          <Cashflow weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS} totalOpex={totalOpex} mult={mult} oneTimeCost={oneTimeCost} weeklyNet={netAfterTax / mult} />
        )}
        {tab === 'forecast_growth' && (
          <Growth weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS} totalOpex={totalOpex} mult={mult} oneTimeCost={oneTimeCost} />
        )}
        {tab === 'forecast_ramadan' && (
          <RamadanMode
            weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS}
            totalOpex={totalOpex} mult={mult}
            deliRevWk={deliRevWk} juiceRevWk={juiceRevWk} bevRevWk={bevRevWk}
            snackRevWk={snackRevWk} grocRevWk={grocRevWk}
          />
        )}

        {/* OPERATIONS subpages */}
        {tab === 'ops_inventory' && (
          <WastageTracker deliCost={deliCost} juiceCost={juiceCost} bevCost={bevCost} snackCost={snackCost} grocCost={grocCost} />
        )}
        {tab === 'ops_sales' && (
          <DailySalesLog weeklyRev={weeklyRev} />
        )}
        {tab === 'ops_expenses' && (
          <ExpenseTracker totalOpex={totalOpex} mult={mult} />
        )}
        {tab === 'ops_benchmarks' && (
          <CompetitorBenchmarks
            weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS}
            totalOpex={totalOpex} mult={mult}
            salaryVal={salaryVal} rentVal={rentVal} elecVal={elecVal}
          />
        )}

        {/* PEOPLE subpages */}
        {tab === 'people_payroll' && (
          <Payroll cashiers={cashiers} cashierRate={cashierRate} cooks={cooks} cookRate={cookRate} stockBoys={stockBoys} stockRate={stockRate} dblRate={gratuityRate} />
        )}
        {tab === 'people_scheduling' && (
          <StaffScheduler salaryVal={salaryVal} mult={mult} />
        )}

        {/* FINANCE subpages */}
        {tab === 'finance_history' && (
          <PLHistory
            period={period} revenue={revenue} gross={gross}
            netAfterTax={netAfterTax} totalTax={totalTax}
            foodCOGS={foodCOGS} totalOpex={totalOpex}
            weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS} mult={mult}
            restaurantId={session?.restaurantId}
            userId={session?.userId}
          />
        )}
        {tab === 'finance_category' && (
          <CategoryBreakeven
            deliCost={deliCost} deliMarkup={deliMarkup}
            juiceCost={juiceCost} juiceMarkup={juiceMarkup}
            bevCost={bevCost} bevMarkup={bevMarkup}
            snackCost={snackCost} snackMarkup={snackMarkup}
            grocCost={grocCost} grocMarkup={grocMarkup}
            totalOpex={totalOpex} mult={mult} oneTimeCost={oneTimeCost}
          />
        )}
        {tab === 'finance_vat' && (
          <VATSummary
            weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS}
            deliRevWk={deliRevWk} juiceRevWk={juiceRevWk} bevRevWk={bevRevWk}
            snackRevWk={snackRevWk} grocRevWk={grocRevWk}
            deliCost={deliCost} juiceCost={juiceCost} bevCost={bevCost}
            snackCost={snackCost} grocCost={grocCost}
          />
        )}
        {tab === 'finance_loan' && (
          <Loan oneTimeCost={oneTimeCost} />
        )}
        {tab === 'finance_currency' && (
          <CurrencyConverter
            deliCost={deliCost} juiceCost={juiceCost} bevCost={bevCost}
            snackCost={snackCost} grocCost={grocCost} rentCost={rentCost}
          />
        )}

        {tab === 'suppliers' && (
          <SupplierTracker />
        )}

        {tab === 'export' && (
          <div>
            <Snapshot
              period={period} revenue={revenue} gross={gross}
              netBeforeTax={netBeforeTax} netAfterTax={netAfterTax} totalTax={totalTax}
              foodCOGS={foodCOGS} totalOpex={totalOpex} oneTimeCost={oneTimeCost}
              blendedMargin={blendedMargin}
              deliRevWk={deliRevWk} alcRevWk={juiceRevWk} bevRevWk={bevRevWk}
              snackRevWk={snackRevWk} grocRevWk={grocRevWk}
              weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS}
              rentVal={rentVal} salaryVal={salaryVal} equityVal={licenceVal}
              techVal={techVal} insVal={insVal} elecVal={elecVal} gasVal={coolingVal} dblVal={gratuityVal}
              keyfoodRevFee={franRevFee} keyfoodMktFee={franMktFee}
              taxLines={taxLines} mult={mult}
              inputs={{ deliCost, deliMarkup, alcCost: juiceCost, alcMarkup: juiceMarkup, bevCost, bevMarkup, snackCost, snackMarkup, grocCost, grocMarkup, rentCost, techCost, insCost, elecCost, gasCost: coolingCost, keyfoodRev: franRev, keyfoodMkt: franMkt, cashiers, cashierRate, cooks, cookRate, stockBoys, stockRate, dblRate: gratuityRate, initCost, equityCost: licenceCost }}
            />
            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '0.5px solid var(--border)' }}>
              <InvestorReport
                period={period} revenue={revenue} gross={gross}
                netBeforeTax={netBeforeTax} netAfterTax={netAfterTax}
                totalTax={totalTax} foodCOGS={foodCOGS} totalOpex={totalOpex}
                oneTimeCost={oneTimeCost} blendedMargin={blendedMargin}
                weeklyRev={weeklyRev} weeklyCOGS={weeklyCOGS} mult={mult}
                rentVal={rentVal} salaryVal={salaryVal} techVal={techVal}
                insVal={insVal} elecVal={elecVal} coolingVal={coolingVal}
                gratuityVal={gratuityVal} franRevFee={franRevFee} franMktFee={franMktFee} licenceVal={licenceVal}
                taxLines={taxLines}
                inputs={{ deliCost, deliMarkup, alcCost: juiceCost, alcMarkup: juiceMarkup, bevCost, bevMarkup, snackCost, snackMarkup, grocCost, grocMarkup }}
              />
            </div>
          </div>
        )}

        {(tab === 'calculator' || tab === 'acc_calculator') && (
        <div className={styles.layout}>
          <aside className={styles.panel}>
            <div className={styles.periodRow}>
              {PERIODS.map(p => (
                <button key={p.key} className={styles.periodBtn} data-active={period === p.key} onClick={() => setPeriod(p.key)}>
                  {p.label}
                </button>
              ))}
            </div>

            <section className={styles.section}>
              <p className={styles.sectionLabel}>Setup costs &amp; annual licence</p>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Fit-out / setup cost</label>
                  <div className={styles.inputWrap}><span className={styles.inputPre}>AED</span><input type="number" min="0" value={initCost} onChange={e => setInitCost(e.target.value)} className={styles.inputWithPre} /></div>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Trade licence <span className={styles.labelNote}>/yr</span></label>
                  <div className={styles.inputWrap}><span className={styles.inputPre}>AED</span><input type="number" min="0" value={licenceCost} onChange={e => setLicenceCost(e.target.value)} className={styles.inputWithPre} /></div>
                </div>
              </div>
            </section>

            <div className={styles.sep} />

            <section className={styles.section}>
              <div className={styles.sectionHeaderRow}>
                <p className={styles.sectionLabel}>Food categories <span className={styles.labelNote}>weekly cost (AED) + markup</span></p>
                <button className={styles.addCatBtn} onClick={() => setCategories(prev => [...prev, { id: 'cat_' + Date.now(), name: 'New Category', cost: '0', markup: '50' }])}>
                  + Add category
                </button>
              </div>
              {categories.map((cat, idx) => {
                const rev = n(cat.cost) * (1 + n(cat.markup) / 100)
                return (
                  <div key={cat.id} className={styles.foodRow}>
                    <div className={styles.foodRowHeader}>
                      <input
                        value={cat.name}
                        onChange={e => setCategories(prev => prev.map((c, i) => i === idx ? { ...c, name: e.target.value } : c))}
                        className={styles.catNameInput}
                        placeholder="Category name"
                      />
                      <button
                        className={styles.removeCatBtn}
                        onClick={() => setCategories(prev => prev.filter((_, i) => i !== idx))}
                        title="Remove category"
                      >✕</button>
                    </div>
                    <div className={styles.foodInputs}>
                      <div className={styles.foodField}>
                        <span className={styles.foodFieldLabel}>Weekly cost</span>
                        <div className={styles.inputWrap}>
                          <span className={styles.inputPre}>AED</span>
                          <input type="number" min="0" value={cat.cost}
                            onChange={e => setCategories(prev => prev.map((c, i) => i === idx ? { ...c, cost: e.target.value } : c))}
                            className={styles.inputWithPre} />
                        </div>
                      </div>
                      <div className={styles.foodField}>
                        <span className={styles.foodFieldLabel}>Markup</span>
                        <div className={styles.inputWrap}>
                          <input type="number" min="0" value={cat.markup}
                            onChange={e => setCategories(prev => prev.map((c, i) => i === idx ? { ...c, markup: e.target.value } : c))}
                            className={styles.inputWithSuf} />
                          <span className={styles.inputSuf}>%</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.foodRevLine}>
                      <span className={styles.foodRevLabel}>Weekly revenue →</span>
                      <span className={styles.foodRevVal}>{fmt(rev)}</span>
                    </div>
                  </div>
                )
              })}
              <div className={styles.foodTotalRow}>
                <span>Total weekly revenue</span>
                <strong>{fmt(weeklyRev)}</strong>
              </div>
            </section>

            <div className={styles.sep} />

            <section className={styles.section}>
              <p className={styles.sectionLabel}>Operating costs</p>
              <div className={styles.grid2}>
                {[
                  { label: 'Rent (weekly)', val: rentCost, set: setRentCost, note: '/wk' },
                  { label: 'Technology / POS', val: techCost, set: setTechCost, note: '/mo' },
                  { label: 'Insurance', val: insCost, set: setInsCost, note: '/mo' },
                  { label: 'DEWA Electricity', val: elecCost, set: setElecCost, note: '/mo' },
                  { label: 'District Cooling', val: coolingCost, set: setCoolingCost, note: '/mo' },
                ].map(({ label, val, set, note }) => (
                  <div key={label} className={styles.field}>
                    <label className={styles.fieldLabel}>{label} <span className={styles.labelNote}>{note}</span></label>
                    <div className={styles.inputWrap}>
                      <span className={styles.inputPre}>AED</span>
                      <input type="number" min="0" value={val} onChange={e => set(e.target.value)} className={styles.inputWithPre} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className={styles.sep} />

            <section className={styles.section}>
              <p className={styles.sectionLabel}>Franchise / co-op fees <span className={styles.labelNote}>% of gross revenue</span></p>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Revenue share</label>
                  <div className={styles.inputWrap}>
                    <input type="number" min="0" value={franRev} onChange={e => setFranRev(e.target.value)} className={styles.inputWithSuf} />
                    <span className={styles.inputSuf}>%</span>
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Marketing share</label>
                  <div className={styles.inputWrap}>
                    <input type="number" min="0" value={franMkt} onChange={e => setFranMkt(e.target.value)} className={styles.inputWithSuf} />
                    <span className={styles.inputSuf}>%</span>
                  </div>
                </div>
              </div>
            </section>

            <div className={styles.sep} />

            <section className={styles.section}>
              <p className={styles.sectionLabel}>Staff <span className={styles.labelNote}>48 hrs/wk · UAE standard</span></p>
              <div className={styles.staffGrid}>
                {[
                  { role: 'Cashiers',     count: cashiers,  setCount: setCashiers,  rate: cashierRate, setRate: setCashierRate, wkCost: cashierWk },
                  { role: 'Cooks / Deli', count: cooks,     setCount: setCooks,     rate: cookRate,    setRate: setCookRate,    wkCost: cookWk    },
                  { role: 'Stock Boys',   count: stockBoys, setCount: setStockBoys, rate: stockRate,   setRate: setStockRate,   wkCost: stockWk   },
                ].map(({ role, count, setCount, rate, setRate, wkCost }) => (
                  <div key={role} className={styles.staffRow}>
                    <div className={styles.staffInfo}>
                      <span className={styles.staffRole}>{role}</span>
                      <div className={styles.rateInput}>
                        <span className={styles.ratePre}>AED</span>
                        <input type="number" min="0" value={rate} onChange={e => setRate(e.target.value)} className={styles.rateField} />
                        <span className={styles.ratePost}>/hr</span>
                      </div>
                    </div>
                    <div className={styles.staffInput}>
                      <button className={styles.stepBtn} onClick={() => setCount(v => String(Math.max(0, n(v) - 1)))}>−</button>
                      <input type="number" min="0" value={count} onChange={e => setCount(e.target.value)} className={styles.countInput} />
                      <button className={styles.stepBtn} onClick={() => setCount(v => String(n(v) + 1))}>+</button>
                    </div>
                    <span className={styles.staffTotal}>{fmt(wkCost * mult)}</span>
                  </div>
                ))}
              </div>
              <div className={styles.staffTotalRow}>
                <span>Total salary{periodLabel}</span>
                <strong>{fmt(salaryVal)}</strong>
              </div>
              <div className={styles.dblRow}>
                <div>
                  <span className={styles.dblLabel}>End-of-Service Gratuity Provision</span>
                  <span className={styles.dblSub}> — {totalEmp} staff ×</span>
                </div>
                <div className={styles.inputWrap} style={{ width: 130 }}>
                  <span className={styles.inputPre}>AED</span>
                  <input type="number" min="0" value={gratuityRate} onChange={e => setGratuityRate(e.target.value)} className={styles.inputWithPre} style={{ width: 65 }} />
                  <span className={styles.inputSuf}>/mo</span>
                </div>
                <span className={styles.dblTotal}>{fmt(gratuityVal)}</span>
              </div>
            </section>
          </aside>

          <div className={styles.results}>
            <div className={styles.metricsGrid}>
              <MetricCard label="Revenue"        value={fmt(revenue) + periodLabel}       sub={'COGS ' + blendedMargin + '% of rev'}                                           color="blue"                             />
              <MetricCard label="Gross profit"   value={fmt(gross) + periodLabel}         sub={pct(gross, revenue) ? pct(gross, revenue) + ' margin' : null}                  color={gross >= 0 ? 'green' : 'red'}     />
              <MetricCard label="Net before tax" value={fmt(netBeforeTax) + periodLabel}  sub={pct(netBeforeTax, revenue) ? pct(netBeforeTax, revenue) + ' margin' : null}    color={netBeforeTax >= 0 ? 'green' : 'red'} />
              <MetricCard label="Total tax"      value={fmt(-totalTax) + periodLabel}     sub={taxBase > 0 ? (totalTax / taxBase * 100).toFixed(1) + '% effective rate' : null} color="red"                            />
              <MetricCard label="Net after tax"  value={fmt(netAfterTax) + periodLabel}   sub={pct(netAfterTax, revenue) ? pct(netAfterTax, revenue) + ' margin' : null}      color={netAfterTax >= 0 ? 'green' : 'red'} />
            </div>

            <div className={styles.exportRow}>
              <span className={styles.exportLabel}>Export P&amp;L</span>
              <div className={styles.exportBtns}>
                <button className={styles.exportBtn} onClick={exportCSV}><span className={styles.exportIcon}>↓</span> CSV</button>
                <button className={styles.exportBtn} onClick={exportPDF}><span className={styles.exportIcon}>↓</span> PDF / Print</button>
              </div>
            </div>

            <div className={styles.breakdown}>
              <div className={styles.breakdownTitle}>Profit &amp; loss breakdown — {PERIODS.find(p => p.key === period)?.label}</div>

              <BRow label="Hot Food / Shawarma / Deli"  value={fmt(deliRevWk  * mult)} variant="revenue" pill={'+' + n(deliMarkup)  + '%'} indent />
              <BRow label="Fresh Juices & Smoothies"    value={fmt(juiceRevWk * mult)} variant="revenue" pill={'+' + n(juiceMarkup) + '%'} indent />
              <BRow label="Beverages (non-alcoholic)"   value={fmt(bevRevWk   * mult)} variant="revenue" pill={'+' + n(bevMarkup)   + '%'} indent />
              <BRow label="Snacks & Confectionery"      value={fmt(snackRevWk * mult)} variant="revenue" pill={'+' + n(snackMarkup) + '%'} indent />
              <BRow label="Grocery & Household"         value={fmt(grocRevWk  * mult)} variant="revenue" pill={'+' + n(grocMarkup)  + '%'} indent />
              <BRow label="Total Revenue"               value={fmt(revenue)}           variant="revenue" />

              <div className={styles.breakdownDivider} />
              <BRow label="Deli COGS"    value={'− ' + fmt(n(deliCost)   * mult)} variant="cost" indent />
              <BRow label="Juices COGS"  value={'− ' + fmt(n(juiceCost)  * mult)} variant="cost" indent />
              <BRow label="Bev COGS"     value={'− ' + fmt(n(bevCost)    * mult)} variant="cost" indent />
              <BRow label="Snacks COGS"  value={'− ' + fmt(n(snackCost)  * mult)} variant="cost" indent />
              <BRow label="Grocery COGS" value={'− ' + fmt(n(grocCost)   * mult)} variant="cost" indent />
              <BRow label="Gross Profit" value={fmt(gross)}                        variant={gross >= 0 ? 'profit' : 'loss'} />

              <div className={styles.breakdownDivider} />
              <BRow label={'Revenue Share — Franchise (' + n(franRev) + '%)'}  value={'− ' + fmt(franRevFee)}  variant="cost" indent />
              <BRow label={'Marketing Share — Franchise (' + n(franMkt) + '%)'} value={'− ' + fmt(franMktFee)} variant="cost" indent />
              <BRow label="Rent"                      value={'− ' + fmt(rentVal)}             variant="cost" indent />
              <BRow label={'Cashiers ×' + n(cashiers)}    value={'− ' + fmt(cashierWk * mult)} variant="cost" indent />
              <BRow label={'Cooks/Deli ×' + n(cooks)}     value={'− ' + fmt(cookWk    * mult)} variant="cost" indent />
              <BRow label={'Stock Boys ×' + n(stockBoys)}  value={'− ' + fmt(stockWk   * mult)} variant="cost" indent />
              <BRow label="Technology / POS"           value={'− ' + fmt(techVal)}           variant="cost" indent />
              <BRow label="Insurance"                  value={'− ' + fmt(insVal)}             variant="cost" indent />
              <BRow label="DEWA Electricity"           value={'− ' + fmt(elecVal)}            variant="cost" indent />
              <BRow label="District Cooling"           value={'− ' + fmt(coolingVal)}         variant="cost" indent />
              <BRow label={'EoS Gratuity — ' + totalEmp + ' staff'} value={'− ' + fmt(gratuityVal)} variant="cost" indent />
              <BRow label="Fit-out / Setup (one-time)" value={'− ' + fmt(n(initCost))}        variant="cost" indent />
              <BRow label="Trade Licence (annual)"     value={'− ' + fmt(licenceVal)}         variant="cost" indent />
              <BRow label="Net Before Tax"             value={fmt(netBeforeTax)}               variant={netBeforeTax >= 0 ? 'profit' : 'loss'} />

              <div className={styles.breakdownDivider} />
              {taxLines.map(t => (
                <BRow key={t.key} label={t.label + ' (' + (t.rate * 100).toFixed(2) + '%)'} value={'− ' + fmt(t.amount)} variant="tax" indent />
              ))}
              <BRow label="Total Tax & Levies" value={'− ' + fmt(totalTax)}  variant="tax" />
              <BRow label="Net After Tax"      value={fmt(netAfterTax)}       variant={netAfterTax >= 0 ? 'profit' : 'loss'} />
            </div>

            {revenue > 0 && (
              <div className={styles.breakeven}>
                <div className={styles.breakevenTitle}>Break-even insight</div>
                <div className={styles.breakevenGrid}>
                  <div className={styles.breakevenItem}>
                    <span className={styles.breakevenLabel}>Min. weekly revenue needed</span>
                    <span className={styles.breakevenVal}>{fmt(totalOpex / mult / (1 - weeklyCOGS / Math.max(1, weeklyRev)))}</span>
                  </div>
                  <div className={styles.breakevenItem}>
                    <span className={styles.breakevenLabel}>One-time cost recovery</span>
                    <span className={styles.breakevenVal}>
                      {netAfterTax > 0 ? Math.ceil(oneTimeCost / (netAfterTax / mult)) + ' weeks' : 'Not profitable yet'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        )}

          </main>
        </div>
      </div>
      )}

      {showChangePIN && session && (
      <ChangePinModal onClose={() => setShowChangePIN(false)} />
    )}
    </>
  )
}
