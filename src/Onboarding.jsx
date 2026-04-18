import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import styles from './Onboarding.module.css'

const STEPS = [
  {
    id: 'restaurant',
    icon: '🏪',
    title: 'Set up your restaurant profile',
    desc: 'Add your trade name, TRN, address and contact details for invoices and VAT reports.',
    action: 'settings',
    actionLabel: 'Go to Settings',
    check: async (restaurantId) => {
      const { data } = await supabase.from('restaurants').select('trade_name, trn, address_line1').eq('id', restaurantId).single()
      return !!(data?.trade_name && data?.trn)
    }
  },
  {
    id: 'menu',
    icon: '🍽',
    title: 'Build your menu',
    desc: 'Add categories and items to your menu so the POS terminal is ready to take orders.',
    action: 'pos_menu',
    actionLabel: 'Open Menu Builder',
    check: async (restaurantId) => {
      const { count } = await supabase.from('menu_items').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).eq('active', true)
      return (count ?? 0) > 0
    }
  },
  {
    id: 'tables',
    icon: '🪑',
    title: 'Set up your floor plan',
    desc: 'Add your tables and sections so staff can assign orders to the right table.',
    action: 'pos_tables',
    actionLabel: 'Open Table Manager',
    check: async (restaurantId) => {
      const { count } = await supabase.from('restaurant_tables').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
      return (count ?? 0) > 0
    }
  },
  {
    id: 'staff',
    icon: '👥',
    title: 'Add your team',
    desc: 'Set up staff roles, POS permissions and cashier PINs for secure access.',
    action: 'pos_permissions',
    actionLabel: 'Set up Permissions',
    check: async (restaurantId) => {
      const { data } = await supabase.from('pos_permissions').select('manager_pin').eq('restaurant_id', restaurantId).single()
      return !!(data?.manager_pin)
    }
  },
  {
    id: 'ingredients',
    icon: '🥦',
    title: 'Add ingredients & recipes',
    desc: 'Build your ingredient database and link recipes to menu items for food cost tracking.',
    action: 'prod_ingredients',
    actionLabel: 'Open Manufacturing',
    check: async (restaurantId) => {
      const { count } = await supabase.from('ingredients').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).eq('active', true)
      return (count ?? 0) > 0
    }
  },
  {
    id: 'first_sale',
    icon: '💰',
    title: 'Make your first sale',
    desc: 'Open a cash session, take an order on the POS terminal and complete your first payment.',
    action: 'pos_terminal',
    actionLabel: 'Open POS Terminal',
    check: async (restaurantId) => {
      const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId).eq('status', 'paid')
      return (count ?? 0) > 0
    }
  },
  {
    id: 'supplier',
    icon: '🛒',
    title: 'Add your first supplier',
    desc: 'Set up your key suppliers so you can raise purchase orders and track costs.',
    action: 'suppliers',
    actionLabel: 'Open Suppliers',
    check: async (restaurantId) => {
      const { count } = await supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('restaurant_id', restaurantId)
      return (count ?? 0) > 0
    }
  },
  {
    id: 'customer',
    icon: '🤝',
    title: 'Set up your loyalty programme',
    desc: 'Configure points earning rates and tiers to reward your returning customers.',
    action: 'sales_loyalty',
    actionLabel: 'Open Loyalty',
    check: async (restaurantId) => {
      const { data } = await supabase.from('loyalty_settings').select('points_per_aed').eq('restaurant_id', restaurantId).single()
      return !!(data?.points_per_aed)
    }
  },
]

export default function Onboarding({ restaurantId, onNavigate, onDismiss }) {
  const [statuses, setStatuses] = useState({})
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    checkAll()
  }, [restaurantId])

  async function checkAll() {
    setLoading(true)
    const results = {}
    await Promise.all(STEPS.map(async step => {
      try { results[step.id] = await step.check(restaurantId) }
      catch { results[step.id] = false }
    }))
    setStatuses(results)
    setLoading(false)
  }

  const completed = STEPS.filter(s => statuses[s.id]).length
  const pct = Math.round((completed / STEPS.length) * 100)
  const allDone = completed === STEPS.length

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Getting started</h2>
          <p className={styles.sub}>{allDone ? '🎉 You\'re all set! Your restaurant is fully configured.' : `Complete these steps to get the most out of BiteERP`}</p>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.progressCircle}>
            <svg viewBox="0 0 36 36" width="64" height="64">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--bg-input)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--accent)" strokeWidth="3"
                strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset="25"
                strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
            </svg>
            <div className={styles.circleLabel}>{completed}/{STEPS.length}</div>
          </div>
          {onDismiss && (
            <button className={styles.dismissBtn} onClick={onDismiss}>Dismiss</button>
          )}
        </div>
      </div>

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: pct + '%' }} />
      </div>

      {loading ? (
        <div className={styles.checkingText}>Checking setup status…</div>
      ) : (
        <div className={styles.steps}>
          {STEPS.map((step, i) => {
            const done = statuses[step.id]
            const isOpen = expanded === step.id
            return (
              <div key={step.id} className={styles.step} data-done={done} data-open={isOpen}>
                <button className={styles.stepHeader} onClick={() => setExpanded(isOpen ? null : step.id)}>
                  <div className={styles.stepCheck} data-done={done}>
                    {done ? '✓' : <span className={styles.stepNum}>{i + 1}</span>}
                  </div>
                  <div className={styles.stepIcon}>{step.icon}</div>
                  <div className={styles.stepTitle}>{step.title}</div>
                  <div className={styles.stepArrow} data-open={isOpen}>›</div>
                </button>
                {isOpen && (
                  <div className={styles.stepBody}>
                    <p className={styles.stepDesc}>{step.desc}</p>
                    <div className={styles.stepActions}>
                      <button className={styles.goBtn} onClick={() => { onNavigate?.(step.action) }}>
                        {step.actionLabel} →
                      </button>
                      {!done && (
                        <button className={styles.refreshBtn} onClick={checkAll}>↻ Check again</button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
