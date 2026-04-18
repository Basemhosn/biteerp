-- ============================================================
-- BiteERP POS v3 — Full POS feature set
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Extend menu_items with SKU, barcode, variants ────────────
alter table public.menu_items
  add column if not exists sku          text,
  add column if not exists barcode      text,
  add column if not exists track_stock  boolean default false,
  add column if not exists stock_count  numeric default 0,
  add column if not exists tax_rate     numeric default 5,
  add column if not exists is_variant_parent boolean default false;

-- Product variants (e.g. Small/Medium/Large, different sizes/flavours)
create table if not exists public.item_variants (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  item_id         uuid not null references public.menu_items(id) on delete cascade,
  name            text not null,     -- e.g. 'Small', 'Large', 'Chicken', 'Beef'
  sku             text,
  barcode         text,
  price           numeric not null default 0,
  cost            numeric default 0,
  available       boolean default true,
  sort_order      int default 0
);

-- ── Promotions / Discounts ───────────────────────────────────
create table if not exists public.promotions (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  name            text not null,
  code            text,              -- promo code (optional)
  type            text not null,     -- 'percent' | 'fixed' | 'bogo' | 'happy_hour'
  value           numeric not null default 0,  -- % or AED amount
  min_order_value numeric default 0,
  applies_to      text default 'order',  -- 'order' | 'category' | 'item'
  applies_to_id   uuid,              -- category_id or item_id if scoped
  active          boolean default true,
  valid_from      timestamptz,
  valid_until     timestamptz,
  days_of_week    text[] default '{}',   -- ['monday','friday'] empty = all days
  start_time      time,              -- happy hour start
  end_time        time,              -- happy hour end
  usage_count     int default 0,
  usage_limit     int,               -- null = unlimited
  created_at      timestamptz default now()
);

-- ── Cashier shifts ───────────────────────────────────────────
create table if not exists public.cashier_shifts (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  cash_session_id uuid references public.cash_sessions(id),
  cashier_id      uuid references auth.users(id),
  cashier_name    text,
  opened_at       timestamptz default now(),
  closed_at       timestamptz,
  opening_float   numeric default 0,
  closing_cash    numeric,
  total_sales     numeric default 0,
  total_orders    int default 0,
  status          text default 'open'  -- open | closed
);

-- ── Refunds ──────────────────────────────────────────────────
create table if not exists public.refunds (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  order_id        uuid not null references public.orders(id),
  refund_number   text not null,
  reason          text,
  type            text not null default 'full',  -- full | partial | item
  amount          numeric not null default 0,
  payment_method  text,              -- cash | card | credit_note
  status          text default 'pending',  -- pending | approved | processed
  processed_by    uuid references auth.users(id),
  processed_at    timestamptz,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now()
);

create table if not exists public.refund_lines (
  id              uuid primary key default uuid_generate_v4(),
  refund_id       uuid not null references public.refunds(id) on delete cascade,
  order_item_id   uuid references public.order_items(id),
  name            text not null,
  quantity        int not null default 1,
  amount          numeric not null default 0
);

-- ── Extend orders with promo, shift, refund ──────────────────
alter table public.orders
  add column if not exists promotion_id   uuid references public.promotions(id),
  add column if not exists promo_code     text,
  add column if not exists discount_type  text default 'amount',  -- amount | percent | promo
  add column if not exists shift_id       uuid references public.cashier_shifts(id),
  add column if not exists is_refunded    boolean default false,
  add column if not exists refund_amount  numeric default 0;

-- ── RLS ───────────────────────────────────────────────────────
alter table public.item_variants     enable row level security;
alter table public.promotions        enable row level security;
alter table public.cashier_shifts    enable row level security;
alter table public.refunds           enable row level security;
alter table public.refund_lines      enable row level security;

create policy "members read item_variants"  on public.item_variants for select using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write item_variants" on public.item_variants for all using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));

create policy "members read promotions"  on public.promotions for select using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write promotions" on public.promotions for all using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));

create policy "members read cashier_shifts"  on public.cashier_shifts for select using (restaurant_id = public.my_restaurant_id());
create policy "members write cashier_shifts" on public.cashier_shifts for all using (restaurant_id = public.my_restaurant_id());

create policy "members read refunds"  on public.refunds for select using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write refunds" on public.refunds for all using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));
create policy "members read refund_lines" on public.refund_lines for select using (refund_id in (select id from public.refunds where restaurant_id = public.my_restaurant_id()));
create policy "managers+ write refund_lines" on public.refund_lines for all using (refund_id in (select id from public.refunds where restaurant_id = public.my_restaurant_id()));

-- Index for fast barcode lookup
create index if not exists idx_menu_items_barcode on public.menu_items(barcode) where barcode is not null;
create index if not exists idx_item_variants_barcode on public.item_variants(barcode) where barcode is not null;
