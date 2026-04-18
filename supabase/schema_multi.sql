-- ============================================================
-- BiteERP — Multi-branch & Multi-company
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Company groups (for multi-company clients) ───────────────
-- A company group links multiple restaurants that belong to
-- the same legal entity owner but have different TRNs/entities
create table if not exists public.company_groups (
  id              uuid primary key default uuid_generate_v4(),
  owner_id        uuid not null references auth.users(id),
  name            text not null,           -- e.g. "Basem Hospitality Group"
  created_at      timestamptz default now()
);

-- ── Branches (within a single restaurant/company) ────────────
-- A branch shares the same TRN, COA, and P&L as its parent restaurant
-- but has its own inventory, POS, staff, and cash sessions
create table if not exists public.branches (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  name            text not null,           -- e.g. "Dubai Mall", "JBR Branch"
  code            text,                    -- short code e.g. "DXB-1"
  address         text,
  city            text,
  phone           text,
  manager_name    text,
  is_main         boolean default false,   -- is this the main/HQ branch?
  active          boolean default true,
  created_at      timestamptz default now()
);

-- ── Link restaurants to company groups ───────────────────────
alter table public.restaurants
  add column if not exists company_group_id uuid references public.company_groups(id),
  add column if not exists is_headquarters  boolean default false;

-- ── Add branch_id to all operational tables ──────────────────
alter table public.orders            add column if not exists branch_id uuid references public.branches(id);
alter table public.ingredients       add column if not exists branch_id uuid references public.branches(id);
alter table public.stock_movements   add column if not exists branch_id uuid references public.branches(id);
alter table public.purchase_orders   add column if not exists branch_id uuid references public.branches(id);
alter table public.cash_sessions     add column if not exists branch_id uuid references public.branches(id);
alter table public.cashier_shifts    add column if not exists branch_id uuid references public.branches(id);

-- ── Inter-branch transfers ────────────────────────────────────
create table if not exists public.branch_transfers (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  transfer_number text not null,
  from_branch_id  uuid not null references public.branches(id),
  to_branch_id    uuid not null references public.branches(id),
  status          text not null default 'draft', -- draft | sent | received | cancelled
  notes           text,
  requested_by    uuid references auth.users(id),
  approved_by     uuid references auth.users(id),
  sent_at         timestamptz,
  received_at     timestamptz,
  created_at      timestamptz default now()
);

create table if not exists public.branch_transfer_lines (
  id              uuid primary key default uuid_generate_v4(),
  transfer_id     uuid not null references public.branch_transfers(id) on delete cascade,
  ingredient_id   uuid references public.ingredients(id),
  ingredient_name text not null,
  quantity_sent   numeric not null default 0,
  quantity_received numeric,              -- may differ (damage/discrepancy)
  unit            text,
  cost_per_unit   numeric default 0
);

-- ── Profile gets branch access ────────────────────────────────
-- Which branches a staff member can access
create table if not exists public.profile_branches (
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  branch_id       uuid not null references public.branches(id) on delete cascade,
  primary key (profile_id, branch_id)
);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.company_groups     enable row level security;
alter table public.branches           enable row level security;
alter table public.branch_transfers   enable row level security;
alter table public.branch_transfer_lines enable row level security;
alter table public.profile_branches   enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='company_groups' and policyname='owner read company_groups') then
    create policy "owner read company_groups" on public.company_groups for select using (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='company_groups' and policyname='owner write company_groups') then
    create policy "owner write company_groups" on public.company_groups for all using (owner_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='branches' and policyname='members read branches') then
    create policy "members read branches" on public.branches for select using (restaurant_id = public.my_restaurant_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='branches' and policyname='managers write branches') then
    create policy "managers write branches" on public.branches for all using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));
  end if;
  if not exists (select 1 from pg_policies where tablename='branch_transfers' and policyname='members read branch_transfers') then
    create policy "members read branch_transfers" on public.branch_transfers for select using (restaurant_id = public.my_restaurant_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='branch_transfers' and policyname='members write branch_transfers') then
    create policy "members write branch_transfers" on public.branch_transfers for all using (restaurant_id = public.my_restaurant_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='branch_transfer_lines' and policyname='members read transfer_lines') then
    create policy "members read transfer_lines" on public.branch_transfer_lines for select using (transfer_id in (select id from public.branch_transfers where restaurant_id = public.my_restaurant_id()));
  end if;
  if not exists (select 1 from pg_policies where tablename='branch_transfer_lines' and policyname='members write transfer_lines') then
    create policy "members write transfer_lines" on public.branch_transfer_lines for all using (transfer_id in (select id from public.branch_transfers where restaurant_id = public.my_restaurant_id()));
  end if;
  if not exists (select 1 from pg_policies where tablename='profile_branches' and policyname='members read profile_branches') then
    create policy "members read profile_branches" on public.profile_branches for select using (profile_id = auth.uid());
  end if;
end $$;

create index if not exists idx_branches_restaurant   on public.branches(restaurant_id);
create index if not exists idx_branch_transfers_from on public.branch_transfers(from_branch_id);
create index if not exists idx_branch_transfers_to   on public.branch_transfers(to_branch_id);
