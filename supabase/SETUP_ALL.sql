-- ============================================================
-- BiteERP — COMPLETE SETUP (run this if you're missing tables)
-- Safe to run multiple times — uses IF NOT EXISTS everywhere
-- ============================================================

-- ── Contacts table ────────────────────────────────────────────
create table if not exists public.contacts (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  type            text not null default 'customer',
  name            text not null,
  company         text,
  phone           text,
  email           text,
  address         text,
  city            text,
  country         text default 'UAE',
  trn             text,
  website         text,
  birthday        date,
  gender          text,
  notes           text,
  tags            text[] default '{}',
  credit_limit    numeric default 0,
  payment_terms   int default 0,
  currency        text default 'AED',
  opening_balance numeric default 0,
  loyalty_points  int default 0,
  lifetime_spend  numeric default 0,
  visit_count     int default 0,
  last_visit_at   timestamptz,
  tier            text default 'bronze',
  active          boolean default true,
  source          text default 'manual',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Partner ledger ────────────────────────────────────────────
create table if not exists public.partner_ledger (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  contact_id      uuid not null references public.contacts(id) on delete cascade,
  date            date not null,
  type            text not null,
  reference       text,
  description     text,
  debit           numeric default 0,
  credit          numeric default 0,
  balance         numeric default 0,
  source_type     text,
  source_id       uuid,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now()
);

-- ── Invoices ──────────────────────────────────────────────────
create table if not exists public.invoices (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  type            text not null default 'invoice',
  number          text not null,
  contact_id      uuid references public.contacts(id),
  partner_name    text,
  invoice_date    date,
  due_date        date,
  subtotal        numeric default 0,
  vat_amount      numeric default 0,
  total           numeric default 0,
  status          text default 'draft',
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

-- ── Staff ─────────────────────────────────────────────────────
create table if not exists public.staff (
  id                  uuid primary key default uuid_generate_v4(),
  restaurant_id       uuid not null references public.restaurants(id) on delete cascade,
  full_name           text not null,
  position            text,
  department          text default 'Restaurant',
  nationality         text,
  phone               text,
  email               text,
  passport_number     text,
  visa_expiry         date,
  contract_start      date,
  contract_end        date,
  basic_salary        numeric,
  housing_allowance   numeric default 0,
  transport_allowance numeric default 0,
  food_allowance      numeric default 0,
  other_allowance     numeric default 0,
  bank_name           text,
  bank_account        text,
  iban                text,
  notes               text,
  active              boolean default true,
  created_at          timestamptz default now()
);

-- ── Branches ─────────────────────────────────────────────────
create table if not exists public.branches (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  name            text not null,
  code            text,
  address         text,
  city            text,
  phone           text,
  manager_name    text,
  is_main         boolean default false,
  active          boolean default true,
  created_at      timestamptz default now()
);

-- ── Company groups ────────────────────────────────────────────
create table if not exists public.company_groups (
  id         uuid primary key default uuid_generate_v4(),
  owner_id   uuid not null references auth.users(id),
  name       text not null,
  created_at timestamptz default now()
);

-- ── Branch transfers ──────────────────────────────────────────
create table if not exists public.branch_transfers (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  transfer_number text not null,
  from_branch_id  uuid not null references public.branches(id),
  to_branch_id    uuid not null references public.branches(id),
  status          text not null default 'draft',
  notes           text,
  requested_by    uuid references auth.users(id),
  sent_at         timestamptz,
  received_at     timestamptz,
  created_at      timestamptz default now()
);

create table if not exists public.branch_transfer_lines (
  id                uuid primary key default uuid_generate_v4(),
  transfer_id       uuid not null references public.branch_transfers(id) on delete cascade,
  ingredient_id     uuid,
  ingredient_name   text not null,
  quantity_sent     numeric not null default 0,
  quantity_received numeric,
  unit              text,
  cost_per_unit     numeric default 0
);

-- ── Journal entries extra columns ─────────────────────────────
alter table public.journal_entries
  add column if not exists reconciled     boolean default false,
  add column if not exists reconciled_ref text;

-- ── Profile extra columns ─────────────────────────────────────
alter table public.profiles
  add column if not exists lang_preference text default 'en',
  add column if not exists email           text,
  add column if not exists phone           text,
  add column if not exists job_title       text,
  add column if not exists last_seen_at    timestamptz,
  add column if not exists is_online       boolean default false,
  add column if not exists allowed_modules text[] default '{}',
  add column if not exists avatar_color    text default '#0D7377';

-- ── Restaurants extra columns ─────────────────────────────────
alter table public.restaurants
  add column if not exists company_group_id uuid,
  add column if not exists is_headquarters  boolean default false;

-- ── Enable RLS on new tables ──────────────────────────────────
alter table public.contacts           enable row level security;
alter table public.partner_ledger     enable row level security;
alter table public.invoices           enable row level security;
alter table public.invoice_lines      enable row level security;
alter table public.staff              enable row level security;
alter table public.branches           enable row level security;
alter table public.company_groups     enable row level security;
alter table public.branch_transfers   enable row level security;
alter table public.branch_transfer_lines enable row level security;

-- ── Drop old broken policies ──────────────────────────────────
drop policy if exists "members read contacts"         on public.contacts;
drop policy if exists "all staff write contacts"      on public.contacts;
drop policy if exists "all staff update contacts"     on public.contacts;
drop policy if exists "all staff delete contacts"     on public.contacts;
drop policy if exists "members read partner_ledger"   on public.partner_ledger;
drop policy if exists "managers+ write partner_ledger" on public.partner_ledger;
drop policy if exists "all staff write partner_ledger" on public.partner_ledger;
drop policy if exists "all staff update partner_ledger" on public.partner_ledger;
drop policy if exists "members read invoices"         on public.invoices;
drop policy if exists "all staff write invoices"      on public.invoices;
drop policy if exists "all staff insert invoices"     on public.invoices;
drop policy if exists "all staff update invoices"     on public.invoices;
drop policy if exists "all staff delete invoices"     on public.invoices;
drop policy if exists "members read invoice_lines"    on public.invoice_lines;
drop policy if exists "all staff write invoice_lines" on public.invoice_lines;
drop policy if exists "all staff insert invoice_lines" on public.invoice_lines;
drop policy if exists "all staff update invoice_lines" on public.invoice_lines;
drop policy if exists "all staff delete invoice_lines" on public.invoice_lines;
drop policy if exists "members read staff"            on public.staff;
drop policy if exists "managers write staff"          on public.staff;
drop policy if exists "managers insert staff"         on public.staff;
drop policy if exists "managers update staff"         on public.staff;
drop policy if exists "managers delete staff"         on public.staff;
drop policy if exists "members read branches"         on public.branches;
drop policy if exists "managers write branches"       on public.branches;
drop policy if exists "managers insert branches"      on public.branches;
drop policy if exists "managers update branches"      on public.branches;
drop policy if exists "managers delete branches"      on public.branches;
drop policy if exists "owner read company_groups"     on public.company_groups;
drop policy if exists "owner write company_groups"    on public.company_groups;
drop policy if exists "members read branch_transfers" on public.branch_transfers;
drop policy if exists "members write branch_transfers" on public.branch_transfers;
drop policy if exists "members read transfer_lines"   on public.branch_transfer_lines;
drop policy if exists "members write transfer_lines"  on public.branch_transfer_lines;

-- ── Create correct RLS policies ───────────────────────────────

-- Contacts
create policy "contacts_select" on public.contacts for select using (restaurant_id = public.my_restaurant_id());
create policy "contacts_insert" on public.contacts for insert with check (restaurant_id = public.my_restaurant_id());
create policy "contacts_update" on public.contacts for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "contacts_delete" on public.contacts for delete using (restaurant_id = public.my_restaurant_id());

-- Partner ledger
create policy "ledger_select" on public.partner_ledger for select using (restaurant_id = public.my_restaurant_id());
create policy "ledger_insert" on public.partner_ledger for insert with check (restaurant_id = public.my_restaurant_id());
create policy "ledger_update" on public.partner_ledger for update using (restaurant_id = public.my_restaurant_id());
create policy "ledger_delete" on public.partner_ledger for delete using (restaurant_id = public.my_restaurant_id());

-- Invoices
create policy "invoices_select" on public.invoices for select using (restaurant_id = public.my_restaurant_id());
create policy "invoices_insert" on public.invoices for insert with check (restaurant_id = public.my_restaurant_id());
create policy "invoices_update" on public.invoices for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "invoices_delete" on public.invoices for delete using (restaurant_id = public.my_restaurant_id());

-- Invoice lines
create policy "inv_lines_select" on public.invoice_lines for select using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
create policy "inv_lines_insert" on public.invoice_lines for insert with check (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
create policy "inv_lines_update" on public.invoice_lines for update using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
create policy "inv_lines_delete" on public.invoice_lines for delete using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));

-- Staff
create policy "staff_select" on public.staff for select using (restaurant_id = public.my_restaurant_id());
create policy "staff_insert" on public.staff for insert with check (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));
create policy "staff_update" on public.staff for update using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));
create policy "staff_delete" on public.staff for delete using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));

-- Branches
create policy "branches_select" on public.branches for select using (restaurant_id = public.my_restaurant_id());
create policy "branches_insert" on public.branches for insert with check (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));
create policy "branches_update" on public.branches for update using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));
create policy "branches_delete" on public.branches for delete using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));

-- Company groups
create policy "groups_select" on public.company_groups for select using (owner_id = auth.uid());
create policy "groups_insert" on public.company_groups for insert with check (owner_id = auth.uid());
create policy "groups_update" on public.company_groups for update using (owner_id = auth.uid());
create policy "groups_delete" on public.company_groups for delete using (owner_id = auth.uid());

-- Branch transfers
create policy "transfers_select" on public.branch_transfers for select using (restaurant_id = public.my_restaurant_id());
create policy "transfers_insert" on public.branch_transfers for insert with check (restaurant_id = public.my_restaurant_id());
create policy "transfers_update" on public.branch_transfers for update using (restaurant_id = public.my_restaurant_id());
create policy "transfers_delete" on public.branch_transfers for delete using (restaurant_id = public.my_restaurant_id());

-- Branch transfer lines
create policy "tlines_select" on public.branch_transfer_lines for select using (transfer_id in (select id from public.branch_transfers where restaurant_id = public.my_restaurant_id()));
create policy "tlines_insert" on public.branch_transfer_lines for insert with check (transfer_id in (select id from public.branch_transfers where restaurant_id = public.my_restaurant_id()));
create policy "tlines_update" on public.branch_transfer_lines for update using (transfer_id in (select id from public.branch_transfers where restaurant_id = public.my_restaurant_id()));
create policy "tlines_delete" on public.branch_transfer_lines for delete using (transfer_id in (select id from public.branch_transfers where restaurant_id = public.my_restaurant_id()));

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists idx_contacts_restaurant  on public.contacts(restaurant_id);
create index if not exists idx_invoices_restaurant  on public.invoices(restaurant_id, type);
create index if not exists idx_staff_restaurant     on public.staff(restaurant_id);
create index if not exists idx_branches_restaurant  on public.branches(restaurant_id);
