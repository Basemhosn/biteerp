-- ============================================================
-- BiteERP — ADD MISSING TABLES + FIX RLS
-- Run this ONE file in Supabase SQL Editor
-- Safe to run even if some tables already exist
-- ============================================================

-- ── 1. CONTACTS ───────────────────────────────────────────────
create table if not exists public.contacts (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null default 'customer',
  name text not null,
  company text, phone text, email text, address text, city text,
  country text default 'UAE', trn text, notes text,
  tags text[] default '{}',
  credit_limit numeric default 0,
  payment_terms int default 0,
  currency text default 'AED',
  opening_balance numeric default 0,
  loyalty_points int default 0,
  lifetime_spend numeric default 0,
  visit_count int default 0,
  last_visit_at timestamptz,
  tier text default 'bronze',
  active boolean default true,
  source text default 'manual',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.contacts enable row level security;

-- ── 2. PARTNER LEDGER ─────────────────────────────────────────
create table if not exists public.partner_ledger (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  date date not null,
  type text not null,
  reference text, description text,
  debit numeric default 0, credit numeric default 0, balance numeric default 0,
  source_type text, source_id uuid,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table public.partner_ledger enable row level security;

-- ── 3. INVOICES + LINES ───────────────────────────────────────
create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null default 'invoice',
  number text not null,
  contact_id uuid references public.contacts(id),
  partner_name text,
  invoice_date date, due_date date,
  subtotal numeric default 0, vat_amount numeric default 0, total numeric default 0,
  status text default 'draft', notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.invoices enable row level security;

create table if not exists public.invoice_lines (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_name text, account_ref text,
  quantity numeric default 1, unit_price numeric default 0,
  subtotal numeric default 0, uom text default 'Units', notes text
);
alter table public.invoice_lines enable row level security;

-- ── 4. BRANCHES ───────────────────────────────────────────────
create table if not exists public.branches (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null, code text, address text, city text, phone text,
  manager_name text, is_main boolean default false, active boolean default true,
  created_at timestamptz default now()
);
alter table public.branches enable row level security;

-- ── 5. COMPANY GROUPS ─────────────────────────────────────────
create table if not exists public.company_groups (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id),
  name text not null,
  created_at timestamptz default now()
);
alter table public.company_groups enable row level security;

-- ── 6. BRANCH TRANSFERS ───────────────────────────────────────
create table if not exists public.branch_transfers (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  transfer_number text not null,
  from_branch_id uuid not null references public.branches(id),
  to_branch_id uuid not null references public.branches(id),
  status text not null default 'draft',
  notes text,
  requested_by uuid references auth.users(id),
  sent_at timestamptz, received_at timestamptz,
  created_at timestamptz default now()
);
alter table public.branch_transfers enable row level security;

create table if not exists public.branch_transfer_lines (
  id uuid primary key default uuid_generate_v4(),
  transfer_id uuid not null references public.branch_transfers(id) on delete cascade,
  ingredient_id uuid, ingredient_name text not null,
  quantity_sent numeric not null default 0,
  quantity_received numeric, unit text, cost_per_unit numeric default 0
);
alter table public.branch_transfer_lines enable row level security;

-- ── 7. STAFF ──────────────────────────────────────────────────
create table if not exists public.staff (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  full_name text not null, position text,
  department text default 'Restaurant',
  nationality text, phone text, email text,
  passport_number text, visa_expiry date,
  contract_start date, contract_end date,
  basic_salary numeric, housing_allowance numeric default 0,
  transport_allowance numeric default 0, food_allowance numeric default 0,
  other_allowance numeric default 0,
  bank_name text, bank_account text, iban text,
  notes text, active boolean default true,
  created_at timestamptz default now()
);
alter table public.staff enable row level security;

-- ── 8. CHATTER ────────────────────────────────────────────────
create table if not exists public.chatter_messages (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  record_type text, record_id uuid,
  author_id uuid not null references auth.users(id),
  author_name text not null, author_color text default '#0D7377',
  message_type text not null default 'comment',
  content text not null,
  mentions uuid[] default '{}',
  edited boolean default false, edited_at timestamptz,
  parent_id uuid references public.chatter_messages(id),
  created_at timestamptz default now()
);
alter table public.chatter_messages enable row level security;

create table if not exists public.chatter_reads (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  last_read_at timestamptz default now(),
  primary key (profile_id, restaurant_id)
);
alter table public.chatter_reads enable row level security;

-- ── 9. PROFILE & RESTAURANT EXTRA COLUMNS ────────────────────
alter table public.profiles add column if not exists lang_preference text default 'en';
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists is_online boolean default false;
alter table public.profiles add column if not exists allowed_modules text[] default '{}';
alter table public.profiles add column if not exists avatar_color text default '#0D7377';
alter table public.restaurants add column if not exists company_group_id uuid;
alter table public.restaurants add column if not exists is_headquarters boolean default false;
alter table public.journal_entries add column if not exists reconciled boolean default false;
alter table public.journal_entries add column if not exists reconciled_ref text;

-- ── 10. USER PERMISSIONS ─────────────────────────────────────
create table if not exists public.user_permissions (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  module text not null,
  can_read boolean default true,
  can_write boolean default false,
  can_delete boolean default false,
  unique (profile_id, restaurant_id, module)
);
alter table public.user_permissions enable row level security;

-- ── 11. DROP ALL EXISTING POLICIES (clean slate) ─────────────
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
    and tablename in (
      'contacts','partner_ledger','invoices','invoice_lines',
      'branches','company_groups','branch_transfers','branch_transfer_lines',
      'staff','chatter_messages','chatter_reads','user_permissions','pos_permissions'
    )
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- ── 12. CREATE CORRECT RLS POLICIES ──────────────────────────
-- Each table has 4 policies: select/insert/update/delete
-- INSERT always uses WITH CHECK (not using) — this was the bug

-- contacts
create policy "c_s" on public.contacts for select using (restaurant_id = public.my_restaurant_id());
create policy "c_i" on public.contacts for insert with check (restaurant_id = public.my_restaurant_id());
create policy "c_u" on public.contacts for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "c_d" on public.contacts for delete using (restaurant_id = public.my_restaurant_id());

-- partner_ledger
create policy "pl_s" on public.partner_ledger for select using (restaurant_id = public.my_restaurant_id());
create policy "pl_i" on public.partner_ledger for insert with check (restaurant_id = public.my_restaurant_id());
create policy "pl_u" on public.partner_ledger for update using (restaurant_id = public.my_restaurant_id());
create policy "pl_d" on public.partner_ledger for delete using (restaurant_id = public.my_restaurant_id());

-- invoices
create policy "inv_s" on public.invoices for select using (restaurant_id = public.my_restaurant_id());
create policy "inv_i" on public.invoices for insert with check (restaurant_id = public.my_restaurant_id());
create policy "inv_u" on public.invoices for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "inv_d" on public.invoices for delete using (restaurant_id = public.my_restaurant_id());

-- invoice_lines
create policy "il_s" on public.invoice_lines for select using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
create policy "il_i" on public.invoice_lines for insert with check (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
create policy "il_u" on public.invoice_lines for update using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
create policy "il_d" on public.invoice_lines for delete using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));

-- branches
create policy "br_s" on public.branches for select using (restaurant_id = public.my_restaurant_id());
create policy "br_i" on public.branches for insert with check (restaurant_id = public.my_restaurant_id());
create policy "br_u" on public.branches for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "br_d" on public.branches for delete using (restaurant_id = public.my_restaurant_id());

-- company_groups
create policy "cg_s" on public.company_groups for select using (owner_id = auth.uid());
create policy "cg_i" on public.company_groups for insert with check (owner_id = auth.uid());
create policy "cg_u" on public.company_groups for update using (owner_id = auth.uid());
create policy "cg_d" on public.company_groups for delete using (owner_id = auth.uid());

-- branch_transfers
create policy "bt_s" on public.branch_transfers for select using (restaurant_id = public.my_restaurant_id());
create policy "bt_i" on public.branch_transfers for insert with check (restaurant_id = public.my_restaurant_id());
create policy "bt_u" on public.branch_transfers for update using (restaurant_id = public.my_restaurant_id());
create policy "bt_d" on public.branch_transfers for delete using (restaurant_id = public.my_restaurant_id());

-- branch_transfer_lines
create policy "btl_s" on public.branch_transfer_lines for select using (transfer_id in (select id from public.branch_transfers where restaurant_id = public.my_restaurant_id()));
create policy "btl_i" on public.branch_transfer_lines for insert with check (transfer_id in (select id from public.branch_transfers where restaurant_id = public.my_restaurant_id()));
create policy "btl_u" on public.branch_transfer_lines for update using (transfer_id in (select id from public.branch_transfers where restaurant_id = public.my_restaurant_id()));
create policy "btl_d" on public.branch_transfer_lines for delete using (transfer_id in (select id from public.branch_transfers where restaurant_id = public.my_restaurant_id()));

-- staff
create policy "st_s" on public.staff for select using (restaurant_id = public.my_restaurant_id());
create policy "st_i" on public.staff for insert with check (restaurant_id = public.my_restaurant_id());
create policy "st_u" on public.staff for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "st_d" on public.staff for delete using (restaurant_id = public.my_restaurant_id());

-- chatter_messages
create policy "cm_s" on public.chatter_messages for select using (restaurant_id = public.my_restaurant_id());
create policy "cm_i" on public.chatter_messages for insert with check (restaurant_id = public.my_restaurant_id());
create policy "cm_u" on public.chatter_messages for update using (author_id = auth.uid());
create policy "cm_d" on public.chatter_messages for delete using (author_id = auth.uid());

-- chatter_reads
create policy "cr_s" on public.chatter_reads for select using (profile_id = auth.uid());
create policy "cr_i" on public.chatter_reads for insert with check (profile_id = auth.uid());
create policy "cr_u" on public.chatter_reads for update using (profile_id = auth.uid());

-- user_permissions
create policy "up_s" on public.user_permissions for select using (restaurant_id = public.my_restaurant_id());
create policy "up_i" on public.user_permissions for insert with check (restaurant_id = public.my_restaurant_id());
create policy "up_u" on public.user_permissions for update using (restaurant_id = public.my_restaurant_id());
create policy "up_d" on public.user_permissions for delete using (restaurant_id = public.my_restaurant_id());

-- pos_permissions — fix existing table
create policy "pp_s" on public.pos_permissions for select using (restaurant_id = public.my_restaurant_id());
create policy "pp_i" on public.pos_permissions for insert with check (restaurant_id = public.my_restaurant_id());
create policy "pp_u" on public.pos_permissions for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "pp_d" on public.pos_permissions for delete using (restaurant_id = public.my_restaurant_id());

-- ── 13. INDEXES ───────────────────────────────────────────────
create index if not exists idx_contacts_rid    on public.contacts(restaurant_id);
create index if not exists idx_invoices_rid    on public.invoices(restaurant_id, type);
create index if not exists idx_branches_rid    on public.branches(restaurant_id);
create index if not exists idx_staff_rid       on public.staff(restaurant_id);
create index if not exists idx_chatter_rid     on public.chatter_messages(restaurant_id, record_type, record_id);

select 'SUCCESS — all tables created and RLS policies fixed' as status;
