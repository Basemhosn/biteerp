import { useState, useEffect, useCallback } from 'react'
import styles from './CurrencyConverter.module.css'

const n = v => parseFloat(v) || 0

// AED is pegged to USD at 3.6725 — this is fixed by UAE Central Bank
// Other rates are approximate and user-adjustable
const DEFAULT_RATES = { AED: 1, USD: 3.6725, EUR: 4.02, GBP: 4.68, SAR: 0.9793, INR: 0.044 }

const CURRENCIES = [
  { code: 'AED', name: 'UAE Dirham',          flag: '🇦🇪', pegged: true  },
  { code: 'USD', name: 'US Dollar',           flag: '🇺🇸', pegged: true  },
  { code: 'EUR', name: 'Euro',                flag: '🇪🇺', pegged: false },
  { code: 'GBP', name: 'British Pound',       flag: '🇬🇧', pegged: false },
  { code: 'SAR', name: 'Saudi Riyal',         flag: '🇸🇦', pegged: false },
  { code: 'INR', name: 'Indian Rupee',        flag: '🇮🇳', pegged: false },
]

const COMMON_ITEMS = [
  { label: 'Deli / Hot food (weekly COGS)',  defaultAED: 25000 },
  { label: 'Fresh juices (weekly COGS)',     defaultAED: 6000  },
  { label: 'Beverages (weekly COGS)',        defaultAED: 8000  },
  { label: 'Monthly rent',                  defaultAED: 24000 },
  { label: 'Equipment purchase',            defaultAED: 150000},
  { label: 'Staff salary (monthly)',        defaultAED: 3500  },
]

export default function CurrencyConverter({ deliCost, juiceCost, bevCost, snackCost, grocCost, rentCost }) {
  const [rates, setRates]     = useState(DEFAULT_RATES)
  const [amount, setAmount]   = useState('10000')
  const [fromCur, setFromCur] = useState('AED')
  const [toCur, setToCur]     = useState('USD')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [fetching, setFetching]       = useState(false)

  const toAED   = (val, cur) => n(val) * n(rates[cur])
  const fromAED = (val, cur) => n(val) / n(rates[cur])
  const convert = (val, from, to) => toAED(val, from) / n(rates[to])

  const fetchRates = useCallback(async () => {
    setFetching(true)
    try {
      const res  = await fetch('https://api.exchangerate-api.com/v4/latest/AED')
      const data = await res.json()
      if (data.rates) {
        const updated = {}
        Object.keys(DEFAULT_RATES).forEach(cur => {
          updated[cur] = cur === 'AED' ? 1 : 1 / (data.rates[cur] ?? (1 / DEFAULT_RATES[cur]))
        })
        setRates(updated)
        setLastUpdated(new Date().toLocaleTimeString('en-AE'))
      }
    } catch {
      // Use defaults silently
    }
    setFetching(false)
  }, [])

  useEffect(() => { fetchRates() }, [])

  const result = convert(amount, fromCur, toCur)

  // Calculator inputs in all currencies
  const calcItems = [
    { label: 'Hot Food / Deli COGS/wk',  aed: n(deliCost)  },
    { label: 'Juices COGS/wk',           aed: n(juiceCost) },
    { label: 'Beverages COGS/wk',        aed: n(bevCost)   },
    { label: 'Snacks COGS/wk',           aed: n(snackCost) },
    { label: 'Grocery COGS/wk',          aed: n(grocCost)  },
    { label: 'Rent/wk',                  aed: n(rentCost)  },
  ].filter(i => i.aed > 0)

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Currency converter</h2>
          <p className={styles.pageSub}>Convert costs between AED and your supplier currencies. AED/USD rate is fixed at 3.6725 (UAE Central Bank peg).</p>
        </div>
        <div className={styles.rateActions}>
          <button className={styles.refreshBtn} onClick={fetchRates} disabled={fetching}>
            {fetching ? 'Updating…' : '↻ Live rates'}
          </button>
          {lastUpdated && <span className={styles.lastUpdated}>Updated {lastUpdated}</span>}
        </div>
      </div>

      {/* Main converter */}
      <div className={styles.converterCard}>
        <div className={styles.converterRow}>
          <div className={styles.converterField}>
            <label className={styles.converterLabel}>Amount</label>
            <input
              type="number" min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className={styles.converterInput}
            />
          </div>
          <div className={styles.converterField}>
            <label className={styles.converterLabel}>From</label>
            <select value={fromCur} onChange={e => setFromCur(e.target.value)} className={styles.converterSelect}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>)}
            </select>
          </div>
          <button className={styles.swapBtn} onClick={() => { setFromCur(toCur); setToCur(fromCur) }}>⇌</button>
          <div className={styles.converterField}>
            <label className={styles.converterLabel}>To</label>
            <select value={toCur} onChange={e => setToCur(e.target.value)} className={styles.converterSelect}>
              {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>)}
            </select>
          </div>
        </div>
        <div className={styles.resultRow}>
          <span className={styles.resultFrom}>{n(amount).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {fromCur}</span>
          <span className={styles.resultArrow}>=</span>
          <span className={styles.resultTo}>{result.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {toCur}</span>
        </div>
        <div className={styles.rateNote}>
          1 {fromCur} = {convert(1, fromCur, toCur).toFixed(4)} {toCur}
          {fromCur === 'AED' && toCur === 'USD' && <span className={styles.pegNote}> · Fixed peg</span>}
        </div>
      </div>

      {/* All rates vs AED */}
      <div className={styles.ratesCard}>
        <div className={styles.ratesTitle}>Current rates vs AED</div>
        <div className={styles.ratesGrid}>
          {CURRENCIES.filter(c => c.code !== 'AED').map(c => (
            <div key={c.code} className={styles.rateRow}>
              <span className={styles.rateFlag}>{c.flag}</span>
              <div className={styles.rateInfo}>
                <span className={styles.rateCode}>{c.code}</span>
                <span className={styles.rateName}>{c.name}</span>
              </div>
              <div className={styles.rateValues}>
                <div className={styles.rateInputWrap}>
                  <span className={styles.rateInputPre}>1 {c.code} =</span>
                  <input
                    type="number"
                    value={rates[c.code]?.toFixed(4) ?? ''}
                    onChange={e => setRates(prev => ({ ...prev, [c.code]: n(e.target.value) }))}
                    className={styles.rateInput}
                    disabled={c.pegged}
                    title={c.pegged ? 'Fixed peg — cannot be changed' : 'Edit rate manually'}
                  />
                  <span className={styles.rateInputSuf}>AED</span>
                </div>
                {c.pegged && <span className={styles.pegBadge}>Fixed</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Calculator costs in all currencies */}
      {calcItems.length > 0 && (
        <div className={styles.calcCard}>
          <div className={styles.calcTitle}>Your calculator costs in other currencies</div>
          <div className={styles.calcScroll}>
            <table className={styles.calcTable}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>AED</th>
                  {CURRENCIES.filter(c => c.code !== 'AED').map(c => <th key={c.code}>{c.flag} {c.code}</th>)}
                </tr>
              </thead>
              <tbody>
                {calcItems.map(item => (
                  <tr key={item.label}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{item.label}</td>
                    <td style={{ color: '#0D7377' }}>{item.aed.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    {CURRENCIES.filter(c => c.code !== 'AED').map(c => (
                      <td key={c.code} style={{ color: 'var(--text-secondary)' }}>
                        {fromAED(item.aed, c.code).toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
