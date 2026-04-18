-- ============================================================
-- BiteERP Sprint 2 — Customers & Loyalty
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Customers ────────────────────────────────────────────────
create table if not exists public.customers (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  name            text not null,
  phone           text,
  email           text,
  birthday        date,
  gender          text,                    -- male | female | other
  notes           text,
  tags            text[] default '{}',     -- ['vip','regular','blacklisted']
  -- Loyalty
  loyalty_points  int not null default 0,
  lifetime_spend  numeric not null default 0,
  visit_count     int not null default 0,
  last_visit_at   timestamptz,
  tier            text not null default 'bronze',  -- bronze|silver|gold|platinum
  -- Meta
  source          text default 'pos',      -- pos | import | manual
  active          boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (restaurant_id, phone)
);

-- ── Loyalty transactions ─────────────────────────────────────
create table if not exists public.loyalty_transactions (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  customer_id     uuid not null references public.customers(id) on delete cascade,
  order_id        uuid references public.orders(id),
  type            text not null,           -- earn | redeem | adjust | expire
  points          int not null,            -- positive = earn, negative = redeem/expire
  balance_after   int not null,
  description     text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now()
);

-- ── Loyalty settings ─────────────────────────────────────────
create table if not exists public.loyalty_settings (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade unique,
  enabled         boolean default true,
  points_per_aed  numeric default 1,       -- points earned per AED spent
  aed_per_point   numeric default 0.10,    -- AED value of each point on redemption
  min_redeem      int default 100,         -- minimum points to redeem
  expiry_days     int,                     -- null = no expiry
  -- Tier thresholds (lifetime spend in AED)
  silver_threshold  numeric default 500,
  gold_threshold    numeric default 2000,
  plat_threshold    numeric default 5000,
  -- Tier multipliers
  silver_mult     numeric default 1.5,
  gold_mult       numeric default 2.0,
  plat_mult       numeric default 3.0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Extend orders with customer ──────────────────────────────
alter table public.orders
  add column if not exists customer_id       uuid references public.customers(id),
  add column if not exists loyalty_earned    int default 0,
  add column if not exists loyalty_redeemed  int default 0,
  add column if not exists loyalty_discount  numeric default 0;

-- ── RLS ───────────────────────────────────────────────────────
alter table public.customers            enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.loyalty_settings     enable row level security;

create policy "members read customers"    on public.customers for select using (restaurant_id = public.my_restaurant_id());
create policy "all staff write customers" on public.customers for all    using (restaurant_id = public.my_restaurant_id());

create policy "members read loyalty_tx"   on public.loyalty_transactions for select using (restaurant_id = public.my_restaurant_id());
create policy "all staff write loyalty_tx"on public.loyalty_transactions for all    using (restaurant_id = public.my_restaurant_id());

create policy "members read loyalty_settings"   on public.loyalty_settings for select using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write loyalty_settings"on public.loyalty_settings for all   using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));

-- Triggers
create trigger trg_customers_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger trg_loyalty_settings_updated_at before update on public.loyalty_settings for each row execute function public.set_updated_at();

-- Indexes
create index if not exists idx_customers_phone   on public.customers(restaurant_id, phone);
create index if not exists idx_customers_name    on public.customers(restaurant_id, name);
create index if not exists idx_loyalty_customer  on public.loyalty_transactions(customer_id, created_at desc);
