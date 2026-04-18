import { useState, useEffect } from 'react'
import { loadTables, saveTable, deleteTable } from './supabase.js'
import styles from './TableManager.module.css'

const SECTIONS = ['Main', 'Indoor', 'Outdoor', 'Counter', 'Terrace', 'VIP', 'Bar']

export default function TableManager({ restaurantId }) {
  const [tables,   setTables]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [editRow,  setEditRow]  = useState(null)
  const [saving,   setSaving]   = useState(false)

  const blank = () => ({ name: '', section: 'Main', capacity: 4 })

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    loadTables(restaurantId).then(t => { setTables(t); setLoading(false) }).catch(err => { console.error('Tables load error:', err); setLoading(false) })
  }, [restaurantId])

  const reload = () => loadTables(restaurantId).then(setTables)

  const save = async () => {
    if (!editRow?.name?.trim()) return
    setSaving(true)
    try { await saveTable(restaurantId, editRow); setEditRow(null); await reload() }
    catch (e) { alert(e.message) } finally { setSaving(false) }
  }

  const del = async (id) => {
    if (!confirm('Remove this table?')) return
    await deleteTable(id); await reload()
  }

  const sections = [...new Set(tables.map(t => t.section))]

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Tables & sections</h2>
          <p className={styles.pageSub}>Configure your dining room layout. These appear on the POS table selection screen.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setEditRow(blank())}>+ Add table</button>
      </div>

      {editRow && (
        <div className={styles.formCard}>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Table / counter name *</label>
              <input value={editRow.name} onChange={e => setEditRow(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Table 1, Counter A" className={styles.formInput} autoFocus />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Section</label>
              <select value={editRow.section} onChange={e => setEditRow(p => ({ ...p, section: e.target.value }))} className={styles.formInput}>
                {SECTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel}>Capacity</label>
              <input type="number" min="1" max="30" value={editRow.capacity}
                onChange={e => setEditRow(p => ({ ...p, capacity: parseInt(e.target.value) || 1 }))} className={styles.formInput} />
            </div>
          </div>
          <div className={styles.formActions}>
            <button className={styles.saveBtn} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button className={styles.cancelBtn} onClick={() => setEditRow(null)}>Cancel</button>
          </div>
        </div>
      )}

      {sections.map(section => (
        <div key={section} className={styles.section}>
          <div className={styles.sectionLabel}>{section}</div>
          <div className={styles.tableGrid}>
            {tables.filter(t => t.section === section).map(t => (
              <div key={t.id} className={styles.tableCard}>
                <span className={styles.tableName}>{t.name}</span>
                <span className={styles.tableCap}>👥 {t.capacity}</span>
                <div className={styles.tableActions}>
                  <button className={styles.editBtn} onClick={() => setEditRow({ ...t })}>✏</button>
                  <button className={styles.delBtn}  onClick={() => del(t.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {tables.length === 0 && (
        <div className={styles.empty}>No tables yet — click "+ Add table" to set up your floor plan</div>
      )}
    </div>
  )
}
