import { useState, useEffect } from 'react'
import { loadTeamFull, updateTeamMember, saveUserPermissions, loadUserPermissions, inviteTeamMember } from './supabase.js'

const ROLES = [
  { value: 'owner',   label: 'Owner',   color: '#8e44ad', desc: 'Full access — billing, settings, all modules' },
  { value: 'manager', label: 'Manager', color: '#2980b9', desc: 'All modules except user management & billing' },
  { value: 'cashier', label: 'Cashier', color: '#27ae60', desc: 'POS terminal, daily sales, and cash sessions' },
  { value: 'viewer',  label: 'Viewer',  color: '#7f8c8d', desc: 'Read-only access to reports and dashboard'   },
]

const MODULES = [
  { key: 'pos',        label: '🍽 POS',        desc: 'Terminal, menu, tables, kitchen display' },
  { key: 'purchase',   label: '🛒 Purchase',   desc: 'Quotations, purchase orders, suppliers'   },
  { key: 'sales',      label: '💼 Sales',      desc: 'Sales orders, delivery, promotions'       },
  { key: 'inventory',  label: '📦 Inventory',  desc: 'Stock levels, movements, wastage'         },
  { key: 'production', label: '⚗️ Production', desc: 'Recipes, ingredients, production log'     },
  { key: 'accounting', label: '📊 Accounting', desc: 'Invoices, bills, journal entries, reports'},
  { key: 'contacts',   label: '👥 Contacts',   desc: 'Customers, suppliers, loyalty'            },
  { key: 'import',     label: '📥 Import',     desc: 'Data import and migration tools'          },
  { key: 'branches',   label: '🏪 Branches',   desc: 'Branch management and stock transfers'    },
  { key: 'settings',   label: '⚙ Settings',   desc: 'Company, users, hardware configuration'   },
]

const ROLE_DEFAULTS = {
  owner:   { modules: MODULES.map(m => m.key), canWrite: true, canDelete: true },
  manager: { modules: ['pos','purchase','sales','inventory','production','accounting','contacts','import','branches'], canWrite: true, canDelete: false },
  cashier: { modules: ['pos'], canWrite: true, canDelete: false },
  viewer:  { modules: ['inventory','accounting','contacts'], canWrite: false, canDelete: false },
}

const AVATAR_COLORS = ['#0D7377','#2980b9','#8e44ad','#27ae60','#e67e22','#c0392b','#16a085','#d35400']

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  return parts.length > 1 ? parts[0][0] + parts[parts.length-1][0] : parts[0].slice(0,2)
}

function timeSince(date) {
  if (!date) return 'Never'
  const diff = Date.now() - new Date(date)
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'Just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return new Date(date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })
}

export default function UsersAccess({ restaurantId, userId, session }) {
  const [members,   setMembers]   = useState([])
  const [loading,   setLoading]   = useState(true)
  const [selUser,   setSelUser]   = useState(null)
  const [userPerms, setUserPerms] = useState([])
  const [saving,    setSaving]    = useState(false)
  const [view,      setView]      = useState('list') // list | detail
  const [editForm,  setEditForm]  = useState({})

  // Invite
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState('cashier')
  const [inviteMsg,   setInviteMsg]   = useState('')

  const isOwner = session?.role === 'owner'

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    load()
  }, [restaurantId])

  async function load() {
    setLoading(true)
    try { setMembers(await loadTeamFull(restaurantId)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const openDetail = async (m) => {
    setSelUser(m)
    setEditForm({ full_name: m.full_name, job_title: m.job_title || '', phone: m.phone || '', avatar_color: m.avatar_color || '#0D7377' })
    const perms = await loadUserPermissions(restaurantId, m.id)
    // Fill defaults for any missing modules
    const filled = MODULES.map(mod => {
      const existing = perms.find(p => p.module === mod.key)
      const def      = ROLE_DEFAULTS[m.role] ?? ROLE_DEFAULTS.viewer
      return existing ?? {
        module:     mod.key,
        can_read:   def.modules.includes(mod.key),
        can_write:  def.modules.includes(mod.key) && def.canWrite,
        can_delete: def.modules.includes(mod.key) && def.canDelete,
      }
    })
    setUserPerms(filled)
    setView('detail')
  }

  const saveDetail = async () => {
    if (!selUser) return
    setSaving(true)
    try {
      await updateTeamMember(selUser.id, editForm)
      await saveUserPermissions(restaurantId, selUser.id, userPerms)
      await load()
      setView('list')
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const changeRole = async (memberId, newRole) => {
    await updateTeamMember(memberId, { role: newRole })
    await load()
  }

  const removeMember = async (memberId) => {
    if (!confirm('Remove this user from the restaurant?')) return
    await updateTeamMember(memberId, { restaurant_id: null })
    await load()
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return
    setSaving(true)
    try {
      await inviteTeamMember(inviteEmail.trim(), inviteRole, restaurantId)
      setInviteMsg(`Invitation sent to ${inviteEmail}. They will receive an email to join.`)
      setInviteEmail('')
    } catch (e) {
      setInviteMsg(`Send this link to ${inviteEmail}: ${window.location.origin} — ask them to sign up, then they will appear in this list.`)
    }
    setSaving(false)
  }

  const togglePerm = (moduleKey, field) => {
    setUserPerms(prev => prev.map(p =>
      p.module === moduleKey ? { ...p, [field]: !p[field] } : p
    ))
  }

  const applyRoleDefaults = (role) => {
    const def = ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS.viewer
    setUserPerms(MODULES.map(mod => ({
      module:     mod.key,
      can_read:   def.modules.includes(mod.key),
      can_write:  def.modules.includes(mod.key) && def.canWrite,
      can_delete: def.modules.includes(mod.key) && def.canDelete,
    })))
  }

  const SI = { background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' }
  const SL = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: 5 }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading team…</div>

  // ── DETAIL VIEW ──
  if (view === 'detail' && selUser) return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => setView('list')} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: selUser.avatar_color || '#0D7377', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {getInitials(selUser.full_name)}
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{selUser.full_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selUser.email}</div>
          </div>
        </div>
        <button onClick={saveDetail} disabled={saving} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 20px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* Profile fields */}
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem' }}>Profile</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Full name',  field: 'full_name'  },
              { label: 'Job title',  field: 'job_title'  },
              { label: 'Phone',      field: 'phone'      },
            ].map(f => (
              <div key={f.field}>
                <label style={SL}>{f.label}</label>
                <input value={editForm[f.field] ?? ''} onChange={e => setEditForm(p => ({ ...p, [f.field]: e.target.value }))} style={SI} />
              </div>
            ))}
            <div>
              <label style={SL}>Avatar colour</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {AVATAR_COLORS.map(c => (
                  <button key={c} onClick={() => setEditForm(p => ({ ...p, avatar_color: c }))}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: editForm.avatar_color === c ? '3px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Role */}
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem' }}>Role & access level</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ROLES.map(r => (
              <div key={r.value} onClick={() => { if (isOwner && selUser.id !== userId) { changeRole(selUser.id, r.value); applyRoleDefaults(r.value) } }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--radius)', border: `1px solid ${selUser.role === r.value ? r.color : 'var(--border)'}`, background: selUser.role === r.value ? r.color + '15' : 'var(--bg-input)', cursor: isOwner ? 'pointer' : 'default' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{r.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.desc}</div>
                </div>
                {selUser.role === r.value && <span style={{ fontSize: 11, fontWeight: 600, color: r.color }}>Current</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Module permissions */}
      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Module permissions</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {ROLES.map(r => (
              <button key={r.value} onClick={() => applyRoleDefaults(r.value)}
                style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '4px 10px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Apply {r.label} defaults
              </button>
            ))}
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr>
            {['Module','Read','Write','Delete'].map(h => (
              <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Module' ? 'left' : 'center', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {MODULES.map(mod => {
              const perm = userPerms.find(p => p.module === mod.key) ?? { can_read: false, can_write: false, can_delete: false }
              return (
                <tr key={mod.key}>
                  <td style={{ padding: '10px 10px', borderBottom: '0.5px solid var(--border)' }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{mod.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{mod.desc}</div>
                  </td>
                  {['can_read','can_write','can_delete'].map(field => (
                    <td key={field} style={{ padding: '10px', borderBottom: '0.5px solid var(--border)', textAlign: 'center' }}>
                      <button onClick={() => isOwner && togglePerm(mod.key, field)}
                        style={{ width: 24, height: 24, borderRadius: 6, border: `1px solid ${perm[field] ? 'var(--accent)' : 'var(--border)'}`, background: perm[field] ? 'var(--accent)' : 'var(--bg-input)', color: perm[field] ? '#fff' : 'var(--text-muted)', fontSize: 12, cursor: isOwner ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                        {perm[field] ? '✓' : ''}
                      </button>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Last activity */}
      <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Activity</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            { label: 'Last seen',   val: timeSince(selUser.last_seen_at) },
            { label: 'Status',      val: selUser.is_online ? '🟢 Online' : '⚫ Offline' },
            { label: 'Member since',val: new Date(selUser.created_at).toLocaleDateString('en-AE', { month: 'short', year: 'numeric' }) },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius)', padding: '12px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{k.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ── LIST VIEW ──
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>Users & Access</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Manage team members, roles, and module-level permissions.</p>
        </div>
      </div>

      {/* Team grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: '1.25rem' }}>
        {members.map(m => {
          const role     = ROLES.find(r => r.value === m.role) ?? ROLES[1]
          const isOnline = m.is_online && m.last_seen_at && (Date.now() - new Date(m.last_seen_at)) < 300000 // 5 min
          return (
            <div key={m.id} onClick={() => openDetail(m)}
              style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', cursor: 'pointer', transition: 'border-color 0.13s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: m.avatar_color || '#0D7377', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                    {getInitials(m.full_name)}
                  </div>
                  <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: isOnline ? '#27ae60' : '#7f8c8d', border: '2px solid var(--bg-surface)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.full_name ?? '—'}
                    {m.id === userId && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--text-muted)' }}>(you)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.job_title || m.email || '—'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: role.color + '18', color: role.color }}>
                  {role.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {isOnline ? '🟢 Online' : timeSince(m.last_seen_at)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Invite */}
      {isOwner && (
        <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>Invite team member</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'end' }}>
            <div>
              <label style={SL}>Email address</label>
              <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                style={SI} placeholder="colleague@email.com" />
            </div>
            <div>
              <label style={SL}>Role</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ ...SI, width: 130 }}>
                {ROLES.filter(r => r.value !== 'owner').map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button onClick={handleInvite} disabled={saving || !inviteEmail.trim()}
              style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: (!inviteEmail.trim() || saving) ? 0.6 : 1, height: 38, whiteSpace: 'nowrap' }}>
              {saving ? '…' : 'Send invite'}
            </button>
          </div>
          {inviteMsg && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--accent)', padding: '8px 12px', background: 'var(--accent-dim)', borderRadius: 'var(--radius)' }}>{inviteMsg}</div>}
        </div>
      )}
    </div>
  )
}
