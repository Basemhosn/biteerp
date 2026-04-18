-- ============================================================
-- BiteERP Accounting Schema (Double-Entry)
-- Run AFTER schema_inventory.sql
-- ============================================================

-- ── Chart of Accounts ────────────────────────────────────────
create table public.accounts (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  code            text not null,          -- e.g. 1000, 2000, 4000
  name            text not null,
  type            text not null,          -- asset | liability | equity | revenue | expense
  sub_type        text,                   -- cash | receivable | payable | cogs | opex | etc.
  parent_id       uuid references public.accounts(id),
  is_system       boolean default false,  -- system accounts can't be deleted
  active          boolean default true,
  created_at      timestamptz default now(),
  unique (restaurant_id, code)
);

-- ── Accounting Periods ───────────────────────────────────────
create table public.accounting_periods (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  year            int not null,
  month           int not null check (month between 1 and 12),
  status          text not null default 'open', -- open | closed
  closed_at       timestamptz,
  closed_by       uuid references auth.users(id),
  unique (restaurant_id, year, month)
);

-- ── Journal Entries ──────────────────────────────────────────
create table public.journal_entries (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  entry_number    text not null,
  entry_date      date not null default current_date,
  description     text not null,
  source          text not null default 'manual', -- manual | pos_sale | purchase_order | payroll | adjustment
  reference_id    uuid,
  period_id       uuid references public.accounting_periods(id),
  posted          boolean default false,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now()
);

-- ── Journal Lines ────────────────────────────────────────────
create table public.journal_lines (
  id              uuid primary key default uuid_generate_v4(),
  entry_id        uuid not null references public.journal_entries(id) on delete cascade,
  account_id      uuid not null references public.accounts(id),
  description     text,
  debit           numeric not null default 0,
  credit          numeric not null default 0,
  sort_order      int default 0,
  constraint debit_or_credit check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0) or (debit = 0 and credit = 0)
  )
);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.accounts            enable row level security;
alter table public.accounting_periods  enable row level security;
alter table public.journal_entries     enable row level security;
alter table public.journal_lines       enable row level security;

create policy "members read accounts"
  on public.accounts for select
  using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write accounts"
  on public.accounts for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

create policy "members read periods"
  on public.accounting_periods for select
  using (restaurant_id = public.my_restaurant_id());
create policy "owners manage periods"
  on public.accounting_periods for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() = 'owner');

create policy "members read journal_entries"
  on public.journal_entries for select
  using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write journal_entries"
  on public.journal_entries for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

create policy "members read journal_lines"
  on public.journal_lines for select
  using (entry_id in (
    select id from public.journal_entries
    where restaurant_id = public.my_restaurant_id()
  ));
create policy "managers+ write journal_lines"
  on public.journal_lines for all
  using (entry_id in (
    select id from public.journal_entries
    where restaurant_id = public.my_restaurant_id()
  ));

-- ── Default UAE Restaurant Chart of Accounts ─────────────────
-- Seeded via a function so each new restaurant gets defaults
create or replace function public.seed_chart_of_accounts(p_restaurant_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into public.accounts (restaurant_id, code, name, type, sub_type, is_system) values
    -- ASSETS
    (p_restaurant_id, '1000', 'Cash & Bank',              'asset',     'cash',         true),
    (p_restaurant_id, '1010', 'Cash on Hand',             'asset',     'cash',         true),
    (p_restaurant_id, '1020', 'Bank Account',             'asset',     'bank',         true),
    (p_restaurant_id, '1100', 'Accounts Receivable',      'asset',     'receivable',   true),
    (p_restaurant_id, '1200', 'Inventory / Stock',        'asset',     'inventory',    true),
    (p_restaurant_id, '1300', 'Prepaid Expenses',         'asset',     'prepaid',      false),
    -- LIABILITIES
    (p_restaurant_id, '2000', 'Accounts Payable',         'liability', 'payable',      true),
    (p_restaurant_id, '2100', 'VAT Payable',              'liability', 'tax',          true),
    (p_restaurant_id, '2200', 'Accrued Expenses',         'liability', 'accrued',      false),
    (p_restaurant_id, '2300', 'Loans Payable',            'liability', 'loan',         false),
    -- EQUITY
    (p_restaurant_id, '3000', 'Owner''s Equity',          'equity',    'equity',       true),
    (p_restaurant_id, '3100', 'Retained Earnings',        'equity',    'retained',     true),
    -- REVENUE
    (p_restaurant_id, '4000', 'Sales Revenue',            'revenue',   'sales',        true),
    (p_restaurant_id, '4010', 'Dine-in Revenue',          'revenue',   'sales',        true),
    (p_restaurant_id, '4020', 'Takeaway Revenue',         'revenue',   'sales',        true),
    (p_restaurant_id, '4030', 'Delivery Revenue',         'revenue',   'sales',        true),
    (p_restaurant_id, '4100', 'Other Revenue',            'revenue',   'other',        false),
    -- COST OF GOODS
    (p_restaurant_id, '5000', 'Cost of Goods Sold',       'expense',   'cogs',         true),
    (p_restaurant_id, '5010', 'Food Cost',                'expense',   'cogs',         true),
    (p_restaurant_id, '5020', 'Beverage Cost',            'expense',   'cogs',         true),
    -- OPERATING EXPENSES
    (p_restaurant_id, '6000', 'Operating Expenses',       'expense',   'opex',         true),
    (p_restaurant_id, '6010', 'Salaries & Wages',         'expense',   'payroll',      true),
    (p_restaurant_id, '6020', 'Rent',                     'expense',   'rent',         true),
    (p_restaurant_id, '6030', 'Utilities (DEWA)',         'expense',   'utilities',    true),
    (p_restaurant_id, '6040', 'District Cooling',         'expense',   'utilities',    false),
    (p_restaurant_id, '6050', 'Marketing & Advertising',  'expense',   'marketing',    false),
    (p_restaurant_id, '6060', 'Repairs & Maintenance',    'expense',   'maintenance',  false),
    (p_restaurant_id, '6070', 'Insurance',                'expense',   'insurance',    false),
    (p_restaurant_id, '6080', 'Licenses & Permits',       'expense',   'admin',        false),
    (p_restaurant_id, '6090', 'Technology & Software',    'expense',   'tech',         false),
    (p_restaurant_id, '6100', 'Depreciation',             'expense',   'depreciation', false),
    (p_restaurant_id, '6110', 'End of Service Gratuity',  'expense',   'payroll',      false),
    (p_restaurant_id, '6200', 'Miscellaneous Expenses',   'expense',   'misc',         false),
    -- TAX
    (p_restaurant_id, '7000', 'VAT Expense',              'expense',   'tax',          true),
    (p_restaurant_id, '7010', 'Corporate Tax (9%)',        'expense',   'tax',          false)
  on conflict (restaurant_id, code) do nothing;
end;
$$;
