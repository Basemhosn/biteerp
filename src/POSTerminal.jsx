import { useState, useEffect, useCallback, useRef } from 'react'
import { enqueue, getPendingCount } from './offlineQueue.js'
import { printerManager, kitchenPrinterManager } from './ReceiptPrinter.js'
import { simulatePayment, openPaymentWindow, createTapCharge, GATEWAYS } from './PaymentGateway.js'
import { useOnlineStatus } from './useOnlineStatus.js'
import {
  loadMenu, loadTables, loadOpenOrders, createOrder,
  addOrderItem, removeOrderItem, updateOrderTotals, closeOrder, voidOrder,
  fireOrderToKitchen, markOrderReady, updateItemNotes, transferTable,
  loadKitchenOrders, getOpenCashSession, openCashSession, closeCashSession,
  addCashMovement, updateSessionSales, loadCashSessions,
  updateOrderCovers, loadCompanyProfile, closeOrderWithInvoice, writeAuditLog,
  searchCustomers, loadLoyaltySettings, earnPoints, redeemPoints, calcPointsValue,
  loadPOSPermissions, verifyManagerPIN, writeAuditLogFull,
  lookupBarcode, loadPromotions, applyPromoCode, incrementPromoUsage,
  createRefund, loadRefunds,
  openCashierShift, closeCashierShift, getActiveShift, updateShiftSales, loadShifts
} from './supabase.js'
import styles from './POSTerminal.module.css'

const n = v => parseFloat(v) || 0
const VAT = 0.05
const fmt = v => 'AED ' + n(v).toFixed(2)

const STATUS_COLOR = {
  available: { bg: '#eafaf1', border: '#a9dfbf', text: '#27ae60', label: 'Available' },
  occupied:  { bg: '#fef5e7', border: '#f9ca8c', text: '#e67e22', label: 'Occupied'  },
  ready:     { bg: '#eaf4fb', border: '#aed6f1', text: '#2980b9', label: 'Ready'     },
  reserved:  { bg: '#f5eef8', border: '#d2b4de', text: '#8e44ad', label: 'Reserved'  },
}

export default function POSTerminal({ restaurantId, userId, session }) {
  const [menu,        setMenu]        = useState({ categories: [], items: [] })
  const [tables,      setTables]      = useState([])
  const [openOrders,  setOpenOrders]  = useState([])
  const [kitchenOrds, setKitchenOrds] = useState([])
  const [company,     setCompany]     = useState(null)
  const [cashSession, setCashSession] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [view,        setView]        = useState('floor') // floor|pos|kitchen|orders|cash
  const [activeOrder, setActiveOrder] = useState(null)
  const [orderItems,  setOrderItems]  = useState([])
  const [activeCat,   setActiveCat]   = useState(null)
  const [menuSearch,  setMenuSearch]  = useState('')
  const [saving,      setSaving]      = useState(false)

  // Modals
  const [modModal,    setModModal]    = useState(null)
  const [selectedMods,setSelectedMods]= useState({})
  const [payModal,    setPayModal]    = useState(false)
  const [splitModal,  setSplitModal]  = useState(false)
  const [transferModal,setTransferModal]= useState(false)
  const [noteModal,   setNoteModal]   = useState(null) // order_item
  const [noteText,    setNoteText]    = useState('')
  const [payMethod,   setPayMethod]   = useState('cash')
  const [discount,    setDiscount]    = useState('0')
  const [discType,    setDiscType]    = useState('amount') // amount|percent
  const [splitCount,  setSplitCount]  = useState(2)
  const [covers,      setCovers]      = useState(1)
  const [custName,    setCustName]    = useState('')

  // Cash drawer
  const [cashModal,   setCashModal]   = useState(null) // open|close|movement
  const [cashFloat,   setCashFloat]   = useState('0')
  const [cashClose,   setCashClose]   = useState('0')
  const [cashMoveAmt, setCashMoveAmt] = useState('')
  const [cashMoveReason,setCashMoveReason] = useState('')
  const [cashMoveType,setCashMoveType] = useState('cash_in')
  const [cashSessions,setCashSessions]= useState([])

  // Barcode scanner
  const [lastInvoice,   setLastInvoice]   = useState(null)
  const { isOnline, isSyncing, pendingCnt } = useOnlineStatus()
  const [gatewayProcessing, setGatewayProcessing] = useState(false)
  const [gatewayResult,     setGatewayResult]     = useState(null)  // { success, authCode, reference }
  const [hardwareConfig,    setHardwareConfig]     = useState(null)
  const [posPerms,      setPosPerms]      = useState(null)
  // Manager override modal
  const [overrideModal, setOverrideModal] = useState(null) // { action, onConfirm, label }
  const [overridePIN,   setOverridePIN]   = useState('')
  const [overrideError, setOverrideError] = useState('')
  const [loyaltySettings, setLoyaltySettings] = useState(null)
  // Customer lookup
  const [custSearch,    setCustSearch]    = useState('')
  const [custResults,   setCustResults]   = useState([])
  const [selCustomer,   setSelCustomer]   = useState(null)
  const [custSearching, setCustSearching] = useState(false)
  // Loyalty redemption
  const [redeemPoints,  setRedeemPointsAmt] = useState('') // points to redeem
  const [redeemDiscount,setRedeemDiscount]  = useState(0)
  const [lastPointsEarned, setLastPointsEarned] = useState(0)
  const [barcodeInput,  setBarcodeInput]  = useState('')
  const barcodeRef = useRef(null)
  const barcodeTimer = useRef(null)

  // Promos
  const [promotions,    setPromotions]    = useState([])
  const [promoCode,     setPromoCode]     = useState('')
  const [promoError,    setPromoError]    = useState('')
  const [appliedPromo,  setAppliedPromo]  = useState(null)

  // Shift
  const [activeShift,   setActiveShift]   = useState(null)
  const [shiftModal,    setShiftModal]    = useState(null) // open|close
  const [shiftName,     setShiftName]     = useState('')
  const [shiftFloat,    setShiftFloat]    = useState('0')
  const [shiftClose,    setShiftClose]    = useState('0')
  const [shifts,        setShifts]        = useState([])

  // Refunds
  const [refundModal,   setRefundModal]   = useState(null) // order object
  const [refundType,    setRefundType]    = useState('full') // full|partial|item
  const [refundMethod,  setRefundMethod]  = useState('cash')
  const [refundReason,  setRefundReason]  = useState('')
  const [refundLines,   setRefundLines]   = useState([])
  const [refunds,       setRefunds]       = useState([])

  // Variants
  const [variantModal,  setVariantModal]  = useState(null) // { item, variants }

  const kitchenTimer = useRef(null)

  useEffect(() => {
    if (!restaurantId) { setLoading(false); return }
    loadAll()
  }, [restaurantId])

  const refreshKitchen = async () => {
    const k = await loadKitchenOrders(restaurantId)
    setKitchenOrds(k)
  }

  // Auto-refresh kitchen every 30s
  useEffect(() => {
    if (view === 'kitchen') {
      kitchenTimer.current = setInterval(refreshKitchen, 30000)
    } else {
      clearInterval(kitchenTimer.current)
    }
    return () => clearInterval(kitchenTimer.current)
  }, [view])


  // ── Keyboard shortcuts ────────────────────────────────────
  // ── Computed ──────────────────────────────────────────────

  const activeItems = orderItems.filter(i => i.status !== 'voided')
  const subtotal    = activeItems.reduce((s, i) => s + n(i.item_total) * (i.quantity ?? 1), 0)
  const discAmt     = discType === 'percent' ? subtotal * n(discount) / 100 : Math.min(n(discount), subtotal)
  const vatAmt      = (subtotal - discAmt) * VAT
  const total       = subtotal - discAmt + vatAmt
  const splitAmt    = total / Math.max(splitCount, 1)

  const menuItems   = menu.items.filter(i =>
    i.category_id === activeCat &&
    (!menuSearch || i.name.toLowerCase().includes(menuSearch.toLowerCase()))
  )
  const tableOrder  = (t) => openOrders.find(o => o.table_id === t.id && ['open','sent','ready'].includes(o.status))
  const sections    = [...new Set(tables.map(t => t.section).filter(Boolean))]
  const pendingKitchen = kitchenOrds.filter(o => o.status === 'sent').length
  const readyKitchen   = kitchenOrds.filter(o => o.status === 'ready').length

  useEffect(() => {
    const handler = (e) => {
      // Only active when in POS view
      if (view !== 'pos') return
      // Don't intercept when typing in an input/textarea
      if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return

      // Escape — close modals in priority order
      if (e.key === 'Escape') {
        if (modModal)    { setModModal(null);    return }
        if (noteModal)   { setNoteModal(null);   return }
        if (splitModal)  { setSplitModal(false); return }
        if (refundModal) { setRefundModal(null); return }
        if (payModal)    { setPayModal(false);   return }
        return
      }

      // P — open pay modal
      if ((e.key === 'p' || e.key === 'P') && !payModal && !modModal) {
        if (activeOrder && activeItems.length > 0) { setPayModal(true); return }
      }

      // F — go to floor view
      if ((e.key === 'f' || e.key === 'F') && !payModal && !modModal) {
        setView('floor'); return
      }

      // Number keys 1-9 — tap the Nth visible menu item
      if (!payModal && !modModal && !noteModal) {
        const digit = parseInt(e.key)
        if (!isNaN(digit) && digit >= 1 && digit <= 9) {
          e.preventDefault()
          const visibleItems = menu.items.filter(i =>
            i.active !== false && i.category_id === activeCat
          )
          const target = visibleItems[digit - 1]
          if (target) handleItemTap(target)
          return
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [view, payModal, modModal, noteModal, splitModal, refundModal, activeOrder, activeItems, menu, activeCat])

  async function loadAll() {
    setLoading(true)
    try {
      const results = await Promise.all([
        loadMenu(restaurantId),
        loadTables(restaurantId),
        loadOpenOrders(restaurantId),
        loadKitchenOrders(restaurantId),
        loadCompanyProfile(restaurantId),
        getOpenCashSession(restaurantId),
        loadPromotions(restaurantId),
        getActiveShift(restaurantId, userId),
        loadRefunds(restaurantId, 20),
      ])
      const m     = results[0]
      const t     = results[1]
      const o     = results[2]
      const k     = results[3]
      const comp  = results[4]
      const cs    = results[5]
      const promos= results[6]
      const shift = results[7]
      const refs  = results[8]
      setMenu(m)
      setTables(t)
      setOpenOrders(o)
      setKitchenOrds(k)
      setCompany(comp)
      setCashSession(cs)
      setPromotions(promos)
      setActiveShift(shift)
      setRefunds(refs)
      if (m.categories.length > 0) setActiveCat(m.categories[0].id)
      // Load secondary data separately to avoid circular refs
      loadLoyaltySettings(restaurantId).then(setLoyaltySettings).catch(() => {})
      loadPOSPermissions(restaurantId).then(setPosPerms).catch(() => {})
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const reload = async () => {
    const [t, o] = await Promise.all([loadTables(restaurantId), loadOpenOrders(restaurantId)])
    setTables(t); setOpenOrders(o)
  }

  // ── Order management ──────────────────────────────────────
  const startOrder = async (tableId, type) => {
    if (!cashSession) { setCashModal('open'); return }
    setSaving(true)
    try {
      if (isOnline) {
        const order = await createOrder(restaurantId, tableId, type, userId)
        setActiveOrder({ ...order, covers: 1 }); setOrderItems([])
      } else {
        // Offline: create a local order with temp ID
        const tempId = 'offline-' + Date.now()
        const localOrder = {
          id: tempId, restaurant_id: restaurantId, table_id: tableId,
          order_type: type, status: 'open', subtotal: 0, vat_amount: 0,
          total: 0, discount: 0, opened_by: userId,
          opened_at: new Date().toISOString(), order_number: 'OFFLINE-' + tempId.slice(-4),
          _offline: true,
        }
        await enqueue('create_order', localOrder)
        setActiveOrder(localOrder); setOrderItems([])
      }
      setCovers(1); setCustName(''); setDiscount('0')
      setView('pos')
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const openExisting = (order) => {
    setActiveOrder(order); setOrderItems(order.order_items ?? [])
    setCovers(order.covers ?? 1); setCustName(order.customer_name ?? '')
    setDiscount(String(order.discount ?? 0)); setView('pos')
  }

  // ── Items ─────────────────────────────────────────────────
  function handleItemTap(item) {
    if (item.modifierGroups?.length > 0) { setModModal(item); setSelectedMods({}) }
    else addItem(item, [])
  }

  async function addItem(item, mods) {
    if (!activeOrder) return
    const modTotal  = mods.reduce((s, m) => s + n(m.price_delta), 0)
    const itemTotal = n(item.price) + modTotal
    try {
      const saved = await addOrderItem(activeOrder.id, {
        item_id: item.id, name: item.name, price: n(item.price),
        cost: n(item.cost), quantity: 1, modifiers: mods, item_total: itemTotal,
      })
      const newItems = [...orderItems, { ...saved, status: 'pending', notes: '' }]
      setOrderItems(newItems); await recalc(newItems)
    } catch (e) { alert(e.message) }
    setModModal(null)
  }

  const removeItem = async (itemId) => {
    try {
      await removeOrderItem(itemId)
      const newItems = orderItems.filter(i => i.id !== itemId)
      setOrderItems(newItems); await recalc(newItems)
    } catch (e) { alert(e.message) }
  }

  const changeQty = async (item, delta) => {
    const newQty = (item.quantity ?? 1) + delta
    if (newQty < 1) { removeItem(item.id); return }
    const newItems = orderItems.map(i =>
      i.id === item.id ? { ...i, quantity: newQty, item_total: n(i.price) * newQty } : i)
    setOrderItems(newItems); await recalc(newItems)
  }

  async function recalc(items) {
    const sub   = items.filter(i => i.status !== 'voided').reduce((s, i) => s + n(i.item_total) * (i.quantity ?? 1), 0)
    const disc  = discType === 'percent' ? sub * n(discount) / 100 : n(discount)
    const vat   = (sub - disc) * VAT
    await updateOrderTotals(activeOrder.id, sub, vat, disc > sub ? sub : disc)
  }

  const saveItemNote = async () => {
    if (!noteModal) return
    try {
      await updateItemNotes(noteModal.id, noteText)
      setOrderItems(p => p.map(i => i.id === noteModal.id ? { ...i, notes: noteText } : i))
    } catch (e) { alert(e.message) }
    setNoteModal(null)
  }

  // ── Fire to kitchen ───────────────────────────────────────
  const fireOrder = async () => {
    if (!activeOrder || orderItems.length === 0) return
    setSaving(true)
    try {
      await fireOrderToKitchen(activeOrder.id, userId)
      setActiveOrder(p => ({ ...p, status: 'sent' }))
      setOrderItems(p => p.map(i => ({ ...i, status: i.status === 'pending' ? 'cooking' : i.status })))
      // Print kitchen ticket(s) to all configured kitchen printers
      const table = tables.find(t => t.id === activeOrder.table_id)
      const enrichedItems = orderItems.filter(i => i.status !== 'voided').map(i => ({
        ...i,
        category_name: (menu.items.find(m => m.id === i.item_id)?.category_name ||
          menu.categories.find(c => c.id === menu.items.find(m => m.id === i.item_id)?.category_id)?.name) ?? ''
      }))
      kitchenPrinterManager.printKitchenTicket({
        orderNumber:  activeOrder.order_number,
        tableLabel:   table?.name,
        orderType:    activeOrder.order_type,
        cashierName:  activeShift?.cashier_name,
        firedAt:      new Date().toISOString(),
        items:        orderItems
          .filter(i => i.status === 'pending')
          .map(i => ({
            name:          i.name,
            quantity:      i.quantity ?? 1,
            modifiers:     i.modifiers ?? [],
            notes:         i.notes ?? '',
            category_name: i.category_name ?? '',
          })),
      }).catch(e => console.warn('Kitchen print:', e))
      await reload()
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  // ── Payment ───────────────────────────────────────────────
  const handlePay = async () => {
    setSaving(true)
    try {
      const invoiceNum = await closeOrderWithInvoice(activeOrder.id, payMethod, userId, restaurantId)
      // Earn loyalty points
      if (selCustomer && loyaltySettings?.enabled) {
        try {
          const pts = await earnPoints(restaurantId, selCustomer.id, activeOrder.id, total, userId)
          setLastPointsEarned(pts)
        } catch (e) { console.warn('Points earn failed:', e.message) }
      }
      if (cashSession) await updateSessionSales(cashSession.id, payMethod, total)
      if (activeShift) await updateShiftSales(activeShift.id, total)
      // Write audit log
      await writeAuditLog(restaurantId, userId, 'order_closed', 'order', activeOrder.id, {
        invoice_number: invoiceNum, total, payment_method: payMethod, order_number: activeOrder.order_number
      })
      setLastInvoice(invoiceNum)
      setPayModal(false); setSplitModal(false)
      setActiveOrder(null); setOrderItems([]); setSelCustomer(null); setRedeemPointsAmt(''); setRedeemDiscount(0)
      await reload(); setView('floor')
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleVoid = async () => {
    if (!confirm('Void entire order?')) return
    const doVoid = async (overrideBy, overrideName) => {
      await voidOrder(activeOrder.id, userId)
      await writeAuditLogFull(restaurantId, userId, session?.fullName, 'order_voided', 'order', activeOrder.id, { order_number: activeOrder.order_number, total }, overrideBy, overrideName)
      setActiveOrder(null); setOrderItems([]); setSelCustomer(null)
      await reload(); setView('floor')
    }
    if (posPerms?.require_override_void) {
      requireOverride('void', 'Void order #' + activeOrder.order_number, doVoid)
    } else {
      doVoid(null, null)
    }
    return
    setActiveOrder(null); setOrderItems([])
    await reload(); setView('floor')
  }

  const handleTransfer = async (newTableId) => {
    try {
      await transferTable(activeOrder.id, newTableId)
      setActiveOrder(p => ({ ...p, table_id: newTableId }))
      setTransferModal(false); await reload()
    } catch (e) { alert(e.message) }
  }

  // ── Cash session ──────────────────────────────────────────
  const handleOpenSession = async () => {
    setSaving(true)
    try {
      const s = await openCashSession(restaurantId, n(cashFloat), userId)
      setCashSession(s); setCashModal(null)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleCloseSession = async () => {
    setSaving(true)
    try {
      await closeCashSession(cashSession.id, n(cashClose), '', userId)
      setCashSession(null); setCashModal(null)
      const sessions = await loadCashSessions(restaurantId)
      setCashSessions(sessions)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleCashMove = async () => {
    if (!n(cashMoveAmt)) return
    setSaving(true)
    try {
      await addCashMovement(cashSession.id, restaurantId, cashMoveType, n(cashMoveAmt), cashMoveReason, userId)
      setCashModal(null); setCashMoveAmt(''); setCashMoveReason('')
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  // ── Print receipt ─────────────────────────────────────────
  const printReceipt = async (invoiceOverride = null) => {
    const table   = tables.find(t => t.id === activeOrder?.table_id)
    const invNum  = invoiceOverride ?? lastInvoice ?? activeOrder?.invoice_number ?? '—'
    const netAmt  = subtotal - discAmt
    const vatAmt2 = netAmt * 0.05

    const itemRows = orderItems.filter(i => i.status !== 'voided').map(i => {
      const qty     = i.quantity ?? 1
      const net     = n(i.item_total) * qty / 1.05  // back-calculate net from VAT-inclusive
      const itemVAT = n(i.item_total) * qty - net
      return `
        <tr>
          <td>${qty}× ${i.name}${(i.modifiers??[]).length ? '<br><span style="font-size:10px;color:#666">' + i.modifiers.map(m=>m.name).join(', ') + '</span>' : ''}${i.notes ? '<br><span style="font-size:10px;color:#e67e22">Note: ' + i.notes + '</span>' : ''}</td>
          <td style="text-align:right">${fmt(net)}</td>
          <td style="text-align:right">${fmt(itemVAT)}</td>
          <td style="text-align:right">${fmt(n(i.item_total)*qty)}</td>
        </tr>`
    }).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
    <title>Tax Invoice ${invNum}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1a1a1a;padding:30px;max-width:420px;margin:0 auto}
      .header{text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #0D7377}
      .logo{max-height:60px;max-width:180px;object-fit:contain;margin-bottom:8px}
      .logoText{font-size:20px;font-weight:800;color:#0D7377}
      .invoiceType{font-size:14px;font-weight:700;color:#0D7377;letter-spacing:.06em;margin:6px 0 2px}
      .invoiceNum{font-size:13px;color:#666}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0;font-size:11px}
      .metaBlock label{display:block;color:#999;margin-bottom:3px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}
      .metaBlock span{color:#1a1a1a}
      table{width:100%;border-collapse:collapse;margin:16px 0;font-size:11px}
      thead th{background:#0D7377;color:#fff;padding:7px 8px;text-align:left;font-weight:600}
      thead th:not(:first-child){text-align:right}
      tbody td{padding:7px 8px;border-bottom:.5px solid #e8e8e8;vertical-align:top}
      tbody tr:last-child td{border-bottom:none}
      .totals{border-top:1px solid #0D7377;padding-top:10px;margin-top:4px}
      .trow{display:flex;justify-content:space-between;padding:3px 0;font-size:12px;color:#444}
      .trowBig{display:flex;justify-content:space-between;padding:6px 0;font-size:15px;font-weight:700;color:#0D7377;border-top:1px solid #0D7377;margin-top:4px}
      .vatBox{background:#f9fffe;border:1px solid #0D7377;border-radius:6px;padding:12px;margin:16px 0;font-size:11px}
      .vatBoxTitle{font-size:10px;font-weight:700;color:#0D7377;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px}
      .vatRow{display:flex;justify-content:space-between;padding:2px 0;color:#444}
      .footer{text-align:center;font-size:10px;color:#999;margin-top:20px;padding-top:12px;border-top:.5px solid #e8e8e8}
      .ftaNote{font-size:9px;color:#bbb;margin-top:6px}
      @media print{body{padding:10px}}
    </style></head><body>
    <div class="header">
      ${company?.logo_url ? `<img src="${company.logo_url}" class="logo" alt="Logo"/><br/>` : ''}
      <div class="logoText">${company?.trade_name ?? company?.name ?? 'BiteERP'}</div>
      <div class="invoiceType">TAX INVOICE — فاتورة ضريبية</div>
      <div class="invoiceNum">${invNum}</div>
    </div>

    <div class="meta">
      <div class="metaBlock">
        <label>Supplier</label>
        <span>${company?.name ?? '—'}</span><br/>
        ${company?.address_line1 ? `<span>${company.address_line1}${company.address_line2 ? ', ' + company.address_line2 : ''}, ${company?.city ?? 'Dubai'}, UAE</span><br/>` : ''}
        ${company?.trn ? `<span>TRN: ${company.trn}</span>` : ''}
      </div>
      <div class="metaBlock">
        <label>Invoice details</label>
        <span>Date: ${new Date().toLocaleDateString('en-AE',{day:'numeric',month:'long',year:'numeric'})}</span><br/>
        <span>Time: ${new Date().toLocaleTimeString('en-AE',{hour:'2-digit',minute:'2-digit'})}</span><br/>
        <span>${table ? 'Table: '+table.name : custName ? 'Customer: '+custName : 'Takeaway'}</span>
        ${covers > 1 ? `<br/><span>Covers: ${covers}</span>` : ''}
      </div>
    </div>

    <table>
      <thead><tr><th>Item</th><th>Net (AED)</th><th>VAT (AED)</th><th>Total (AED)</th></tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div class="totals">
      <div class="trow"><span>Subtotal (excl. VAT)</span><span>${fmt(netAmt)}</span></div>
      ${discAmt > 0 ? `<div class="trow"><span>Discount</span><span>− ${fmt(discAmt)}</span></div>` : ''}
      <div class="trowBig"><span>TOTAL (incl. 5% VAT)</span><span>${fmt(total)}</span></div>
    </div>

    <div class="vatBox">
      <div class="vatBoxTitle">VAT Summary — ملخص ضريبة القيمة المضافة</div>
      <div class="vatRow"><span>Tax rate</span><span>5%</span></div>
      <div class="vatRow"><span>Taxable amount (net)</span><span>${fmt(netAmt)}</span></div>
      <div class="vatRow"><span>VAT amount</span><span>${fmt(vatAmt2)}</span></div>
      <div class="vatRow" style="font-weight:600;margin-top:4px;padding-top:4px;border-top:.5px solid #c8e8e8"><span>Total incl. VAT</span><span>${fmt(total)}</span></div>
    </div>

    <div class="trow"><span>Payment method</span><span>${payMethod.toUpperCase()}</span></div>
    ${activeShift ? `<div class="trow"><span>Served by</span><span>${activeShift.cashier_name}</span></div>` : ''}

    <div class="footer">
      ${company?.phone ? `<p>${company.phone}</p>` : ''}
      ${company?.email ? `<p>${company.email}</p>` : ''}
      ${company?.website ? `<p>${company.website}</p>` : ''}
      <p style="margin-top:8px">Thank you for your business!</p>
      <div class="ftaNote">This is a computer-generated tax invoice. No signature required.<br/>
      ${company?.trn ? `Supplier TRN: ${company.trn}` : ''}</div>
    </div>
    </body></html>`

    // Try hardware printer first, fall back to browser
    const receiptData = {
      companyName: company?.trade_name ?? company?.name,
      address: company?.address_line1,
      phone: company?.phone,
      trn: company?.trn,
      invoiceNumber: lastInvoice ?? activeOrder?.invoice_number,
      date: new Date().toLocaleDateString('en-AE'),
      time: new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }),
      table: tables.find(t => t.id === activeOrder?.table_id)?.name,
      cashier: activeShift?.cashier_name,
      customerName: selCustomer?.name ?? custName,
      orderItems: orderItems.filter(i => i.status !== 'voided'),
      subtotal, discount: discAmt, vat: vatAmt, total, paymentMethod: payMethod,
      loyaltyEarned: lastPointsEarned,
    }
    await printerManager.print(receiptData, () => {
      const w = window.open('', '_blank', 'width=500,height=700')
      w.document.write(html); w.document.close()
      setTimeout(() => w.print(), 400)
    })
    // Open cash drawer after payment
    await printerManager.openCashDrawer()
  }

  // ── Customer lookup ──────────────────────────────────
  const handleCustSearch = async (q) => {
    setCustSearch(q)
    if (q.length < 2) { setCustResults([]); return }
    setCustSearching(true)
    try { setCustResults(await searchCustomers(restaurantId, q)) }
    catch (e) { console.error(e) }
    setCustSearching(false)
  }

  const selectCustomer = (c) => {
    setSelCustomer(c); setCustSearch(''); setCustResults([])
  }

  const applyPointsRedemption = () => {
    if (!selCustomer || !redeemPoints) return
    const pts = parseInt(redeemPoints) || 0
    if (!loyaltySettings) return
    const discount = calcPointsValue(pts, loyaltySettings)
    setRedeemDiscount(discount)
    setDiscount(String(discount.toFixed(2)))
    setDiscType('amount')
    recalc(orderItems)
  }

  // ── Barcode scan ─────────────────────────────────────────
  const handleBarcodeKey = async (e) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      const result = await lookupBarcode(restaurantId, barcodeInput.trim())
      if (result) {
        if (result.type === 'variant') {
          // Add variant directly
          const v = result.data
          await addItem({ id: v.item_id, name: v.menu_items?.name + ' — ' + v.name, price: v.price, cost: v.cost, modifierGroups: [] }, [])
        } else {
          handleItemTap(result.data)
        }
      } else {
        // Flash error briefly
        setBarcodeInput('NOT FOUND')
        setTimeout(() => setBarcodeInput(''), 1000)
        return
      }
      setBarcodeInput('')
    }
  }

  // ── Promo code ────────────────────────────────────────────
  const applyPromo = async () => {
    if (!promoCode.trim()) return
    setPromoError('')
    const result = await applyPromoCode(restaurantId, promoCode, subtotal)
    if (result.error) { setPromoError(result.error); return }
    setAppliedPromo(result.promo)
    setDiscount(String(result.discount))
    setDiscType('amount')
    await recalc(orderItems)
  }

  const removePromo = () => {
    setAppliedPromo(null); setPromoCode(''); setPromoError(''); setDiscount('0')
    recalc(orderItems)
  }

  // ── Permission gate ──────────────────────────────────────
  function requireOverride(action, label, onConfirm) {
    const role = session?.role ?? 'staff'
    const isManager = role === 'owner' || role === 'manager'
    // Managers bypass override unless PIN is explicitly required
    if (isManager) { onConfirm(null, null); return }
    setOverrideModal({ action, label, onConfirm })
    setOverridePIN(''); setOverrideError('')
  }

  const submitOverride = async () => {
    const valid = await verifyManagerPIN(restaurantId, overridePIN)
    if (!valid) { setOverrideError('Incorrect PIN'); return }
    overrideModal.onConfirm(userId, session?.fullName ?? 'Manager')
    setOverrideModal(null); setOverridePIN(''); setOverrideError('')
  }

  // ── Cashier shift ─────────────────────────────────────────
  const handleOpenShift = async () => {
    setSaving(true)
    try {
      const shift = await openCashierShift(restaurantId, cashSession?.id, shiftName || session?.fullName || 'Cashier', n(shiftFloat), userId)
      setActiveShift(shift); setShiftModal(null)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const handleCloseShift = async () => {
    if (!activeShift) return
    setSaving(true)
    try {
      await closeCashierShift(activeShift.id, n(shiftClose), userId)
      setActiveShift(null); setShiftModal(null)
      const updated = await loadShifts(restaurantId, 10)
      setShifts(updated)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  // ── Refund ────────────────────────────────────────────────
  const handleRefund = async () => {
    if (!refundModal) return
    setSaving(true)
    try {
      const lines = refundType === 'item' ? refundLines.filter(l => l._selected) : []
      const amount = refundType === 'full'
        ? n(refundModal.total)
        : refundType === 'partial'
          ? lines.reduce((s, l) => s + n(l.item_total) * (l.quantity ?? 1), 0)
          : lines.reduce((s, l) => s + n(l.item_total) * (l.quantity ?? 1), 0)
      const doRefund = async (overrideBy, overrideName) => {
        await createRefund(restaurantId, refundModal.id, refundType, amount, refundReason, refundMethod, lines, userId)
        await writeAuditLogFull(restaurantId, userId, session?.fullName, 'refund_issued', 'order', refundModal.id, { amount, type: refundType, reason: refundReason }, overrideBy, overrideName)
        setRefundModal(null); setRefundReason(''); setRefundLines([])
        const refs = await loadRefunds(restaurantId, 20)
        setRefunds(refs); await reload()
      }
      if (posPerms?.require_override_refund) {
        requireOverride('refund', 'Refund AED ' + amount.toFixed(2), doRefund)
        setSaving(false); return
      }
      await doRefund(null, null)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  const openRefundModal = (order) => {
    setRefundModal(order)
    setRefundType('full')
    setRefundLines((order.order_items ?? []).map(i => ({ ...i, _selected: false })))
  }


  if (!restaurantId) return <div className={styles.loading}>No restaurant linked.</div>
  if (loading) return <div className={styles.loading}>Loading POS…</div>

  return (
    <div className={styles.wrap}>

      {/* ══ TOP BAR ══════════════════════════════════════════ */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          {[
            { key: 'floor',   label: '🪑 Floor',   badge: null },
            { key: 'orders',  label: '📋 Orders',  badge: openOrders.length || null },
            { key: 'kitchen', label: '🔥 Kitchen', badge: pendingKitchen + readyKitchen || null },
            { key: 'cash',    label: '💵 Cash',    badge: null },
          ].map(v => (
            <button key={v.key} className={styles.topBarBtn} data-active={view === v.key}
              onClick={() => { setView(v.key); if (v.key === 'kitchen') refreshKitchen() }}>
              {v.label}
              {v.badge > 0 && <span className={styles.badge}>{v.badge}</span>}
            </button>
          ))}
        </div>
        <div className={styles.topBarRight}>
          {/* Session indicator */}
          {/* Offline indicator */}
          {!isOnline && (
            <span className={styles.sessionBadge} style={{ background: 'rgba(192,57,43,0.12)', color: '#ff6b6b' }}>
              ⚡ Offline{pendingCnt > 0 ? ` · ${pendingCnt} queued` : ''}
            </span>
          )}
          {activeShift
            ? <span className={styles.sessionBadge} style={{ background: 'rgba(39,174,96,0.12)', color: '#27ae60', cursor: 'pointer' }} onClick={() => setShiftModal('close')}>
                👤 {activeShift.cashier_name}
              </span>
            : <span className={styles.sessionBadge} style={{ background: 'rgba(230,126,34,0.1)', color: '#e67e22', cursor: 'pointer' }} onClick={() => setShiftModal('open')}>
                👤 No shift — click to open
              </span>
          }
          {cashSession
            ? <span className={styles.sessionBadge} style={{ background: 'rgba(39,174,96,0.12)', color: '#27ae60' }}>● Session open</span>
            : <span className={styles.sessionBadge} style={{ background: 'rgba(192,57,43,0.1)', color: '#c0392b' }}>● No session</span>
          }
          <button className={styles.newOrderBtn}
            onClick={() => startOrder(null, 'takeaway')} disabled={saving}>
            + Takeaway
          </button>
        </div>
      </div>

      {/* ══ FLOOR PLAN ═══════════════════════════════════════ */}
      {view === 'floor' && (
        <div className={styles.floorWrap}>
          {!cashSession && (
            <div className={styles.sessionAlert}>
              <span>⚠ No cash session open.</span>
              <button className={styles.openSessionBtn} onClick={() => setCashModal('open')}>Open session</button>
            </div>
          )}
          {sections.length === 0 && tables.length === 0 && (
            <div className={styles.emptyState}>
              No tables set up. Go to <strong>POS → Tables</strong> to add your floor plan.
            </div>
          )}
          {(sections.length > 0 ? sections : [null]).map(section => (
            <div key={section ?? 'default'} className={styles.floorSection}>
              {section && <div className={styles.sectionLabel}>{section}</div>}
              <div className={styles.tableGrid}>
                {tables.filter(t => section ? t.section === section : true).map(t => {
                  const order  = tableOrder(t)
                  const sc = STATUS_COLOR[order ? (order.status === 'ready' ? 'ready' : 'occupied') : 'available']
                  return (
                    <div key={t.id} className={styles.tableCard}
                      style={{ background: sc.bg, borderColor: sc.border }}
                      onClick={() => order ? openExisting(order) : startOrder(t.id, 'dine_in')}>
                      <div className={styles.tableName}>{t.name}</div>
                      <div className={styles.tableCap}>👥 {t.capacity}</div>
                      {order ? (
                        <>
                          <div className={styles.tableAmt} style={{ color: sc.text }}>{fmt(order.total)}</div>
                          <div className={styles.tableTag} style={{ background: sc.border, color: sc.text }}>{sc.label}</div>
                        </>
                      ) : (
                        <div className={styles.tableTag} style={{ background: sc.border, color: sc.text }}>Available</div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ OPEN ORDERS ══════════════════════════════════════ */}
      {view === 'orders' && (
        <div className={styles.ordersWrap}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {openOrders.length} open order{openOrders.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className={styles.ordersGrid}>
            {openOrders.length === 0 && <div className={styles.emptyState}>No open orders</div>}
            {openOrders.map(o => {
              const sc = STATUS_COLOR[o.status === 'ready' ? 'ready' : 'occupied']
              return (
                <div key={o.id} className={styles.orderCard} style={{ borderColor: sc.border }}
                  onClick={() => openExisting(o)}>
                  <div className={styles.orderCardTop}>
                    <span className={styles.orderNum}>#{o.order_number}</span>
                    <span className={styles.orderTag} style={{ background: sc.bg, color: sc.text }}>{o.status}</span>
                  </div>
                  <div className={styles.orderTable}>{o.restaurant_tables?.name ?? (o.customer_name ? '🥡 ' + o.customer_name : '🥡 Takeaway')}</div>
                  <div className={styles.orderTotal}>{fmt(o.total)}</div>
                  <div className={styles.orderMeta}>{(o.order_items ?? []).length} items · {new Date(o.opened_at).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              )
            })}
          </div>
          {/* Refunds section */}
          {refunds.length > 0 && (
            <div className={styles.refundSection}>
              <div className={styles.refundSectionTitle}>Recent refunds</div>
              {refunds.slice(0,5).map(r => (
                <div key={r.id} className={styles.refundRow}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 12 }}>{r.refund_number}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Order #{r.orders?.order_number}</span>
                  <span style={{ fontSize: 12, color: '#c0392b', fontWeight: 600 }}>− AED {n(r.amount).toFixed(2)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.payment_method}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ KITCHEN VIEW ═════════════════════════════════════ */}
      {view === 'kitchen' && (
        <div className={styles.kitchenWrap}>
          <div className={styles.kitchenHeader}>
            <span className={styles.kitchenTitle}>Kitchen Display</span>
            <button className={styles.refreshBtn} onClick={refreshKitchen}>↻ Refresh</button>
          </div>
          {kitchenOrds.length === 0 && <div className={styles.emptyState}>No orders in kitchen</div>}
          <div className={styles.kitchenGrid}>
            {kitchenOrds.map(o => {
              const age    = Math.floor((Date.now() - new Date(o.fired_at)) / 60000)
              const urgent = age > 15
              return (
                <div key={o.id} className={styles.kitchenCard} data-urgent={urgent} data-ready={o.status === 'ready'}>
                  <div className={styles.kitchenCardHeader}>
                    <span className={styles.kitchenOrderNum}>#{o.order_number}</span>
                    <span className={styles.kitchenTable}>{o.restaurant_tables?.name ?? 'Takeaway'}</span>
                    <span className={styles.kitchenAge} style={{ color: urgent ? '#c0392b' : '#e67e22' }}>{age}m</span>
                  </div>
                  <div className={styles.kitchenItems}>
                    {(o.order_items ?? []).filter(i => i.status !== 'voided').map(item => (
                      <div key={item.id} className={styles.kitchenItem} data-ready={item.status === 'ready'}>
                        <span className={styles.kitchenQty}>{item.quantity ?? 1}×</span>
                        <div className={styles.kitchenItemInfo}>
                          <span className={styles.kitchenItemName}>{item.name}</span>
                          {item.notes && <span className={styles.kitchenItemNote}>⚠ {item.notes}</span>}
                          {(item.modifiers ?? []).length > 0 && (
                            <span className={styles.kitchenItemMods}>{item.modifiers.map(m => m.name).join(', ')}</span>
                          )}
                        </div>
                        <span className={styles.kitchenItemStatus} data-status={item.status}>
                          {item.status === 'ready' ? '✓' : item.status === 'cooking' ? '🔥' : '⏳'}
                        </span>
                      </div>
                    ))}
                  </div>
                  {o.status !== 'ready' && (
                    <button className={styles.kitchenReadyBtn} onClick={async () => {
                      await markOrderReady(o.id)
                      refreshKitchen(); reload()
                    }}>
                      ✓ Mark order ready
                    </button>
                  )}
                  {o.status === 'ready' && (
                    <div className={styles.kitchenReadyBadge}>✓ Ready for service</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══ CASH DRAWER ══════════════════════════════════════ */}
      {view === 'cash' && (
        <div className={styles.cashWrap}>
          <div className={styles.cashHeader}>
            <h2 className={styles.cashTitle}>Cash Drawer</h2>
            {cashSession
              ? <div className={styles.cashActions}>
                  <button className={styles.cashMoveBtn} onClick={() => setCashModal('movement')}>+ Cash in/out</button>
                  <button className={styles.cashCloseBtn} onClick={() => setCashModal('close')}>Close session</button>
                </div>
              : <button className={styles.openSessionBtn} onClick={() => setCashModal('open')}>Open session</button>
            }
          </div>

          {cashSession && (
            <div className={styles.cashSessionCard}>
              <div className={styles.cashKPIRow}>
                {[
                  { label: 'Opening float',  val: fmt(cashSession.opening_float) },
                  { label: 'Cash sales',     val: fmt(cashSession.total_cash_sales) },
                  { label: 'Card sales',     val: fmt(cashSession.total_card_sales) },
                  { label: 'Total revenue',  val: fmt(cashSession.total_revenue), accent: true },
                  { label: 'Total orders',   val: cashSession.total_orders ?? 0 },
                ].map(k => (
                  <div key={k.label} className={styles.cashKPI}>
                    <span className={styles.cashKPIVal} style={{ color: k.accent ? 'var(--accent)' : 'var(--text-primary)' }}>{k.val}</span>
                    <span className={styles.cashKPILabel}>{k.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                Session opened: {new Date(cashSession.opened_at).toLocaleString('en-AE')}
              </div>
            </div>
          )}

          {/* End of Day summary */}
          {cashSession && (
            <div style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Today's summary</span>
                <button onClick={() => {
                  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>End of Day Report</title>
                  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:monospace;font-size:12px;padding:20px;max-width:360px}
                  h2{font-size:16px;margin-bottom:4px}p{color:#666;font-size:11px;margin-bottom:16px}
                  .row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:.5px solid #eee}
                  .big{font-size:15px;font-weight:700;color:#0D7377}</style></head><body>
                  <h2>End of Day Report</h2>
                  <p>${company?.name ?? 'BiteERP'} · ${new Date().toLocaleDateString('en-AE')}</p>
                  <div class="row"><span>Cash sales</span><span>${fmt(cashSession.total_cash_sales)}</span></div>
                  <div class="row"><span>Card sales</span><span>${fmt(cashSession.total_card_sales)}</span></div>
                  <div class="row"><span>Split sales</span><span>${fmt(cashSession.total_split_sales)}</span></div>
                  <div class="row big"><span>Total revenue</span><span>${fmt(cashSession.total_revenue)}</span></div>
                  <div class="row"><span>Total orders</span><span>${cashSession.total_orders}</span></div>
                  <div class="row"><span>Opening float</span><span>${fmt(cashSession.opening_float)}</span></div>
                  <div class="row"><span>Session opened</span><span>${new Date(cashSession.opened_at).toLocaleTimeString('en-AE')}</span></div>
                  ${activeShift ? `<div class="row"><span>Cashier</span><span>${activeShift.cashier_name}</span></div>` : ''}
                  </body></html>`
                  const w = window.open('', '_blank'); w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300)
                }} style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '5px 12px', background: 'var(--accent-dim)', border: '0.5px solid var(--accent)', borderRadius: 'var(--radius)', color: 'var(--accent)', cursor: 'pointer' }}>
                  🖨 Print EOD
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Cash',         val: fmt(cashSession.total_cash_sales)   },
                  { label: 'Card',         val: fmt(cashSession.total_card_sales)   },
                  { label: 'Orders',       val: cashSession.total_orders ?? 0       },
                  { label: 'Total revenue',val: fmt(cashSession.total_revenue), accent: true },
                  { label: 'Avg order',    val: cashSession.total_orders > 0 ? fmt(cashSession.total_revenue / cashSession.total_orders) : '—' },
                  { label: 'Float',        val: fmt(cashSession.opening_float)      },
                ].map(k => (
                  <div key={k.label} style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: k.accent ? 'var(--accent)' : 'var(--text-primary)', marginBottom: 2 }}>{k.val}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{k.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Previous sessions */}
          <div className={styles.cashSessionsSection}>
            <div className={styles.cashSessionsTitle}>Recent sessions</div>
            {cashSessions.length === 0 && (
              <button className={styles.loadSessionsBtn} onClick={async () => {
                const s = await loadCashSessions(restaurantId)
                setCashSessions(s)
              }}>Load history</button>
            )}
            {cashSessions.filter(s => s.status === 'closed').map(s => (
              <div key={s.id} className={styles.cashSessionRow}>
                <span>{new Date(s.opened_at).toLocaleDateString('en-AE')}</span>
                <span>{fmt(s.total_revenue)} revenue</span>
                <span>{s.total_orders} orders</span>
                <span style={{ color: n(s.cash_difference) >= 0 ? '#27ae60' : '#c0392b' }}>
                  {n(s.cash_difference) >= 0 ? '+' : ''}{fmt(s.cash_difference)} diff
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ POS ORDER SCREEN ═════════════════════════════════ */}
      {view === 'pos' && activeOrder && (
        <div className={styles.posViewWrap}>
          {/* Barcode scanner bar */}
          <div className={styles.barcodeBar}>
            <span className={styles.barcodeIcon}>▦</span>
            <input
              ref={barcodeRef}
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeKey}
              className={styles.barcodeInput}
              placeholder="Scan barcode or enter SKU…"
              style={{ color: barcodeInput === 'NOT FOUND' ? '#c0392b' : undefined }}
            />
          </div>
        <div className={styles.posLayout}>

          {/* Left: Menu panel */}
          <div className={styles.menuPanel}>
            {/* Search */}
            <div className={styles.menuSearchWrap}>
              <input value={menuSearch} onChange={e => setMenuSearch(e.target.value)}
                className={styles.menuSearch} placeholder="🔍 Search menu…" />
              {menuSearch && <button className={styles.clearSearch} onClick={() => setMenuSearch('')}>✕</button>}
            </div>
            {/* Category tabs */}
            <div className={styles.catTabs}>
              {menu.categories.map(cat => (
                <button key={cat.id} className={styles.catTab} data-active={activeCat === cat.id}
                  onClick={() => { setActiveCat(cat.id); setMenuSearch('') }}>
                  {cat.icon && <span>{cat.icon}</span>}
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
            {/* Items */}
            <div className={styles.itemGrid}>
              {menuItems.length === 0 && !menuSearch && (
                <p className={styles.selectCat}>Select a category</p>
              )}
              {menuSearch && menu.items.filter(i => i.name.toLowerCase().includes(menuSearch.toLowerCase())).map(item => (
                <ItemCard key={item.id} item={item} onTap={handleItemTap} />
              ))}
              {!menuSearch && menuItems.map((item, idx) => (
                <div key={item.id} style={{ position: 'relative' }}>
                  {idx < 9 && (
                    <span style={{
                      position: 'absolute', top: 6, left: 6, zIndex: 2,
                      background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.7)',
                      fontSize: 10, fontWeight: 700, width: 16, height: 16,
                      borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-body)', pointerEvents: 'none',
                    }}>{idx + 1}</span>
                  )}
                  <ItemCard item={item} onTap={handleItemTap} />
                </div>
              ))}
            </div>
            <div style={{ padding: '4px 12px 8px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[['1–9','Add item'],['P','Pay'],['F','Floor'],['Esc','Close']].map(([key, label]) => (
                <span key={key} style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <kbd style={{ background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 3, padding: '1px 5px', fontSize: 10, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{key}</kbd>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Ticket panel */}
          <div className={styles.ticketPanel}>
            {/* Ticket header */}
            <div className={styles.ticketHeader}>
              <div className={styles.ticketInfo}>
                <span className={styles.ticketNum}>#{activeOrder.order_number}</span>
                <span className={styles.ticketType}>
                  {activeOrder.order_type === 'dine_in'
                    ? '🪑 ' + (tables.find(t => t.id === activeOrder.table_id)?.name ?? 'Table')
                    : custName ? '🥡 ' + custName : '🥡 Takeaway'
                  }
                </span>
              </div>
              <div className={styles.ticketActions}>
                <button className={styles.ticketActionBtn} title="Transfer table" onClick={() => setTransferModal(true)}>⇄</button>
                <button className={styles.ticketActionBtn} title="Void order" onClick={handleVoid} style={{ color: '#c0392b' }}>🗑</button>
              </div>
            </div>

            {/* Covers + customer name */}
            <div className={styles.orderMeta}>
              {activeOrder.order_type === 'dine_in' ? (
                <div className={styles.coversRow}>
                  <span className={styles.metaLabel}>Covers</span>
                  <div className={styles.coversControl}>
                    <button className={styles.coversBtn} onClick={() => { const c = Math.max(1, covers - 1); setCovers(c); updateOrderCovers(activeOrder.id, c) }}>−</button>
                    <span className={styles.coversNum}>{covers}</span>
                    <button className={styles.coversBtn} onClick={() => { const c = covers + 1; setCovers(c); updateOrderCovers(activeOrder.id, c) }}>+</button>
                  </div>
                </div>
              ) : (
                <div className={styles.custNameRow}>
                  <span className={styles.metaLabel}>Customer</span>
                  <input value={custName} onChange={e => setCustName(e.target.value)}
                    className={styles.custNameInput} placeholder="Name (optional)" />
                </div>
              )}
            </div>

            {/* Items */}
            <div className={styles.ticketItems}>
              {activeItems.length === 0 && <p className={styles.ticketEmpty}>Tap items to add</p>}
              {activeItems.map(item => (
                <div key={item.id} className={styles.ticketItem}>
                  <div className={styles.ticketItemLeft}>
                    <div className={styles.ticketItemName}>{item.name}</div>
                    {(item.modifiers ?? []).length > 0 && (
                      <div className={styles.ticketItemMods}>{item.modifiers.map(m => m.name).join(', ')}</div>
                    )}
                    {item.notes && (
                      <div className={styles.ticketItemNote}>📝 {item.notes}</div>
                    )}
                    <button className={styles.addNoteBtn} onClick={() => { setNoteModal(item); setNoteText(item.notes ?? '') }}>
                      {item.notes ? 'Edit note' : '+ Note'}
                    </button>
                  </div>
                  <div className={styles.ticketItemRight}>
                    <div className={styles.qtyCtrl}>
                      <button className={styles.qtyBtn} onClick={() => changeQty(item, -1)}>−</button>
                      <span className={styles.qtyNum}>{item.quantity ?? 1}</span>
                      <button className={styles.qtyBtn} onClick={() => changeQty(item, +1)}>+</button>
                    </div>
                    <span className={styles.itemPrice}>{fmt(n(item.item_total) * (item.quantity ?? 1))}</span>
                    <button className={styles.removeBtn} onClick={() => removeItem(item.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Customer lookup */}
            <div className={styles.custRow}>
              {selCustomer ? (
                <div className={styles.custSelected}>
                  <div className={styles.custInfo}>
                    <span className={styles.custName}>{selCustomer.name}</span>
                    <span className={styles.custPoints}>🏆 {(selCustomer.loyalty_points ?? 0).toLocaleString()} pts</span>
                  </div>
                  <button className={styles.custRemove} onClick={() => { setSelCustomer(null); setRedeemPointsAmt(''); setRedeemDiscount(0); setDiscount('0'); recalc(orderItems) }}>✕</button>
                </div>
              ) : (
                <div className={styles.custSearch}>
                  <input value={custSearch} onChange={e => handleCustSearch(e.target.value)}
                    className={styles.custInput} placeholder="🔍 Search customer…" />
                  {custResults.length > 0 && (
                    <div className={styles.custDropdown}>
                      {custResults.map(c => (
                        <div key={c.id} className={styles.custOption} onClick={() => selectCustomer(c)}>
                          <span className={styles.custOptionName}>{c.name}</span>
                          <span className={styles.custOptionMeta}>{c.phone} · {(c.loyalty_points??0)} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Redeem points */}
              {selCustomer && loyaltySettings?.enabled && (selCustomer.loyalty_points ?? 0) >= (loyaltySettings.min_redeem ?? 100) && !redeemDiscount && (
                <div className={styles.redeemRow}>
                  <input type="number" value={redeemPoints} onChange={e => setRedeemPointsAmt(e.target.value)}
                    className={styles.redeemInput} placeholder={`Redeem pts (min ${loyaltySettings.min_redeem})`} />
                  <button className={styles.redeemBtn} onClick={applyPointsRedemption}>Redeem</button>
                </div>
              )}
              {redeemDiscount > 0 && (
                <div className={styles.redeemApplied}>
                  🏆 {redeemPoints} pts redeemed = AED {redeemDiscount.toFixed(2)} off
                  <button onClick={() => { setRedeemPointsAmt(''); setRedeemDiscount(0); setDiscount('0'); recalc(orderItems) }} className={styles.promoRemove}>✕</button>
                </div>
              )}
            </div>

            {/* Promo code */}
            <div className={styles.promoRow}>
              {appliedPromo ? (
                <div className={styles.promoApplied}>
                  <span>🎟 {appliedPromo.name}</span>
                  <button className={styles.promoRemove} onClick={removePromo}>✕</button>
                </div>
              ) : (
                <div className={styles.promoInput}>
                  <input value={promoCode} onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError('') }}
                    onKeyDown={e => e.key === 'Enter' && applyPromo()}
                    className={styles.promoField} placeholder="Promo code" />
                  <button className={styles.promoApplyBtn} onClick={applyPromo}>Apply</button>
                </div>
              )}
              {promoError && <div className={styles.promoError}>{promoError}</div>}
            </div>

            {/* Discount */}
            <div className={styles.discountRow}>
              <span className={styles.metaLabel}>Discount</span>
              <div className={styles.discountCtrl}>
                <button className={styles.discTypeBtn} data-active={discType === 'amount'} onClick={() => setDiscType('amount')}>AED</button>
                <button className={styles.discTypeBtn} data-active={discType === 'percent'} onClick={() => setDiscType('percent')}>%</button>
                <input type="number" min="0" value={discount}
                  onChange={e => { setDiscount(e.target.value); recalc(orderItems) }}
                  className={styles.discInput} />
              </div>
            </div>

            {/* Discount permission warning */}
            {posPerms && discAmt > 0 && (n(discount) > (posPerms.max_discount_cashier ?? 10)) && (session?.role === 'staff' || session?.role === 'cashier') && (
              <div style={{ padding: '4px 14px', fontSize: 11, color: '#e67e22', background: 'rgba(230,126,34,0.08)', borderTop: '0.5px solid rgba(230,126,34,0.2)' }}>
                ⚠ Discount exceeds your limit ({posPerms.max_discount_cashier}%). Manager override required at payment.
              </div>
            )}

            {/* Totals */}
            <div className={styles.ticketTotals}>
              <div className={styles.totalRow}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
              {discAmt > 0 && <div className={styles.totalRow} style={{ color: '#27ae60' }}><span>Discount</span><span>− {fmt(discAmt)}</span></div>}
              <div className={styles.totalRow}><span>VAT 5%</span><span>{fmt(vatAmt)}</span></div>
              <div className={styles.totalRowBig}><span>Total</span><span>{fmt(total)}</span></div>
            </div>

            {/* Action buttons */}
            <div className={styles.ticketBtns}>
              <button className={styles.fireBtn}
                onClick={fireOrder}
                disabled={saving || orderItems.length === 0}
                data-fired={activeOrder.status === 'sent' || activeOrder.status === 'ready'}>
                {activeOrder.status === 'sent' ? '🔥 Fired' : activeOrder.status === 'ready' ? '✓ Ready' : '🔥 Fire to kitchen'}
              </button>
              <button className={styles.payBtn}
                onClick={() => setPayModal(true)}
                disabled={orderItems.length === 0}>
                Charge {fmt(total)}
              </button>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* ══ MODIFIER MODAL ═══════════════════════════════════ */}
      {modModal && (
        <div className={styles.overlay} onClick={() => setModModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>{modModal.name}</span>
              <span className={styles.modalPrice}>{fmt(modModal.price)}</span>
              <button className={styles.modalClose} onClick={() => setModModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {modModal.modifierGroups?.map(group => (
                <div key={group.id} className={styles.modGroup}>
                  <div className={styles.modGroupLabel}>
                    {group.name}
                    {group.required && <span className={styles.modRequired}>Required</span>}
                    {group.multi_select && <span className={styles.modMulti}>Multi-select</span>}
                  </div>
                  {group.modifiers.map(mod => {
                    const sel = (selectedMods[group.id] ?? []).some(m => m.id === mod.id)
                    return (
                      <button key={mod.id} className={styles.modOption} data-sel={sel}
                        onClick={() => {
                          if (group.multi_select) {
                            setSelectedMods(p => ({ ...p, [group.id]: sel ? (p[group.id] ?? []).filter(m => m.id !== mod.id) : [...(p[group.id] ?? []), mod] }))
                          } else {
                            setSelectedMods(p => ({ ...p, [group.id]: sel ? [] : [mod] }))
                          }
                        }}>
                        <span className={styles.modName}>{mod.name}</span>
                        {n(mod.price_delta) !== 0 && <span className={styles.modDelta}>{n(mod.price_delta) > 0 ? '+' : ''}{fmt(mod.price_delta)}</span>}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
            <button className={styles.modalConfirmBtn} onClick={() => addItem(modModal, Object.values(selectedMods).flat())}>
              Add to order — {fmt(n(modModal.price) + Object.values(selectedMods).flat().reduce((s, m) => s + n(m.price_delta), 0))}
            </button>
          </div>
        </div>
      )}

      {/* ══ ITEM NOTE MODAL ══════════════════════════════════ */}
      {noteModal && (
        <div className={styles.overlay} onClick={() => setNoteModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>Note for {noteModal.name}</span>
              <button className={styles.modalClose} onClick={() => setNoteModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} autoFocus
                placeholder="e.g. No onions · Extra spicy · Allergy: nuts"
                className={styles.noteTextarea} />
              <div className={styles.noteSuggestions}>
                {['No onions', 'Extra spicy', 'Mild', 'No sauce', 'Extra cheese', 'Allergy: nuts', 'Well done', 'Medium rare'].map(s => (
                  <button key={s} className={styles.noteSugg}
                    onClick={() => setNoteText(p => p ? p + ' · ' + s : s)}>{s}</button>
                ))}
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalConfirmBtn} onClick={saveItemNote}>Save note</button>
              <button className={styles.modalCancelBtn} onClick={() => { setNoteText(''); setNoteModal(null) }}>Remove note</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ PAYMENT MODAL ════════════════════════════════════ */}
      {payModal && (
        <div className={styles.overlay} onClick={() => setPayModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>Collect payment</span>
              <button className={styles.modalClose} onClick={() => setPayModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.payTotal}>{fmt(total)}</div>
              <div className={styles.payMethods}>
                {[
                  { key: 'cash',    label: '💵 Cash'    },
                  { key: 'card',    label: '💳 Card'    },
                  { key: 'split',   label: '⚡ Split'   },
                  ...(hardwareConfig?.gateway?.gateway ? [{ key: 'online', label: '📱 Online/QR' }] : []),
                ].map(m => (
                  <button key={m.key} className={styles.payMethodBtn} data-active={payMethod === m.key}
                    onClick={() => setPayMethod(m.key)}>{m.label}</button>
                ))}
              </div>

              {/* Gateway payment */}
              {payMethod === 'online' && hardwareConfig?.gateway && (
                <div style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: 'var(--radius)', marginBottom: 12 }}>
                  {gatewayResult ? (
                    <div style={{ textAlign: 'center', color: '#27ae60' }}>
                      <div style={{ fontSize: 20, marginBottom: 6 }}>✓</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Payment confirmed</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Auth: {gatewayResult.authCode} · Ref: {gatewayResult.reference}</div>
                    </div>
                  ) : gatewayProcessing ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      Processing payment…
                    </div>
                  ) : (
                    <button onClick={async () => {
                      setGatewayProcessing(true)
                      try {
                        const gc = hardwareConfig.gateway
                        if (gc.simulation_mode) {
                          const result = await simulatePayment(total, 'card')
                          setGatewayResult(result)
                        } else if (gc.gateway === 'tap' && gc.publishable_key) {
                          const { url } = await createTapCharge(gc.publishable_key, total, 'AED', activeOrder.order_number, selCustomer ?? {})
                          openPaymentWindow(url, () => setGatewayResult({ success: true, authCode: 'TAP', reference: activeOrder.order_number }))
                        } else {
                          const result = await simulatePayment(total)
                          setGatewayResult(result)
                        }
                      } catch (e) { alert(e.message) }
                      setGatewayProcessing(false)
                    }} style={{ width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, padding: '12px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>
                      {hardwareConfig.gateway.simulation_mode ? '🔵 Simulate payment' : '📱 Open payment page'}
                    </button>
                  )}
                </div>
              )}

              {payMethod === 'split' && (
                <div className={styles.splitRow}>
                  <span className={styles.metaLabel}>Split between</span>
                  <div className={styles.splitCtrl}>
                    <button className={styles.qtyBtn} onClick={() => setSplitCount(p => Math.max(2, p - 1))}>−</button>
                    <span className={styles.qtyNum}>{splitCount} people</span>
                    <button className={styles.qtyBtn} onClick={() => setSplitCount(p => p + 1)}>+</button>
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{fmt(splitAmt)} each</span>
                </div>
              )}

              <div className={styles.payBreakdown}>
                <div className={styles.payRow}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {discAmt > 0 && <div className={styles.payRow} style={{ color: '#27ae60' }}><span>Discount</span><span>− {fmt(discAmt)}</span></div>}
                <div className={styles.payRow}><span>VAT 5%</span><span>{fmt(vatAmt)}</span></div>
                <div className={styles.payRowBig}><span>Total</span><span>{fmt(total)}</span></div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalConfirmBtn} onClick={() => { setGatewayResult(null); handlePay() }} disabled={saving || (payMethod === 'online' && !gatewayResult)}>
                {saving ? 'Processing…' : `✓ Confirm ${payMethod} — ${fmt(total)}`}
              </button>
              <button className={styles.modalSecondBtn} onClick={() => { setPayModal(false); setTimeout(printReceipt, 100) }}>
                🖨 Print receipt
              </button>
              {lastInvoice && <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', width: '100%', marginTop: 4 }}>Invoice: {lastInvoice}</div>}
              {lastPointsEarned > 0 && selCustomer && <div style={{ fontSize: 12, color: '#e67e22', textAlign: 'center', width: '100%', marginTop: 4, fontWeight: 500 }}>🏆 {lastPointsEarned} points earned for {selCustomer.name}!</div>}
            </div>
          </div>
        </div>
      )}

      {/* ══ TABLE TRANSFER MODAL ═════════════════════════════ */}
      {transferModal && (
        <div className={styles.overlay} onClick={() => setTransferModal(false)}>
          <div className={styles.modal} style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>Transfer to table</span>
              <button className={styles.modalClose} onClick={() => setTransferModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.transferGrid}>
                {tables.filter(t => t.id !== activeOrder?.table_id && !tableOrder(t)).map(t => (
                  <button key={t.id} className={styles.transferTableBtn} onClick={() => handleTransfer(t.id)}>
                    {t.name}
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'block' }}>👥 {t.capacity}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ CASH SESSION MODALS ══════════════════════════════ */}
      {cashModal === 'open' && (
        <div className={styles.overlay} onClick={() => setCashModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>Open cash session</span>
              <button className={styles.modalClose} onClick={() => setCashModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Count your starting cash and enter the opening float.
              </p>
              <div className={styles.cashInputRow}>
                <label className={styles.metaLabel}>Opening float (AED)</label>
                <input type="number" min="0" step="0.5" value={cashFloat}
                  onChange={e => setCashFloat(e.target.value)}
                  className={styles.cashInput} autoFocus />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalConfirmBtn} onClick={handleOpenSession} disabled={saving}>
                {saving ? 'Opening…' : 'Open session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cashModal === 'close' && (
        <div className={styles.overlay} onClick={() => setCashModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>Close session — Z Report</span>
              <button className={styles.modalClose} onClick={() => setCashModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.zReport}>
                {[
                  { label: 'Opening float',  val: fmt(cashSession?.opening_float) },
                  { label: 'Cash sales',     val: fmt(cashSession?.total_cash_sales) },
                  { label: 'Card sales',     val: fmt(cashSession?.total_card_sales) },
                  { label: 'Split sales',    val: fmt(cashSession?.total_split_sales) },
                  { label: 'Total revenue',  val: fmt(cashSession?.total_revenue), bold: true },
                  { label: 'Total orders',   val: cashSession?.total_orders ?? 0 },
                ].map(r => (
                  <div key={r.label} className={styles.zRow} style={{ fontWeight: r.bold ? 600 : 400 }}>
                    <span>{r.label}</span><span>{r.val}</span>
                  </div>
                ))}
              </div>
              <div className={styles.cashInputRow} style={{ marginTop: 16 }}>
                <label className={styles.metaLabel}>Actual cash in drawer (AED)</label>
                <input type="number" min="0" step="0.5" value={cashClose}
                  onChange={e => setCashClose(e.target.value)} className={styles.cashInput} autoFocus />
              </div>
              {n(cashClose) > 0 && (
                <div className={styles.cashDiff} style={{ color: n(cashClose) - (n(cashSession?.opening_float) + n(cashSession?.total_cash_sales)) >= 0 ? '#27ae60' : '#c0392b' }}>
                  Difference: {fmt(n(cashClose) - (n(cashSession?.opening_float) + n(cashSession?.total_cash_sales)))}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalConfirmBtn} style={{ background: '#c0392b' }} onClick={handleCloseSession} disabled={saving}>
                {saving ? 'Closing…' : 'Close session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cashModal === 'movement' && (
        <div className={styles.overlay} onClick={() => setCashModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>Cash movement</span>
              <button className={styles.modalClose} onClick={() => setCashModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.payMethods} style={{ marginBottom: 16 }}>
                <button className={styles.payMethodBtn} data-active={cashMoveType === 'cash_in'}
                  onClick={() => setCashMoveType('cash_in')}>Cash in</button>
                <button className={styles.payMethodBtn} data-active={cashMoveType === 'cash_out'}
                  onClick={() => setCashMoveType('cash_out')}>Cash out</button>
              </div>
              <div className={styles.cashInputRow}>
                <label className={styles.metaLabel}>Amount (AED)</label>
                <input type="number" min="0" step="0.5" value={cashMoveAmt}
                  onChange={e => setCashMoveAmt(e.target.value)} className={styles.cashInput} autoFocus />
              </div>
              <div className={styles.cashInputRow} style={{ marginTop: 12 }}>
                <label className={styles.metaLabel}>Reason</label>
                <input value={cashMoveReason} onChange={e => setCashMoveReason(e.target.value)}
                  className={styles.cashInput} placeholder="e.g. Petty cash, supplier payment…" />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalConfirmBtn} onClick={handleCashMove} disabled={saving || !n(cashMoveAmt)}>
                {saving ? 'Saving…' : `Record ${cashMoveType.replace('_', ' ')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MANAGER OVERRIDE MODAL ══════════════════════════ */}
      {overrideModal && (
        <div className={styles.overlay} onClick={() => { setOverrideModal(null); setOverridePIN('') }}>
          <div className={styles.modal} style={{ maxWidth: 340 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalTitle}>Manager override required</span>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{overrideModal.label}</div>
              </div>
              <button className={styles.modalClose} onClick={() => { setOverrideModal(null); setOverridePIN('') }}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                This action requires a manager PIN to proceed.
              </p>
              {/* PIN dots display */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ width: 16, height: 16, borderRadius: '50%', background: overridePIN.length > i ? 'var(--accent)' : 'var(--bg-input)', border: '2px solid var(--border)', transition: 'background 0.15s' }} />
                ))}
              </div>
              {/* PIN keypad */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
                  <button key={i} disabled={!k}
                    onClick={() => {
                      if (k === '⌫') { setOverridePIN(p => p.slice(0,-1)); setOverrideError('') }
                      else if (overridePIN.length < 4) { setOverridePIN(p => p + k); setOverrideError('') }
                    }}
                    style={{ fontFamily: 'var(--font-body)', fontSize: 20, fontWeight: 500, padding: '14px', background: k ? 'var(--bg-input)' : 'transparent', border: k ? '0.5px solid var(--border)' : 'none', borderRadius: 'var(--radius)', color: 'var(--text-primary)', cursor: k ? 'pointer' : 'default', transition: 'background 0.12s' }}>
                    {k}
                  </button>
                ))}
              </div>
              {overrideError && <div style={{ textAlign: 'center', fontSize: 12, color: '#c0392b', marginTop: 12 }}>{overrideError}</div>}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalConfirmBtn}
                onClick={submitOverride}
                disabled={overridePIN.length < 4}>
                Confirm override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CASHIER SHIFT MODAL ══════════════════════════════ */}
      {shiftModal === 'open' && (
        <div className={styles.overlay} onClick={() => setShiftModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>Open cashier shift</span>
              <button className={styles.modalClose} onClick={() => setShiftModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>Start your shift by entering your name and the float you're starting with.</p>
              <div className={styles.cashInputRow} style={{ marginBottom: 12 }}>
                <label className={styles.metaLabel}>Cashier name</label>
                <input value={shiftName} onChange={e => setShiftName(e.target.value)}
                  className={styles.cashInput} placeholder={session?.fullName ?? 'Your name'} autoFocus />
              </div>
              <div className={styles.cashInputRow}>
                <label className={styles.metaLabel}>Opening float (AED)</label>
                <input type="number" min="0" step="0.5" value={shiftFloat}
                  onChange={e => setShiftFloat(e.target.value)} className={styles.cashInput} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalConfirmBtn} onClick={handleOpenShift} disabled={saving}>
                {saving ? 'Opening…' : 'Start shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {shiftModal === 'close' && activeShift && (
        <div className={styles.overlay} onClick={() => setShiftModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>Close shift — {activeShift.cashier_name}</span>
              <button className={styles.modalClose} onClick={() => setShiftModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.zReport}>
                {[
                  { label: 'Shift opened', val: new Date(activeShift.opened_at).toLocaleTimeString('en-AE') },
                  { label: 'Total sales',  val: fmt(activeShift.total_sales) },
                  { label: 'Total orders', val: activeShift.total_orders ?? 0 },
                  { label: 'Opening float',val: fmt(activeShift.opening_float) },
                ].map(r => (
                  <div key={r.label} className={styles.zRow}><span>{r.label}</span><span>{r.val}</span></div>
                ))}
              </div>
              <div className={styles.cashInputRow} style={{ marginTop: 14 }}>
                <label className={styles.metaLabel}>Cash counted in drawer (AED)</label>
                <input type="number" min="0" step="0.5" value={shiftClose}
                  onChange={e => setShiftClose(e.target.value)} className={styles.cashInput} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalConfirmBtn} style={{ background: '#c0392b' }}
                onClick={handleCloseShift} disabled={saving}>
                {saving ? 'Closing…' : 'Close shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ REFUND MODAL ═════════════════════════════════════ */}
      {refundModal && (
        <div className={styles.overlay} onClick={() => setRefundModal(null)}>
          <div className={styles.modal} style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>Refund — Order #{refundModal.order_number}</span>
              <button className={styles.modalClose} onClick={() => setRefundModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              {/* Refund type */}
              <div className={styles.payMethods} style={{ marginBottom: 14 }}>
                {[
                  { key: 'full',    label: `Full refund (${fmt(refundModal.total)})` },
                  { key: 'item',    label: 'Select items' },
                ].map(t => (
                  <button key={t.key} className={styles.payMethodBtn} data-active={refundType === t.key}
                    onClick={() => setRefundType(t.key)}>{t.label}</button>
                ))}
              </div>

              {/* Item selection for partial refund */}
              {refundType === 'item' && (
                <div className={styles.refundItemList}>
                  {refundLines.map((item, i) => (
                    <div key={item.id} className={styles.refundItem}
                      style={{ background: item._selected ? 'var(--accent-dim)' : 'var(--bg-input)', borderColor: item._selected ? 'var(--accent)' : 'var(--border)' }}
                      onClick={() => setRefundLines(p => p.map((l, idx) => idx === i ? { ...l, _selected: !l._selected } : l))}>
                      <span className={styles.refundCheck}>{item._selected ? '☑' : '☐'}</span>
                      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>{item.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>×{item.quantity}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{fmt(n(item.item_total) * (item.quantity ?? 1))}</span>
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#c0392b', marginTop: 8 }}>
                    Refund: {fmt(refundLines.filter(l => l._selected).reduce((s, l) => s + n(l.item_total) * (l.quantity ?? 1), 0))}
                  </div>
                </div>
              )}

              {/* Refund method */}
              <div className={styles.payMethods} style={{ margin: '14px 0 10px' }}>
                {[
                  { key: 'cash',        label: '💵 Cash'        },
                  { key: 'card',        label: '💳 Card'        },
                  { key: 'credit_note', label: '📋 Credit note' },
                ].map(m => (
                  <button key={m.key} className={styles.payMethodBtn} data-active={refundMethod === m.key}
                    onClick={() => setRefundMethod(m.key)}>{m.label}</button>
                ))}
              </div>

              <div className={styles.cashInputRow}>
                <label className={styles.metaLabel}>Reason for refund</label>
                <input value={refundReason} onChange={e => setRefundReason(e.target.value)}
                  className={styles.cashInput} placeholder="e.g. Wrong order, quality issue, customer changed mind…" />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalConfirmBtn} style={{ background: '#c0392b' }}
                onClick={handleRefund} disabled={saving}>
                {saving ? 'Processing…' : 'Process refund'}
              </button>
              <button className={styles.modalCancelBtn} onClick={() => setRefundModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function ItemCard({ item, onTap }) {
  return (
    <button className={styles.itemCard} disabled={!item.available} onClick={() => onTap(item)}>
      {item.image_url && <img src={item.image_url} className={styles.itemImg} alt={item.name} />}
      <span className={styles.itemName}>{item.name}</span>
      {item.description && <span className={styles.itemDesc}>{item.description}</span>}
      <span className={styles.itemPrice}>{fmt(item.price)}</span>
      {item.modifierGroups?.length > 0 && <span className={styles.itemMods}>+ options</span>}
      {!item.available && <span className={styles.itemUnavail}>Unavailable</span>}
    </button>
  )
}
