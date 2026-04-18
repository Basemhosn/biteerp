import { useState, useEffect, useRef } from 'react'
import { supabase, getUnreadCount } from './supabase.js'

const n = v => parseFloat(v) || 0

export default function NotificationBell({ restaurantId, onNavigate }) {
  const [open,   setOpen]   = useState(false)
  const [notifs, setNotifs] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (!restaurantId) return
    loadNotifs()
    const interval = setInterval(loadNotifs, 60_000) // refresh every minute
    return () => clearInterval(interval)
  }, [restaurantId])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function loadNotifs() {
    const items = []

    try {
      // Low stock alerts
      const { data: ings } = await supabase
        .from('ingredients')
        .select('name, stock_qty, min_stock, unit')
        .eq('restaurant_id', restaurantId)
        .eq('active', true)
      const low = (ings ?? []).filter(i => n(i.min_stock) > 0 && n(i.stock_qty) <= n(i.min_stock))
      if (low.length > 0) {
        items.push({
          id: 'low-stock',
          type: 'warning',
          icon: '📦',
          title: `${low.length} ingredient${low.length > 1 ? 's' : ''} low on stock`,
          body: low.slice(0, 3).map(i => `${i.name} (${n(i.stock_qty)} ${i.unit})`).join(', ') + (low.length > 3 ? `… +${low.length - 3} more` : ''),
          action: 'inv_stock',
          actionLabel: 'View stock',
          time: null,
        })
      }
    } catch {}

    try {
      // Open purchase orders (sent, not received)
      const { count } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'sent')
      if (count > 0) {
        items.push({
          id: 'open-pos',
          type: 'info',
          icon: '🛒',
          title: `${count} purchase order${count > 1 ? 's' : ''} awaiting delivery`,
          body: 'Confirm receipt when goods arrive.',
          action: 'pur_orders',
          actionLabel: 'View orders',
          time: null,
        })
      }
    } catch {}

    try {
      // Open POS orders on tables
      const { count: openOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .in('status', ['open', 'sent'])
      if (openOrders > 0) {
        items.push({
          id: 'open-orders',
          type: 'info',
          icon: '🧾',
          title: `${openOrders} open order${openOrders > 1 ? 's' : ''} on tables`,
          body: 'Active orders awaiting payment.',
          action: 'pos_terminal',
          actionLabel: 'Go to POS',
          time: null,
        })
      }
    } catch {}

    try {
      // Overdue invoices
      const today = new Date().toISOString().slice(0,10)
      const { data: overdueInvs } = await supabase
        .from('invoices')
        .select('id, total, partner_name, type')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'posted')
        .lt('due_date', today)
      if (overdueInvs?.length > 0) {
        const invs  = overdueInvs.filter(i => i.type === 'invoice')
        const bills = overdueInvs.filter(i => i.type === 'bill')
        if (invs.length > 0) {
          items.push({
            id: 'overdue-invoices', type: 'error', icon: '⚠',
            title: `${invs.length} overdue invoice${invs.length > 1 ? 's' : ''}`,
            body: `AED ${invs.reduce((s,i) => s + n(i.total), 0).toFixed(0)} outstanding from customers`,
            action: 'acc_invoices', actionLabel: 'View invoices',
          })
        }
        if (bills.length > 0) {
          items.push({
            id: 'overdue-bills', type: 'warning', icon: '📄',
            title: `${bills.length} overdue bill${bills.length > 1 ? 's' : ''}`,
            body: `AED ${bills.reduce((s,i) => s + n(i.total), 0).toFixed(0)} payable to suppliers`,
            action: 'acc_bills', actionLabel: 'View bills',
          })
        }
      }
    } catch {}

    try {
      // Branch transfers in transit
      const { count: transitCount } = await supabase
        .from('branch_transfers')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('status', 'sent')
      if (transitCount > 0) {
        items.push({
          id: 'branch-transfers', type: 'info', icon: '🔄',
          title: `${transitCount} branch transfer${transitCount > 1 ? 's' : ''} awaiting receipt`,
          body: 'Stock in transit between branches — confirm on arrival.',
          action: 'inv_transfers', actionLabel: 'View transfers',
        })
      }
    } catch {}

    try {
      // Open cashier shifts (might be forgotten)
      const { data: shifts } = await supabase
        .from('cashier_shifts')
        .select('cashier_name, opened_at')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'open')
      if (shifts?.length > 0) {
        const old = shifts.filter(s => {
          const hrs = (Date.now() - new Date(s.opened_at)) / 3600000
          return hrs > 12
        })
        if (old.length > 0) {
          items.push({
            id: 'open-shifts', type: 'warning', icon: '👤',
            title: `${old.length} shift${old.length > 1 ? 's' : ''} open for over 12 hours`,
            body: old.map(s => s.cashier_name).join(', '),
            action: 'pos_terminal', actionLabel: 'Go to POS',
          })
        }
      }
    } catch {}

    try {
      // Unpaid VAT — check if last quarter has sales but no VAT filed
      const { data: latestSale } = await supabase
        .from('orders')
        .select('closed_at')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'paid')
        .order('closed_at', { ascending: false })
        .limit(1)
      if (latestSale?.[0]) {
        const daysSinceLastSale = (Date.now() - new Date(latestSale[0].closed_at)) / (1000 * 60 * 60 * 24)
        if (daysSinceLastSale < 90) {
          items.push({
            id: 'vat-reminder',
            type: 'info',
            icon: '🧾',
            title: 'UAE VAT filing reminder',
            body: 'Check your VAT summary and file quarterly returns on time.',
            action: 'acc_vat',
            actionLabel: 'VAT summary',
            time: null,
          })
        }
      }
    } catch {}

    try {
      const unreadChat = await getUnreadCount(restaurantId, restaurantId) // uses restaurantId as stand-in for general chat
      if (unreadChat > 0) {
        items.unshift({
          id: 'unread-chat', type: 'info', icon: '💬',
          title: `${unreadChat} unread team message${unreadChat > 1 ? 's' : ''}`,
          body: 'Your teammates have been active in the chat.',
          action: 'settings_chatter', actionLabel: 'Open chat',
        })
      }
    } catch {}

    setNotifs(items)
    setUnread(items.length)
  }

  const handleAction = (action) => {
    onNavigate(action)
    setOpen(false)
  }

  const TYPE_COLORS = {
    warning: { color: '#e67e22', bg: 'rgba(230,126,34,0.1)', border: 'rgba(230,126,34,0.25)' },
    error:   { color: '#c0392b', bg: 'rgba(192,57,43,0.08)', border: 'rgba(192,57,43,0.2)'  },
    info:    { color: 'var(--accent)', bg: 'var(--accent-dim)', border: 'rgba(13,115,119,0.2)' },
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(v => !v); if (!open) setUnread(0) }}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          padding: '6px 8px', borderRadius: 8, position: 'relative',
          color: 'rgba(255,255,255,0.7)', fontSize: 18, lineHeight: 1,
          transition: 'color 0.15s',
        }}
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: '#d47060', color: '#fff',
            fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-body)',
            borderRadius: 999, minWidth: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', lineHeight: 1,
          }}>{unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 340, background: 'var(--bg-surface)',
          border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', zIndex: 999,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', borderBottom: '0.5px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</span>
            <button onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
          </div>

          {notifs.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              All clear — no alerts
            </div>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {notifs.map(notif => {
                const tc = TYPE_COLORS[notif.type] ?? TYPE_COLORS.info
                return (
                  <div key={notif.id} style={{
                    padding: '12px 16px', borderBottom: '0.5px solid var(--border)',
                    background: tc.bg, borderLeft: `3px solid ${tc.color}`,
                  }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 18, lineHeight: 1.4 }}>{notif.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                          {notif.title}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>
                          {notif.body}
                        </div>
                        {notif.action && (
                          <button
                            onClick={() => handleAction(notif.action)}
                            style={{
                              fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
                              padding: '4px 10px', background: 'transparent',
                              border: `0.5px solid ${tc.color}`, borderRadius: 6,
                              color: tc.color, cursor: 'pointer',
                            }}
                          >
                            {notif.actionLabel} →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{
            padding: '10px 16px', borderTop: '0.5px solid var(--border)',
            display: 'flex', justifyContent: 'flex-end',
          }}>
            <button onClick={loadNotifs}
              style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
              ↻ Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
