-- ============================================================
-- BiteERP — FIX ALL RLS ISSUES
-- Paste this ENTIRE block into Supabase SQL Editor and Run
-- ============================================================

-- Create missing tables
create table if not exists public.contacts (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null default 'customer', name text not null,
  company text, phone text, email text, address text, city text,
  country text default 'UAE', trn text, notes text, tags text[] default '{}',
  credit_limit numeric default 0, payment_terms int default 0,
  currency text default 'AED', opening_balance numeric default 0,
  loyalty_points int default 0, lifetime_spend numeric default 0,
  visit_count int default 0, last_visit_at timestamptz,
  tier text default 'bronze', active boolean default true,
  source text default 'manual', created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.partner_ledger (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  date date not null, type text not null, reference text, description text,
  debit numeric default 0, credit numeric default 0, balance numeric default 0,
  source_type text, source_id uuid, created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.invoices (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null default 'invoice', number text not null,
  contact_id uuid references public.contacts(id), partner_name text,
  invoice_date date, due_date date, subtotal numeric default 0,
  vat_amount numeric default 0, total numeric default 0,
  status text default 'draft', notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.invoice_lines (
  id uuid primary key default uuid_generate_v4(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  product_name text, account_ref text, quantity numeric default 1,
  unit_price numeric default 0, subtotal numeric default 0,
  uom text default 'Units', notes text
);

create table if not exists public.branches (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null, code text, address text, city text, phone text,
  manager_name text, is_main boolean default false, active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.company_groups (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id),
  name text not null, created_at timestamptz default now()
);

create table if not exists public.staff (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  full_name text not null, position text, department text default 'Restaurant',
  nationality text, phone text, email text, passport_number text,
  visa_expiry date, contract_start date, contract_end date,
  basic_salary numeric, housing_allowance numeric default 0,
  transport_allowance numeric default 0, food_allowance numeric default 0,
  other_allowance numeric default 0, bank_name text, bank_account text,
  iban text, notes text, active boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.contacts       enable row level security;
alter table public.partner_ledger enable row level security;
alter table public.invoices       enable row level security;
alter table public.invoice_lines  enable row level security;
alter table public.branches       enable row level security;
alter table public.company_groups enable row level security;
alter table public.staff          enable row level security;

-- Drop ALL existing policies on these tables (nuclear approach)
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename
    from pg_policies
    where tablename in ('contacts','partner_ledger','invoices','invoice_lines',
                        'branches','company_groups','staff','pos_permissions')
      and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- CONTACTS — full CRUD with proper WITH CHECK
create policy "c_sel" on public.contacts for select using (restaurant_id = public.my_restaurant_id());
create policy "c_ins" on public.contacts for insert with check (restaurant_id = public.my_restaurant_id());
create policy "c_upd" on public.contacts for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "c_del" on public.contacts for delete using (restaurant_id = public.my_restaurant_id());

-- PARTNER LEDGER
create policy "pl_sel" on public.partner_ledger for select using (restaurant_id = public.my_restaurant_id());
create policy "pl_ins" on public.partner_ledger for insert with check (restaurant_id = public.my_restaurant_id());
create policy "pl_upd" on public.partner_ledger for update using (restaurant_id = public.my_restaurant_id());
create policy "pl_del" on public.partner_ledger for delete using (restaurant_id = public.my_restaurant_id());

-- INVOICES
create policy "inv_sel" on public.invoices for select using (restaurant_id = public.my_restaurant_id());
create policy "inv_ins" on public.invoices for insert with check (restaurant_id = public.my_restaurant_id());
create policy "inv_upd" on public.invoices for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "inv_del" on public.invoices for delete using (restaurant_id = public.my_restaurant_id());

-- INVOICE LINES
create policy "il_sel" on public.invoice_lines for select using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
create policy "il_ins" on public.invoice_lines for insert with check (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
create policy "il_upd" on public.invoice_lines for update using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
create policy "il_del" on public.invoice_lines for delete using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));

-- BRANCHES
create policy "br_sel" on public.branches for select using (restaurant_id = public.my_restaurant_id());
create policy "br_ins" on public.branches for insert with check (restaurant_id = public.my_restaurant_id());
create policy "br_upd" on public.branches for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "br_del" on public.branches for delete using (restaurant_id = public.my_restaurant_id());

-- COMPANY GROUPS
create policy "cg_sel" on public.company_groups for select using (owner_id = auth.uid());
create policy "cg_ins" on public.company_groups for insert with check (owner_id = auth.uid());
create policy "cg_upd" on public.company_groups for update using (owner_id = auth.uid());
create policy "cg_del" on public.company_groups for delete using (owner_id = auth.uid());

-- STAFF
create policy "st_sel" on public.staff for select using (restaurant_id = public.my_restaurant_id());
create policy "st_ins" on public.staff for insert with check (restaurant_id = public.my_restaurant_id());
create policy "st_upd" on public.staff for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "st_del" on public.staff for delete using (restaurant_id = public.my_restaurant_id());

-- POS PERMISSIONS — fix the for all using() issue
create policy "pp_sel" on public.pos_permissions for select using (restaurant_id = public.my_restaurant_id());
create policy "pp_ins" on public.pos_permissions for insert with check (restaurant_id = public.my_restaurant_id());
create policy "pp_upd" on public.pos_permissions for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "pp_del" on public.pos_permissions for delete using (restaurant_id = public.my_restaurant_id());

-- Extra columns
alter table public.profiles add column if not exists lang_preference text default 'en';
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists is_online boolean default false;
alter table public.profiles add column if not exists allowed_modules text[] default '{}';
alter table public.profiles add column if not exists avatar_color text default '#0D7377';
alter table public.journal_entries add column if not exists reconciled boolean default false;
alter table public.journal_entries add column if not exists reconciled_ref text;
alter table public.restaurants add column if not exists company_group_id uuid;
alter table public.restaurants add column if not exists is_headquarters boolean default false;

select 'ALL DONE — RLS policies fixed successfully' as status;
