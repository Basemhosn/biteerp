import { useState, useEffect, useRef, useCallback } from 'react'
import {
  loadMessages, sendMessage, editMessage, deleteMessage,
  markChatterRead, getUnreadCount, subscribeToMessages,
  loadTeamFull,
} from './supabase.js'

const AVATAR_COLORS = ['#0D7377','#2980b9','#8e44ad','#27ae60','#e67e22','#c0392b','#16a085','#d35400']

function getInitials(name) {
  if (!name) return '?'
  const p = name.trim().split(' ')
  return p.length > 1 ? p[0][0] + p[p.length - 1][0] : p[0].slice(0, 2)
}

function timeLabel(iso) {
  if (!iso) return ''
  const d   = new Date(iso)
  const now = new Date()
  const diffMs = now - d
  const diffM  = Math.floor(diffMs / 60000)
  if (diffM < 1)   return 'just now'
  if (diffM < 60)  return `${diffM}m`
  const diffH = Math.floor(diffM / 60)
  if (diffH < 24)  return `${diffH}h`
  if (diffH < 48)  return 'yesterday'
  return d.toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })
}

function isSameDay(a, b) {
  const da = new Date(a), db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

function dayLabel(iso) {
  const d   = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'short' })
}

// ── Thread: either general (no record) or attached to a record ──
const CHANNELS = [
  { id: 'general',    label: '# General',    icon: '💬', type: 'general',         recordId: null },
  { id: 'ops',        label: '# Operations', icon: '🍽',  type: 'channel_ops',     recordId: null },
  { id: 'kitchen',    label: '# Kitchen',    icon: '👨‍🍳', type: 'channel_kitchen', recordId: null },
  { id: 'management', label: '# Management', icon: '📊',  type: 'channel_mgmt',    recordId: null },
]

export default function Chatter({
  restaurantId, userId, session,
  // Optional: attach to a specific record
  recordType = null, recordId = null, recordLabel = null,
  // Mode: 'panel' = floating side panel, 'inline' = embedded in a page
  mode = 'panel',
  onClose,
}) {
  const isAttached   = !!recordType && !!recordId
  const authorName   = session?.fullName ?? session?.email ?? 'Unknown'
  const authorColor  = session?.avatarColor ?? AVATAR_COLORS[Math.abs(userId?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]

  const [activeChannel, setActiveChannel]   = useState(isAttached ? 'record' : 'general')
  const [messages,      setMessages]         = useState([])
  const [team,          setTeam]             = useState([])
  const [unread,        setUnread]           = useState({})
  const [loading,       setLoading]          = useState(true)
  const [sending,       setSending]          = useState(false)
  const [draft,         setDraft]            = useState('')
  const [editingId,     setEditingId]        = useState(null)
  const [editDraft,     setEditDraft]        = useState('')
  const [mentionSearch, setMentionSearch]    = useState(null) // null | string
  const [dmTarget,      setDmTarget]         = useState(null) // profile for DM
  const [msgType,       setMsgType]          = useState('comment') // comment | note
  const [showMembers,   setShowMembers]      = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)
  const subRef         = useRef(null)

  useEffect(() => {
    if (!restaurantId) return
    loadTeamFull(restaurantId).then(t => setTeam(t || [])).catch(() => setTeam([]))
    reload()
    // Real-time subscription
    subRef.current = subscribeToMessages(restaurantId, (newMsg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === newMsg.id)) return prev
        return [...prev, newMsg]
      })
      // Auto-scroll if near bottom
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    })
    return () => { subRef.current?.unsubscribe?.() }
  }, [restaurantId, activeChannel, dmTarget])

  async function reload() {
    setLoading(true)
    try {
      let type = activeChannel
      let rid  = null
      if (isAttached && activeChannel === 'record') {
        type = recordType; rid = recordId
      } else if (dmTarget) {
        type = 'dm'; rid = dmTarget.id
      } else {
        const ch = CHANNELS.find(c => c.id === activeChannel)
        if (ch) { type = ch.type; rid = null }
      }
      const msgs = await loadMessages(restaurantId, type, rid, 100).catch(() => [])
      setMessages(msgs)
      // Mark as read
      markChatterRead(restaurantId, userId).catch(() => {})
    } catch (e) { console.error(e) }
    } finally {
      setLoading(false)
    }
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'instant' }), 50)
  }

  const handleSend = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)

    // Extract @mentions
    const mentionMatches = [...text.matchAll(/@(\w[\w\s]*?)(?=\s|$|[,.])/g)]
    const mentionedIds = mentionMatches.flatMap(m => {
      const name = m[1].toLowerCase()
      return team.filter(t => t.full_name?.toLowerCase().startsWith(name)).map(t => t.id)
    })

    let type = 'general', rid = null
    if (isAttached && activeChannel === 'record') {
      type = recordType; rid = recordId
    } else if (dmTarget) {
      type = 'dm'; rid = dmTarget.id
    } else {
      const ch = CHANNELS.find(c => c.id === activeChannel)
      if (ch) { type = ch.type }
    }

    try {
      await sendMessage(restaurantId, userId, authorName, authorColor, text, type, rid, msgType, mentionedIds)
      setDraft('')
      setMentionSearch(null)
    } catch (e) { console.error(e) }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleEdit = async (id) => {
    if (!editDraft.trim()) return
    await editMessage(id, editDraft)
    setEditingId(null)
    setEditDraft('')
    await reload()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this message?')) return
    await deleteMessage(id)
    await reload()
  }

  // @ mention detection
  const handleDraftChange = (val) => {
    setDraft(val)
    const atIdx = val.lastIndexOf('@')
    if (atIdx >= 0 && atIdx === val.length - 1) {
      setMentionSearch('')
    } else if (atIdx >= 0 && !val.slice(atIdx + 1).includes(' ')) {
      setMentionSearch(val.slice(atIdx + 1))
    } else {
      setMentionSearch(null)
    }
  }

  const insertMention = (member) => {
    const atIdx = draft.lastIndexOf('@')
    setDraft(draft.slice(0, atIdx) + `@${member.full_name} `)
    setMentionSearch(null)
    inputRef.current?.focus()
  }

  const filteredMentions = mentionSearch !== null
    ? team.filter(t => t.full_name?.toLowerCase().includes(mentionSearch.toLowerCase()) && t.id !== userId)
    : []

  // Group messages by day
  const grouped = []
  let lastDay = null
  for (const msg of messages) {
    const day = msg.created_at?.slice(0, 10)
    if (day !== lastDay) { grouped.push({ type: 'day', label: dayLabel(msg.created_at) }); lastDay = day }
    grouped.push({ type: 'msg', msg })
  }

  const S = {
    wrap: mode === 'panel' ? {
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 360,
      background: 'var(--bg-surface)', borderLeft: '0.5px solid var(--border)',
      display: 'flex', flexDirection: 'column', zIndex: 300,
      boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
    } : {
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-surface)', border: '0.5px solid var(--border)',
      borderRadius: 'var(--radius-lg)', overflow: 'hidden', height: 480,
    },
  }

  return (
    <div style={S.wrap}>
      {/* ── Header ── */}
      <div style={{ padding: '12px 14px', borderBottom: '0.5px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>💬</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                {isAttached && activeChannel === 'record' ? recordLabel ?? 'Record chat'
                  : dmTarget ? `DM — ${dmTarget.full_name}`
                  : (CHANNELS.find(c => c.id === activeChannel)?.label ?? 'Chatter')}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {team.filter(t => t.is_online).length} online · {team.length} members
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setShowMembers(p => !p)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '4px 6px', borderRadius: 6 }} title="Members">
              👥
            </button>
            {onClose && (
              <button onClick={onClose}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: '4px 6px', borderRadius: 6 }}>
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Channel / DM tabs ── */}
      {!isAttached && (
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '0.5px solid var(--border)', flexShrink: 0, background: 'var(--bg-card)' }}>
          {CHANNELS.map(ch => (
            <button key={ch.id} onClick={() => { setActiveChannel(ch.id); setDmTarget(null) }}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '7px 12px', border: 'none', borderBottom: activeChannel === ch.id && !dmTarget ? '2px solid var(--accent)' : '2px solid transparent', background: 'transparent', color: activeChannel === ch.id && !dmTarget ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: activeChannel === ch.id && !dmTarget ? 600 : 400 }}>
              {ch.icon} {ch.label}
            </button>
          ))}
          {dmTarget && (
            <button style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '7px 12px', border: 'none', borderBottom: '2px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}>
              @ {dmTarget.full_name}
              <span onClick={() => setDmTarget(null)} style={{ marginLeft: 6, opacity: 0.6 }}>✕</span>
            </button>
          )}
        </div>
      )}

      {/* ── Members sidebar ── */}
      {showMembers && (
        <div style={{ borderBottom: '0.5px solid var(--border)', background: 'var(--bg-input)', padding: '10px 14px', maxHeight: 160, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Team members</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {team.map(m => {
              const isOnline = m.is_online && m.last_seen_at && (Date.now() - new Date(m.last_seen_at)) < 300000
              return (
                <button key={m.id} onClick={() => { setDmTarget(m); setShowMembers(false) }}
                  title={`DM ${m.full_name}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--text-secondary)' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: m.avatar_color || '#0D7377', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                      {getInitials(m.full_name)}
                    </div>
                    <div style={{ position: 'absolute', bottom: -1, right: -1, width: 6, height: 6, borderRadius: '50%', background: isOnline ? '#27ae60' : '#7f8c8d', border: '1.5px solid var(--bg-input)' }} />
                  </div>
                  {m.full_name?.split(' ')[0]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {loading && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '2rem' }}>Loading…</div>}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '3rem 1rem' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>No messages yet</div>
            <div style={{ fontSize: 11 }}>Be the first to say something</div>
          </div>
        )}
        {grouped.map((item, i) => {
          if (item.type === 'day') return (
            <div key={`day-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 8px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.label}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          )
          const msg      = item.msg
          const isOwn    = msg.author_id === userId
          const isSystem = msg.message_type === 'system'
          const isNote   = msg.message_type === 'note'
          const prevMsg  = grouped[i - 1]?.msg
          const sameAuthor = prevMsg && prevMsg.author_id === msg.author_id && (new Date(msg.created_at) - new Date(prevMsg.created_at)) < 120000

          if (isSystem) return (
            <div key={msg.id} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', padding: '4px 0', fontStyle: 'italic' }}>
              {msg.content}
            </div>
          )

          return (
            <div key={msg.id}
              style={{ display: 'flex', gap: 8, marginBottom: sameAuthor ? 2 : 10, alignItems: 'flex-start', flexDirection: isOwn ? 'row-reverse' : 'row' }}>
              {/* Avatar */}
              {!sameAuthor ? (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: msg.author_color || '#0D7377', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', marginTop: 2 }}>
                  {getInitials(msg.author_name)}
                </div>
              ) : <div style={{ width: 28, flexShrink: 0 }} />}

              {/* Bubble */}
              <div style={{ maxWidth: '75%' }}>
                {!sameAuthor && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 2, flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: msg.author_color || 'var(--accent)' }}>{isOwn ? 'You' : msg.author_name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeLabel(msg.created_at)}</span>
                    {isNote && <span style={{ fontSize: 9, padding: '1px 5px', background: 'rgba(142,68,173,0.12)', color: '#8e44ad', borderRadius: 3, fontWeight: 600 }}>NOTE</span>}
                  </div>
                )}
                {editingId === msg.id ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input value={editDraft} onChange={e => setEditDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleEdit(msg.id); if (e.key === 'Escape') setEditingId(null) }}
                      autoFocus style={{ flex: 1, padding: '5px 8px', background: 'var(--bg-input)', border: '0.5px solid var(--accent)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-body)', outline: 'none' }} />
                    <button onClick={() => handleEdit(msg.id)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--accent)', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ fontSize: 11, padding: '3px 6px', background: 'transparent', border: '0.5px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>✕</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }} className="msg-wrap">
                    <div style={{
                      padding: '7px 11px', borderRadius: isOwn ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                      background: isOwn ? 'var(--accent)' : isNote ? 'rgba(142,68,173,0.08)' : 'var(--bg-input)',
                      color: isOwn ? '#fff' : 'var(--text-primary)',
                      fontSize: 13, lineHeight: 1.5,
                      border: isNote ? '0.5px solid rgba(142,68,173,0.2)' : 'none',
                      wordBreak: 'break-word',
                    }}>
                      {/* Render @mentions in teal */}
                      {msg.content.split(/(@\w[\w\s]*?)(?=\s|$)/g).map((part, pi) =>
                        part.startsWith('@')
                          ? <span key={pi} style={{ fontWeight: 600, color: isOwn ? 'rgba(255,255,255,0.9)' : 'var(--accent)' }}>{part}</span>
                          : part
                      )}
                      {msg.edited && <span style={{ fontSize: 9, opacity: 0.5, marginLeft: 4 }}>(edited)</span>}
                    </div>
                    {/* Hover actions */}
                    {isOwn && (
                      <div style={{ position: 'absolute', top: -18, right: 0, display: 'none', gap: 3, background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 6, padding: '2px 4px' }} className="msg-actions">
                        <button onClick={() => { setEditingId(msg.id); setEditDraft(msg.content) }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: '2px 4px', borderRadius: 3, fontFamily: 'var(--font-body)' }}>Edit</button>
                        <button onClick={() => handleDelete(msg.id)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#c0392b', fontSize: 11, padding: '2px 4px', borderRadius: 3, fontFamily: 'var(--font-body)' }}>Delete</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Composer ── */}
      <div style={{ padding: '10px 14px', borderTop: '0.5px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
        {/* @mention suggestions */}
        {filteredMentions.length > 0 && (
          <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 6, overflow: 'hidden', maxHeight: 120, overflowY: 'auto' }}>
            {filteredMentions.map(m => (
              <button key={m.id} onClick={() => insertMention(m)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 10px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-dim)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: m.avatar_color || '#0D7377', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff' }}>
                  {getInitials(m.full_name)}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{m.full_name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{m.role}</span>
              </button>
            ))}
          </div>
        )}

        {/* Note toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {[{ k: 'comment', l: '💬 Comment' }, { k: 'note', l: '📌 Internal note' }].map(t => (
            <button key={t.k} onClick={() => setMsgType(t.k)}
              style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '3px 9px', borderRadius: 4, border: '0.5px solid var(--border)', background: msgType === t.k ? 'var(--accent-dim)' : 'transparent', color: msgType === t.k ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: msgType === t.k ? 600 : 400 }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* Input row */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={e => handleDraftChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                if (e.key === 'Escape') setMentionSearch(null)
              }}
              placeholder={msgType === 'note' ? 'Internal note (only visible to staff)…' : 'Message… (@ to mention)'}
              rows={1}
              style={{
                width: '100%', resize: 'none', padding: '8px 10px',
                background: 'var(--bg-input)', border: `0.5px solid ${msgType === 'note' ? 'rgba(142,68,173,0.4)' : 'var(--border)'}`,
                borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
                fontFamily: 'var(--font-body)', outline: 'none', lineHeight: 1.4,
                maxHeight: 100, overflowY: 'auto',
              }}
            />
          </div>
          <button onClick={handleSend} disabled={sending || !draft.trim()}
            style={{ padding: '8px 12px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 14, opacity: (sending || !draft.trim()) ? 0.5 : 1, flexShrink: 0 }}>
            {sending ? '…' : '➤'}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Enter to send · Shift+Enter for newline · @ to mention</div>
      </div>
    </div>
  )
}
