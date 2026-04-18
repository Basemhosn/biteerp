import { useState, useEffect } from 'react'
import { loadPOSPermissions, savePOSPermissions } from './supabase.js'

export default function POSPermissions({ restaurantId, session }) {
  const [perms,   setPerms]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [showPIN, setShowPIN] = useState(false)

  const isManager = session?.role === 'owner' || session?.role === 'manager'

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    loadPOSPermissions(restaurantId)
      .then(p => setPerms(p || {
        max_discount_cashier: 10, max_discount_manager: 100,
        require_override_void: true, require_override_refund: true,
        require_override_discount: true, require_override_price_edit: false,
        manager_pin: '0000', cashier_can_reopen: false, cashier_can_delete_item: true,
      }))
      .catch(() => setPerms({
        max_discount_cashier: 10, max_discount_manager: 100,
        require_override_void: true, require_override_refund: true,
        require_override_discount: true, require_override_price_edit: false,
        manager_pin: '0000', cashier_can_reopen: false, cashier_can_delete_item: true,
      }))
      .finally(() => setLoading(false))
  }, [restaurantId])

  const set = (f, v) => setPerms(p => ({ ...p, [f]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await savePOSPermissions(restaurantId, perms)
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  if (loading || !perms) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
  if (!isManager) return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>🔒 Only managers can configure POS permissions.</div>

  const S = {
    card:   { background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 12 },
    title:  { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '0.5px solid var(--border)' },
    row:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid var(--border)' },
    rowLast:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' },
    label:  { fontSize: 13, color: 'var(--text-primary)' },
    sub:    { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
    toggle: (on) => ({ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 14px', background: on ? 'rgba(39,174,96,0.1)' : 'var(--bg-input)', border: `0.5px solid ${on ? '#27ae60' : 'var(--border)'}`, borderRadius: 999, color: on ? '#27ae60' : 'var(--text-muted)', cursor: isManager ? 'pointer' : 'not-allowed' }),
    numInput: { background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '6px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: 80, textAlign: 'right' },
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>POS Permissions</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Control what cashiers can do without a manager override PIN.</p>
        </div>
      </div>

      {/* Manager PIN */}
      <div style={S.card}>
        <div style={S.title}>Manager override PIN</div>
        <div style={S.rowLast}>
          <div>
            <div style={S.label}>4-digit PIN for manager overrides</div>
            <div style={S.sub}>Required when cashiers attempt restricted actions (void, refund, high discount)</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type={showPIN ? 'text' : 'password'}
              value={perms.manager_pin ?? '0000'}
              onChange={e => { if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) set('manager_pin', e.target.value) }}
              maxLength={4}
              style={{ ...S.numInput, letterSpacing: showPIN ? 0 : 6, fontSize: 18, width: 100, textAlign: 'center' }}
            />
            <button onClick={() => setShowPIN(p => !p)}
              style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '5px 10px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              {showPIN ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>
      </div>

      {/* Override gates */}
      <div style={S.card}>
        <div style={S.title}>Override requirements</div>
        {[
          { label: 'Void order', sub: 'Cashier must get manager PIN to void an entire order', field: 'require_override_void' },
          { label: 'Issue refund', sub: 'Cashier must get manager PIN to process any refund', field: 'require_override_refund' },
          { label: 'Apply discount above limit', sub: 'Cashier must get manager PIN for discounts exceeding the max % below', field: 'require_override_discount' },
          { label: 'Edit item price', sub: 'Cashier must get manager PIN to manually change an item price', field: 'require_override_price_edit' },
        ].map((r, i, arr) => (
          <div key={r.field} style={i === arr.length - 1 ? S.rowLast : S.row}>
            <div>
              <div style={S.label}>{r.label}</div>
              <div style={S.sub}>{r.sub}</div>
            </div>
            <button onClick={() => set(r.field, !perms[r.field])} style={S.toggle(perms[r.field])}>
              {perms[r.field] ? '● Required' : '○ Not required'}
            </button>
          </div>
        ))}
      </div>

      {/* Discount limits */}
      <div style={S.card}>
        <div style={S.title}>Discount limits</div>
        {[
          { label: 'Max discount — Cashier (%)', sub: 'Cashier can apply up to this % without override', field: 'max_discount_cashier' },
          { label: 'Max discount — Manager (%)', sub: 'Maximum discount any manager can apply', field: 'max_discount_manager' },
        ].map((r, i, arr) => (
          <div key={r.field} style={i === arr.length - 1 ? S.rowLast : S.row}>
            <div>
              <div style={S.label}>{r.label}</div>
              <div style={S.sub}>{r.sub}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="number" min="0" max="100" value={perms[r.field] ?? 0}
                onChange={e => set(r.field, parseFloat(e.target.value) || 0)}
                style={S.numInput} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Cashier capabilities */}
      <div style={S.card}>
        <div style={S.title}>Cashier capabilities</div>
        {[
          { label: 'Can reopen closed orders', sub: 'Allow cashiers to reopen paid orders', field: 'cashier_can_reopen' },
          { label: 'Can remove items before firing', sub: 'Allow cashiers to delete items from an open order', field: 'cashier_can_delete_item' },
        ].map((r, i, arr) => (
          <div key={r.field} style={i === arr.length - 1 ? S.rowLast : S.row}>
            <div>
              <div style={S.label}>{r.label}</div>
              <div style={S.sub}>{r.sub}</div>
            </div>
            <button onClick={() => set(r.field, !perms[r.field])} style={S.toggle(perms[r.field])}>
              {perms[r.field] ? '● Allowed' : '○ Not allowed'}
            </button>
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving}
        style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '10px 28px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save permissions'}
      </button>
    </div>
  )
}
