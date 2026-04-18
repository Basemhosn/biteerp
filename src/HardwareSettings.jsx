import { useState, useEffect } from 'react'
import { printerManager, kitchenPrinterManager } from './ReceiptPrinter.js'
import { GATEWAYS } from './PaymentGateway.js'
import { supabase } from './supabase.js'

const uid = () => Math.random().toString(36).slice(2, 10)

const COMMON_CATEGORIES = [
  'Hot Food','Cold Food','Grill','Starters','Mains','Desserts',
  'Beverages','Juices','Bar','Bakery','Salads','Pizza','Sushi',
]

const S = {
  card:   { background:'var(--bg-surface)', border:'0.5px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1.25rem', marginBottom:12 },
  title:  { fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:'1rem', paddingBottom:'0.75rem', borderBottom:'0.5px solid var(--border)' },
  field:  { display:'flex', flexDirection:'column', gap:5, marginBottom:12 },
  label:  { fontSize:11, color:'var(--text-muted)', fontWeight:500 },
  input:  { background:'var(--bg-input)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text-primary)', fontSize:13, padding:'8px 10px', outline:'none', fontFamily:'var(--font-body)', width:'100%' },
  grid2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  toggle: (on) => ({ fontFamily:'var(--font-body)', fontSize:12, padding:'5px 14px', background: on?'rgba(39,174,96,0.1)':'var(--bg-input)', border:'0.5px solid '+(on?'#27ae60':'var(--border)'), borderRadius:999, color: on?'#27ae60':'var(--text-muted)', cursor:'pointer' }),
  addBtn: { fontFamily:'var(--font-body)', fontSize:12, padding:'6px 14px', background:'var(--accent-dim)', border:'0.5px solid var(--accent)', borderRadius:'var(--radius)', color:'var(--accent)', cursor:'pointer' },
  delBtn: { fontFamily:'var(--font-body)', fontSize:11, padding:'4px 10px', background:'rgba(192,57,43,0.08)', border:'0.5px solid rgba(192,57,43,0.25)', borderRadius:'var(--radius)', color:'#c0392b', cursor:'pointer' },
  testBtn:{ fontFamily:'var(--font-body)', fontSize:12, padding:'6px 12px', background:'var(--bg-input)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text-secondary)', cursor:'pointer' },
  pCard:  { background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'1rem', marginBottom:10 },
}

function ModeSelector({ value, onChange }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 }}>
      {[
        { key:'browser', label:'Browser',  desc:'Print dialog. Works everywhere.' },
        { key:'network', label:'Network',  desc:'Epson/Star over WiFi/LAN.' },
        { key:'usb',     label:'USB',      desc:'WebUSB. Chrome/Edge only.' },
      ].map(m => (
        <button key={m.key} onClick={() => onChange(m.key)}
          style={{ padding:'10px', background: value===m.key?'var(--accent-dim)':'var(--bg-input)', border:'1px solid '+(value===m.key?'var(--accent)':'var(--border)'), borderRadius:'var(--radius)', cursor:'pointer', textAlign:'left' }}>
          <div style={{ fontSize:12, fontWeight:600, color: value===m.key?'var(--accent)':'var(--text-primary)', marginBottom:3 }}>{m.label}</div>
          <div style={{ fontSize:10, color:'var(--text-muted)' }}>{m.desc}</div>
        </button>
      ))}
    </div>
  )
}

function TestResult({ result }) {
  if (!result) return null
  return (
    <div style={{ marginTop:8, padding:'8px 12px', borderRadius:'var(--radius)', background: result.success?'rgba(39,174,96,0.08)':'rgba(192,57,43,0.08)', border:'0.5px solid '+(result.success?'rgba(39,174,96,0.3)':'rgba(192,57,43,0.3)'), fontSize:12, color: result.success?'#27ae60':'#c0392b' }}>
      {result.success ? '✓ ' : '✕ '}{result.message}
    </div>
  )
}

export default function HardwareSettings({ restaurantId, session }) {
  const [activeTab, setActiveTab] = useState('receipt')

  const [receiptPrinters, setReceiptPrinters] = useState([{
    id: uid(), name:'Receipt Printer 1', mode:'browser', ip:'', port:9100, enabled:true, stationLabel:'',
  }])
  const [receiptTestResults, setReceiptTestResults] = useState({})

  const [kitchenPrinters, setKitchenPrinters] = useState([{
    id: uid(), name:'Kitchen Printer', mode:'network', ip:'', port:9100, enabled:false, courseFilter:[],
  }])
  const [kitchenTestResults, setKitchenTestResults] = useState({})

  const [gatewayConfig, setGatewayConfig] = useState({
    gateway:'', api_key:'', secret_key:'', publishable_key:'',
    integration_id:'', outlet_ref:'', realm:'', hmac_secret:'',
    simulation_mode:true, terminal_bridge_url:'http://localhost:8765',
  })

  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const isManager = session?.role === 'owner' || session?.role === 'manager'

  useEffect(() => { if (restaurantId) loadConfig() }, [restaurantId])

  async function loadConfig() {
    try {
      const { data } = await supabase.from('restaurants').select('hardware_config').eq('id', restaurantId).single()
      if (data?.hardware_config) {
        const c = data.hardware_config
        if (c.receipt_printers?.length) setReceiptPrinters(c.receipt_printers)
        else if (c.printer) setReceiptPrinters([{ id:uid(), ...c.printer, enabled:true, stationLabel:'' }])
        if (c.kitchen_printers?.length) setKitchenPrinters(c.kitchen_printers)
        else if (c.kitchen_printer) setKitchenPrinters([{ id:uid(), name:'Kitchen', ...c.kitchen_printer, courseFilter:[] }])
        if (c.gateway) setGatewayConfig(c.gateway)
        printerManager.configure(c.receipt_printers?.[0] ?? c.printer ?? {})
        kitchenPrinterManager.configure(c.kitchen_printers ?? (c.kitchen_printer ? [c.kitchen_printer] : []))
      }
    } catch {}
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      const config = {
        receipt_printers:receiptPrinters, kitchen_printers:kitchenPrinters, gateway:gatewayConfig,
        printer:receiptPrinters[0], kitchen_printer:kitchenPrinters[0],
      }
      await supabase.from('restaurants').update({ hardware_config:config }).eq('id', restaurantId)
      printerManager.configure(receiptPrinters[0])
      kitchenPrinterManager.configure(kitchenPrinters)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    } catch (e) { alert(e.message) }
    setSaving(false)
  }

  // Receipt helpers
  const addReceiptPrinter  = () => setReceiptPrinters(p => [...p, { id:uid(), name:'Receipt Printer '+(p.length+1), mode:'browser', ip:'', port:9100, enabled:true, stationLabel:'' }])
  const updReceipt         = (id,f,v) => setReceiptPrinters(p => p.map(x => x.id===id ? {...x,[f]:v} : x))
  const delReceiptPrinter  = (id) => setReceiptPrinters(p => p.filter(x => x.id!==id))
  const testReceiptPrinter = async (printer) => {
    printerManager.configure(printer)
    if (printer.mode === 'usb') {
      try { const { WebUSBPrinter } = await import('./ReceiptPrinter.js'); const p = new WebUSBPrinter(); await p.connect(); setReceiptTestResults(r => ({...r,[printer.id]:{success:true,message:'USB connected!'}})) }
      catch (e) { setReceiptTestResults(r => ({...r,[printer.id]:{success:false,message:e.message}})) }
      return
    }
    if (printer.mode === 'network' && printer.ip) {
      const res = await printerManager.testConnection()
      setReceiptTestResults(r => ({...r,[printer.id]:res}))
    } else {
      window.print()
      setReceiptTestResults(r => ({...r,[printer.id]:{success:true,message:'Browser print dialog opened'}}))
    }
  }
  const testCashDrawer = async (printer) => {
    printerManager.configure(printer)
    await printerManager.openCashDrawer()
    setReceiptTestResults(r => ({...r,[printer.id]:{success:true,message:'Cash drawer signal sent'}}))
  }

  // Kitchen helpers
  const addKitchenPrinter  = () => setKitchenPrinters(p => [...p, { id:uid(), name:'Kitchen Printer '+(p.length+1), mode:'network', ip:'', port:9100, enabled:false, courseFilter:[] }])
  const updKitchen         = (id,f,v) => setKitchenPrinters(p => p.map(x => x.id===id ? {...x,[f]:v} : x))
  const delKitchenPrinter  = (id) => setKitchenPrinters(p => p.filter(x => x.id!==id))
  const toggleFilter       = (id,cat) => setKitchenPrinters(p => p.map(x => { if(x.id!==id) return x; const f=x.courseFilter??[]; return {...x,courseFilter:f.includes(cat)?f.filter(c=>c!==cat):[...f,cat]} }))
  const testKitchenPrinter = async (printer) => {
    const res = await kitchenPrinterManager.testPrinter(printer)
    setKitchenTestResults(r => ({...r,[printer.id]:res}))
  }

  const selGateway = GATEWAYS.find(g => g.id === gatewayConfig.gateway)

  return (
    <div>
      <div style={{ marginBottom:'1.25rem' }}>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, color:'var(--text-primary)', marginBottom:4 }}>Hardware & Integrations</h2>
        <p style={{ fontSize:13, color:'var(--text-muted)' }}>Configure receipt printers, kitchen printers, and payment gateways.</p>
      </div>

      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:'1.25rem' }}>
        {[['receipt','Receipt Printers'],['kitchen','Kitchen Printers'],['gateway','Payment Gateway']].map(([k,label]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            style={{ fontFamily:'var(--font-body)', fontSize:13, padding:'10px 18px', border:'none', borderBottom: activeTab===k?'2px solid var(--accent)':'2px solid transparent', background:'transparent', color: activeTab===k?'var(--accent)':'var(--text-muted)', cursor:'pointer', fontWeight: activeTab===k?500:400 }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── RECEIPT PRINTERS ── */}
      {activeTab === 'receipt' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>Receipt Printers</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>Add one printer per POS station or cashier counter</div>
            </div>
            <button style={S.addBtn} onClick={addReceiptPrinter}>+ Add printer</button>
          </div>

          {receiptPrinters.map(printer => (
            <div key={printer.id} style={S.pCard}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:18 }}>🖨</span>
                  <input value={printer.name} onChange={e => updReceipt(printer.id,'name',e.target.value)} style={{ ...S.input, width:200, fontWeight:600 }} placeholder="Printer name" />
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <button style={S.toggle(printer.enabled)} onClick={() => updReceipt(printer.id,'enabled',!printer.enabled)}>{printer.enabled ? '● Active' : '○ Disabled'}</button>
                  {receiptPrinters.length > 1 && <button style={S.delBtn} onClick={() => delReceiptPrinter(printer.id)}>Remove</button>}
                </div>
              </div>

              <ModeSelector value={printer.mode} onChange={v => updReceipt(printer.id,'mode',v)} />

              {printer.mode === 'network' && (
                <div style={S.grid2}>
                  <div style={S.field}><label style={S.label}>IP address</label><input value={printer.ip} onChange={e => updReceipt(printer.id,'ip',e.target.value)} style={S.input} placeholder="192.168.1.100" /></div>
                  <div style={S.field}><label style={S.label}>Port (default 9100)</label><input type="number" value={printer.port} onChange={e => updReceipt(printer.id,'port',parseInt(e.target.value)||9100)} style={S.input} /></div>
                </div>
              )}

              <div style={S.field}>
                <label style={S.label}>Station label (optional — e.g. "Counter 1", "Drive-Through")</label>
                <input value={printer.stationLabel??''} onChange={e => updReceipt(printer.id,'stationLabel',e.target.value)} style={S.input} placeholder="Optional" />
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button style={S.testBtn} onClick={() => testReceiptPrinter(printer)}>🖨 Test print</button>
                <button style={S.testBtn} onClick={() => testCashDrawer(printer)}>💰 Open cash drawer</button>
              </div>
              <TestResult result={receiptTestResults[printer.id]} />
            </div>
          ))}

          <div style={S.card}>
            <div style={S.title}>Tested & supported printers</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:8 }}>
              {['Epson TM-T88','Epson TM-T20','Epson TM-T82','Star TSP100','Star TSP650','Bixolon SRP-350','SEYPOS PRP-300','Xprinter XP-Q800','Any ESC/POS'].map(p => (
                <div key={p} style={{ fontSize:12, padding:'8px 12px', background:'var(--bg-input)', borderRadius:'var(--radius)', color:'var(--text-secondary)' }}>🖨 {p}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── KITCHEN PRINTERS ── */}
      {activeTab === 'kitchen' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>Kitchen Printers</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>Each printer can filter by category — "Hot Kitchen" prints Mains only, "Bar" prints Drinks only</div>
            </div>
            <button style={S.addBtn} onClick={addKitchenPrinter}>+ Add kitchen printer</button>
          </div>

          {kitchenPrinters.map(printer => (
            <div key={printer.id} style={S.pCard}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:18 }}>🔥</span>
                  <input value={printer.name} onChange={e => updKitchen(printer.id,'name',e.target.value)} style={{ ...S.input, width:220, fontWeight:600 }} placeholder="e.g. Hot Kitchen, Bar, Cold Station" />
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <button style={S.toggle(printer.enabled)} onClick={() => updKitchen(printer.id,'enabled',!printer.enabled)}>{printer.enabled ? '● Active' : '○ Disabled'}</button>
                  {kitchenPrinters.length > 1 && <button style={S.delBtn} onClick={() => delKitchenPrinter(printer.id)}>Remove</button>}
                </div>
              </div>

              <ModeSelector value={printer.mode} onChange={v => updKitchen(printer.id,'mode',v)} />

              {printer.mode === 'network' && (
                <div style={S.grid2}>
                  <div style={S.field}><label style={S.label}>IP address</label><input value={printer.ip} onChange={e => updKitchen(printer.id,'ip',e.target.value)} style={S.input} placeholder="192.168.1.101" /></div>
                  <div style={S.field}><label style={S.label}>Port (default 9100)</label><input type="number" value={printer.port} onChange={e => updKitchen(printer.id,'port',parseInt(e.target.value)||9100)} style={S.input} /></div>
                </div>
              )}

              <div style={S.field}>
                <label style={S.label}>
                  Print items from these categories only &nbsp;
                  <span style={{ color:'var(--accent)', fontSize:10 }}>
                    {(printer.courseFilter??[]).length === 0 ? '(all items — no filter)' : (printer.courseFilter??[]).length + ' selected'}
                  </span>
                </label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
                  {COMMON_CATEGORIES.map(cat => {
                    const active = (printer.courseFilter??[]).includes(cat)
                    return (
                      <button key={cat} onClick={() => toggleFilter(printer.id, cat)}
                        style={{ fontFamily:'var(--font-body)', fontSize:11, padding:'4px 10px', borderRadius:999, border:'0.5px solid '+(active?'var(--accent)':'var(--border)'), background: active?'var(--accent-dim)':'var(--bg-input)', color: active?'var(--accent)':'var(--text-muted)', cursor:'pointer' }}>
                        {cat}
                      </button>
                    )
                  })}
                </div>
                <input placeholder="Custom category — press Enter to add" style={{ ...S.input, fontSize:11 }}
                  onKeyDown={e => { if (e.key==='Enter' && e.target.value.trim()) { toggleFilter(printer.id, e.target.value.trim()); e.target.value='' } }} />
              </div>

              <div style={{ padding:'10px 14px', background:'var(--bg-input)', borderRadius:'var(--radius)', fontSize:11, fontFamily:'monospace', whiteSpace:'pre', lineHeight:1.6, color:'var(--text-secondary)', marginBottom:10 }}>
{'[ '+(printer.name||'KITCHEN').toUpperCase()+' ]\nORDER #42\nTable 5\n'+new Date().toLocaleTimeString('en-AE',{hour:'2-digit',minute:'2-digit'})+'\n========================================\n2x Chicken Shawarma\n  + Extra sauce\n  *** No onions ***\n\n1x Grilled Salmon\n========================================\n2 items'}
              </div>

              <button style={S.testBtn} onClick={() => testKitchenPrinter(printer)}>🔥 Print test ticket</button>
              <TestResult result={kitchenTestResults[printer.id]} />
            </div>
          ))}

          <div style={{ padding:'12px 16px', background:'var(--bg-input)', borderRadius:'var(--radius)', fontSize:12, color:'var(--text-muted)', marginTop:8 }}>
            <strong style={{ color:'var(--text-secondary)' }}>How it works:</strong> When a cashier fires an order to the kitchen, BiteERP sends a ticket to every enabled kitchen printer simultaneously. Printers with category filters only receive items from matching categories — your hot station only sees hot food, your bar only sees drinks.
          </div>
        </div>
      )}

      {/* ── PAYMENT GATEWAY ── */}
      {activeTab === 'gateway' && (
        <div>
          <div style={S.card}>
            <div style={S.title}>Select payment gateway</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8, marginBottom:16 }}>
              {GATEWAYS.map(g => (
                <button key={g.id} onClick={() => setGatewayConfig(p => ({...p, gateway:g.id}))}
                  style={{ padding:'12px', background: gatewayConfig.gateway===g.id?'var(--accent-dim)':'var(--bg-input)', border:'1px solid '+(gatewayConfig.gateway===g.id?'var(--accent)':'var(--border)'), borderRadius:'var(--radius)', cursor:'pointer', textAlign:'left' }}>
                  <div style={{ fontSize:13, fontWeight:600, color: gatewayConfig.gateway===g.id?'var(--accent)':'var(--text-primary)', marginBottom:4 }}>{g.logo} {g.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>{g.region}</div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {g.supportsApplePay && <span style={{ fontSize:10, padding:'1px 6px', background:'rgba(0,0,0,0.1)', borderRadius:4, color:'var(--text-muted)' }}>Apple Pay</span>}
                    {g.supportsQR && <span style={{ fontSize:10, padding:'1px 6px', background:'rgba(0,0,0,0.1)', borderRadius:4, color:'var(--text-muted)' }}>QR Pay</span>}
                  </div>
                </button>
              ))}
            </div>
            {selGateway && (
              <div>
                <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--bg-input)', borderRadius:'var(--radius)', fontSize:12, color:'var(--text-muted)' }}>
                  Documentation: <a href={selGateway.docs} target="_blank" rel="noopener noreferrer" style={{ color:'var(--accent)' }}>{selGateway.docs}</a>
                </div>
                <div style={S.grid2}>
                  {selGateway.fields.map(field => (
                    <div key={field} style={S.field}>
                      <label style={S.label}>{field.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
                      <input type={field.includes('secret')||field.includes('key')?'password':'text'} value={gatewayConfig[field]??''} onChange={e => setGatewayConfig(p => ({...p,[field]:e.target.value}))} style={S.input} />
                    </div>
                  ))}
                </div>
                <div style={S.field}>
                  <label style={S.label}>Terminal bridge URL</label>
                  <input value={gatewayConfig.terminal_bridge_url} onChange={e => setGatewayConfig(p => ({...p,terminal_bridge_url:e.target.value}))} style={S.input} placeholder="http://localhost:8765" />
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:10 }}>
                  <div><div style={{ fontSize:13, color:'var(--text-primary)' }}>Simulation mode</div><div style={{ fontSize:11, color:'var(--text-muted)' }}>Test without real charges</div></div>
                  <button onClick={() => setGatewayConfig(p => ({...p,simulation_mode:!p.simulation_mode}))} style={S.toggle(gatewayConfig.simulation_mode)}>{gatewayConfig.simulation_mode ? '● Simulation ON' : '○ Live mode'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:16 }}>
        <button onClick={saveConfig} disabled={saving||!isManager}
          style={{ fontFamily:'var(--font-body)', fontSize:13, fontWeight:500, padding:'10px 28px', background:'var(--accent)', border:'none', borderRadius:'var(--radius)', color:'#fff', cursor: isManager?'pointer':'not-allowed', opacity: saving||!isManager?0.6:1 }}>
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save hardware settings'}
        </button>
        {!isManager && <span style={{ fontSize:12, color:'var(--text-muted)' }}>Only managers can configure hardware</span>}
        {saved && <span style={{ fontSize:12, color:'#27ae60' }}>✓ Settings saved and applied</span>}
      </div>
    </div>
  )
}

// ── Kitchen Printer Panel — multiple printers ─────────────────
function KitchenPrinterPanel({ printers, onChange, S }) {
  const [testResults, setTestResults] = useState({})
  const [testing,     setTesting]     = useState({})

  const add = () => onChange(prev => [...prev, {
    id:           Date.now().toString(),
    name:         `Kitchen Printer ${prev.length + 1}`,
    mode:         'browser',
    ip:           '',
    port:         9100,
    enabled:      true,
    courseFilter: [],
    categories:   '',
  }])

  const update = (id, field, val) => onChange(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p))
  const remove = (id) => onChange(prev => prev.filter(p => p.id !== id))

  async function testPrinter(p) {
    setTesting(prev => ({ ...prev, [p.id]: true }))
    try {
      const { kitchenPrinterManager } = await import('./ReceiptPrinter.js')
      const result = await kitchenPrinterManager.testPrinter(p)
      setTestResults(prev => ({ ...prev, [p.id]: result }))
    } catch (e) {
      setTestResults(prev => ({ ...prev, [p.id]: { success: false, message: e.message } }))
    }
    setTesting(prev => ({ ...prev, [p.id]: false }))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Kitchen printers</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add one printer per station. Each can be routed by food category or course type.</div>
        </div>
        <button onClick={add} style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer' }}>
          + Add printer
        </button>
      </div>

      {printers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: 13, background: 'var(--bg-surface)', border: '0.5px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
          No kitchen printers configured. Click "Add printer" to set up your first one.
        </div>
      )}

      {printers.map((p, idx) => (
        <div key={p.id} style={{ background: 'var(--bg-surface)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', marginBottom: 12 }}>
          {/* Printer header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-dim)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{idx + 1}</div>
              <input value={p.name} onChange={e => update(p.id, 'name', e.target.value)}
                style={{ ...S.input, width: 200, fontWeight: 500 }} placeholder="Printer name" />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button onClick={() => update(p.id, 'enabled', !p.enabled)}
                style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '4px 12px', background: p.enabled ? 'rgba(39,174,96,0.1)' : 'var(--bg-input)', border: `0.5px solid ${p.enabled ? '#27ae60' : 'var(--border)'}`, borderRadius: 999, color: p.enabled ? '#27ae60' : 'var(--text-muted)', cursor: 'pointer' }}>
                {p.enabled ? '● On' : '○ Off'}
              </button>
              <button onClick={() => remove(p.id)}
                style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '4px 10px', background: 'transparent', border: '0.5px solid rgba(192,57,43,0.3)', borderRadius: 'var(--radius)', color: '#c0392b', cursor: 'pointer' }}>Remove</button>
            </div>
          </div>

          {/* Mode */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { key: 'browser', label: '🌐 Browser print' },
              { key: 'network', label: '📡 Network / IP'  },
            ].map(m => (
              <button key={m.key} onClick={() => update(p.id, 'mode', m.key)}
                style={{ padding: '8px', background: p.mode === m.key ? 'var(--accent-dim)' : 'var(--bg-input)', border: `1px solid ${p.mode === m.key ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: p.mode === m.key ? 'var(--accent)' : 'var(--text-primary)' }}>{m.label}</div>
              </button>
            ))}
          </div>

          {/* IP + Port */}
          {p.mode === 'network' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, marginBottom: 14 }}>
              <div style={S.field}>
                <label style={S.label}>Printer IP address</label>
                <input value={p.ip} onChange={e => update(p.id, 'ip', e.target.value)} style={S.input} placeholder="192.168.1.101" />
              </div>
              <div style={S.field}>
                <label style={S.label}>Port</label>
                <input type="number" value={p.port} onChange={e => update(p.id, 'port', parseInt(e.target.value) || 9100)} style={S.input} />
              </div>
            </div>
          )}

          {/* Category / course routing */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Routing — what this printer receives</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={S.field}>
                <label style={S.label}>Filter by categories (comma separated)</label>
                <input value={p.categories ?? ''} onChange={e => update(p.id, 'categories', e.target.value)}
                  style={S.input} placeholder="e.g. Hot Food, Grill, Pizza" />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Empty = receives all items</span>
              </div>
              <div style={S.field}>
                <label style={S.label}>Filter by course</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {['starter','main','dessert','drink'].map(course => {
                    const cf    = p.courseFilter ?? []
                    const on    = cf.includes(course)
                    return (
                      <button key={course} onClick={() => update(p.id, 'courseFilter', on ? cf.filter(c => c !== course) : [...cf, course])}
                        style={{ fontFamily: 'var(--font-body)', fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '0.5px solid var(--border)', background: on ? 'var(--accent-dim)' : 'transparent', color: on ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', textTransform: 'capitalize' }}>
                        {course}
                      </button>
                    )
                  })}
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>None selected = receives all courses</span>
              </div>
            </div>
          </div>

          {/* Test */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => testPrinter(p)} disabled={testing[p.id]}
              style={{ fontFamily: 'var(--font-body)', fontSize: 12, padding: '6px 14px', background: 'var(--bg-input)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              {testing[p.id] ? '…' : '🖨 Test this printer'}
            </button>
            {testResults[p.id] && (
              <span style={{ fontSize: 12, color: testResults[p.id].success ? '#27ae60' : '#c0392b' }}>
                {testResults[p.id].success ? '✓ ' : '✕ '}{testResults[p.id].message}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
