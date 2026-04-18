import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { saveCategory, saveMenuItem } from './supabase.js'
import styles from './MenuImport.module.css'

const n = v => parseFloat(v) || 0

// Expected columns (case-insensitive, flexible naming)
const COL_MAP = {
  category:    ['category', 'section', 'group', 'type'],
  name:        ['name', 'item', 'item name', 'dish', 'product'],
  description: ['description', 'desc', 'details', 'notes'],
  price:       ['price', 'selling price', 'sell price', 'sale price', 'aed'],
  cost:        ['cost', 'cogs', 'food cost', 'cost price', 'unit cost'],
  tags:        ['tags', 'label', 'labels', 'flags'],
  available:   ['available', 'active', 'enabled', 'status'],
}

function matchCol(headers, candidates) {
  const lower = headers.map(h => h?.toString().toLowerCase().trim())
  for (const c of candidates) {
    const idx = lower.findIndex(h => h === c || h?.includes(c))
    if (idx !== -1) return idx
  }
  return -1
}

function parseRows(rows) {
  if (!rows.length) return { error: 'File is empty' }
  const headers = rows[0].map(h => h?.toString() ?? '')
  const data    = rows.slice(1).filter(r => r.some(c => c !== null && c !== undefined && c !== ''))

  const cols = {}
  for (const [key, candidates] of Object.entries(COL_MAP)) {
    cols[key] = matchCol(headers, candidates)
  }

  if (cols.name === -1)  return { error: 'Could not find a "Name" column. Make sure your file has a column called "Name" or "Item".' }
  if (cols.price === -1) return { error: 'Could not find a "Price" column. Make sure your file has a column called "Price" or "Selling Price".' }

  const items = []
  for (const row of data) {
    const name = row[cols.name]?.toString().trim()
    if (!name) continue
    items.push({
      category:    cols.category    !== -1 ? (row[cols.category]?.toString().trim() || 'General') : 'General',
      name,
      description: cols.description !== -1 ? (row[cols.description]?.toString().trim() || '') : '',
      price:       cols.price       !== -1 ? n(row[cols.price]) : 0,
      cost:        cols.cost        !== -1 ? n(row[cols.cost])  : 0,
      tags:        cols.tags        !== -1 ? (row[cols.tags]?.toString().split(',').map(t => t.trim()).filter(Boolean) ?? []) : [],
      available:   cols.available   !== -1 ? !['no','false','0','inactive','unavailable'].includes(row[cols.available]?.toString().toLowerCase()) : true,
    })
  }

  if (!items.length) return { error: 'No valid rows found. Check your file has data rows below the header.' }
  return { items, headers, cols }
}

export default function MenuImport({ restaurantId, onDone }) {
  const [stage,    setStage]    = useState('idle') // idle | preview | importing | done | error
  const [parsed,   setParsed]   = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef()

  const handleFile = (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv','xlsx','xls'].includes(ext)) {
      setErrorMsg('Please upload a .csv, .xlsx, or .xls file')
      setStage('error')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'binary' })
        const ws   = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })
        const result = parseRows(rows)

        if (result.error) {
          setErrorMsg(result.error)
          setStage('error')
          return
        }

        // Group by category for preview
        const byCategory = {}
        for (const item of result.items) {
          if (!byCategory[item.category]) byCategory[item.category] = []
          byCategory[item.category].push(item)
        }
        setParsed({ ...result, byCategory })
        setStage('preview')
      } catch (err) {
        setErrorMsg('Could not read file: ' + err.message)
        setStage('error')
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const runImport = async () => {
    if (!parsed) return
    setStage('importing')

    const categories = Object.keys(parsed.byCategory)
    const total = parsed.items.length
    let done = 0
    setProgress({ done: 0, total })

    // Create categories first, collect their IDs
    const catIds = {}
    for (const catName of categories) {
      try {
        const existing = await saveCategory(restaurantId, {
          name: catName, icon: '🍽', color: '#0D7377',
          sort_order: categories.indexOf(catName)
        })
        catIds[catName] = existing.id
      } catch {}
    }

    // Import items
    for (const item of parsed.items) {
      try {
        await saveMenuItem(restaurantId, {
          ...item,
          category_id: catIds[item.category],
          sort_order: done,
        })
      } catch (err) {
        console.error('Failed to import item:', item.name, err)
      }
      done++
      setProgress({ done, total })
    }

    setStage('done')
  }

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Category', 'Name', 'Description', 'Price', 'Cost', 'Tags', 'Available'],
      ['Hot Food',  'Chicken Shawarma',    'Grilled chicken wrap with garlic sauce', 28,   12,  'popular,chicken', 'yes'],
      ['Hot Food',  'Mixed Grill Platter', 'Assorted grilled meats with sides',       85,   35,  'popular',         'yes'],
      ['Juices',    'Fresh Orange Juice',  'Freshly squeezed orange',                 18,   4,   'fresh',           'yes'],
      ['Juices',    'Mango Lassi',         'Mango yoghurt drink',                     20,   5,   'popular',         'yes'],
      ['Beverages', 'Still Water 500ml',   '',                                         5,    1,   '',                'yes'],
      ['Beverages', 'Pepsi Can',           '',                                         8,    2.5, '',                'yes'],
      ['Snacks',    'French Fries',        'Crispy golden fries',                     15,   4,   'vegetarian',      'yes'],
    ])

    // Column widths
    ws['!cols'] = [
      { wch: 15 }, { wch: 25 }, { wch: 35 }, { wch: 8 },
      { wch: 8  }, { wch: 20 }, { wch: 10 }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Menu')
    XLSX.writeFile(wb, 'biteerp-menu-template.xlsx')
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Import menu from file</h3>
          <p className={styles.sub}>Upload a CSV or Excel file to bulk-import your categories and items.</p>
        </div>
        <button className={styles.templateBtn} onClick={downloadTemplate}>
          ↓ Download template
        </button>
      </div>

      {/* Idle / drop zone */}
      {(stage === 'idle' || stage === 'error') && (
        <>
          <div
            className={styles.dropZone}
            data-dragging={isDragging}
            onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef} type="file"
              accept=".csv,.xlsx,.xls"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
            <div className={styles.dropIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <rect x="8" y="6" width="32" height="36" rx="4" fill="var(--accent)" opacity="0.1"/>
                <rect x="8" y="6" width="32" height="36" rx="4" stroke="var(--accent)" strokeWidth="1.5"/>
                <line x1="16" y1="18" x2="32" y2="18" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
                <line x1="16" y1="24" x2="32" y2="24" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
                <line x1="16" y1="30" x2="24" y2="30" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>
                <circle cx="36" cy="36" r="9" fill="var(--accent)"/>
                <line x1="36" y1="32" x2="36" y2="40" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <line x1="32" y1="36" x2="40" y2="36" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p className={styles.dropTitle}>
              {isDragging ? 'Drop your file here' : 'Drag & drop your file here'}
            </p>
            <p className={styles.dropSub}>or click to browse · CSV, XLSX, XLS supported</p>
          </div>

          {stage === 'error' && (
            <div className={styles.errorBox}>
              <span className={styles.errorIcon}>⚠</span>
              <div>
                <div className={styles.errorTitle}>Could not read file</div>
                <div className={styles.errorMsg}>{errorMsg}</div>
              </div>
            </div>
          )}

          <div className={styles.formatGuide}>
            <div className={styles.formatTitle}>Required columns</div>
            <div className={styles.colGrid}>
              {[
                { col: 'Category', req: true,  note: 'Groups items together (e.g. Hot Food, Juices)' },
                { col: 'Name',     req: true,  note: 'Item name — required' },
                { col: 'Price',    req: true,  note: 'Selling price in AED' },
                { col: 'Cost',     req: false, note: 'COGS / food cost in AED' },
                { col: 'Description', req: false, note: 'Short description' },
                { col: 'Tags',     req: false, note: 'Comma-separated: popular, vegan, spicy' },
                { col: 'Available',req: false, note: 'yes / no (default: yes)' },
              ].map(({ col, req, note }) => (
                <div key={col} className={styles.colRow}>
                  <span className={styles.colName}>{col}</span>
                  {req && <span className={styles.colReq}>Required</span>}
                  <span className={styles.colNote}>{note}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Preview */}
      {stage === 'preview' && parsed && (
        <div>
          <div className={styles.previewSummary}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryNum}>{Object.keys(parsed.byCategory).length}</span>
              <span className={styles.summaryLabel}>Categories</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryNum}>{parsed.items.length}</span>
              <span className={styles.summaryLabel}>Items</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryNum}>
                {parsed.items.filter(i => i.cost > 0).length}
              </span>
              <span className={styles.summaryLabel}>With cost</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryNum}>
                {parsed.items.filter(i => i.price > 0 && i.cost > 0)
                  .reduce((s, i) => s + Math.round(((i.price - i.cost) / i.price) * 100), 0) /
                  Math.max(parsed.items.filter(i => i.price > 0 && i.cost > 0).length, 1) | 0}%
              </span>
              <span className={styles.summaryLabel}>Avg margin</span>
            </div>
          </div>

          <div className={styles.previewTable}>
            <div className={styles.previewScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Item name</th>
                    <th>Price</th>
                    <th>Cost</th>
                    <th>Margin</th>
                    <th>Tags</th>
                    <th>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.items.map((item, i) => {
                    const margin = item.price > 0 && item.cost > 0
                      ? Math.round(((item.price - item.cost) / item.price) * 100)
                      : null
                    return (
                      <tr key={i}>
                        <td><span className={styles.catChip}>{item.category}</span></td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</td>
                        <td style={{ color: 'var(--accent)' }}>AED {item.price.toFixed(2)}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{item.cost > 0 ? 'AED ' + item.cost.toFixed(2) : '—'}</td>
                        <td>
                          {margin !== null && (
                            <span className={styles.marginBadge} data-ok={margin >= 40}>
                              {margin}%
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.tags.join(', ') || '—'}</td>
                        <td>
                          <span style={{ color: item.available ? '#27ae60' : '#c0392b', fontSize: 12 }}>
                            {item.available ? '✓' : '✗'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className={styles.previewActions}>
            <button className={styles.importBtn} onClick={runImport}>
              Import {parsed.items.length} items →
            </button>
            <button className={styles.cancelBtn} onClick={() => { setStage('idle'); setParsed(null) }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Importing */}
      {stage === 'importing' && (
        <div className={styles.progressWrap}>
          <div className={styles.progressTitle}>Importing menu…</div>
          <div className={styles.progressBarWrap}>
            <div
              className={styles.progressBar}
              style={{ width: progress.total > 0 ? (progress.done / progress.total * 100) + '%' : '0%' }}
            />
          </div>
          <div className={styles.progressLabel}>{progress.done} / {progress.total} items</div>
        </div>
      )}

      {/* Done */}
      {stage === 'done' && (
        <div className={styles.doneWrap}>
          <div className={styles.doneIcon}>✓</div>
          <div className={styles.doneTitle}>Import complete!</div>
          <div className={styles.doneSub}>{progress.total} items imported successfully.</div>
          <div className={styles.doneActions}>
            <button className={styles.importBtn} onClick={onDone}>
              View menu
            </button>
            <button className={styles.cancelBtn} onClick={() => { setStage('idle'); setParsed(null) }}>
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
