-- ============================================================
-- BiteERP POS v2 — kitchen flow, item notes, cash sessions
-- Run in Supabase SQL Editor
-- ============================================================

-- Extend orders table
alter table public.orders
  add column if not exists customer_name  text,
  add column if not exists fired_at       timestamptz,
  add column if not exists ready_at       timestamptz,
  add column if not exists notes          text,
  add column if not exists covers         int default 1;

-- Extend order_items
alter table public.order_items
  add column if not exists status  text not null default 'pending',  -- pending|cooking|ready|voided
  add column if not exists notes   text,
  add column if not exists course  text not null default 'main';     -- starter|main|dessert|drink

-- Cash sessions
create table if not exists public.cash_sessions (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  opened_by       uuid references auth.users(id),
  closed_by       uuid references auth.users(id),
  opening_float   numeric not null default 0,
  closing_cash    numeric,
  expected_cash   numeric,
  cash_difference numeric,
  total_cash_sales   numeric default 0,
  total_card_sales   numeric default 0,
  total_split_sales  numeric default 0,
  total_orders       int     default 0,
  total_revenue      numeric default 0,
  status          text not null default 'open',  -- open | closed
  opened_at       timestamptz default now(),
  closed_at       timestamptz,
  notes           text
);

-- Cash movements (cash in/out during session)
create table if not exists public.cash_movements (
  id              uuid primary key default uuid_generate_v4(),
  session_id      uuid not null references public.cash_sessions(id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  movement_type   text not null,  -- cash_in | cash_out
  amount          numeric not null,
  reason          text,
  logged_by       uuid references auth.users(id),
  created_at      timestamptz default now()
);

-- RLS
alter table public.cash_sessions  enable row level security;
alter table public.cash_movements enable row level security;

create policy "members read cash_sessions"  on public.cash_sessions for select using (restaurant_id = public.my_restaurant_id());
create policy "members write cash_sessions" on public.cash_sessions for all    using (restaurant_id = public.my_restaurant_id());
create policy "members read cash_movements" on public.cash_movements for select using (restaurant_id = public.my_restaurant_id());
create policy "members write cash_movements"on public.cash_movements for all    using (restaurant_id = public.my_restaurant_id());
