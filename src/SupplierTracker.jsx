import { useState } from 'react'
import styles from './SupplierTracker.module.css'

const n = v => parseFloat(v) || 0

function fmt(val) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  return (val < 0 ? '-AED ' : 'AED ') + Math.abs(val).toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const CATEGORIES = ['Hot Food / Deli', 'Juices & Smoothies', 'Beverages', 'Snacks', 'Grocery', 'Packaging', 'Cleaning', 'Other']
const PAYMENT_TERMS = ['Cash on delivery', '7 days', '14 days', '30 days', '45 days', '60 days']
const STATUS_OPTIONS = ['Active', 'On hold', 'Trial', 'Inactive']

const DEFAULT_SUPPLIERS = [
  { id: 1, name: 'Al Islami Foods',       category: 'Hot Food / Deli',    contact: '',  phone: '',  terms: '14 days',         outstanding: '0',    monthlySpend: '25000', status: 'Active', notes: 'Frozen deli items, halal certified' },
  { id: 2, name: 'Emirates Refreshments', category: 'Beverages',          contact: '',  phone: '',  terms: '30 days',         outstanding: '0',    monthlySpend: '8000',  status: 'Active', notes: 'Non-alcoholic beverages' },
  { id: 3, name: 'Kibsons International', category: 'Grocery',            contact: '',  phone: '',  terms: '7 days',          outstanding: '0',    monthlySpend: '12000', status: 'Active', notes: 'Fresh produce delivery' },
  { id: 4, name: 'Agthia Group',          category: 'Grocery',            contact: '',  phone: '',  terms: '30 days',         outstanding: '0',    monthlySpend: '10000', status: 'Active', notes: 'Al Ain water, packaged goods' },
  { id: 5, name: 'Juice supplier TBD',    category: 'Juices & Smoothies', contact: '',  phone: '',  terms: 'Cash on delivery', outstanding: '0',   monthlySpend: '6000',  status: 'Trial',  notes: '' },
]

let nextId = 6

export default function SupplierTracker() {
  const [suppliers, setSuppliers] = useState(DEFAULT_SUPPLIERS)
  const [editId, setEditId] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [filterStatus, setFilterStatus] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [newSupplier, setNewSupplier] = useState({
    name: '', category: 'Grocery', contact: '', phone: '', terms: '30 days',
    outstanding: '0', monthlySpend: '0', status: 'Active', notes: ''
  })

  const handleEdit = (id, field, value) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const handleAdd = () => {
    if (!newSupplier.name.trim()) return
    setSuppliers(prev => [...prev, { ...newSupplier, id: nextId++ }])
    setNewSupplier({ name: '', category: 'Grocery', contact: '', phone: '', terms: '30 days', outstanding: '0', monthlySpend: '0', status: 'Active', notes: '' })
    setShowAdd(false)
  }

  const handleDelete = (id) => setSuppliers(prev => prev.filter(s => s.id !== id))

  const filtered = suppliers
    .filter(s => filterStatus === 'All' || s.status === filterStatus)
    .sort((a, b) => {
      if (sortKey === 'monthlySpend') return n(b.monthlySpend) - n(a.monthlySpend)
      if (sortKey === 'outstanding')  return n(b.outstanding)  - n(a.outstanding)
      return a[sortKey]?.localeCompare(b[sortKey])
    })

  const totalMonthly    = suppliers.filter(s => s.status === 'Active').reduce((sum, s) => sum + n(s.monthlySpend), 0)
  const totalOutstanding = suppliers.reduce((sum, s) => sum + n(s.outstanding), 0)
  const activeCount     = suppliers.filter(s => s.status === 'Active').length
  const overdueCount    = suppliers.filter(s => n(s.outstanding) > 0).length

  return (
    <div className={styles.wrap}>
      <div className={styles.topRow}>
        <div>
          <h2 className={styles.pageTitle}>Supplier tracker</h2>
          <p className={styles.pageSub}>Manage your supplier relationships, payment terms, and outstanding balances.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowAdd(v => !v)}>+ Add supplier</button>
      </div>

      <div className={styles.summaryRow}>
        {[
          { label: 'Active suppliers',    val: activeCount,      color: '#6a9fcb', money: false },
          { label: 'Monthly spend',       val: totalMonthly,     color: '#0D7377', money: true  },
          { label: 'Outstanding balance', val: totalOutstanding,  color: totalOutstanding > 0 ? '#d47060' : '#5db88a', money: true },
          { label: 'Awaiting payment',    val: overdueCount,     color: overdueCount > 0 ? '#d47060' : '#5db88a', money: false },
        ].map(({ label, val, color, money }) => (
          <div key={label} className={styles.summaryCard}>
            <span className={styles.summaryLabel}>{label}</span>
            <span className={styles.summaryVal} style={{ color }}>{money ? fmt(val) : val}</span>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className={styles.addCard}>
          <div className={styles.addTitle}>New supplier</div>
          <div className={styles.addGrid}>
            {[
              { label: 'Supplier name *', field: 'name',         type: 'text'   },
              { label: 'Contact person',  field: 'contact',      type: 'text'   },
              { label: 'Phone / WhatsApp',field: 'phone',        type: 'text'   },
              { label: 'Monthly spend',   field: 'monthlySpend', type: 'number' },
              { label: 'Outstanding',     field: 'outstanding',  type: 'number' },
              { label: 'Notes',           field: 'notes',        type: 'text'   },
            ].map(({ label, field, type }) => (
              <div key={field} className={styles.addField}>
                <label className={styles.addLabel}>{label}</label>
                <input type={type} value={newSupplier[field]} onChange={e => setNewSupplier(p => ({ ...p, [field]: e.target.value }))} className={styles.addInput} />
              </div>
            ))}
            <div className={styles.addField}>
              <label className={styles.addLabel}>Category</label>
              <select value={newSupplier.category} onChange={e => setNewSupplier(p => ({ ...p, category: e.target.value }))} className={styles.addInput}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.addField}>
              <label className={styles.addLabel}>Payment terms</label>
              <select value={newSupplier.terms} onChange={e => setNewSupplier(p => ({ ...p, terms: e.target.value }))} className={styles.addInput}>
                {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className={styles.addField}>
              <label className={styles.addLabel}>Status</label>
              <select value={newSupplier.status} onChange={e => setNewSupplier(p => ({ ...p, status: e.target.value }))} className={styles.addInput}>
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.addActions}>
            <button className={styles.saveBtn} onClick={handleAdd}>Save supplier</button>
            <button className={styles.cancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {['All', ...STATUS_OPTIONS].map(s => (
            <button key={s} className={styles.filterBtn} data-active={filterStatus === s} onClick={() => setFilterStatus(s)}>{s}</button>
          ))}
        </div>
        <select className={styles.sortSelect} value={sortKey} onChange={e => setSortKey(e.target.value)}>
          <option value="name">Sort by name</option>
          <option value="monthlySpend">Sort by spend</option>
          <option value="outstanding">Sort by outstanding</option>
          <option value="category">Sort by category</option>
        </select>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Category</th>
                <th>Payment terms</th>
                <th>Monthly spend</th>
                <th>Outstanding</th>
                <th>Status</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    {editId === s.id
                      ? <input value={s.name} onChange={e => handleEdit(s.id, 'name', e.target.value)} className={styles.inlineInput} />
                      : <span className={styles.supplierName}>{s.name}</span>
                    }
                    {s.phone && <div className={styles.supplierPhone}>{s.phone}</div>}
                  </td>
                  <td>
                    {editId === s.id
                      ? <select value={s.category} onChange={e => handleEdit(s.id, 'category', e.target.value)} className={styles.inlineInput}>
                          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                        </select>
                      : <span className={styles.catBadge}>{s.category}</span>
                    }
                  </td>
                  <td>
                    {editId === s.id
                      ? <select value={s.terms} onChange={e => handleEdit(s.id, 'terms', e.target.value)} className={styles.inlineInput}>
                          {PAYMENT_TERMS.map(t => <option key={t}>{t}</option>)}
                        </select>
                      : <span className={styles.termsBadge}>{s.terms}</span>
                    }
                  </td>
                  <td>
                    {editId === s.id
                      ? <input type="number" value={s.monthlySpend} onChange={e => handleEdit(s.id, 'monthlySpend', e.target.value)} className={styles.inlineInput} style={{ width: 90 }} />
                      : <span style={{ color: '#0D7377' }}>{fmt(n(s.monthlySpend))}</span>
                    }
                  </td>
                  <td>
                    {editId === s.id
                      ? <input type="number" value={s.outstanding} onChange={e => handleEdit(s.id, 'outstanding', e.target.value)} className={styles.inlineInput} style={{ width: 90 }} />
                      : <span style={{ color: n(s.outstanding) > 0 ? '#d47060' : 'var(--text-muted)', fontWeight: n(s.outstanding) > 0 ? 500 : 400 }}>{n(s.outstanding) > 0 ? fmt(n(s.outstanding)) : '—'}</span>
                    }
                  </td>
                  <td>
                    {editId === s.id
                      ? <select value={s.status} onChange={e => handleEdit(s.id, 'status', e.target.value)} className={styles.inlineInput}>
                          {STATUS_OPTIONS.map(st => <option key={st}>{st}</option>)}
                        </select>
                      : <span className={styles.statusBadge} data-status={s.status.toLowerCase().replace(' ', '-')}>{s.status}</span>
                    }
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 160 }}>
                    {editId === s.id
                      ? <input value={s.notes} onChange={e => handleEdit(s.id, 'notes', e.target.value)} className={styles.inlineInput} style={{ width: '100%' }} />
                      : s.notes
                    }
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <button className={styles.editBtn} onClick={() => setEditId(editId === s.id ? null : s.id)}>
                        {editId === s.id ? '✓' : '✏'}
                      </button>
                      <button className={styles.deleteBtn} onClick={() => handleDelete(s.id)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
