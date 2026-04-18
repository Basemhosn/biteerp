-- ============================================================
-- BiteERP Contacts App — Full partner management
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Contacts (unified customers + suppliers) ─────────────────
-- customers table already exists from sprint 2
-- suppliers come from purchase_orders.supplier_name currently
-- We create a unified contacts table and link everything

create table if not exists public.contacts (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  type            text not null default 'customer',  -- customer | supplier | both
  name            text not null,
  company         text,
  phone           text,
  email           text,
  address         text,
  city            text,
  country         text default 'UAE',
  trn             text,          -- Tax Registration Number (for B2B)
  website         text,
  birthday        date,
  gender          text,
  notes           text,
  tags            text[] default '{}',
  -- Financials
  credit_limit    numeric default 0,
  payment_terms   int default 0,       -- days (e.g. 30 = net 30)
  currency        text default 'AED',
  opening_balance numeric default 0,
  -- Loyalty (customers)
  loyalty_points  int default 0,
  lifetime_spend  numeric default 0,
  visit_count     int default 0,
  last_visit_at   timestamptz,
  tier            text default 'bronze',
  -- Status
  active          boolean default true,
  source          text default 'manual', -- manual | pos | import
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Contact links to transactions ────────────────────────────
-- Link orders to contacts
alter table public.orders
  add column if not exists contact_id uuid references public.contacts(id);

-- Link purchase_orders to contacts
alter table public.purchase_orders
  add column if not exists contact_id uuid references public.contacts(id);

-- ── Partner ledger ────────────────────────────────────────────
-- Auto-built view showing all transactions per contact
create table if not exists public.partner_ledger (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  date            date not null,
  type            text not null,  -- invoice | bill | payment | refund | credit_note | opening_balance
  reference       text,           -- invoice number, PO number, etc.
  description     text,
  debit           numeric default 0,   -- amount owed TO us (customer invoice)
  credit          numeric default 0,   -- amount we owe (supplier bill / customer payment)
  balance         numeric default 0,   -- running balance
  source_type     text,               -- pos_order | purchase_order | manual
  source_id       uuid,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now()
);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.contacts        enable row level security;
alter table public.partner_ledger  enable row level security;

create policy "members read contacts"    on public.contacts for select using (restaurant_id = public.my_restaurant_id());
create policy "all staff write contacts" on public.contacts for all    using (restaurant_id = public.my_restaurant_id());

create policy "members read partner_ledger"    on public.partner_ledger for select using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write partner_ledger" on public.partner_ledger for all   using (restaurant_id = public.my_restaurant_id());

create trigger trg_contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- Indexes
create index if not exists idx_contacts_type    on public.contacts(restaurant_id, type);
create index if not exists idx_contacts_phone   on public.contacts(restaurant_id, phone);
create index if not exists idx_partner_ledger   on public.partner_ledger(contact_id, date desc);

-- ── Invoices & Bills ──────────────────────────────────────────
create table if not exists public.invoices (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  type            text not null default 'invoice',  -- invoice | bill
  number          text not null,
  contact_id      uuid references public.contacts(id),
  partner_name    text,
  invoice_date    date,
  due_date        date,
  subtotal        numeric default 0,
  vat_amount      numeric default 0,
  total           numeric default 0,
  status          text default 'draft',  -- draft | posted | paid | cancelled
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists public.invoice_lines (
  id              uuid primary key default uuid_generate_v4(),
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  product_name    text,
  account_ref     text,
  quantity        numeric default 1,
  unit_price      numeric default 0,
  subtotal        numeric default 0,
  uom             text default 'Units',
  notes           text
);

alter table public.invoices       enable row level security;
alter table public.invoice_lines  enable row level security;

create policy "members read invoices"    on public.invoices for select using (restaurant_id = public.my_restaurant_id());
create policy "all staff write invoices" on public.invoices for all    using (restaurant_id = public.my_restaurant_id());
create policy "members read invoice_lines"    on public.invoice_lines for select using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
create policy "all staff write invoice_lines" on public.invoice_lines for all    using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));

create index if not exists idx_invoices_type      on public.invoices(restaurant_id, type);
create index if not exists idx_invoices_contact   on public.invoices(contact_id);
create index if not exists idx_invoices_status    on public.invoices(restaurant_id, status);
