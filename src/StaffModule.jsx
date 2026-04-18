import { useState, useEffect } from 'react'
import { supabase } from './supabase.js'
import { useTranslation, fmtCurrency } from './i18n.js'

const n = v => parseFloat(v) || 0
const AVATAR_COLORS = ['#0D7377','#2980b9','#8e44ad','#27ae60','#e67e22','#c0392b']

const DEPARTMENTS = ['Restaurant','Kitchen','Bar','Delivery','Admin','Management','Housekeeping']
const NATIONALITIES = ['UAE','Indian','Pakistani','Egyptian','Filipino','Jordanian','Lebanese','British','Other']

export default function StaffModule({ restaurantId, userId, session }) {
  const { lang, t } = useTranslation()
  const fmt = v => fmtCurrency(v, lang)

  const [staff,   setStaff]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [view,    setView]    = useState('list') // list | form | detail
  const [sel,     setSel]     = useState(null)

  const BLANK = {
    full_name: '', position: '', department: 'Restaurant', nationality: 'Indian',
    phone: '', email: '', passport_number: '', visa_expiry: '', contract_start: '',
    contract_end: '', basic_salary: '', housing_allowance: '', transport_allowance: '',
    food_allowance: '', other_allowance: '', bank_account: '', bank_name: '',
    iban: '', notes: '', active: true,
  }
  const [form, setForm] = useState(BLANK)

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    load()
  }, [restaurantId])

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase.from('staff')
        .select('*').eq('restaurant_id', restaurantId).eq('active', true).order('full_name')
      setStaff(data ?? [])
    } catch (e) { console.error('staff load:', e) }
    finally { setLoading(false) }
  }

  const save = async () => {
    if (!form.full_name?.trim()) { alert('Name required'); return }
    setSaving(true)
    try {
      const payload = { ...form, restaurant_id: restaurantId }
      const numFields = ['basic_salary','housing_allowance','transport_allowance','food_allowance','other_allowance']
      for (const f of numFields) {
        payload[f] = payload[f] ? parseFloat(payload[f]) : null
      }
      if (form.id) {
        await supabase.from('staff').update(payload).eq('id', form.id)
      } else {
        await supabase.from('staff').insert(payload)
      }
      await load(); setView('list')
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const exportWPS = () => {
    const rows = staff.filter(s => s.bank_account || s.iban).map(s => {
      const total = n(s.basic_salary) + n(s.housing_allowance) + n(s.transport_allowance) + n(s.food_allowance) + n(s.other_allowance)
      return [s.full_name, s.bank_name, s.iban || s.bank_account, total.toFixed(2), 'AED', new Date().toISOString().slice(0,10)]
    })
    const csv = 'Employee Name,Bank,IBAN/Account,Net Pay,Currency,Payment Date\n' + rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = `WPS_${new Date().toISOString().slice(0,7)}.csv`; a.click()
  }

  const totalPayroll = staff.reduce((s, e) => s + n(e.basic_salary) + n(e.housing_allowance) + n(e.transport_allowance) + n(e.food_allowance) + n(e.other_allowance), 0)
  const expiringVisas = staff.filter(s => s.visa_expiry && new Date(s.visa_expiry) <= new Date(Date.now() + 30*86400000))

  const SI = { background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '8px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' }
  const SL = { fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: 5 }
  const SF = { display: 'flex', flexDirection: 'column', gap: 5 }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>

  return (
    <div>
      {view === 'list' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>{t('employees')}</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Staff records, contracts, payroll, and WPS export.</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={exportWPS} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                ↓ {t('wps')}
              </button>
              <button onClick={() => { setForm(BLANK); setView('form') }}
                style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 18px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>
                + {t('employee')}
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: '1.25rem' }}>
            {[
              { label: 'Total staff',      val: staff.length, color: 'var(--accent)' },
              { label: 'Monthly payroll',  val: fmt(totalPayroll), color: 'var(--accent)' },
              { label: 'Visa expiring (30d)', val: expiringVisas.length, color: expiringVisas.length > 0 ? '#c0392b' : '#27ae60' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: k.color, marginBottom: 3 }}>{k.val}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Visa expiry warning */}
          {expiringVisas.length > 0 && (
            <div style={{ padding: '10px 14px', background: 'rgba(192,57,43,0.06)', border: '0.5px solid rgba(192,57,43,0.25)', borderRadius: 'var(--radius)', marginBottom: 14, fontSize: 13, color: '#c0392b' }}>
              ⚠ {expiringVisas.map(e => e.full_name).join(', ')} — visa expiring within 30 days
            </div>
          )}

          {/* Staff table */}
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                {[t('name'), t('position'), t('department'), t('nationality'), t('salary'), 'Visa expiry', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {staff.map(emp => {
                  const total = n(emp.basic_salary) + n(emp.housing_allowance) + n(emp.transport_allowance) + n(emp.food_allowance) + n(emp.other_allowance)
                  const color = AVATAR_COLORS[emp.full_name?.charCodeAt(0) % AVATAR_COLORS.length] ?? '#0D7377'
                  const visaExpiry  = emp.visa_expiry ? new Date(emp.visa_expiry) : null
                  const visaExpiring = visaExpiry && visaExpiry <= new Date(Date.now() + 30*86400000)
                  return (
                    <tr key={emp.id} style={{ cursor: 'pointer' }} onClick={() => { setSel(emp); setView('detail') }}>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {emp.full_name?.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{emp.full_name}</div>
                            {emp.phone && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{emp.phone}</div>}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', borderBottom: '0.5px solid var(--border)' }}>{emp.position || '—'}</td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--accent-dim)', color: 'var(--accent)' }}>{emp.department}</span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)' }}>{emp.nationality || '—'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 500, color: 'var(--accent)', borderBottom: '0.5px solid var(--border)' }}>{total > 0 ? fmt(total) : '—'}</td>
                      <td style={{ padding: '10px 12px', color: visaExpiring ? '#c0392b' : 'var(--text-muted)', fontWeight: visaExpiring ? 600 : 400, borderBottom: '0.5px solid var(--border)', fontSize: 11 }}>
                        {emp.visa_expiry ? new Date(emp.visa_expiry).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-AE') : '—'}
                        {visaExpiring && ' ⚠'}
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)' }}>
                        <button onClick={e => { e.stopPropagation(); setForm({ ...emp }); setView('form') }}
                          style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 9px', border: '0.5px solid var(--border)', borderRadius: 4, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>{t('edit')}</button>
                      </td>
                    </tr>
                  )
                })}
                {staff.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>No staff records yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'form' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)' }}>{form.id ? `Edit — ${form.full_name}` : `New ${t('employee')}`}</h2>
            <button onClick={() => setView('list')} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 14px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>← {t('back')}</button>
          </div>
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            {/* Personal info */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Personal information</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { label: t('name') + ' *', field: 'full_name', ph: 'Full name' },
                { label: t('position'),    field: 'position',  ph: 'Job title' },
                { label: t('phone'),       field: 'phone',     ph: '+971 50 XXX XXXX' },
                { label: t('email'),       field: 'email',     ph: 'work@email.com' },
                { label: t('passport'),    field: 'passport_number', ph: 'Passport number' },
              ].map(f => (
                <div key={f.field} style={SF}><label style={SL}>{f.label}</label>
                  <input value={form[f.field] ?? ''} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))} style={SI} placeholder={f.ph} />
                </div>
              ))}
              <div style={SF}><label style={SL}>{t('department')}</label>
                <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} style={SI}>
                  {DEPARTMENTS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div style={SF}><label style={SL}>{t('nationality')}</label>
                <select value={form.nationality} onChange={e => setForm(p => ({ ...p, nationality: e.target.value }))} style={SI}>
                  {NATIONALITIES.map(n => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div style={SF}><label style={SL}>{t('visa_expiry')}</label>
                <input type="date" value={form.visa_expiry ?? ''} onChange={e => setForm(p => ({ ...p, visa_expiry: e.target.value }))} style={SI} />
              </div>
              <div style={SF}><label style={SL}>{t('contract_start')}</label>
                <input type="date" value={form.contract_start ?? ''} onChange={e => setForm(p => ({ ...p, contract_start: e.target.value }))} style={SI} />
              </div>
              <div style={SF}><label style={SL}>{t('contract_end')}</label>
                <input type="date" value={form.contract_end ?? ''} onChange={e => setForm(p => ({ ...p, contract_end: e.target.value }))} style={SI} />
              </div>
            </div>

            {/* Salary */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Salary & allowances (AED/month)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Basic salary', field: 'basic_salary' },
                { label: 'Housing',      field: 'housing_allowance' },
                { label: 'Transport',    field: 'transport_allowance' },
                { label: 'Food',         field: 'food_allowance' },
                { label: 'Other',        field: 'other_allowance' },
              ].map(f => (
                <div key={f.field} style={SF}><label style={SL}>{f.label}</label>
                  <input type="number" min="0" value={form[f.field] ?? ''} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))} style={SI} placeholder="0.00" />
                </div>
              ))}
              <div style={{ ...SF, justifyContent: 'flex-end' }}>
                <label style={SL}>Total monthly</label>
                <div style={{ padding: '8px 10px', background: 'var(--accent-dim)', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600, color: 'var(--accent)', border: '0.5px solid var(--accent)' }}>
                  {fmt(n(form.basic_salary) + n(form.housing_allowance) + n(form.transport_allowance) + n(form.food_allowance) + n(form.other_allowance))}
                </div>
              </div>
            </div>

            {/* Bank / WPS */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Bank details (WPS)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Bank name',    field: 'bank_name',    ph: 'e.g. Emirates NBD' },
                { label: 'IBAN',         field: 'iban',         ph: 'AE00 0000 0000 0000 0000 000' },
                { label: 'Account no.', field: 'bank_account', ph: 'Account number' },
              ].map(f => (
                <div key={f.field} style={SF}><label style={SL}>{f.label}</label>
                  <input value={form[f.field] ?? ''} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))} style={SI} placeholder={f.ph} />
                </div>
              ))}
            </div>

            <div style={{ ...SF, marginBottom: 16 }}>
              <label style={SL}>Notes</label>
              <textarea value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...SI, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={save} disabled={saving} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '10px 24px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? t('saving') : t('save')}
              </button>
              <button onClick={() => setView('list')} style={{ fontFamily: 'var(--font-body)', fontSize: 13, padding: '10px 16px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
