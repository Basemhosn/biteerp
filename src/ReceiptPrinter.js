// ── BiteERP Receipt Printer ───────────────────────────────────
// Three modes:
// 1. Network/IP printer (Epson ePOS, Star, etc.) — recommended
// 2. WebUSB (direct USB, Chrome/Edge only)
// 3. Browser print fallback (always works)

// ── ESC/POS command bytes ─────────────────────────────────────
const ESC  = 0x1B
const GS   = 0x1D
const LF   = 0x0A
const CR   = 0x0D

const CMD = {
  INIT:        [ESC, 0x40],
  CUT:         [GS,  0x56, 0x41, 0x10],
  CASH_DRAWER: [ESC, 0x70, 0x00, 0x19, 0xFF],
  BOLD_ON:     [ESC, 0x45, 0x01],
  BOLD_OFF:    [ESC, 0x45, 0x00],
  ALIGN_LEFT:  [ESC, 0x61, 0x00],
  ALIGN_CENTER:[ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  LARGE_ON:    [GS,  0x21, 0x11],
  LARGE_OFF:   [GS,  0x21, 0x00],
  FONT_A:      [ESC, 0x4D, 0x00],
  UNDERLINE_ON:[ESC, 0x2D, 0x01],
  UNDERLINE_OFF:[ESC,0x2D, 0x00],
}

function toBytes(str) {
  return new TextEncoder().encode(str)
}

function buildReceipt(receiptData) {
  const {
    companyName, address, phone, trn, invoiceNumber,
    date, time, table, cashier, orderItems,
    subtotal, discount, vat, total, paymentMethod,
    loyaltyEarned, customerName,
  } = receiptData

  const lines = []
  const push  = (...cmds) => lines.push(...cmds)
  const text  = (str) => lines.push(...toBytes(str + '\n'))
  const line  = (char = '-', len = 32) => text(char.repeat(len))

  push(...CMD.INIT)
  push(...CMD.ALIGN_CENTER)
  push(...CMD.BOLD_ON)
  push(...CMD.LARGE_ON)
  text(companyName ?? 'BiteERP')
  push(...CMD.LARGE_OFF)
  push(...CMD.BOLD_OFF)

  if (address) text(address)
  if (phone)   text(phone)
  if (trn)     text('TRN: ' + trn)

  line()
  push(...CMD.ALIGN_LEFT)
  text('TAX INVOICE')
  text('Invoice: ' + (invoiceNumber ?? '—'))
  text('Date: ' + date + '  ' + time)
  if (table)   text('Table: ' + table)
  if (cashier) text('Cashier: ' + cashier)
  if (customerName) text('Customer: ' + customerName)
  line()

  // Items
  for (const item of (orderItems ?? [])) {
    const qty   = item.quantity ?? 1
    const name  = (item.name ?? '').slice(0, 20)
    const price = 'AED ' + (parseFloat(item.item_total) * qty).toFixed(2)
    const left  = qty + 'x ' + name
    const pad   = Math.max(1, 32 - left.length - price.length)
    text(left + ' '.repeat(pad) + price)
    if (item.modifiers?.length) text('  + ' + item.modifiers.map(m => m.name).join(', '))
    if (item.notes) text('  * ' + item.notes)
  }

  line()
  push(...CMD.ALIGN_RIGHT)
  const fmtRow = (label, val) => {
    const row = label + ' '.repeat(Math.max(1, 20 - label.length - val.length)) + val
    text(row.padStart(32))
  }
  fmtRow('Subtotal:', 'AED ' + parseFloat(subtotal).toFixed(2))
  if (discount > 0) fmtRow('Discount:', '-AED ' + parseFloat(discount).toFixed(2))
  fmtRow('VAT 5%:', 'AED ' + parseFloat(vat).toFixed(2))
  push(...CMD.BOLD_ON)
  fmtRow('TOTAL:', 'AED ' + parseFloat(total).toFixed(2))
  push(...CMD.BOLD_OFF)
  fmtRow('Payment:', (paymentMethod ?? 'cash').toUpperCase())

  line()
  push(...CMD.ALIGN_CENTER)
  if (loyaltyEarned > 0) { push(...CMD.BOLD_ON); text(loyaltyEarned + ' loyalty points earned!'); push(...CMD.BOLD_OFF) }
  text('Thank you for dining with us!')
  text('شكراً لزيارتكم!')

  push('\n\n\n'.split('').map(c => c.charCodeAt(0)))
  push(...CMD.CUT)

  return new Uint8Array(lines.flat())
}

// ── Network/IP Printer ────────────────────────────────────────
// Epson ePOS SDK or direct TCP (via CORS proxy/bridge)
class NetworkPrinter {
  constructor(ip, port = 9100) {
    this.ip   = ip
    this.port = port
    // Epson ePOS endpoint (if supported)
    this.eposUrl = `http://${ip}/cgi-bin/epos/service.cgi`
  }

  async print(receiptData) {
    const bytes = buildReceipt(receiptData)
    // Try Epson ePOS SDK first
    try {
      return await this._printEpson(receiptData)
    } catch {
      // Fall back to raw TCP via bridge
      return await this._printRaw(bytes)
    }
  }

  async _printEpson(data) {
    // Epson ePOS-Print XML API
    const xml = this._buildEpsonXML(data)
    const res = await fetch(this.eposUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', 'SOAPAction': '""' },
      body: xml,
    })
    if (!res.ok) throw new Error('ePOS failed: ' + res.status)
    return true
  }

  _buildEpsonXML(d) {
    const items = (d.orderItems ?? []).map(i =>
      `<text>${(i.quantity??1)}x ${i.name} ... AED ${(parseFloat(i.item_total)*(i.quantity??1)).toFixed(2)}&#10;</text>`
    ).join('')
    return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
<s:Body>
<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
<text align="center" font="font_a" width="2" height="2">${d.companyName ?? 'BiteERP'}&#10;</text>
<text align="center">${d.address ?? ''}&#10;${d.trn ? 'TRN: '+d.trn+'&#10;' : ''}</text>
<feed line="1"/>
<text align="left">TAX INVOICE&#10;Invoice: ${d.invoiceNumber ?? '—'}&#10;Date: ${d.date} ${d.time}&#10;</text>
<feed line="1"/>
${items}
<feed line="1"/>
<text>--------------------------------&#10;</text>
<text align="right">VAT 5%: AED ${parseFloat(d.vat).toFixed(2)}&#10;</text>
<text em="true" align="right">TOTAL: AED ${parseFloat(d.total).toFixed(2)}&#10;</text>
<feed line="1"/>
<text align="center">Thank you! / شكراً&#10;</text>
<feed line="3"/>
<cut type="feed"/>
</epos-print>
</s:Body>
</s:Envelope>`
  }

  async _printRaw(bytes) {
    // Requires a small bridge server running locally
    // e.g. https://github.com/NielsLeenheer/WebSerialReceiptPrinter
    const bridgeUrl = `http://localhost:8765/print`
    const res = await fetch(bridgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes,
    })
    if (!res.ok) throw new Error('Print bridge failed')
    return true
  }

  async openCashDrawer() {
    const bytes = new Uint8Array([...CMD.INIT, ...CMD.CASH_DRAWER])
    try { await this._printRaw(bytes) } catch {}
  }
}

// ── WebUSB Printer ────────────────────────────────────────────
class WebUSBPrinter {
  constructor() { this.device = null }

  isSupported() { return 'usb' in navigator }

  async connect() {
    if (!this.isSupported()) throw new Error('WebUSB not supported in this browser')
    this.device = await navigator.usb.requestDevice({
      filters: [
        { vendorId: 0x04b8 }, // Epson
        { vendorId: 0x0519 }, // Star
        { vendorId: 0x1504 }, // Bixolon
        { vendorId: 0x0fe6 }, // Inateck
      ]
    })
    await this.device.open()
    const iface = this.device.configuration.interfaces[0]
    await this.device.claimInterface(iface.interfaceNumber)
    const endpoint = iface.alternates[0].endpoints.find(e => e.direction === 'out')
    this.endpointNumber = endpoint.endpointNumber
  }

  async print(receiptData) {
    if (!this.device) await this.connect()
    const bytes = buildReceipt(receiptData)
    await this.device.transferOut(this.endpointNumber, bytes)
    return true
  }

  async openCashDrawer() {
    if (!this.device) return
    const bytes = new Uint8Array([...CMD.CASH_DRAWER])
    await this.device.transferOut(this.endpointNumber, bytes)
  }
}

// ── Printer Manager (singleton) ───────────────────────────────
class PrinterManager {
  constructor() {
    this.mode    = 'browser'  // 'browser' | 'network' | 'usb'
    this.printer = null
    this.config  = {}
  }

  configure(config) {
    this.config = config
    this.mode   = config.mode ?? 'browser'
    if (this.mode === 'network') {
      this.printer = new NetworkPrinter(config.ip, config.port ?? 9100)
    } else if (this.mode === 'usb') {
      this.printer = new WebUSBPrinter()
    }
  }

  async testConnection() {
    if (this.mode === 'network' && this.printer) {
      try {
        await this.printer._printEpson({ companyName: 'TEST', orderItems: [], subtotal: 0, vat: 0, total: 0, date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString(), invoiceNumber: 'TEST-001' })
        return { success: true, message: 'Printer connected successfully' }
      } catch (e) {
        return { success: false, message: e.message }
      }
    }
    return { success: true, message: 'Browser print mode — no connection test needed' }
  }

  async print(receiptData, htmlFallback) {
    if (this.mode === 'browser' || !this.printer) {
      // Browser print fallback
      if (htmlFallback) htmlFallback()
      return true
    }
    try {
      await this.printer.print(receiptData)
      return true
    } catch (e) {
      console.warn('Hardware print failed, falling back to browser:', e.message)
      if (htmlFallback) htmlFallback()
      return false
    }
  }

  async openCashDrawer() {
    if (this.printer?.openCashDrawer) {
      try { await this.printer.openCashDrawer() } catch (e) { console.warn('Cash drawer:', e.message) }
    }
  }
}

export const printerManager = new PrinterManager()
export { NetworkPrinter, WebUSBPrinter, buildReceipt }

// ═══════════════════════════════════════════════════════════
//  KITCHEN TICKET BUILDER
// ═══════════════════════════════════════════════════════════

export function buildKitchenTicket(ticketData) {
  const {
    orderNumber, tableLabel, orderType,
    cashierName, firedAt, items, printerName,
    courseFilter, // optional — only print items matching these category names
  } = ticketData

  const filteredItems = courseFilter?.length
    ? items.filter(i => courseFilter.some(f => (i.category_name ?? '').toLowerCase().includes(f.toLowerCase())))
    : items

  if (filteredItems.length === 0) return null

  const lines = []
  const push  = (...cmds) => lines.push(...cmds)
  const text  = (str) => lines.push(...new TextEncoder().encode(str + '\n'))
  const line  = (char = '-', len = 40) => text(char.repeat(len))

  push(...CMD.INIT)
  push(...CMD.ALIGN_CENTER)

  // Station label (if set)
  if (printerName) {
    push(...CMD.BOLD_ON)
    text(`[ ${printerName.toUpperCase()} ]`)
    push(...CMD.BOLD_OFF)
  }

  // Big order number
  push(...CMD.LARGE_ON)
  push(...CMD.BOLD_ON)
  text(`ORDER #${orderNumber}`)
  push(...CMD.BOLD_OFF)
  push(...CMD.LARGE_OFF)

  // Table / type
  push(...CMD.BOLD_ON)
  text(tableLabel ?? (orderType === 'takeaway' ? 'TAKEAWAY' : 'COUNTER'))
  push(...CMD.BOLD_OFF)

  // Time fired
  const t = firedAt ? new Date(firedAt) : new Date()
  text(t.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  if (cashierName) text(cashierName)

  line('=')
  push(...CMD.ALIGN_LEFT)

  // Items
  for (const item of filteredItems) {
    const qty  = item.quantity ?? 1
    push(...CMD.BOLD_ON)
    push(...CMD.LARGE_ON)
    text(`${qty}x ${item.name}`)
    push(...CMD.LARGE_OFF)
    push(...CMD.BOLD_OFF)

    // Modifiers
    if (item.modifiers?.length) {
      for (const mod of item.modifiers) {
        text(`  + ${mod.name}`)
      }
    }
    // Notes / special requests
    if (item.notes?.trim()) {
      push(...CMD.BOLD_ON)
      text(`  *** ${item.notes.trim()} ***`)
      push(...CMD.BOLD_OFF)
    }
    text('')
  }

  line('=')
  push(...CMD.ALIGN_CENTER)
  text(`${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''}`)
  push('\n\n\n'.split('').map(c => c.charCodeAt(0)))
  push(...CMD.CUT)

  return new Uint8Array(lines.flat())
}

// ═══════════════════════════════════════════════════════════
//  KITCHEN PRINTER MANAGER
//  Supports multiple kitchen printers, each with optional
//  category/section filtering
// ═══════════════════════════════════════════════════════════

export class KitchenPrinterManager {
  constructor() {
    // Array of { id, name, mode, ip, port, enabled, courseFilter: string[] }
    this.printers = []
  }

  configure(printers = []) {
    this.printers = printers
  }

  async printKitchenTicket(ticketData) {
    const activePrinters = this.printers.filter(p => p.enabled && (p.ip || p.mode === 'browser'))
    if (activePrinters.length === 0) return

    const results = []
    for (const printerConfig of activePrinters) {
      try {
        const bytes = buildKitchenTicket({
          ...ticketData,
          printerName:  printerConfig.name,
          courseFilter: printerConfig.courseFilter?.filter(Boolean) ?? [],
        })
        if (!bytes) continue // no matching items for this printer

        if (printerConfig.mode === 'network' && printerConfig.ip) {
          const printer = new NetworkPrinter(printerConfig.ip, printerConfig.port ?? 9100)
          await printer._printRaw(bytes)
        } else {
          // Browser fallback — open a print window
          this._browserPrintKitchen(ticketData, printerConfig)
        }
        results.push({ printer: printerConfig.name, success: true })
      } catch (e) {
        console.warn(`Kitchen printer ${printerConfig.name} failed:`, e.message)
        results.push({ printer: printerConfig.name, success: false, error: e.message })
        // Fallback to browser print
        this._browserPrintKitchen(ticketData, printerConfig)
      }
    }
    return results
  }

  _browserPrintKitchen(ticketData, printerConfig) {
    // Filter by course
    let items = ticketData.items ?? []
    if (printerConfig.courseFilter?.length) {
      items = items.filter(i =>
        printerConfig.courseFilter.some(f =>
          (i.course ?? 'main').toLowerCase() === f.toLowerCase()
        )
      )
    }
    // Filter by category name
    if (printerConfig.categories) {
      const cats = printerConfig.categories.split(',').map(c => c.trim().toLowerCase()).filter(Boolean)
      if (cats.length > 0) {
        items = items.filter(i =>
          cats.some(cat => (i.category_name ?? '').toLowerCase().includes(cat))
        )
      }
    }

    if (items.length === 0) return

    const rows = items.map(i => `
      <div class="item">
        <div class="qty">${i.quantity ?? 1}x <strong>${i.name}</strong></div>
        ${(i.modifiers ?? []).map(m => `<div class="mod">+ ${m.name}</div>`).join('')}
        ${i.notes ? `<div class="note">★ ${i.notes}</div>` : ''}
      </div>`).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Kitchen Ticket</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: monospace; font-size: 14px; padding: 10px; width: 80mm; }
  .station { text-align: center; font-size: 11px; font-weight: bold; letter-spacing: 2px; border: 1px solid #000; padding: 3px; margin-bottom: 6px; }
  .order-num { text-align: center; font-size: 32px; font-weight: 900; line-height: 1; margin: 6px 0; }
  .table { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 4px; }
  .meta { text-align: center; font-size: 11px; color: #555; margin-bottom: 8px; }
  .divider { border-top: 3px solid #000; margin: 8px 0; }
  .item { margin-bottom: 10px; }
  .qty { font-size: 16px; }
  .mod { font-size: 13px; padding-left: 12px; color: #333; }
  .note { font-size: 13px; padding-left: 12px; font-weight: bold; }
  .footer { text-align: center; font-size: 11px; margin-top: 8px; }
  @media print { @page { margin: 0; } }
</style></head><body>
${printerConfig.name ? `<div class="station">[ ${printerConfig.name.toUpperCase()} ]</div>` : ''}
<div class="order-num">#${ticketData.orderNumber}</div>
<div class="table">${ticketData.tableLabel ?? (ticketData.orderType === 'takeaway' ? 'TAKEAWAY' : 'COUNTER')}</div>
<div class="meta">${new Date(ticketData.firedAt ?? Date.now()).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}${ticketData.cashierName ? ' · ' + ticketData.cashierName : ''}</div>
<div class="divider"></div>
${rows}
<div class="divider"></div>
<div class="footer">${items.length} item${items.length !== 1 ? 's' : ''}</div>
</body></html>`

    const w = window.open('', '_blank', 'width=320,height=500')
    if (w) {
      w.document.write(html)
      w.document.close()
      setTimeout(() => { w.print(); setTimeout(() => w.close(), 1000) }, 300)
    }
  }

  async testPrinter(printerConfig) {
    const testData = {
      orderNumber: 'TEST',
      tableLabel: 'Table 1',
      orderType: 'dine_in',
      cashierName: 'Test',
      firedAt: new Date().toISOString(),
      items: [
        { name: 'Printer Test Item', quantity: 1, modifiers: [], notes: 'This is a test' },
        { name: 'Second Item', quantity: 2, modifiers: [{ name: 'No onions' }], notes: '' },
      ],
    }
    if (printerConfig.mode === 'network' && printerConfig.ip) {
      const printer = new NetworkPrinter(printerConfig.ip, printerConfig.port ?? 9100)
      const bytes = buildKitchenTicket({ ...testData, printerName: printerConfig.name })
      return printer._printRaw(bytes)
        .then(() => ({ success: true, message: 'Test ticket printed!' }))
        .catch(e => ({ success: false, message: e.message }))
    } else {
      this._browserPrintKitchen(testData, printerConfig)
      return { success: true, message: 'Test ticket sent to browser' }
    }
  }
}

export const kitchenPrinterManager = new KitchenPrinterManager()
