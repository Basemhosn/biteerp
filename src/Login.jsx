import { useState, useEffect } from 'react'
import { signIn, signUp, signOut, getSession, getProfile, createRestaurant, resetPassword } from './supabase.js'
import styles from './Login.module.css'

const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', cashier: 'Cashier', viewer: 'Viewer' }

// ─── Sign In screen ──────────────────────────────────────────
function SignInScreen({ onSuccess, onSignUp, onForgot }) {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)
  const [shake,    setShake]    = useState(false)

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 620)
  }

  async function submit() {
    if (!email.trim())    { setError('Enter your email'); return }
    if (!password.trim()) { setError('Enter your password'); return }
    setLoading(true); setError('')
    try {
      const { user } = await signIn(email.trim(), password.trim())
      const profile  = await getProfile(user.id)
      onSuccess({
        userId:       user.id,
        email:        user.email,
        fullName:     profile.full_name ?? user.email,
        role:         profile.role,
        restaurantId: profile.restaurant_id,
        restaurant:   profile.restaurants,
        lang:         profile.lang_preference ?? 'en',
      })
    } catch (err) {
      setError(err.message ?? 'Sign in failed')
      triggerShake()
    } finally { setLoading(false) }
  }

  return (
    <div className={`${styles.card} ${shake ? styles.shake : ''}`}>
      <svg viewBox="0 0 200 44" width="160" height="35" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', margin: '0 auto 1rem' }}>
        <text x="0" y="34" fontFamily="Inter, -apple-system, sans-serif" fontWeight="800" fontSize="38" letterSpacing="-2" fill="var(--text-primary)">bite</text>
        <circle cx="126" cy="16" r="6" fill="var(--accent)"/>
        <text x="134" y="34" fontFamily="Inter, -apple-system, sans-serif" fontWeight="800" fontSize="38" letterSpacing="-2" fill="var(--accent)">erp</text>
      </svg>
      <p className={styles.sub}>Made For Restaurants By Restaurant Experts</p>

      <div className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input
            type="email" value={email}
            onChange={e => { setEmail(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="your@email.com"
            className={`${styles.textInput} ${error ? styles.inputError : ''}`}
            autoComplete="email" autoFocus
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Password
            <button type="button" className={styles.forgotLink} onClick={onForgot}>Forgot?</button>
          </label>
          <div className={styles.pwWrap}>
            <input
              type={showPw ? 'text' : 'password'} value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Enter your password"
              className={`${styles.textInput} ${styles.pwInput} ${error ? styles.inputError : ''}`}
              autoComplete="current-password"
            />
            <button type="button" className={styles.pwToggle} onClick={() => setShowPw(v => !v)} tabIndex={-1}>
              {showPw ? '🙈' : '👁'}
            </button>
          </div>
        </div>

        {error && <p className={styles.errorMsg}>{error}</p>}

        <button className={styles.submitBtn} onClick={submit} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className={styles.switchLink}>
          Don't have an account?{' '}
          <button type="button" className={styles.switchBtn} onClick={onSignUp}>Create one</button>
        </p>
      </div>
    </div>
  )
}

// ─── Sign Up / Onboarding screen ─────────────────────────────
function SignUpScreen({ onSuccess, onSignIn }) {
  const [step,     setStep]     = useState(1) // 1 = account, 2 = restaurant
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [fullName, setFullName] = useState('')
  const [restName, setRestName] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPw,   setShowPw]   = useState(false)

  const submitStep1 = async () => {
    if (!fullName.trim()) { setError('Enter your name'); return }
    if (!email.trim())    { setError('Enter your email'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError("Passwords don't match"); return }
    setError('')
    setStep(2)
  }

  const submitStep2 = async () => {
    if (!restName.trim()) { setError('Enter your restaurant / business name'); return }
    setLoading(true); setError('')
    try {
      const { user } = await signUp(email.trim(), password, fullName.trim(), 'owner')
      await createRestaurant(restName.trim(), user.id)
      const profile = await getProfile(user.id)
      onSuccess({
        userId:       user.id,
        email:        user.email,
        fullName:     profile.full_name,
        role:         profile.role,
        restaurantId: profile.restaurant_id,
        restaurant:   profile.restaurants,
        lang:         profile.lang_preference ?? 'en',
      })
    } catch (err) {
      setError(err.message ?? 'Sign up failed')
    } finally { setLoading(false) }
  }

  return (
    <div className={styles.card}>
      <svg viewBox="0 0 200 44" width="160" height="35" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', margin: '0 auto 1rem' }}>
        <text x="0" y="34" fontFamily="Inter, -apple-system, sans-serif" fontWeight="800" fontSize="38" letterSpacing="-2" fill="var(--text-primary)">bite</text>
        <circle cx="126" cy="16" r="6" fill="var(--accent)"/>
        <text x="134" y="34" fontFamily="Inter, -apple-system, sans-serif" fontWeight="800" fontSize="38" letterSpacing="-2" fill="var(--accent)">erp</text>
      </svg>
      <h1 className={styles.title}>Create account</h1>
      <p className={styles.sub}>
        {step === 1 ? 'Set up your login details' : 'Tell us about your business'}
      </p>

      <div className={styles.stepRow}>
        <div className={styles.step} data-active={step >= 1}>1 Account</div>
        <div className={styles.stepLine} />
        <div className={styles.step} data-active={step >= 2}>2 Restaurant</div>
      </div>

      {step === 1 && (
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Full name</label>
            <input type="text" value={fullName} onChange={e => { setFullName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && submitStep1()}
              placeholder="Your name" className={styles.textInput} autoFocus />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="your@email.com" className={styles.textInput} autoComplete="email" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <div className={styles.pwWrap}>
              <input type={showPw ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Min. 6 characters"
                className={`${styles.textInput} ${styles.pwInput}`} autoComplete="new-password" />
              <button type="button" className={styles.pwToggle} onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Confirm password</label>
            <input type="password" value={confirm} onChange={e => { setConfirm(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && submitStep1()}
              placeholder="Re-enter password"
              className={`${styles.textInput} ${error ? styles.inputError : ''}`} autoComplete="new-password" />
          </div>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <button className={styles.submitBtn} onClick={submitStep1}>Continue →</button>
          <p className={styles.switchLink}>
            Already have an account?{' '}
            <button type="button" className={styles.switchBtn} onClick={onSignIn}>Sign in</button>
          </p>
        </div>
      )}

      {step === 2 && (
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Restaurant / business name</label>
            <input type="text" value={restName} onChange={e => { setRestName(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && submitStep2()}
              placeholder="e.g. Al Barsha Grill, Downtown Shawarma…" className={styles.textInput} autoFocus />
          </div>
          <p className={styles.hint}>You can add team members after signing up from the Settings page.</p>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <div className={styles.stepBtns}>
            <button className={styles.backBtn} onClick={() => { setStep(1); setError('') }}>← Back</button>
            <button className={styles.submitBtn} onClick={submitStep2} disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Forgot password screen ───────────────────────────────────
function ForgotScreen({ onBack }) {
  const [email,   setEmail]   = useState('')
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!email.trim()) { setError('Enter your email'); return }
    setLoading(true); setError('')
    try {
      await resetPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message ?? 'Could not send reset email')
    } finally { setLoading(false) }
  }

  return (
    <div className={styles.card}>
      <svg viewBox="0 0 200 44" width="160" height="35" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', margin: '0 auto 1rem' }}>
        <text x="0" y="34" fontFamily="Inter, -apple-system, sans-serif" fontWeight="800" fontSize="38" letterSpacing="-2" fill="var(--text-primary)">bite</text>
        <circle cx="126" cy="16" r="6" fill="var(--accent)"/>
        <text x="134" y="34" fontFamily="Inter, -apple-system, sans-serif" fontWeight="800" fontSize="38" letterSpacing="-2" fill="var(--accent)">erp</text>
      </svg>
      <h1 className={styles.title}>Reset password</h1>
      {sent ? (
        <>
          <p className={styles.successMsg}>✓ Check your email for a reset link</p>
          <button className={styles.backBtn} style={{ marginTop: 16 }} onClick={onBack}>← Back to sign in</button>
        </>
      ) : (
        <div className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Email address</label>
            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="your@email.com" className={styles.textInput} autoFocus />
          </div>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <button className={styles.submitBtn} onClick={submit} disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
          <button className={styles.backBtn} onClick={onBack}>← Back to sign in</button>
        </div>
      )}
    </div>
  )
}

// ─── Main Login export ────────────────────────────────────────
export default function Login({ onLogin }) {
  const [screen, setScreen] = useState('signin') // signin | signup | forgot

  // Check for existing session on mount
  useEffect(() => {
    getSession().then(async session => {
      if (!session) return
      try {
        const profile = await getProfile(session.user.id)
        onLogin({
          userId:       session.user.id,
          email:        session.user.email,
          fullName:     profile.full_name ?? session.user.email,
          role:         profile.role,
          restaurantId: profile.restaurant_id,
          restaurant:   profile.restaurants,
        })
      } catch {}
    })
  }, [])

  return (
    <div className={styles.overlay}>
      {screen === 'signin'  && <SignInScreen  onSuccess={onLogin} onSignUp={() => setScreen('signup')} onForgot={() => setScreen('forgot')} />}
      {screen === 'signup'  && <SignUpScreen  onSuccess={onLogin} onSignIn={() => setScreen('signin')} />}
      {screen === 'forgot'  && <ForgotScreen  onBack={() => setScreen('signin')} />}
    </div>
  )
}

// ─── Change password modal ────────────────────────────────────
export function ChangePinModal({ onClose }) {
  const [current,  setCurrent]  = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState(false)
  const [loading,  setLoading]  = useState(false)

  const submit = async () => {
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError("Passwords don't match"); return }
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (err) {
      setError(err.message ?? 'Failed to update password')
    } finally { setLoading(false) }
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Change password</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        {success ? (
          <p className={styles.successMsg}>✓ Password updated!</p>
        ) : (
          <div className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>New password</label>
              <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Min. 6 characters" className={styles.textInput} autoFocus autoComplete="new-password" />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Confirm new password</label>
              <input type="password" value={confirm} onChange={e => { setConfirm(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="Re-enter password"
                className={`${styles.textInput} ${error ? styles.inputError : ''}`} autoComplete="new-password" />
            </div>
            {error && <p className={styles.errorMsg}>{error}</p>}
            <button className={styles.submitBtn} onClick={submit} disabled={loading}>
              {loading ? 'Saving…' : 'Save new password'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
