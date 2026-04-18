-- ============================================================
-- Dubai Market SaaS — Supabase Schema
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- RESTAURANTS
-- Each paying customer is a "restaurant" (or food business)
-- ============================================================
create table public.restaurants (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  slug          text unique not null,           -- used in URLs
  country       text not null default 'UAE',
  city          text not null default 'Dubai',
  currency      text not null default 'AED',
  timezone      text not null default 'Asia/Dubai',
  plan          text not null default 'free',   -- free | pro | enterprise
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- PROFILES
-- Extends Supabase auth.users with role + restaurant link
-- ============================================================
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  restaurant_id  uuid references public.restaurants(id) on delete cascade,
  full_name      text,
  role           text not null default 'manager', -- owner | manager | cashier | viewer
  avatar_url     text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ============================================================
-- CALCULATOR STATE
-- Stores the saved Calculator inputs per restaurant
-- (replaces Redis state:username)
-- ============================================================
create table public.calculator_state (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  state          jsonb not null default '{}',
  saved_at       timestamptz default now(),
  saved_by       uuid references auth.users(id),
  unique (restaurant_id)
);

-- ============================================================
-- P&L HISTORY
-- Monthly snapshots saved from the P&L History tab
-- ============================================================
create table public.pl_history (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  month          int  not null check (month between 0 and 11),
  year           int  not null,
  label          text not null,
  note           text,
  revenue        numeric not null default 0,
  gross          numeric not null default 0,
  net_after_tax  numeric not null default 0,
  total_tax      numeric not null default 0,
  food_cogs      numeric not null default 0,
  total_opex     numeric not null default 0,
  gross_margin   int    not null default 0,
  net_margin     int    not null default 0,
  saved_by       uuid references auth.users(id),
  saved_at       timestamptz default now(),
  unique (restaurant_id, month, year)
);

-- ============================================================
-- SUPPLIERS
-- ============================================================
create table public.suppliers (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null,
  category       text,
  contact        text,
  phone          text,
  terms          text default '30 days',
  outstanding    numeric default 0,
  monthly_spend  numeric default 0,
  status         text default 'Active',
  notes          text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ============================================================
-- EXPENSES
-- One-off expense log
-- ============================================================
create table public.expenses (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  date           date not null default current_date,
  description    text not null,
  category       text not null,
  amount         numeric not null,
  receipt        boolean default false,
  notes          text,
  logged_by      uuid references auth.users(id),
  created_at     timestamptz default now()
);

-- ============================================================
-- DAILY SALES LOG
-- Actual daily revenue per week
-- ============================================================
create table public.daily_sales (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  week_start     date not null,              -- ISO date of Monday
  day_of_week    text not null,              -- 'monday' ... 'sunday'
  total          numeric not null default 0,
  deli           numeric default 0,
  juice          numeric default 0,
  beverages      numeric default 0,
  snacks         numeric default 0,
  grocery        numeric default 0,
  logged_by      uuid references auth.users(id),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (restaurant_id, week_start, day_of_week)
);

-- ============================================================
-- STAFF
-- Staff roster per restaurant
-- ============================================================
create table public.staff (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null,
  role           text not null default 'Cashier',
  rate           numeric not null default 18,
  color          text default '#6a9fcb',
  active         boolean default true,
  created_at     timestamptz default now()
);

-- ============================================================
-- STAFF SCHEDULE
-- Weekly rota — one row per staff member per day per week
-- ============================================================
create table public.staff_schedule (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  staff_id       uuid not null references public.staff(id) on delete cascade,
  week_start     date not null,
  day_of_week    text not null,              -- 'monday' ... 'sunday'
  preset         text not null default 'morning',
  shift_start    time default '07:00',
  shift_end      time default '15:00',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (staff_id, week_start, day_of_week)
);

-- ============================================================
-- INVENTORY / WASTAGE LOG
-- Weekly actuals per category
-- ============================================================
create table public.inventory_log (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  week_start     date not null,
  category       text not null,             -- deli | juice | bev | snack | groc
  log_type       text not null,             -- 'actual_cogs' | 'wastage'
  amount         numeric not null default 0,
  wastage_reason text,
  logged_by      uuid references auth.users(id),
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique (restaurant_id, week_start, category, log_type)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Each restaurant only sees its own data
-- ============================================================

-- Enable RLS on all tables
alter table public.restaurants       enable row level security;
alter table public.profiles          enable row level security;
alter table public.calculator_state  enable row level security;
alter table public.pl_history        enable row level security;
alter table public.suppliers         enable row level security;
alter table public.expenses          enable row level security;
alter table public.daily_sales       enable row level security;
alter table public.staff             enable row level security;
alter table public.staff_schedule    enable row level security;
alter table public.inventory_log     enable row level security;

-- Helper: get restaurant_id for the current user
create or replace function public.my_restaurant_id()
returns uuid language sql stable security definer as $$
  select restaurant_id from public.profiles where id = auth.uid()
$$;

-- Helper: get role for the current user
create or replace function public.my_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;

-- Restaurants: users can only see their own restaurant
create policy "users see own restaurant"
  on public.restaurants for select
  using (id = public.my_restaurant_id());

create policy "owners can update restaurant"
  on public.restaurants for update
  using (id = public.my_restaurant_id() and public.my_role() = 'owner');

-- Profiles: users see profiles in their restaurant
create policy "users see own profile"
  on public.profiles for select
  using (restaurant_id = public.my_restaurant_id());

create policy "users update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Calculator state
create policy "restaurant members can read state"
  on public.calculator_state for select
  using (restaurant_id = public.my_restaurant_id());

create policy "managers+ can write state"
  on public.calculator_state for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner', 'manager'));

-- P&L History
create policy "restaurant members read pl_history"
  on public.pl_history for select
  using (restaurant_id = public.my_restaurant_id());

create policy "managers+ write pl_history"
  on public.pl_history for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner', 'manager'));

-- Suppliers
create policy "restaurant members read suppliers"
  on public.suppliers for select
  using (restaurant_id = public.my_restaurant_id());

create policy "managers+ write suppliers"
  on public.suppliers for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner', 'manager'));

-- Expenses
create policy "restaurant members read expenses"
  on public.expenses for select
  using (restaurant_id = public.my_restaurant_id());

create policy "all staff can log expenses"
  on public.expenses for insert
  with check (restaurant_id = public.my_restaurant_id());

create policy "managers+ can update/delete expenses"
  on public.expenses for update
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner', 'manager'));

create policy "managers+ can delete expenses"
  on public.expenses for delete
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner', 'manager'));

-- Daily sales
create policy "restaurant members read sales"
  on public.daily_sales for select
  using (restaurant_id = public.my_restaurant_id());

create policy "all staff can log sales"
  on public.daily_sales for all
  using (restaurant_id = public.my_restaurant_id());

-- Staff
create policy "restaurant members read staff"
  on public.staff for select
  using (restaurant_id = public.my_restaurant_id());

create policy "managers+ write staff"
  on public.staff for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner', 'manager'));

-- Staff schedule
create policy "restaurant members read schedule"
  on public.staff_schedule for select
  using (restaurant_id = public.my_restaurant_id());

create policy "managers+ write schedule"
  on public.staff_schedule for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner', 'manager'));

-- Inventory log
create policy "restaurant members read inventory"
  on public.inventory_log for select
  using (restaurant_id = public.my_restaurant_id());

create policy "all staff can log inventory"
  on public.inventory_log for all
  using (restaurant_id = public.my_restaurant_id());

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_restaurants_updated_at
  before update on public.restaurants
  for each row execute function public.set_updated_at();

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

create trigger trg_daily_sales_updated_at
  before update on public.daily_sales
  for each row execute function public.set_updated_at();

create trigger trg_schedule_updated_at
  before update on public.staff_schedule
  for each row execute function public.set_updated_at();

create trigger trg_inventory_updated_at
  before update on public.inventory_log
  for each row execute function public.set_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE on signup
-- Runs when a new user signs up via Supabase Auth
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'manager')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- POS EXTENSION — Menu, Orders, Tables
-- Run this in Supabase SQL Editor after the base schema
-- ============================================================

-- ── Menu Categories ──────────────────────────────────────────
create table public.menu_categories (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null,
  icon           text default '🍽',
  color          text default '#0D7377',
  sort_order     int  default 0,
  active         boolean default true,
  created_at     timestamptz default now()
);

-- ── Menu Items ───────────────────────────────────────────────
create table public.menu_items (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  category_id    uuid not null references public.menu_categories(id) on delete cascade,
  name           text not null,
  description    text,
  price          numeric not null default 0,
  cost           numeric default 0,          -- COGS per item
  image_url      text,
  tags           text[] default '{}',        -- e.g. ['vegan','spicy','popular']
  available      boolean default true,
  sort_order     int default 0,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ── Menu Modifiers ───────────────────────────────────────────
create table public.menu_modifier_groups (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  item_id        uuid references public.menu_items(id) on delete cascade,
  name           text not null,              -- e.g. "Size", "Extras", "Remove"
  required       boolean default false,
  multi_select   boolean default false,
  sort_order     int default 0
);

create table public.menu_modifiers (
  id             uuid primary key default uuid_generate_v4(),
  group_id       uuid not null references public.menu_modifier_groups(id) on delete cascade,
  name           text not null,              -- e.g. "Large", "Extra cheese"
  price_delta    numeric default 0,          -- +/- on base price
  sort_order     int default 0
);

-- ── Tables / Sections ────────────────────────────────────────
create table public.restaurant_tables (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null,              -- e.g. "Table 1", "Counter 3"
  section        text default 'Main',        -- e.g. "Indoor", "Outdoor", "Counter"
  capacity       int default 4,
  active         boolean default true,
  created_at     timestamptz default now()
);

-- ── Orders ───────────────────────────────────────────────────
create table public.orders (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  order_number   serial,
  table_id       uuid references public.restaurant_tables(id),
  order_type     text not null default 'dine_in', -- dine_in | takeaway | delivery
  status         text not null default 'open',    -- open | sent | paid | voided
  subtotal       numeric not null default 0,
  discount       numeric default 0,
  vat_amount     numeric default 0,
  total          numeric not null default 0,
  payment_method text,                            -- cash | card | split
  notes          text,
  opened_by      uuid references auth.users(id),
  closed_by      uuid references auth.users(id),
  opened_at      timestamptz default now(),
  closed_at      timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

-- ── Order Items ──────────────────────────────────────────────
create table public.order_items (
  id             uuid primary key default uuid_generate_v4(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  item_id        uuid references public.menu_items(id),
  name           text not null,              -- snapshot of item name at time of order
  price          numeric not null,           -- snapshot of price
  cost           numeric default 0,          -- snapshot of COGS
  quantity       int not null default 1,
  modifiers      jsonb default '[]',         -- [{name, price_delta}]
  item_total     numeric not null,           -- (price + modifier deltas) * qty
  notes          text,
  created_at     timestamptz default now()
);

-- ── RLS for new tables ────────────────────────────────────────
alter table public.menu_categories        enable row level security;
alter table public.menu_items             enable row level security;
alter table public.menu_modifier_groups   enable row level security;
alter table public.menu_modifiers         enable row level security;
alter table public.restaurant_tables      enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;

-- Menu categories
create policy "members read menu_categories"
  on public.menu_categories for select
  using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write menu_categories"
  on public.menu_categories for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

-- Menu items
create policy "members read menu_items"
  on public.menu_items for select
  using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write menu_items"
  on public.menu_items for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

-- Modifier groups
create policy "members read modifier_groups"
  on public.menu_modifier_groups for select
  using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write modifier_groups"
  on public.menu_modifier_groups for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

-- Modifiers
create policy "members read modifiers"
  on public.menu_modifiers for select
  using (group_id in (
    select id from public.menu_modifier_groups
    where restaurant_id = public.my_restaurant_id()
  ));
create policy "managers+ write modifiers"
  on public.menu_modifiers for all
  using (group_id in (
    select id from public.menu_modifier_groups
    where restaurant_id = public.my_restaurant_id()
  ));

-- Tables
create policy "members read tables"
  on public.restaurant_tables for select
  using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write tables"
  on public.restaurant_tables for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

-- Orders — all staff can create and update
create policy "members read orders"
  on public.orders for select
  using (restaurant_id = public.my_restaurant_id());
create policy "all staff write orders"
  on public.orders for all
  using (restaurant_id = public.my_restaurant_id());

-- Order items
create policy "members read order_items"
  on public.order_items for select
  using (order_id in (
    select id from public.orders
    where restaurant_id = public.my_restaurant_id()
  ));
create policy "all staff write order_items"
  on public.order_items for all
  using (order_id in (
    select id from public.orders
    where restaurant_id = public.my_restaurant_id()
  ));

-- Triggers
create trigger trg_menu_items_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ============================================================
-- Company Profile (extends restaurants table)
-- Run this in Supabase SQL Editor
-- ============================================================
alter table public.restaurants
  add column if not exists trade_name     text,
  add column if not exists trn            text,          -- UAE Tax Registration Number
  add column if not exists address_line1  text,
  add column if not exists address_line2  text,
  add column if not exists city           text default 'Dubai',
  add column if not exists phone          text,
  add column if not exists email          text,
  add column if not exists website        text,
  add column if not exists logo_url       text,
  add column if not exists bank_name      text,
  add column if not exists bank_iban      text,
  add column if not exists bank_swift     text,
  add column if not exists po_terms       text default 'Payment due within 30 days of invoice.',
  add column if not exists po_notes       text,
  add column if not exists next_po_number int  default 1,
  add column if not exists po_prefix      text default 'PO',
  add column if not exists quote_prefix   text default 'QT';
