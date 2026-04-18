import { useState, useEffect, useMemo } from 'react'
import { supabase, loadDashboardData } from './supabase.js'
import styles from './LiveDashboard.module.css'

const n = v => parseFloat(v) || 0
const fmt  = v => 'AED ' + n(v).toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const fmtD = v => 'AED ' + n(v).toFixed(2)

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

function getMondayOf(date) {
  const d   = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0,10)
}

export default function LiveDashboard({ restaurantId, session, weeklyRev, netAfterTax, totalOpex, mult, onNavigate }) {
  const [loading,    setLoading]    = useState(true)
  const [todaySales, setTodaySales] = useState(0)
  const [weekSales,  setWeekSales]  = useState([])
  const [openOrders, setOpenOrders] = useState(0)
  const [topItems,   setTopItems]   = useState([])
  const [lowStock,   setLowStock]   = useState([])
  const [recentOrds, setRecentOrds] = useState([])
  const [totalOrders,  setTotalOrders]  = useState(0)
  const [crossData,    setCrossData]    = useState({})
  const [dbDebug,    setDbDebug]    = useState(null)
  const [debugLoading, setDebugLoading] = useState(false)

  const today     = new Date().toISOString().slice(0,10)
  const weekStart = getMondayOf(today)
  const todayDay  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date().getDay()]

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    loadAll()
  }, [restaurantId])

  async function loadAll() {
    setLoading(true)
    try {
      await Promise.all([
        loadWeekSales(),
        loadOpenOrders(),
        loadTopItems(),
        loadLowStock(),
        loadRecentOrders(),
      ])
    } catch (e) { console.error(e) }
    } finally {
      setLoading(false)
    }
    // Load cross-module smart data
    loadDashboardData(restaurantId).then(setCrossData).catch(() => {})
  }

  async function loadWeekSales() {
    const { data } = await supabase
      .from('daily_sales')
      .select('day_of_week, total')
      .eq('restaurant_id', restaurantId)
      .eq('week_start', weekStart)
    const salesMap = Object.fromEntries((data ?? []).map(r => [r.day_of_week, r.total]))
    setWeekSales(DAYS.map(d => ({ day: d, total: n(salesMap[d]) })))
    setTodaySales(n(salesMap[todayDay]))
  }

  async function loadOpenOrders() {
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .in('status', ['open','sent'])
    setOpenOrders(count ?? 0)

    const { count: total } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .eq('status', 'paid')
    setTotalOrders(total ?? 0)
  }

  async function loadTopItems() {
    const { data } = await supabase
      .from('order_items')
      .select('name, quantity, item_total, orders!inner(restaurant_id)')
      .eq('orders.restaurant_id', restaurantId)
      .order('item_total', { ascending: false })
      .limit(100)
    if (!data) return
    // Aggregate by name
    const agg = {}
    for (const item of data) {
      if (!agg[item.name]) agg[item.name] = { name: item.name, qty: 0, revenue: 0 }
      agg[item.name].qty     += n(item.quantity)
      agg[item.name].revenue += n(item.item_total)
    }
    setTopItems(Object.values(agg).sort((a,b) => b.revenue - a.revenue).slice(0,5))
  }

  async function loadLowStock() {
    const { data } = await supabase
      .from('ingredients')
      .select('name, stock_qty, min_stock, unit')
      .eq('restaurant_id', restaurantId)
      .eq('active', true)
    const low = (data ?? []).filter(i => n(i.min_stock) > 0 && n(i.stock_qty) <= n(i.min_stock))
    setLowStock(low.slice(0,5))
  }

  async function loadRecentOrders() {
    const { data } = await supabase
      .from('orders')
      .select('order_number, total, status, order_type, opened_at, restaurant_tables(name)')
      .eq('restaurant_id', restaurantId)
      .order('opened_at', { ascending: false })
      .limit(8)
    setRecentOrds(data ?? [])
  }

  const weekTotal   = weekSales.reduce((s, d) => s + d.total, 0)
  const maxDay      = Math.max(...weekSales.map(d => d.total), 1)
  const forecastWk  = weeklyRev ?? 0
  const vsForcast   = forecastWk > 0 ? ((weekTotal - forecastWk) / forecastWk * 100) : 0

  if (loading) return (
    <div className={styles.loadingWrap}>
      <div className={styles.loadingDot} />
      <span>Loading live data…</span>
    </div>
  )

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.pageTitle}>Dashboard</h2>
          <p className={styles.pageSub}>
            {session?.restaurant?.name ?? 'Your restaurant'} &nbsp;·&nbsp;
            {new Date().toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={loadAll}>↻ Refresh</button>
          <button onClick={async () => {
            setDebugLoading(true)
            const { debugTableAccess } = await import('./supabase.js')
            const r = await debugTableAccess(restaurantId)
            setDbDebug(r)
            setDebugLoading(false)
          }} style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '5px 10px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 8 }}>
            {debugLoading ? '…' : '🔍 DB Check'}
          </button>
          {dbDebug && (
            <div style={{ position: 'fixed', top: 60, right: 16, zIndex: 500, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', maxWidth: 400, fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
              <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                DB Status <button onClick={() => setDbDebug(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
              </div>
              {Object.entries(dbDebug).map(([k, v]) => (
                <div key={k} style={{ marginBottom: 4, padding: '4px 8px', background: v.includes('ERROR') ? 'rgba(192,57,43,0.08)' : 'rgba(39,174,96,0.08)', borderRadius: 4 }}>
                  <strong>{k}:</strong> {v}
                </div>
              ))}
            </div>
          )}
      </div>

      {/* KPI row */}
      <div className={styles.kpiRow}>
        {[
          {
            label:  "Today's revenue",
            val:    fmt(todaySales),
            sub:    todaySales === 0 ? 'No sales logged yet' : 'from POS & daily log',
            color:  'var(--accent)',
            icon:   '💰',
          },
          {
            label:  'This week',
            val:    fmt(weekTotal),
            sub:    forecastWk > 0
                      ? (vsForcast >= 0 ? `▲ ${vsForcast.toFixed(0)}% vs forecast` : `▼ ${Math.abs(vsForcast).toFixed(0)}% vs forecast`)
                      : 'week to date',
            color:  vsForcast >= 0 ? '#27ae60' : '#c0392b',
            icon:   '📅',
          },
          {
            label:  'Open orders',
            val:    openOrders,
            sub:    openOrders > 0 ? 'on tables right now' : 'no open orders',
            color:  openOrders > 0 ? '#e67e22' : 'var(--text-muted)',
            icon:   '🧾',
          },
          {
            label:  'Total orders',
            val:    totalOrders,
            sub:    'paid orders all time',
            color:  'var(--text-primary)',
            icon:   '✓',
          },
        ].map(k => (
          <div key={k.label} className={styles.kpiCard}>
            <div className={styles.kpiTop}>
              <span className={styles.kpiIcon}>{k.icon}</span>
              <span className={styles.kpiLabel}>{k.label}</span>
            </div>
            <span className={styles.kpiVal} style={{ color: k.color }}>{k.val}</span>
            <span className={styles.kpiSub}>{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Smart buttons — cross-module alerts */}
      {Object.keys(crossData).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '1.25rem' }}>
          {crossData.openOrders > 0 && (
            <button onClick={() => onNavigate?.('pos_terminal')}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '7px 14px', background: 'rgba(230,126,34,0.1)', border: '0.5px solid rgba(230,126,34,0.3)', borderRadius: 999, color: '#e67e22', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              🍽 {crossData.openOrders} open {crossData.openOrders === 1 ? 'order' : 'orders'} on tables
            </button>
          )}
          {crossData.overdueCount > 0 && (
            <button onClick={() => onNavigate?.('acc_invoices')}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '7px 14px', background: 'rgba(192,57,43,0.1)', border: '0.5px solid rgba(192,57,43,0.3)', borderRadius: 999, color: '#c0392b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚠ {crossData.overdueCount} overdue {crossData.overdueCount === 1 ? 'invoice' : 'invoices'} · AED {(crossData.overdueAED||0).toFixed(0)}
            </button>
          )}
          {crossData.openInvoicesAED > 0 && (
            <button onClick={() => onNavigate?.('acc_invoices')}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '7px 14px', background: 'rgba(41,128,185,0.1)', border: '0.5px solid rgba(41,128,185,0.3)', borderRadius: 999, color: '#2980b9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              🧾 AED {(crossData.openInvoicesAED||0).toFixed(0)} receivable
            </button>
          )}
          {crossData.openBillsAED > 0 && (
            <button onClick={() => onNavigate?.('acc_bills')}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '7px 14px', background: 'rgba(142,68,173,0.1)', border: '0.5px solid rgba(142,68,173,0.3)', borderRadius: 999, color: '#8e44ad', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              📄 AED {(crossData.openBillsAED||0).toFixed(0)} payable to suppliers
            </button>
          )}
          {crossData.lowStockCount > 0 && (
            <button onClick={() => onNavigate?.('inv_stock')}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '7px 14px', background: 'rgba(192,57,43,0.08)', border: '0.5px solid rgba(192,57,43,0.25)', borderRadius: 999, color: '#c0392b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              📦 {crossData.lowStockCount} low stock {crossData.lowStockCount === 1 ? 'item' : 'items'}
            </button>
          )}
          {crossData.pendingPOs > 0 && (
            <button onClick={() => onNavigate?.('purch_orders')}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '7px 14px', background: 'rgba(39,174,96,0.08)', border: '0.5px solid rgba(39,174,96,0.25)', borderRadius: 999, color: '#27ae60', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              🛒 {crossData.pendingPOs} pending PO{crossData.pendingPOs > 1 ? 's' : ''}
            </button>
          )}
          {crossData.openTransfers > 0 && (
            <button onClick={() => onNavigate?.('inv_transfers')}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '7px 14px', background: 'rgba(230,126,34,0.08)', border: '0.5px solid rgba(230,126,34,0.25)', borderRadius: 999, color: '#e67e22', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              🔄 {crossData.openTransfers} branch transfer{crossData.openTransfers > 1 ? 's' : ''} in transit
            </button>
          )}
        </div>
      )}

      {/* Charts + lists row */}
      <div className={styles.mainRow}>

        {/* Weekly sales bar chart */}
        <div className={styles.chartCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>This week's sales</span>
            <span className={styles.cardSub}>{fmt(weekTotal)} total</span>
          </div>
          <div className={styles.barChart}>
            {weekSales.map((d, i) => {
              const isToday = d.day === todayDay
              const pct     = maxDay > 0 ? (d.total / maxDay) * 100 : 0
              return (
                <div key={d.day} className={styles.barCol}>
                  <span className={styles.barVal}>{d.total > 0 ? fmt(d.total).replace('AED ','') : ''}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        height: `${Math.max(pct, d.total > 0 ? 4 : 0)}%`,
                        background: isToday ? 'var(--accent)' : 'var(--accent-dim)',
                        border: isToday ? '2px solid var(--accent)' : 'none',
                      }}
                    />
                  </div>
                  <span className={styles.barLabel} style={{ color: isToday ? 'var(--accent)' : 'var(--text-muted)', fontWeight: isToday ? 600 : 400 }}>
                    {DAY_LABELS[i]}
                  </span>
                </div>
              )
            })}
          </div>
          {forecastWk > 0 && (
            <div className={styles.forecastLine}>
              <span className={styles.forecastDot} />
              <span>Weekly forecast: {fmt(forecastWk)}</span>
            </div>
          )}
        </div>

        {/* Top items */}
        <div className={styles.listCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Top selling items</span>
            <span className={styles.cardSub}>by revenue</span>
          </div>
          {topItems.length === 0 ? (
            <div className={styles.emptyState}>No sales data yet</div>
          ) : (
            <div className={styles.topItemsList}>
              {topItems.map((item, i) => {
                const maxRev = topItems[0]?.revenue ?? 1
                return (
                  <div key={item.name} className={styles.topItemRow}>
                    <span className={styles.topItemRank}>{i + 1}</span>
                    <div className={styles.topItemInfo}>
                      <span className={styles.topItemName}>{item.name}</span>
                      <div className={styles.topItemBar}>
                        <div className={styles.topItemBarFill} style={{ width: (item.revenue / maxRev * 100) + '%' }} />
                      </div>
                    </div>
                    <div className={styles.topItemStats}>
                      <span className={styles.topItemRev}>{fmt(item.revenue)}</span>
                      <span className={styles.topItemQty}>{item.qty} sold</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row */}
      <div className={styles.bottomRow}>

        {/* Recent orders */}
        <div className={styles.listCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Recent orders</span>
          </div>
          {recentOrds.length === 0 ? (
            <div className={styles.emptyState}>No orders yet</div>
          ) : (
            <table className={styles.miniTable}>
              <thead>
                <tr>
                  <th>#</th><th>Table / Type</th><th>Total</th><th>Status</th><th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentOrds.map(o => (
                  <tr key={o.order_number}>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>#{o.order_number}</td>
                    <td>{o.restaurant_tables?.name ?? (o.order_type === 'takeaway' ? '🥡 Takeaway' : 'Counter')}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 500 }}>{fmtD(o.total)}</td>
                    <td>
                      <span className={styles.statusDot} data-status={o.status} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{o.status}</span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {new Date(o.opened_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Low stock alerts */}
        <div className={styles.listCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>Low stock alerts</span>
            <span className={styles.cardSub} style={{ color: lowStock.length > 0 ? '#c0392b' : '#27ae60' }}>
              {lowStock.length > 0 ? `${lowStock.length} items` : 'All good'}
            </span>
          </div>
          {lowStock.length === 0 ? (
            <div className={styles.emptyState} style={{ color: '#27ae60' }}>✓ All stock levels are above minimum</div>
          ) : (
            <div className={styles.stockList}>
              {lowStock.map(i => (
                <div key={i.name} className={styles.stockRow}>
                  <div className={styles.stockInfo}>
                    <span className={styles.stockName}>{i.name}</span>
                    <div className={styles.stockBar}>
                      <div className={styles.stockBarFill}
                        style={{ width: Math.max(5, (n(i.stock_qty) / n(i.min_stock)) * 100) + '%' }} />
                    </div>
                  </div>
                  <div className={styles.stockNums}>
                    <span style={{ color: '#c0392b', fontWeight: 600 }}>{n(i.stock_qty).toFixed(1)}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>/ {n(i.min_stock)} {i.unit} min</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Connection map — how modules link */}
      <div style={{ marginTop: '1.25rem', background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem' }}>How your data flows</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {[
            { from: '🍽 POS', arrow: '→', to: '📊 Accounting',  desc: 'Every sale auto-posts Dr Cash / Cr Revenue + VAT',       tab: 'acc_journal'  },
            { from: '🍽 POS', arrow: '→', to: '📦 Inventory',   desc: 'Closing order deducts ingredients via recipe',           tab: 'inv_stock'    },
            { from: '🍽 POS', arrow: '→', to: '👥 Contacts',    desc: 'Points earned, tier updated, partner ledger entry',      tab: 'contacts_customers' },
            { from: '🛒 Purchase', arrow: '→', to: '📦 Inventory',desc: 'Validating receipt updates stock with AVCO cost',      tab: 'inv_stock'    },
            { from: '🛒 Purchase', arrow: '→', to: '📊 Accounting',desc: 'Receipt validation: Dr Inventory / Cr Payables',      tab: 'acc_journal'  },
            { from: '🧾 Invoice', arrow: '→', to: '📊 Accounting', desc: 'Posting: Dr Receivables / Cr Revenue + VAT Payable',  tab: 'acc_journal'  },
            { from: '🧾 Invoice', arrow: '→', to: '👥 Contacts',  desc: 'Linked to contact, updates partner ledger',            tab: 'contacts_customers' },
            { from: '📦 Inventory', arrow: '→', to: '📊 Accounting',desc: 'Stock adjustments and scrap auto-post to COA',       tab: 'acc_coa'      },
            { from: '💸 Expenses', arrow: '→', to: '📊 Accounting',desc: 'Every expense auto-posts Dr Expense / Cr Cash',      tab: 'acc_journal'  },
          ].map((c, i) => (
            <div key={i} onClick={() => onNavigate?.(c.tab)}
              style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius)', cursor: 'pointer', transition: 'background 0.13s', border: '0.5px solid var(--border)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                {c.from} <span style={{ color: 'var(--accent)' }}>{c.arrow}</span> {c.to}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
