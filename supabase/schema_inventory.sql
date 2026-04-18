-- ============================================================
-- BiteERP Inventory + Purchase Orders Schema
-- Run AFTER schema.sql, schema_pos.sql, schema_recipes.sql
-- ============================================================

-- ── Stock Movements ──────────────────────────────────────────
-- Every change to ingredient stock is recorded here
create table public.stock_movements (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  ingredient_id   uuid not null references public.ingredients(id) on delete cascade,
  movement_type   text not null, -- 'purchase' | 'production_in' | 'sale_deduct' | 'adjustment' | 'wastage' | 'transfer'
  qty_change      numeric not null,   -- positive = in, negative = out
  qty_before      numeric not null default 0,
  qty_after       numeric not null default 0,
  unit_cost       numeric default 0,  -- cost per unit at time of movement
  total_cost      numeric default 0,
  reference_id    uuid,               -- links to PO, production_log, order, etc.
  reference_type  text,               -- 'purchase_order' | 'production' | 'pos_order' | 'manual'
  notes           text,
  logged_by       uuid references auth.users(id),
  created_at      timestamptz default now()
);

-- ── Purchase Orders ──────────────────────────────────────────
create table public.purchase_orders (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  po_number       text not null,
  supplier_id     uuid references public.suppliers(id),
  status          text not null default 'draft', -- draft | sent | partial | received | cancelled
  order_date      date not null default current_date,
  expected_date   date,
  received_date   date,
  subtotal        numeric default 0,
  vat_amount      numeric default 0,
  total           numeric default 0,
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Purchase Order Lines ─────────────────────────────────────
create table public.po_lines (
  id              uuid primary key default uuid_generate_v4(),
  po_id           uuid not null references public.purchase_orders(id) on delete cascade,
  ingredient_id   uuid references public.ingredients(id),
  description     text not null,
  qty_ordered     numeric not null default 0,
  qty_received    numeric default 0,
  unit            text not null default 'kg',
  unit_cost       numeric not null default 0,
  total_cost      numeric not null default 0,
  sort_order      int default 0
);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.stock_movements   enable row level security;
alter table public.purchase_orders   enable row level security;
alter table public.po_lines          enable row level security;

create policy "members read stock_movements"
  on public.stock_movements for select
  using (restaurant_id = public.my_restaurant_id());
create policy "all staff write stock_movements"
  on public.stock_movements for all
  using (restaurant_id = public.my_restaurant_id());

create policy "members read purchase_orders"
  on public.purchase_orders for select
  using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write purchase_orders"
  on public.purchase_orders for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

create policy "members read po_lines"
  on public.po_lines for select
  using (po_id in (
    select id from public.purchase_orders
    where restaurant_id = public.my_restaurant_id()
  ));
create policy "managers+ write po_lines"
  on public.po_lines for all
  using (po_id in (
    select id from public.purchase_orders
    where restaurant_id = public.my_restaurant_id()
  ));

create trigger trg_pos_updated_at
  before update on public.purchase_orders
  for each row execute function public.set_updated_at();
