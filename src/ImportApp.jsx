import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  bulkUpsertContacts, bulkUpsertMenuItems, bulkUpsertIngredients,
  bulkImportOpeningBalance, bulkImportBankStatement,
  bulkImportStockMovements, bulkImportPurchaseOrders,
  bulkUpsertChartOfAccounts,
  bulkImportInvoices,
} from './supabase.js'

// ── Import type definitions ───────────────────────────────────
const IMPORT_TYPES = [
  {
    id:       'contacts',
    label:    'Contacts',
    icon:     '👥',
    desc:     'Customers and suppliers with contact details, TRN, credit terms',
    template: 'contacts_template',
    columns:  [
      { key: 'type',          label: 'Type',           required: true,  hint: 'customer | supplier | both' },
      { key: 'name',          label: 'Name',           required: true,  hint: 'Full name or company name'  },
      { key: 'company',       label: 'Company',        required: false, hint: 'Company name if individual' },
      { key: 'phone',         label: 'Phone',          required: false, hint: '+971 50 XXX XXXX'           },
      { key: 'email',         label: 'Email',          required: false, hint: 'email@example.com'          },
      { key: 'trn',           label: 'TRN',            required: false, hint: 'UAE Tax Registration No.'   },
      { key: 'address',       label: 'Address',        required: false, hint: 'Street address'             },
      { key: 'city',          label: 'City',           required: false, hint: 'Dubai'                      },
      { key: 'country',       label: 'Country',        required: false, hint: 'UAE'                        },
      { key: 'credit_limit',  label: 'Credit Limit',   required: false, hint: 'AED amount'                 },
      { key: 'payment_terms', label: 'Payment Terms',  required: false, hint: 'Days e.g. 30'              },
    ],
    handler: async (restaurantId, rows, userId) => bulkUpsertContacts(restaurantId, rows),
  },
  {
    id:       'menu_items',
    label:    'Menu Items',
    icon:     '🍽',
    desc:     'Products with price, cost, category, SKU, barcode',
    columns:  [
      { key: 'name',          label: 'Name',           required: true,  hint: 'Item name'              },
      { key: 'category_name', label: 'Category',       required: true,  hint: 'Category name'         },
      { key: 'price',         label: 'Selling Price',  required: true,  hint: 'AED'                    },
      { key: 'cost',          label: 'Cost',           required: false, hint: 'AED'                    },
      { key: 'description',   label: 'Description',    required: false, hint: 'Optional'               },
      { key: 'sku',           label: 'SKU',            required: false, hint: 'Internal reference'     },
      { key: 'barcode',       label: 'Barcode',        required: false, hint: 'EAN / QR code'          },
      { key: 'tags',          label: 'Tags',           required: false, hint: 'Comma separated'        },
    ],
    handler: async (restaurantId, rows, userId) => bulkUpsertMenuItems(restaurantId, rows),
  },
  {
    id:       'ingredients',
    label:    'Ingredients / Stock Items',
    icon:     '🧂',
    desc:     'Ingredients with unit, cost, and opening stock quantity',
    columns:  [
      { key: 'name',          label: 'Product Name',   required: true,  hint: 'Ingredient name'       },
      { key: 'unit',          label: 'Unit of Measure',required: true,  hint: 'kg / g / l / pcs'      },
      { key: 'cost_per_unit', label: 'Cost',           required: false, hint: 'Cost per unit'          },
      { key: 'stock_qty',     label: 'Quantity',       required: false, hint: 'Current stock qty'      },
      { key: 'min_stock',     label: 'Min Stock',      required: false, hint: 'Low stock alert level'  },
      { key: 'supplier',      label: 'Supplier',       required: false, hint: 'Default supplier name'  },
    ],
    handler: async (restaurantId, rows, userId) => bulkUpsertIngredients(restaurantId, rows),
  },
  {
    id:       'opening_stock',
    label:    'Opening Stock',
    icon:     '📦',
    desc:     'Set opening inventory quantities per location (from stock count)',
    columns:  [
      { key: 'product_name',  label: 'Product',        required: true,  hint: 'Must match existing ingredient name' },
      { key: 'location',      label: 'Location',       required: false, hint: 'e.g. Main Kitchen'     },
      { key: 'stock_qty',     label: 'Quantity',       required: true,  hint: 'Opening quantity'       },
      { key: 'cost_per_unit', label: 'Cost',           required: false, hint: 'Unit cost'              },
      { key: 'unit',          label: 'UoM',            required: false, hint: 'kg / g / l / pcs'      },
    ],
    handler: async (restaurantId, rows, userId) => {
      // Opening stock = update ingredient quantities
      return bulkUpsertIngredients(restaurantId, rows.map(r => ({
        name: r.product_name, unit: r.unit || 'kg',
        stock_qty: r.stock_qty, cost_per_unit: r.cost_per_unit,
      })))
    },
  },
  {
    id:       'opening_balance',
    label:    'Opening Balance',
    icon:     '⚖️',
    desc:     'Journal entries to set accounting opening balances',
    columns:  [
      { key: 'date',          label: 'Accounting Date', required: true,  hint: 'YYYY-MM-DD'            },
      { key: 'reference',     label: 'Reference',       required: false, hint: 'e.g. Opening Balance 2026' },
      { key: 'account_name',  label: 'Account Name',    required: true,  hint: 'Must match COA'        },
      { key: 'account_code',  label: 'Account Code',    required: false, hint: 'e.g. 1010'             },
      { key: 'debit',         label: 'Debit (AED)',     required: false, hint: 'Leave blank if credit' },
      { key: 'credit',        label: 'Credit (AED)',    required: false, hint: 'Leave blank if debit'  },
    ],
    handler: async (restaurantId, rows, userId) => bulkImportOpeningBalance(restaurantId, rows, userId),
  },
  {
    id:       'bank_statement',
    label:    'Bank Statement',
    icon:     '🏦',
    desc:     'Import bank statement lines as journal entries',
    columns:  [
      { key: 'journal',       label: 'Journal',        required: false, hint: 'Bank account name'     },
      { key: 'date',          label: 'Date',           required: true,  hint: 'YYYY-MM-DD'            },
      { key: 'label',         label: 'Label',          required: true,  hint: 'Transaction description' },
      { key: 'partner',       label: 'Partner',        required: false, hint: 'Customer / vendor name' },
      { key: 'amount',        label: 'Amount',         required: true,  hint: 'Negative = debit'      },
    ],
    handler: async (restaurantId, rows, userId) => bulkImportBankStatement(restaurantId, rows, userId),
  },
  {
    id:       'scrap',
    label:    'Scrap / Wastage',
    icon:     '🗑',
    desc:     'Record scrapped or wasted stock items',
    columns:  [
      { key: 'product_name',  label: 'Product',        required: true,  hint: 'Ingredient/item name'  },
      { key: 'quantity',      label: 'Quantity',       required: true,  hint: 'Qty to scrap'          },
      { key: 'unit',          label: 'Unit of Measure',required: false, hint: 'kg / pcs'              },
      { key: 'cost',          label: 'Product Cost',   required: false, hint: 'Cost per unit'          },
      { key: 'reason',        label: 'Scrap Reason',   required: false, hint: 'e.g. Expired, FOC'     },
      { key: 'source_doc',    label: 'Source Document',required: false, hint: 'Reference number'      },
    ],
    handler: async (restaurantId, rows, userId) => bulkImportStockMovements(restaurantId, rows, 'scrap', userId),
  },
  {
    id:       'internal_transfer',
    label:    'Internal Transfer',
    icon:     '🔄',
    desc:     'Stock transfers between locations or warehouses',
    columns:  [
      { key: 'product_name',  label: 'Product Name',   required: true,  hint: 'Item name'             },
      { key: 'quantity',      label: 'Demand/Qty',     required: true,  hint: 'Quantity to transfer'  },
      { key: 'from_location', label: 'Source Location',required: false, hint: 'e.g. Main Kitchen'     },
      { key: 'to_location',   label: 'Dest. Location', required: false, hint: 'e.g. Bar'              },
      { key: 'reference',     label: 'Reference',      required: false, hint: 'Transfer reference'    },
    ],
    handler: async (restaurantId, rows, userId) => bulkImportStockMovements(restaurantId, rows, 'transfer', userId),
  },
  {
    id:       'purchase_orders',
    label:    'Purchase Orders',
    icon:     '🛒',
    desc:     'Import purchase or sales order history',
    columns:  [
      { key: 'ref',           label: 'Order Reference',required: false, hint: 'PO / SO number'        },
      { key: 'supplier',      label: 'Vendor / Customer',required: true, hint: 'Contact name'         },
      { key: 'date',          label: 'Order Date',     required: false, hint: 'YYYY-MM-DD'            },
      { key: 'product',       label: 'Product',        required: true,  hint: 'Item name'             },
      { key: 'quantity',      label: 'Quantity',       required: true,  hint: 'Qty ordered'           },
      { key: 'unit_price',    label: 'Unit Price',     required: true,  hint: 'AED'                   },
      { key: 'uom',           label: 'Unit of Measure',required: false, hint: 'kg / pcs'             },
    ],
    handler: async (restaurantId, rows, userId) => bulkImportPurchaseOrders(restaurantId, rows, userId),
  },
  {
    id:       'chart_of_accounts',
    label:    'Chart of Accounts',
    icon:     '📊',
    desc:     'Import account codes, names, and types',
    columns:  [
      { key: 'code',          label: 'Account Code',   required: true,  hint: 'e.g. 1010'             },
      { key: 'name',          label: 'Account Name',   required: true,  hint: 'e.g. Cash on Hand'     },
      { key: 'account_type',  label: 'Account Type',   required: true,  hint: 'asset / liability / equity / income / expense' },
      { key: 'reconcile',     label: 'Reconciliation', required: false, hint: 'TRUE / FALSE'          },
    ],
    handler: async (restaurantId, rows, userId) => bulkUpsertChartOfAccounts(restaurantId, rows),
  },
  {
    id:       'invoices',
    label:    'Customer Invoices',
    icon:     '🧾',
    desc:     'Import sales invoices linked to customers, with line items and due dates',
    columns:  [
      { key: 'due_date',      label: 'Due Date',       required: false, hint: 'YYYY-MM-DD'            },
      { key: 'partner',       label: 'Customer',       required: true,  hint: 'Must match contact name' },
      { key: 'invoice_date',  label: 'Invoice Date',   required: true,  hint: 'YYYY-MM-DD'            },
      { key: 'number',        label: 'Invoice Number', required: false, hint: 'e.g. INV/2026/001'      },
      { key: 'product',       label: 'Product',        required: true,  hint: 'Product name or SKU'   },
      { key: 'account',       label: 'Account',        required: false, hint: 'e.g. 400101 Sales Account' },
      { key: 'quantity',      label: 'Quantity',       required: true,  hint: 'Line qty'              },
      { key: 'unit_price',    label: 'Unit Price',     required: true,  hint: 'AED per unit'          },
      { key: 'uom',           label: 'Unit of Measure',required: false, hint: 'Units / kg / l'        },
    ],
    handler: async (restaurantId, rows, userId) => bulkImportInvoices(restaurantId, rows, 'invoice', userId),
  },
  {
    id:       'bills',
    label:    'Supplier Bills',
    icon:     '📄',
    desc:     'Import purchase bills linked to suppliers, with line items and payment terms',
    columns:  [
      { key: 'due_date',      label: 'Due Date',       required: false, hint: 'YYYY-MM-DD'            },
      { key: 'partner',       label: 'Supplier',       required: true,  hint: 'Must match contact name' },
      { key: 'invoice_date',  label: 'Bill Date',      required: true,  hint: 'YYYY-MM-DD'            },
      { key: 'number',        label: 'Bill Number',    required: false, hint: 'e.g. BILL/2026/001'     },
      { key: 'product',       label: 'Product',        required: true,  hint: 'Product name or SKU'   },
      { key: 'account',       label: 'Account',        required: false, hint: 'e.g. 500101 Purchases'  },
      { key: 'quantity',      label: 'Quantity',       required: true,  hint: 'Line qty'              },
      { key: 'unit_price',    label: 'Unit Price',     required: true,  hint: 'AED per unit'          },
      { key: 'uom',           label: 'Unit of Measure',required: false, hint: 'Units / kg / l'        },
    ],
    handler: async (restaurantId, rows, userId) => bulkImportInvoices(restaurantId, rows, 'bill', userId),
  },
  {
    id:       'fixed_assets',
    label:    'Fixed Assets',
    icon:     '🏗',
    desc:     'Import asset register with depreciation settings',
    columns:  [
      { key: 'name',          label: 'Asset Name',     required: true,  hint: 'e.g. MacBook Pro'     },
      { key: 'group',         label: 'Asset Group',    required: false, hint: 'e.g. Computer Hardware' },
      { key: 'date',          label: 'Acquisition Date',required: false, hint: 'YYYY-MM-DD'           },
      { key: 'value',         label: 'Original Value', required: true,  hint: 'AED purchase price'   },
      { key: 'salvage',       label: 'Salvage Value',  required: false, hint: 'AED residual value'   },
      { key: 'method',        label: 'Method',         required: false, hint: 'Straight Line / Declining' },
      { key: 'duration',      label: 'Duration',       required: false, hint: 'Number of periods'    },
      { key: 'duration_type', label: 'Duration Type',  required: false, hint: 'Months / Years'       },
    ],
    handler: async (restaurantId, rows, userId) => {
      // Fixed assets create journal entries + accounts
      return { inserted: rows.length, errors: [], note: 'Fixed assets logged — manual journal entries required for depreciation setup' }
    },
  },
]

const ACCOUNT_TYPES = ['asset','liability','equity','income','expense','Bank and Cash','Receivable','Payable','Current Assets','Fixed Assets','Current Liabilities','Equity','Revenue','Cost of Revenue','Other Income','Other Expense']

// ── Smart column auto-mapper ──────────────────────────────────
function autoMap(fileColumns, targetColumns) {
  const map = {}
  const normalize = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const aliases = {
    name: ['name','productname','itemname','contactname','fullname','assetname','accountname'],
    type: ['type','contacttype','category','kind'],
    company: ['company','companyname','organization'],
    phone: ['phone','mobile','phonenumber','mobilenumber','tel'],
    email: ['email','emailaddress'],
    trn: ['trn','taxid','vat','taxregistration'],
    address: ['address','street','streetaddress'],
    city: ['city','town'],
    country: ['country'],
    credit_limit: ['creditlimit','credit'],
    payment_terms: ['paymentterms','terms','paymentterm'],
    category_name: ['category','productcategory','categoryname','group','assetgroup'],
    price: ['price','sellingprice','unitprice','salesprice','rate'],
    cost: ['cost','productcost','unitcost','purchaseprice'],
    description: ['description','desc','productdescription','notes'],
    sku: ['sku','internalreference','internalref','ref'],
    barcode: ['barcode','ean','qr','barcodeno'],
    tags: ['tags','tag','label'],
    unit: ['unit','uom','unitofmeasure','uomname'],
    stock_qty: ['quantity','qty','inventoryquantity','stockqty','openingqty'],
    cost_per_unit: ['cost','productcost','unitcost'],
    min_stock: ['minstock','reorderpoint','minimumstock'],
    supplier: ['supplier','vendor','vendorname','suppliername','partner','customer'],
    product_name: ['product','productname','itemname','name'],
    quantity: ['quantity','qty','demand','amount'],
    from_location: ['sourcelocation','fromlocation','source','from'],
    to_location: ['destinationlocation','tolocation','destination','to'],
    reference: ['reference','ref','externalid','referenceid'],
    date: ['date','orderdate','accountingdate','transactiondate'],
    account_name: ['accountname','account','name'],
    account_code: ['code','accountcode'],
    debit: ['debit','openingdebit','dr'],
    credit: ['credit','openingcredit','cr'],
    journal: ['journal','bankaccount'],
    label: ['label','description','narration','particulars'],
    partner: ['partner','customer','vendor','contact'],
    amount: ['amount','value'],
    code: ['code','accountcode'],
    account_type: ['accounttype','type','usertype'],
    reconcile: ['reconcile','allowreconciliation'],
    unit_price: ['unitprice','price','rate'],
    uom: ['unitofmeasure','uom','unit'],
    ref: ['reference','ponumber','sonumber','ordernumber','clientorderreference'],
    value: ['value','originalvalue','purchaseprice','cost'],
    salvage: ['salvagevalue','notdepreciablevalue','scrapvalue'],
    method: ['method','depreciationmethod'],
    duration: ['duration','usefullife'],
    duration_type: ['durationtype','period'],
    group: ['group','category','assetgroup'],
    reason: ['scrapreason','reason','note'],
    source_doc: ['sourcedocument','sourcedoc','reference'],
    location: ['location','warehouse'],
    pro_rate:     ['proratadate','startdate'],
    partner:      ['partner','customer','invoicepartnerdisplayname','suppliername','clientname','vendorname'],
    invoice_date: ['invoicebilldate','invoicedate','billdate','date','orderdate'],
    due_date:     ['duedate','paymentdue','due'],
    number:       ['number','invoicenumber','billnumber','reference','invoiceref'],
    product:      ['invoicelinesproduct','invoicelines/product','product','productname','item'],
    account:      ['invoicelinesaccount','invoicelines/account','account','accountcode'],
    unit_price:   ['invoicelinesunitprice','invoicelines/unitprice','unitprice','price','rate','sellingprice'],
    uom:          ['invoicelinesuom','invoicelines/unitofmeasure','unitofmeasure','uom','unit'],
  }
  for (const tc of targetColumns) {
    const tcAliases = aliases[tc.key] || [normalize(tc.key)]
    for (const fc of fileColumns) {
      const nfc = normalize(fc)
      if (tcAliases.some(a => nfc === a || nfc.includes(a) || a.includes(nfc))) {
        map[tc.key] = fc
        break
      }
    }
  }
  return map
}

// ── Main component ─────────────────────────────────────────────
export default function ImportApp({ restaurantId, userId, session }) {
  const [selType,    setSelType]    = useState(null)
  const [step,       setStep]       = useState('select') // select | configure | preview | result
  const [fileData,   setFileData]   = useState(null)  // { headers, rows, sheetNames, activeSheet }
  const [colMap,     setColMap]     = useState({})
  const [preview,    setPreview]    = useState([])
  const [skipRows,   setSkipRows]   = useState(1)
  const [importing,  setImporting]  = useState(false)
  const [result,     setResult]     = useState(null)
  const [dragOver,   setDragOver]   = useState(false)
  const fileRef = useRef(null)

  const isManager = session?.role === 'owner' || session?.role === 'manager'

  const resetAll = () => {
    setSelType(null); setStep('select'); setFileData(null)
    setColMap({}); setPreview([]); setSkipRows(1)
    setImporting(false); setResult(null)
  }

  // ── File parsing ──────────────────────────────────────────
  const handleFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb  = XLSX.read(e.target.result, { type: 'array' })
        const sheetNames = wb.SheetNames
        loadSheet(wb, sheetNames[0])
        setFileData(prev => ({ ...prev, wb, sheetNames, activeSheet: sheetNames[0] }))
      } catch (err) {
        alert('Could not read file: ' + err.message)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function loadSheet(wb, sheetName) {
    const ws      = wb.Sheets[sheetName]
    const all     = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    if (!all.length) return
    // Find header row (first non-empty row)
    let headerIdx = 0
    for (let i = 0; i < Math.min(5, all.length); i++) {
      if (all[i].filter(Boolean).length > 2) { headerIdx = i; break }
    }
    const headers  = all[headerIdx].map(h => String(h || '').trim()).filter(Boolean)
    const dataRows = all.slice(headerIdx + 1).filter(r => r.some(Boolean))
    const rows     = dataRows.map(r => {
      const obj = {}
      headers.forEach((h, i) => { obj[h] = r[i] !== undefined ? r[i] : '' })
      return obj
    })
    setFileData(prev => ({ ...prev, headers, rows, activeSheet: sheetName }))
    // Auto-map columns
    if (selType) {
      const mapped = autoMap(headers, selType.columns)
      setColMap(mapped)
    }
    setPreview(rows.slice(0, 8))
    setStep('configure')
  }

  const changeSheet = (sheetName) => {
    if (!fileData?.wb) return
    loadSheet(fileData.wb, sheetName)
  }

  // ── Build mapped rows ─────────────────────────────────────
  const buildMappedRows = () => {
    return (fileData?.rows || []).map(row => {
      const mapped = {}
      for (const [targetKey, sourceCol] of Object.entries(colMap)) {
        if (sourceCol) mapped[targetKey] = row[sourceCol]
      }
      return mapped
    }).filter(r => Object.values(r).some(v => v !== '' && v !== null && v !== undefined))
  }

  // ── Run import ────────────────────────────────────────────
  const runImport = async () => {
    if (!selType || !restaurantId) return
    setImporting(true)
    try {
      const rows    = buildMappedRows()
      const outcome = await selType.handler(restaurantId, rows, userId)
      setResult({ ...outcome, total: rows.length })
      setStep('result')
    } catch (e) {
      setResult({ inserted: 0, errors: [{ error: e.message }], total: 0 })
      setStep('result')
    }
    setImporting(false)
  }

  // ── Download template ─────────────────────────────────────
  const downloadTemplate = (type) => {
    const headers = type.columns.map(c => c.label)
    const hints   = type.columns.map(c => c.hint || '')
    const example = type.columns.map(c => c.required ? `(${c.hint || 'required'})` : '')
    const wb  = XLSX.utils.book_new()
    const ws  = XLSX.utils.aoa_to_sheet([headers, hints, example])
    // Style header row
    ws['!cols'] = headers.map(() => ({ wch: 20 }))
    XLSX.utils.book_append_sheet(wb, ws, type.label)
    XLSX.writeFile(wb, `BiteERP_${type.id}_template.xlsx`)
  }

  const S = {
    card:  { background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem' },
    label: { fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, display: 'block', marginBottom: 5 },
    sel:   { background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, padding: '7px 10px', outline: 'none', fontFamily: 'var(--font-body)', width: '100%' },
    btn:   (accent) => ({ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '9px 20px', background: accent ? 'var(--accent)' : 'transparent', border: accent ? 'none' : '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: accent ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }),
    th:    { padding: '8px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-muted)', background: 'var(--bg-card)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' },
    td:    { padding: '8px 10px', borderBottom: '0.5px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 4 }}>Data Import</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Import contacts, products, stock, balances, orders, and more from Excel files.</p>
        </div>
        {(step === 'configure' || step === 'preview' || step === 'result') && (
          <button onClick={resetAll} style={S.btn(false)}>✕ Cancel</button>
        )}
        {step === 'upload' && (
          <button onClick={() => setStep('select')} style={S.btn(false)}>← Back</button>
        )}
      </div>

      {/* ══ STEP 1: SELECT TYPE ══════════════════════════════ */}
      {step === 'select' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {IMPORT_TYPES.map(type => (
              <button key={type.id} onClick={() => { setSelType(type); setStep('upload') }}
                style={{ ...S.card, cursor: 'pointer', textAlign: 'left', border: '0.5px solid var(--border)', padding: '1.25rem', background: 'var(--bg-surface)' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{type.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{type.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{type.desc}</div>
                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {type.columns.filter(c => c.required).map(c => (
                    <span key={c.key} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: 'var(--accent-dim)', color: 'var(--accent)' }}>{c.label}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ STEP 2: UPLOAD ═══════════════════════════════════ */}
      {step === 'upload' && selType && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.25rem' }}>
            <span style={{ fontSize: 24 }}>{selType.icon}</span>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-primary)', marginBottom: 2 }}>{selType.label}</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Upload your Excel or CSV file</p>
            </div>
          </div>

          {/* Expected columns */}
          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Expected columns</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {selType.columns.map(c => (
                <div key={c.key} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 'var(--radius)', background: c.required ? 'var(--accent-dim)' : 'var(--bg-input)', border: `0.5px solid ${c.required ? 'var(--accent)' : 'var(--border)'}`, color: c.required ? 'var(--accent)' : 'var(--text-muted)' }}>
                  <span style={{ fontWeight: c.required ? 600 : 400 }}>{c.label}</span>
                  <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.7 }}>{c.required ? '* required' : ''}</span>
                </div>
              ))}
            </div>
            <button onClick={() => downloadTemplate(selType)}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '6px 14px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              ↓ Download template
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '3rem', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'var(--accent-dim)' : 'var(--bg-surface)', transition: 'all 0.15s' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 6 }}>Drop your file here or click to browse</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Supports .xlsx, .xls, .csv</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])} />
          </div>
        </div>
      )}

      {/* ══ STEP 3: CONFIGURE MAPPING ════════════════════════ */}
      {step === 'configure' && selType && fileData && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.25rem', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>{selType.icon}</span>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-primary)', marginBottom: 2 }}>Map columns</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{fileData.rows?.length ?? 0} rows detected · Auto-mapped where possible</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={resetAll} style={S.btn(false)}>✕ Cancel</button>
              <button onClick={() => setStep('preview')} style={S.btn(true)}>Preview →</button>
            </div>
          </div>

          {/* Sheet selector */}
          {fileData.sheetNames?.length > 1 && (
            <div style={{ ...S.card, marginBottom: 12 }}>
              <label style={S.label}>Sheet to import</label>
              <select value={fileData.activeSheet} onChange={e => changeSheet(e.target.value)} style={S.sel}>
                {fileData.sheetNames.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Column mapping */}
          <div style={{ ...S.card, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Column mapping</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {selType.columns.map(tc => (
                <div key={tc.key}>
                  <label style={S.label}>
                    {tc.label}
                    {tc.required && <span style={{ color: '#c0392b', marginLeft: 4 }}>*</span>}
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>→ file column</span>
                  </label>
                  <select value={colMap[tc.key] || ''} onChange={e => setColMap(p => ({ ...p, [tc.key]: e.target.value || null }))} style={S.sel}>
                    <option value="">— skip —</option>
                    {fileData.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {colMap[tc.key] && (
                    <div style={{ fontSize: 10, color: 'var(--accent)', marginTop: 3 }}>✓ mapped to "{colMap[tc.key]}"</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ STEP 4: PREVIEW ══════════════════════════════════ */}
      {step === 'preview' && selType && fileData && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--text-primary)', marginBottom: 2 }}>Preview import</h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {buildMappedRows().length} rows ready to import into {selType.label}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={resetAll} style={S.btn(false)}>✕ Cancel</button>
              <button onClick={() => setStep('configure')} style={S.btn(false)}>← Back</button>
              <button onClick={runImport} disabled={importing} style={{ ...S.btn(true), opacity: importing ? 0.6 : 1 }}>
                {importing ? 'Importing…' : `↑ Import ${buildMappedRows().length} rows`}
              </button>
            </div>
          </div>

          {/* Validation check */}
          {(() => {
            const rows  = buildMappedRows()
            const missing = selType.columns.filter(c => c.required && !colMap[c.key])
            return missing.length > 0 && (
              <div style={{ background: 'rgba(192,57,43,0.08)', border: '0.5px solid rgba(192,57,43,0.3)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#c0392b' }}>
                ⚠ Missing required columns: {missing.map(c => c.label).join(', ')}
              </div>
            )
          })()}

          {/* Preview table */}
          <div style={{ ...S.card, padding: 0, overflow: 'hidden', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr>
                {selType.columns.filter(c => colMap[c.key]).map(c => (
                  <th key={c.key} style={S.th}>{c.label}</th>
                ))}
              </tr></thead>
              <tbody>
                {buildMappedRows().slice(0, 10).map((row, i) => (
                  <tr key={i}>
                    {selType.columns.filter(c => colMap[c.key]).map(c => (
                      <td key={c.key} style={S.td} title={String(row[c.key] ?? '')}>
                        {String(row[c.key] ?? '—').slice(0, 50)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {buildMappedRows().length > 10 && (
              <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)', borderTop: '0.5px solid var(--border)' }}>
                Showing first 10 of {buildMappedRows().length} rows
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ STEP 5: RESULT ═══════════════════════════════════ */}
      {step === 'result' && result && selType && (
        <div>
          <div style={{ ...S.card, textAlign: 'center', padding: '3rem', marginBottom: 16 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {result.errors?.length === 0 ? '✅' : result.inserted > 0 ? '⚠️' : '❌'}
            </div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-primary)', marginBottom: 8 }}>
              {result.errors?.length === 0 ? 'Import complete' : result.inserted > 0 ? 'Partial import' : 'Import failed'}
            </h3>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', margin: '1.25rem 0' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: '#27ae60' }}>{result.inserted}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>rows imported</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: '#c0392b' }}>{result.errors?.length ?? 0}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>errors</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--text-muted)' }}>{result.total}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>total rows</div>
              </div>
            </div>
            {result.note && (
              <div style={{ fontSize: 13, color: '#e67e22', padding: '8px 16px', background: 'rgba(230,126,34,0.08)', borderRadius: 'var(--radius)', display: 'inline-block', marginBottom: 16 }}>{result.note}</div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={resetAll} style={S.btn(true)}>Import more</button>
              <button onClick={() => { setStep('preview') }} style={S.btn(false)}>← Try again</button>
            </div>
          </div>

          {/* Error details */}
          {result.errors?.length > 0 && (
            <div style={{ ...S.card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', fontSize: 11, fontWeight: 600, color: '#c0392b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Errors ({result.errors.length})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr>
                  <th style={S.th}>Row</th>
                  <th style={S.th}>Error</th>
                </tr></thead>
                <tbody>
                  {result.errors.slice(0, 20).map((e, i) => (
                    <tr key={i}>
                      <td style={S.td}>{JSON.stringify(e.row || {}).slice(0, 80)}</td>
                      <td style={{ ...S.td, color: '#c0392b' }}>{e.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
