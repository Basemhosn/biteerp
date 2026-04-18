import { useState, useEffect, useRef } from 'react'
import UsersAccess from './UsersAccess.jsx'
import { supabase, updateProfile, loadCompanyProfile, saveCompanyProfile, uploadCompanyLogo } from './supabase.js'
import styles from './Settings.module.css'

const ROLES = [
  { value: 'owner',   label: 'Owner',   desc: 'Full access to everything including settings' },
  { value: 'manager', label: 'Manager', desc: 'Access to all modules except user management' },
  { value: 'cashier', label: 'Cashier', desc: 'POS terminal and daily sales only' },
  { value: 'viewer',  label: 'Viewer',  desc: 'Read-only access to reports and dashboard' },
]

export default function Settings({ session, onSessionUpdate }) {
  const [tab,         setTab]         = useState('profile')
  const [teamMembers, setTeamMembers] = useState([])
  const [loading,     setLoading]     = useState(false)

  // Profile state
  const [fullName,   setFullName]   = useState(session?.fullName ?? '')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [pwCurrent,  setPwCurrent]  = useState('')
  const [pwNew,      setPwNew]      = useState('')
  const [pwConfirm,  setPwConfirm]  = useState('')
  const [pwError,    setPwError]    = useState('')
  const [pwSaved,    setPwSaved]    = useState(false)

  // Restaurant state
  const [restName,   setRestName]   = useState(session?.restaurant?.name ?? '')

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState('manager')
  const [inviteMsg,   setInviteMsg]   = useState('')

  const isOwner = session?.role === 'owner'

  useEffect(() => {
    if (tab === 'team' && session?.restaurantId) loadTeam()
  }, [tab])

  async function loadTeam() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at')
        .eq('restaurant_id', session.restaurantId)
      setTeamMembers(data ?? [])
    } catch {}
    setLoading(false)
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      await updateProfile(session.userId, { full_name: fullName })
      onSessionUpdate?.({ ...session, fullName })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const savePassword = async () => {
    if (pwNew.length < 6)        { setPwError('Min. 6 characters'); return }
    if (pwNew !== pwConfirm)     { setPwError("Passwords don't match"); return }
    setPwError('')
    setSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pwNew })
      if (error) throw error
      setPwCurrent(''); setPwNew(''); setPwConfirm('')
      setPwSaved(true)
      setTimeout(() => setPwSaved(false), 2000)
    } catch (e) { setPwError(e.message) }
    setSaving(false)
  }

  const saveRestaurant = async () => {
    if (!restName.trim()) return
    setSaving(true)
    try {
      await supabase.from('restaurants').update({ name: restName }).eq('id', session.restaurantId)
      onSessionUpdate?.({ ...session, restaurant: { ...session.restaurant, name: restName } })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const changeRole = async (userId, newRole) => {
    if (!isOwner) return
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    await loadTeam()
  }

  const removeMember = async (userId) => {
    if (!isOwner) return
    if (!confirm('Remove this team member?')) return
    await supabase.from('profiles').update({ restaurant_id: null, role: 'manager' }).eq('id', userId)
    await loadTeam()
  }

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteMsg('')
    try {
      // Create a placeholder — real invite requires Supabase Edge Function
      // For now show instructions
      setInviteMsg(`Send this link to ${inviteEmail}: ${window.location.origin} — ask them to sign up, then you can assign them to this restaurant from the team list.`)
    } catch (e) { setInviteMsg('Error: ' + e.message) }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Settings</h2>
          <p className={styles.pageSub}>Manage your profile, restaurant, and team access.</p>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Sidebar tabs */}
        <div className={styles.sidebar}>
          {[
            { key: 'profile',    label: 'My Profile',    icon: '👤' },
            { key: 'restaurant', label: 'Company',       icon: '🏢' },
            { key: 'team',       label: 'Users & Access', icon: '👥' },
            { key: 'security',   label: 'Security',      icon: '🔒' },
          ].map(t => (
            <button key={t.key} className={styles.sideTab} data-active={tab === t.key} onClick={() => setTab(t.key)}>
              <span className={styles.sideTabIcon}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={styles.content}>

          {/* Profile */}
          {tab === 'profile' && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>My profile</div>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label className={styles.label}>Full name</label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)}
                    className={styles.input} placeholder="Your name" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Email</label>
                  <input value={session?.email ?? ''} disabled className={`${styles.input} ${styles.inputDisabled}`} />
                  <span className={styles.fieldNote}>Email cannot be changed here</span>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Role</label>
                  <div className={styles.roleBadge}>{ROLES.find(r => r.value === session?.role)?.label ?? session?.role}</div>
                  <span className={styles.fieldNote}>{ROLES.find(r => r.value === session?.role)?.desc}</span>
                </div>
              </div>
              <button className={styles.saveBtn} onClick={saveProfile} disabled={saving}>
                {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}

          {/* Company Profile */}
          {tab === 'restaurant' && (
            <CompanyProfileTab
              session={session}
              isOwner={isOwner}
              onUpdate={onSessionUpdate}
            />
          )}

          {/* Team */}
          {tab === 'team' && (
            <UsersAccess
              restaurantId={session?.restaurantId}
              userId={session?.userId}
              session={session}
            />
          )}


        </div>
      </div>
    </div>
  )
}

// ── Company Profile Tab ───────────────────────────────────────
function CompanyProfileTab({ session, isOwner, onUpdate }) {
  const [profile,  setProfile]  = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [uploading,setUploading]= useState(false)
  const fileRef = useRef ? useRef() : { current: null }

  useEffect(() => {
    if (!session?.restaurantId) return
    loadCompanyProfile(session.restaurantId).then(setProfile).catch(() => {})
  }, [session?.restaurantId])

  const set = (field, val) => setProfile(p => ({ ...p, [field]: val }))

  const save = async () => {
    if (!profile || !isOwner) return
    setSaving(true)
    try {
      await saveCompanyProfile(session.restaurantId, {
        name:           profile.name,
        trade_name:     profile.trade_name,
        trn:            profile.trn,
        address_line1:  profile.address_line1,
        address_line2:  profile.address_line2,
        city:           profile.city,
        phone:          profile.phone,
        email:          profile.email,
        website:        profile.website,
        bank_name:      profile.bank_name,
        bank_iban:      profile.bank_iban,
        bank_swift:     profile.bank_swift,
        po_terms:       profile.po_terms,
        po_notes:       profile.po_notes,
        po_prefix:      profile.po_prefix,
        quote_prefix:   profile.quote_prefix,
      })
      onUpdate?.({ ...session, restaurant: { ...session.restaurant, name: profile.name } })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleLogo = async (file) => {
    if (!file || !isOwner) return
    setUploading(true)
    try {
      const url = await uploadCompanyLogo(session.restaurantId, file)
      await saveCompanyProfile(session.restaurantId, { logo_url: url })
      setProfile(p => ({ ...p, logo_url: url }))
    } catch (e) {
      // Storage bucket may not be set up — store as base64 locally
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const url = ev.target.result
        setProfile(p => ({ ...p, logo_url: url }))
        try { await saveCompanyProfile(session.restaurantId, { logo_url: url }) } catch {}
      }
      reader.readAsDataURL(file)
    }
    setUploading(false)
  }

  if (!profile) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>

  const S = {
    section:   { background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1rem' },
    title:     { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '0.5px solid var(--border)' },
    grid:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 },
    field:     { display: 'flex', flexDirection: 'column', gap: 5 },
    label:     { fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 },
    input:     { background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' },
    textarea:  { background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%', resize: 'vertical', minHeight: 72 },
    disabled:  { opacity: 0.5, cursor: 'not-allowed' },
    notice:    { background: 'rgba(200,169,110,0.1)', border: '0.5px solid rgba(200,169,110,0.3)', borderRadius: 'var(--radius)', padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', marginBottom: '1rem' },
  }

  const inp = (field, placeholder, opts = {}) => (
    <input
      style={{ ...S.input, ...((!isOwner || opts.disabled) ? S.disabled : {}) }}
      value={profile[field] ?? ''}
      onChange={e => set(field, e.target.value)}
      placeholder={placeholder}
      disabled={!isOwner || opts.disabled}
      type={opts.type ?? 'text'}
    />
  )

  return (
    <div>
      {!isOwner && <div style={S.notice}>Only the owner can edit company settings.</div>}

      {/* Logo + basic info */}
      <div style={S.section}>
        <div style={S.title}>Company identity</div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Logo upload */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 100, height: 100, border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'var(--bg-input)', cursor: isOwner ? 'pointer' : 'default' }}
              onClick={() => isOwner && document.getElementById('logoUpload')?.click()}>
              {profile.logo_url
                ? <img src={profile.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : <span style={{ fontSize: 28, opacity: 0.3 }}>🏢</span>
              }
            </div>
            {isOwner && (
              <>
                <button onClick={() => document.getElementById('logoUpload')?.click()}
                  style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '5px 12px', background: 'var(--accent-dim)', border: '0.5px solid var(--accent)', borderRadius: 'var(--radius)', color: 'var(--accent)', cursor: 'pointer' }}>
                  {uploading ? 'Uploading…' : '↑ Upload logo'}
                </button>
                <input id="logoUpload" type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => handleLogo(e.target.files[0])} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>PNG, JPG, SVG<br/>Appears on documents</span>
              </>
            )}
          </div>

          {/* Name fields */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, minWidth: 280 }}>
            <div style={S.field}>
              <label style={S.label}>Legal / trading name *</label>
              {inp('name', 'e.g. Al Barsha Grill LLC')}
            </div>
            <div style={S.field}>
              <label style={S.label}>Display name</label>
              {inp('trade_name', 'e.g. Al Barsha Grill')}
            </div>
            <div style={S.field}>
              <label style={S.label}>TRN (UAE Tax Reg. Number)</label>
              {inp('trn', '100-XXXXXX-XXXXX-1')}
            </div>
            <div style={S.field}>
              <label style={S.label}>Document prefix (PO)</label>
              {inp('po_prefix', 'PO')}
            </div>
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div style={S.section}>
        <div style={S.title}>Contact details</div>
        <div style={S.grid}>
          <div style={S.field}><label style={S.label}>Address line 1</label>{inp('address_line1', 'Street / Building')}</div>
          <div style={S.field}><label style={S.label}>Address line 2</label>{inp('address_line2', 'Area / District')}</div>
          <div style={S.field}><label style={S.label}>City</label>{inp('city', 'Dubai')}</div>
          <div style={S.field}><label style={S.label}>Country</label><input style={{ ...S.input, ...S.disabled }} value="UAE" disabled /></div>
          <div style={S.field}><label style={S.label}>Phone</label>{inp('phone', '+971 4 XXX XXXX')}</div>
          <div style={S.field}><label style={S.label}>Email</label>{inp('email', 'info@yourrestaurant.com', { type: 'email' })}</div>
          <div style={{ ...S.field, gridColumn: '1/-1' }}><label style={S.label}>Website</label>{inp('website', 'https://yourrestaurant.com')}</div>
        </div>
      </div>

      {/* Banking */}
      <div style={S.section}>
        <div style={S.title}>Banking details <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>— appears on purchase documents</span></div>
        <div style={S.grid}>
          <div style={S.field}><label style={S.label}>Bank name</label>{inp('bank_name', 'e.g. Emirates NBD')}</div>
          <div style={S.field}><label style={S.label}>SWIFT / BIC</label>{inp('bank_swift', 'e.g. EBILAEAD')}</div>
          <div style={{ ...S.field, gridColumn: '1/-1' }}><label style={S.label}>IBAN</label>{inp('bank_iban', 'AE XX XXXX XXXX XXXX XXXX XXX')}</div>
        </div>
      </div>

      {/* Document defaults */}
      <div style={S.section}>
        <div style={S.title}>Document defaults</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
          <div style={S.field}>
            <label style={S.label}>Default payment terms (appears on POs)</label>
            <textarea style={{ ...S.textarea, ...((!isOwner) ? S.disabled : {}) }}
              value={profile.po_terms ?? ''}
              onChange={e => set('po_terms', e.target.value)}
              disabled={!isOwner}
              placeholder="e.g. Payment due within 30 days of invoice date." />
          </div>
          <div style={S.field}>
            <label style={S.label}>Default PO notes / footer</label>
            <textarea style={{ ...S.textarea, ...((!isOwner) ? S.disabled : {}) }}
              value={profile.po_notes ?? ''}
              onChange={e => set('po_notes', e.target.value)}
              disabled={!isOwner}
              placeholder="e.g. Please deliver to the above address between 8am–12pm." />
          </div>
        </div>
      </div>

      {isOwner && (
        <button onClick={save} disabled={saving}
          style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '10px 28px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save company profile'}
        </button>
      )}
    </div>
  )
}
