-- ============================================================
-- BiteERP — COMPLETE DATABASE SETUP
-- Run this ONE file. Safe to run multiple times.
-- ============================================================

-- ── MISSING TABLES ───────────────────────────────────────────

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
  source text default 'manual',
  created_at timestamptz default now(), updated_at timestamptz default now()
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
  invoice_date date, due_date date,
  subtotal numeric default 0, vat_amount numeric default 0, total numeric default 0,
  status text default 'draft', notes text, created_by uuid references auth.users(id),
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

create table if not exists public.branch_transfers (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  transfer_number text not null,
  from_branch_id uuid not null references public.branches(id),
  to_branch_id uuid not null references public.branches(id),
  status text not null default 'draft', notes text,
  requested_by uuid references auth.users(id),
  sent_at timestamptz, received_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.branch_transfer_lines (
  id uuid primary key default uuid_generate_v4(),
  transfer_id uuid not null references public.branch_transfers(id) on delete cascade,
  ingredient_id uuid, ingredient_name text not null,
  quantity_sent numeric not null default 0, quantity_received numeric,
  unit text, cost_per_unit numeric default 0
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

create table if not exists public.chatter_messages (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  record_type text, record_id uuid,
  author_id uuid not null references auth.users(id),
  author_name text not null, author_color text default '#0D7377',
  message_type text not null default 'comment', content text not null,
  mentions uuid[] default '{}', edited boolean default false,
  edited_at timestamptz, parent_id uuid references public.chatter_messages(id),
  created_at timestamptz default now()
);

create table if not exists public.chatter_reads (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  last_read_at timestamptz default now(),
  primary key (profile_id, restaurant_id)
);

create table if not exists public.user_permissions (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  module text not null, can_read boolean default true,
  can_write boolean default false, can_delete boolean default false,
  unique (profile_id, restaurant_id, module)
);

-- ── EXTRA COLUMNS ─────────────────────────────────────────────
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

-- ── ENABLE RLS ────────────────────────────────────────────────
alter table public.contacts enable row level security;
alter table public.partner_ledger enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.branches enable row level security;
alter table public.company_groups enable row level security;
alter table public.branch_transfers enable row level security;
alter table public.branch_transfer_lines enable row level security;
alter table public.staff enable row level security;
alter table public.chatter_messages enable row level security;
alter table public.chatter_reads enable row level security;
alter table public.user_permissions enable row level security;

-- ── DROP ALL EXISTING POLICIES (complete reset) ───────────────
do $$
declare pol record;
begin
  for pol in
    select policyname, tablename from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- ── RECREATE ALL POLICIES WITH CORRECT WITH CHECK ─────────────
-- restaurants
create policy "r_s" on public.restaurants for select using (id = public.my_restaurant_id());
create policy "r_u" on public.restaurants for update using (id = public.my_restaurant_id() and public.my_role() = 'owner');

-- profiles
create policy "p_s" on public.profiles for select using (restaurant_id = public.my_restaurant_id());
create policy "p_i" on public.profiles for insert with check (id = auth.uid());
create policy "p_u" on public.profiles for update using (id = auth.uid());

-- calculator_state
create policy "cs_s" on public.calculator_state for select using (restaurant_id = public.my_restaurant_id());
create policy "cs_i" on public.calculator_state for insert with check (restaurant_id = public.my_restaurant_id());
create policy "cs_u" on public.calculator_state for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "cs_d" on public.calculator_state for delete using (restaurant_id = public.my_restaurant_id());

-- pl_history
create policy "plh_s" on public.pl_history for select using (restaurant_id = public.my_restaurant_id());
create policy "plh_i" on public.pl_history for insert with check (restaurant_id = public.my_restaurant_id());
create policy "plh_u" on public.pl_history for update using (restaurant_id = public.my_restaurant_id());
create policy "plh_d" on public.pl_history for delete using (restaurant_id = public.my_restaurant_id());

-- daily_sales
create policy "ds_s" on public.daily_sales for select using (restaurant_id = public.my_restaurant_id());
create policy "ds_i" on public.daily_sales for insert with check (restaurant_id = public.my_restaurant_id());
create policy "ds_u" on public.daily_sales for update using (restaurant_id = public.my_restaurant_id());
create policy "ds_d" on public.daily_sales for delete using (restaurant_id = public.my_restaurant_id());

-- expenses
create policy "ex_s" on public.expenses for select using (restaurant_id = public.my_restaurant_id());
create policy "ex_i" on public.expenses for insert with check (restaurant_id = public.my_restaurant_id());
create policy "ex_u" on public.expenses for update using (restaurant_id = public.my_restaurant_id());
create policy "ex_d" on public.expenses for delete using (restaurant_id = public.my_restaurant_id());

-- suppliers
create policy "su_s" on public.suppliers for select using (restaurant_id = public.my_restaurant_id());
create policy "su_i" on public.suppliers for insert with check (restaurant_id = public.my_restaurant_id());
create policy "su_u" on public.suppliers for update using (restaurant_id = public.my_restaurant_id());
create policy "su_d" on public.suppliers for delete using (restaurant_id = public.my_restaurant_id());

-- inventory_log
create policy "il2_s" on public.inventory_log for select using (restaurant_id = public.my_restaurant_id());
create policy "il2_i" on public.inventory_log for insert with check (restaurant_id = public.my_restaurant_id());
create policy "il2_u" on public.inventory_log for update using (restaurant_id = public.my_restaurant_id());
create policy "il2_d" on public.inventory_log for delete using (restaurant_id = public.my_restaurant_id());

-- staff_schedule
create policy "ss_s" on public.staff_schedule for select using (restaurant_id = public.my_restaurant_id());
create policy "ss_i" on public.staff_schedule for insert with check (restaurant_id = public.my_restaurant_id());
create policy "ss_u" on public.staff_schedule for update using (restaurant_id = public.my_restaurant_id());
create policy "ss_d" on public.staff_schedule for delete using (restaurant_id = public.my_restaurant_id());

-- menu_categories
create policy "mc_s" on public.menu_categories for select using (restaurant_id = public.my_restaurant_id());
create policy "mc_i" on public.menu_categories for insert with check (restaurant_id = public.my_restaurant_id());
create policy "mc_u" on public.menu_categories for update using (restaurant_id = public.my_restaurant_id());
create policy "mc_d" on public.menu_categories for delete using (restaurant_id = public.my_restaurant_id());

-- menu_items
create policy "mi_s" on public.menu_items for select using (restaurant_id = public.my_restaurant_id());
create policy "mi_i" on public.menu_items for insert with check (restaurant_id = public.my_restaurant_id());
create policy "mi_u" on public.menu_items for update using (restaurant_id = public.my_restaurant_id());
create policy "mi_d" on public.menu_items for delete using (restaurant_id = public.my_restaurant_id());

-- menu_modifier_groups
create policy "mmg_s" on public.menu_modifier_groups for select using (restaurant_id = public.my_restaurant_id());
create policy "mmg_i" on public.menu_modifier_groups for insert with check (restaurant_id = public.my_restaurant_id());
create policy "mmg_u" on public.menu_modifier_groups for update using (restaurant_id = public.my_restaurant_id());
create policy "mmg_d" on public.menu_modifier_groups for delete using (restaurant_id = public.my_restaurant_id());

-- menu_modifiers
create policy "mm_s" on public.menu_modifiers for select using (group_id in (select id from public.menu_modifier_groups where restaurant_id = public.my_restaurant_id()));
create policy "mm_i" on public.menu_modifiers for insert with check (group_id in (select id from public.menu_modifier_groups where restaurant_id = public.my_restaurant_id()));
create policy "mm_u" on public.menu_modifiers for update using (group_id in (select id from public.menu_modifier_groups where restaurant_id = public.my_restaurant_id()));
create policy "mm_d" on public.menu_modifiers for delete using (group_id in (select id from public.menu_modifier_groups where restaurant_id = public.my_restaurant_id()));

-- restaurant_tables
create policy "rt_s" on public.restaurant_tables for select using (restaurant_id = public.my_restaurant_id());
create policy "rt_i" on public.restaurant_tables for insert with check (restaurant_id = public.my_restaurant_id());
create policy "rt_u" on public.restaurant_tables for update using (restaurant_id = public.my_restaurant_id());
create policy "rt_d" on public.restaurant_tables for delete using (restaurant_id = public.my_restaurant_id());

-- orders
create policy "o_s" on public.orders for select using (restaurant_id = public.my_restaurant_id());
create policy "o_i" on public.orders for insert with check (restaurant_id = public.my_restaurant_id());
create policy "o_u" on public.orders for update using (restaurant_id = public.my_restaurant_id());
create policy "o_d" on public.orders for delete using (restaurant_id = public.my_restaurant_id());

-- order_items
create policy "oi_s" on public.order_items for select using (order_id in (select id from public.orders where restaurant_id = public.my_restaurant_id()));
create policy "oi_i" on public.order_items for insert with check (order_id in (select id from public.orders where restaurant_id = public.my_restaurant_id()));
create policy "oi_u" on public.order_items for update using (order_id in (select id from public.orders where restaurant_id = public.my_restaurant_id()));
create policy "oi_d" on public.order_items for delete using (order_id in (select id from public.orders where restaurant_id = public.my_restaurant_id()));

-- accounts
create policy "ac_s" on public.accounts for select using (restaurant_id = public.my_restaurant_id());
create policy "ac_i" on public.accounts for insert with check (restaurant_id = public.my_restaurant_id());
create policy "ac_u" on public.accounts for update using (restaurant_id = public.my_restaurant_id());
create policy "ac_d" on public.accounts for delete using (restaurant_id = public.my_restaurant_id());

-- accounting_periods
create policy "ap_s" on public.accounting_periods for select using (restaurant_id = public.my_restaurant_id());
create policy "ap_i" on public.accounting_periods for insert with check (restaurant_id = public.my_restaurant_id());
create policy "ap_u" on public.accounting_periods for update using (restaurant_id = public.my_restaurant_id());
create policy "ap_d" on public.accounting_periods for delete using (restaurant_id = public.my_restaurant_id());

-- journal_entries
create policy "je_s" on public.journal_entries for select using (restaurant_id = public.my_restaurant_id());
create policy "je_i" on public.journal_entries for insert with check (restaurant_id = public.my_restaurant_id());
create policy "je_u" on public.journal_entries for update using (restaurant_id = public.my_restaurant_id());
create policy "je_d" on public.journal_entries for delete using (restaurant_id = public.my_restaurant_id());

-- journal_lines
create policy "jl_s" on public.journal_lines for select using (entry_id in (select id from public.journal_entries where restaurant_id = public.my_restaurant_id()));
create policy "jl_i" on public.journal_lines for insert with check (entry_id in (select id from public.journal_entries where restaurant_id = public.my_restaurant_id()));
create policy "jl_u" on public.journal_lines for update using (entry_id in (select id from public.journal_entries where restaurant_id = public.my_restaurant_id()));
create policy "jl_d" on public.journal_lines for delete using (entry_id in (select id from public.journal_entries where restaurant_id = public.my_restaurant_id()));

-- audit_log
create policy "al_s" on public.audit_log for select using (restaurant_id = public.my_restaurant_id());
create policy "al_i" on public.audit_log for insert with check (restaurant_id = public.my_restaurant_id());

-- stock_movements
create policy "sm_s" on public.stock_movements for select using (restaurant_id = public.my_restaurant_id());
create policy "sm_i" on public.stock_movements for insert with check (restaurant_id = public.my_restaurant_id());
create policy "sm_u" on public.stock_movements for update using (restaurant_id = public.my_restaurant_id());
create policy "sm_d" on public.stock_movements for delete using (restaurant_id = public.my_restaurant_id());

-- purchase_orders
create policy "po_s" on public.purchase_orders for select using (restaurant_id = public.my_restaurant_id());
create policy "po_i" on public.purchase_orders for insert with check (restaurant_id = public.my_restaurant_id());
create policy "po_u" on public.purchase_orders for update using (restaurant_id = public.my_restaurant_id());
create policy "po_d" on public.purchase_orders for delete using (restaurant_id = public.my_restaurant_id());

-- po_lines
create policy "pol_s" on public.po_lines for select using (po_id in (select id from public.purchase_orders where restaurant_id = public.my_restaurant_id()));
create policy "pol_i" on public.po_lines for insert with check (po_id in (select id from public.purchase_orders where restaurant_id = public.my_restaurant_id()));
create policy "pol_u" on public.po_lines for update using (po_id in (select id from public.purchase_orders where restaurant_id = public.my_restaurant_id()));
create policy "pol_d" on public.po_lines for delete using (po_id in (select id from public.purchase_orders where restaurant_id = public.my_restaurant_id()));

-- ingredients
create policy "ing_s" on public.ingredients for select using (restaurant_id = public.my_restaurant_id());
create policy "ing_i" on public.ingredients for insert with check (restaurant_id = public.my_restaurant_id());
create policy "ing_u" on public.ingredients for update using (restaurant_id = public.my_restaurant_id());
create policy "ing_d" on public.ingredients for delete using (restaurant_id = public.my_restaurant_id());

-- recipes
create policy "rec_s" on public.recipes for select using (restaurant_id = public.my_restaurant_id());
create policy "rec_i" on public.recipes for insert with check (restaurant_id = public.my_restaurant_id());
create policy "rec_u" on public.recipes for update using (restaurant_id = public.my_restaurant_id());
create policy "rec_d" on public.recipes for delete using (restaurant_id = public.my_restaurant_id());

-- recipe_lines
create policy "rl_s" on public.recipe_lines for select using (recipe_id in (select id from public.recipes where restaurant_id = public.my_restaurant_id()));
create policy "rl_i" on public.recipe_lines for insert with check (recipe_id in (select id from public.recipes where restaurant_id = public.my_restaurant_id()));
create policy "rl_u" on public.recipe_lines for update using (recipe_id in (select id from public.recipes where restaurant_id = public.my_restaurant_id()));
create policy "rl_d" on public.recipe_lines for delete using (recipe_id in (select id from public.recipes where restaurant_id = public.my_restaurant_id()));

-- menu_item_recipes
create policy "mir_s" on public.menu_item_recipes for select using (restaurant_id = public.my_restaurant_id());
create policy "mir_i" on public.menu_item_recipes for insert with check (restaurant_id = public.my_restaurant_id());
create policy "mir_u" on public.menu_item_recipes for update using (restaurant_id = public.my_restaurant_id());
create policy "mir_d" on public.menu_item_recipes for delete using (restaurant_id = public.my_restaurant_id());

-- production_log
create policy "prl_s" on public.production_log for select using (restaurant_id = public.my_restaurant_id());
create policy "prl_i" on public.production_log for insert with check (restaurant_id = public.my_restaurant_id());
create policy "prl_u" on public.production_log for update using (restaurant_id = public.my_restaurant_id());
create policy "prl_d" on public.production_log for delete using (restaurant_id = public.my_restaurant_id());

-- cash_sessions
create policy "cse_s" on public.cash_sessions for select using (restaurant_id = public.my_restaurant_id());
create policy "cse_i" on public.cash_sessions for insert with check (restaurant_id = public.my_restaurant_id());
create policy "cse_u" on public.cash_sessions for update using (restaurant_id = public.my_restaurant_id());
create policy "cse_d" on public.cash_sessions for delete using (restaurant_id = public.my_restaurant_id());

-- cash_movements
create policy "cm_s" on public.cash_movements for select using (session_id in (select id from public.cash_sessions where restaurant_id = public.my_restaurant_id()));
create policy "cm_i" on public.cash_movements for insert with check (session_id in (select id from public.cash_sessions where restaurant_id = public.my_restaurant_id()));
create policy "cm_u" on public.cash_movements for update using (session_id in (select id from public.cash_sessions where restaurant_id = public.my_restaurant_id()));
create policy "cm_d" on public.cash_movements for delete using (session_id in (select id from public.cash_sessions where restaurant_id = public.my_restaurant_id()));

-- cashier_shifts
create policy "csh_s" on public.cashier_shifts for select using (restaurant_id = public.my_restaurant_id());
create policy "csh_i" on public.cashier_shifts for insert with check (restaurant_id = public.my_restaurant_id());
create policy "csh_u" on public.cashier_shifts for update using (restaurant_id = public.my_restaurant_id());
create policy "csh_d" on public.cashier_shifts for delete using (restaurant_id = public.my_restaurant_id());

-- item_variants
create policy "iv_s" on public.item_variants for select using (restaurant_id = public.my_restaurant_id());
create policy "iv_i" on public.item_variants for insert with check (restaurant_id = public.my_restaurant_id());
create policy "iv_u" on public.item_variants for update using (restaurant_id = public.my_restaurant_id());
create policy "iv_d" on public.item_variants for delete using (restaurant_id = public.my_restaurant_id());

-- promotions
create policy "prm_s" on public.promotions for select using (restaurant_id = public.my_restaurant_id());
create policy "prm_i" on public.promotions for insert with check (restaurant_id = public.my_restaurant_id());
create policy "prm_u" on public.promotions for update using (restaurant_id = public.my_restaurant_id());
create policy "prm_d" on public.promotions for delete using (restaurant_id = public.my_restaurant_id());

-- refunds
create policy "ref_s" on public.refunds for select using (restaurant_id = public.my_restaurant_id());
create policy "ref_i" on public.refunds for insert with check (restaurant_id = public.my_restaurant_id());
create policy "ref_u" on public.refunds for update using (restaurant_id = public.my_restaurant_id());
create policy "ref_d" on public.refunds for delete using (restaurant_id = public.my_restaurant_id());

-- refund_lines
create policy "rfl_s" on public.refund_lines for select using (refund_id in (select id from public.refunds where restaurant_id = public.my_restaurant_id()));
create policy "rfl_i" on public.refund_lines for insert with check (refund_id in (select id from public.refunds where restaurant_id = public.my_restaurant_id()));
create policy "rfl_u" on public.refund_lines for update using (refund_id in (select id from public.refunds where restaurant_id = public.my_restaurant_id()));
create policy "rfl_d" on public.refund_lines for delete using (refund_id in (select id from public.refunds where restaurant_id = public.my_restaurant_id()));

-- receipts
create policy "rct_s" on public.receipts for select using (restaurant_id = public.my_restaurant_id());
create policy "rct_i" on public.receipts for insert with check (restaurant_id = public.my_restaurant_id());
create policy "rct_u" on public.receipts for update using (restaurant_id = public.my_restaurant_id());
create policy "rct_d" on public.receipts for delete using (restaurant_id = public.my_restaurant_id());

-- receipt_lines
create policy "rcl_s" on public.receipt_lines for select using (receipt_id in (select id from public.receipts where restaurant_id = public.my_restaurant_id()));
create policy "rcl_i" on public.receipt_lines for insert with check (receipt_id in (select id from public.receipts where restaurant_id = public.my_restaurant_id()));
create policy "rcl_u" on public.receipt_lines for update using (receipt_id in (select id from public.receipts where restaurant_id = public.my_restaurant_id()));
create policy "rcl_d" on public.receipt_lines for delete using (receipt_id in (select id from public.receipts where restaurant_id = public.my_restaurant_id()));

-- customers (legacy)
create policy "cu_s" on public.customers for select using (restaurant_id = public.my_restaurant_id());
create policy "cu_i" on public.customers for insert with check (restaurant_id = public.my_restaurant_id());
create policy "cu_u" on public.customers for update using (restaurant_id = public.my_restaurant_id());
create policy "cu_d" on public.customers for delete using (restaurant_id = public.my_restaurant_id());

-- loyalty_settings
create policy "ls_s" on public.loyalty_settings for select using (restaurant_id = public.my_restaurant_id());
create policy "ls_i" on public.loyalty_settings for insert with check (restaurant_id = public.my_restaurant_id());
create policy "ls_u" on public.loyalty_settings for update using (restaurant_id = public.my_restaurant_id());
create policy "ls_d" on public.loyalty_settings for delete using (restaurant_id = public.my_restaurant_id());

-- loyalty_transactions
create policy "lt_s" on public.loyalty_transactions for select using (restaurant_id = public.my_restaurant_id());
create policy "lt_i" on public.loyalty_transactions for insert with check (restaurant_id = public.my_restaurant_id());
create policy "lt_u" on public.loyalty_transactions for update using (restaurant_id = public.my_restaurant_id());
create policy "lt_d" on public.loyalty_transactions for delete using (restaurant_id = public.my_restaurant_id());

-- pos_permissions
create policy "pp_s" on public.pos_permissions for select using (restaurant_id = public.my_restaurant_id());
create policy "pp_i" on public.pos_permissions for insert with check (restaurant_id = public.my_restaurant_id());
create policy "pp_u" on public.pos_permissions for update using (restaurant_id = public.my_restaurant_id()) with check (restaurant_id = public.my_restaurant_id());
create policy "pp_d" on public.pos_permissions for delete using (restaurant_id = public.my_restaurant_id());

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
create policy "invl_s" on public.invoice_lines for select using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
create policy "invl_i" on public.invoice_lines for insert with check (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
create policy "invl_u" on public.invoice_lines for update using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
create policy "invl_d" on public.invoice_lines for delete using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));

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
create policy "cht_s" on public.chatter_messages for select using (restaurant_id = public.my_restaurant_id());
create policy "cht_i" on public.chatter_messages for insert with check (restaurant_id = public.my_restaurant_id());
create policy "cht_u" on public.chatter_messages for update using (author_id = auth.uid());
create policy "cht_d" on public.chatter_messages for delete using (author_id = auth.uid());

-- chatter_reads
create policy "cr_s" on public.chatter_reads for select using (profile_id = auth.uid());
create policy "cr_i" on public.chatter_reads for insert with check (profile_id = auth.uid());
create policy "cr_u" on public.chatter_reads for update using (profile_id = auth.uid());

-- user_permissions
create policy "up_s" on public.user_permissions for select using (restaurant_id = public.my_restaurant_id());
create policy "up_i" on public.user_permissions for insert with check (restaurant_id = public.my_restaurant_id());
create policy "up_u" on public.user_permissions for update using (restaurant_id = public.my_restaurant_id());
create policy "up_d" on public.user_permissions for delete using (restaurant_id = public.my_restaurant_id());

select 'SETUP COMPLETE — all tables created and all RLS policies fixed' as status;
