import styles from './AppHome.module.css'
import { APP_ICONS } from './AppIcons.jsx'

const APPS = [
  {
    group: 'Point of Sale',
    items: [
      { key: 'pos_terminal',    label: 'Terminal',        desc: 'Sell & take orders',        bg: '#eafaf1' },
      { key: 'pos_menu',        label: 'Menu Builder',    desc: 'Items, prices & modifiers', bg: '#fef5e7' },
      { key: 'pos_tables',      label: 'Tables',          desc: 'Floor plan & sections',     bg: '#f5eef8' },
      { key: 'pos_scheduling',  label: 'Scheduling',      desc: 'Shift & staff rota',        bg: '#eaf4fb' },
    ]
  },
  {
    group: 'Purchasing',
    items: [
      { key: 'pur_orders',      label: 'Quotations',      desc: 'Create & receive POs',      bg: '#eafaf1' },
      { key: 'suppliers',       label: 'Suppliers',       desc: 'Supplier directory',        bg: '#e8f8f5' },
    ]
  },
  {
    group: 'Sales',
    items: [
      { key: 'sales_orders',    label: 'Sales Orders',    desc: 'B2B orders & invoicing',    bg: '#fef5e7' },
      { key: 'sales_customers', label: 'Customers',       desc: 'CRM & customer profiles',   bg: '#eafaf1' },
      { key: 'sales_loyalty',   label: 'Loyalty',         desc: 'Points, tiers & rewards',   bg: '#fef9e7' },
      { key: 'sales_promotions',label: 'Promotions',      desc: 'Discounts & promo codes',   bg: '#f5eef8' },
      { key: 'sales_delivery',  label: 'Delivery Orders', desc: 'Talabat, Deliveroo & more', bg: '#eaf4fb' },
      { key: 'sales_eod',       label: 'End of Day',      desc: 'Cash up & shift close',     bg: '#e8f5f5' },
    ]
  },
  {
    group: 'Inventory',
    items: [
      { key: 'inv_stock',       label: 'Stock Levels',    desc: 'Live stock & alerts',       bg: '#fef0e7' },
      { key: 'inv_movements',   label: 'Movements',       desc: 'Every stock change',        bg: '#fef0e7' },
      { key: 'inv_valuation',   label: 'Valuation',       desc: 'AVCO stock value',          bg: '#fef0e7' },
      { key: 'inv_wastage',     label: 'Wastage',         desc: 'Log & track wastage',       bg: '#fdedec' },
    ]
  },
  {
    group: 'Manufacturing',
    items: [
      { key: 'prod_ingredients',label: 'Ingredients',     desc: 'Raw material database',     bg: '#fdecea' },
      { key: 'prod_subrecipes', label: 'Sub-recipes',     desc: 'Components & sauces',       bg: '#fdecea' },
      { key: 'prod_recipes',    label: 'Recipes',         desc: 'Full dish recipes',         bg: '#fdecea' },
      { key: 'prod_links',      label: 'Menu Links',      desc: 'Link recipes to menu',      bg: '#fdecea' },
      { key: 'prod_log',        label: 'Manufacturing Log', desc: 'Batch production',         bg: '#e8f8f5' },
    ]
  },
  {
    group: 'Accounting',
    items: [
      { key: 'acc_pl',          label: 'P&L',             desc: 'Live profit & loss',        bg: '#e8f5f5' },
      { key: 'acc_balance',     label: 'Balance Sheet',   desc: 'Assets & liabilities',      bg: '#eaf4fb' },
      { key: 'acc_coa',         label: 'Chart of Accounts',desc: 'UAE accounts setup',       bg: '#fef5e7' },
      { key: 'acc_vat',         label: 'VAT',             desc: 'UAE VAT filing',            bg: '#fdedec' },
      { key: 'acc_forecast',    label: 'Forecast',        desc: 'P&L projections',           bg: '#e8f5f5' },
      { key: 'acc_calculator',  label: 'Calculator',      desc: 'Revenue inputs',            bg: '#e8f5f5' },
      { key: 'acc_payroll',     label: 'Payroll',         desc: 'Staff cost summary',        bg: '#eaf4fb' },
      { key: 'acc_export',      label: 'Export',          desc: 'PDF & reports',             bg: '#eaf4fb' },
    ]
  },
  {
    group: 'Administration',
    items: [
      { key: 'settings',        label: 'Settings',        desc: 'Users, roles & access',     bg: '#f0f2f4' },
    ]
  },
]

export default function AppHome({ onNavigate, session }) {
  return (
    <div className={styles.wrap}>
      <div className={styles.greeting}>
        <h1 className={styles.greetTitle}>
          {getGreeting()}, {session?.fullName?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className={styles.greetSub}>
          {session?.restaurant?.name ?? 'BiteERP'} &nbsp;·&nbsp;
          {new Date().toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {APPS.map(group => (
        <div key={group.group} className={styles.group}>
          <div className={styles.groupLabel}>{group.group}</div>
          <div className={styles.appGrid}>
            {group.items.map(app => {
              const IconComponent = APP_ICONS[app.key]
              return (
                <button key={app.key} className={styles.appCard} onClick={() => onNavigate(app.key)}>
                  <div className={styles.appIcon} style={{ background: app.bg }}>
                    {IconComponent ? <IconComponent /> : <span style={{ fontSize: 24 }}>▦</span>}
                  </div>
                  <span className={styles.appLabel}>{app.label}</span>
                  <span className={styles.appDesc}>{app.desc}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
