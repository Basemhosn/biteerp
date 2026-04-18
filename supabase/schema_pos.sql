-- ============================================================
-- BiteERP POS Extension — run this SEPARATELY in SQL Editor
-- after you have already run schema.sql
-- ============================================================

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

create table public.menu_items (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  category_id    uuid not null references public.menu_categories(id) on delete cascade,
  name           text not null,
  description    text,
  price          numeric not null default 0,
  cost           numeric default 0,
  image_url      text,
  tags           text[] default '{}',
  available      boolean default true,
  sort_order     int default 0,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table public.menu_modifier_groups (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  item_id        uuid references public.menu_items(id) on delete cascade,
  name           text not null,
  required       boolean default false,
  multi_select   boolean default false,
  sort_order     int default 0
);

create table public.menu_modifiers (
  id             uuid primary key default uuid_generate_v4(),
  group_id       uuid not null references public.menu_modifier_groups(id) on delete cascade,
  name           text not null,
  price_delta    numeric default 0,
  sort_order     int default 0
);

create table public.restaurant_tables (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  name           text not null,
  section        text default 'Main',
  capacity       int default 4,
  active         boolean default true,
  created_at     timestamptz default now()
);

create table public.orders (
  id             uuid primary key default uuid_generate_v4(),
  restaurant_id  uuid not null references public.restaurants(id) on delete cascade,
  order_number   int,
  table_id       uuid references public.restaurant_tables(id),
  order_type     text not null default 'dine_in',
  status         text not null default 'open',
  subtotal       numeric not null default 0,
  discount       numeric default 0,
  vat_amount     numeric default 0,
  total          numeric not null default 0,
  payment_method text,
  notes          text,
  opened_by      uuid references auth.users(id),
  closed_by      uuid references auth.users(id),
  opened_at      timestamptz default now(),
  closed_at      timestamptz,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table public.order_items (
  id             uuid primary key default uuid_generate_v4(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  item_id        uuid references public.menu_items(id),
  name           text not null,
  price          numeric not null,
  cost           numeric default 0,
  quantity       int not null default 1,
  modifiers      jsonb default '[]',
  item_total     numeric not null,
  notes          text,
  created_at     timestamptz default now()
);

-- RLS
alter table public.menu_categories        enable row level security;
alter table public.menu_items             enable row level security;
alter table public.menu_modifier_groups   enable row level security;
alter table public.menu_modifiers         enable row level security;
alter table public.restaurant_tables      enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;

create policy "members read menu_categories" on public.menu_categories for select using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write menu_categories" on public.menu_categories for all using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));
create policy "members read menu_items" on public.menu_items for select using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write menu_items" on public.menu_items for all using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));
create policy "members read modifier_groups" on public.menu_modifier_groups for select using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write modifier_groups" on public.menu_modifier_groups for all using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));
create policy "members read modifiers" on public.menu_modifiers for select using (group_id in (select id from public.menu_modifier_groups where restaurant_id = public.my_restaurant_id()));
create policy "managers+ write modifiers" on public.menu_modifiers for all using (group_id in (select id from public.menu_modifier_groups where restaurant_id = public.my_restaurant_id()));
create policy "members read tables" on public.restaurant_tables for select using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write tables" on public.restaurant_tables for all using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));
create policy "members read orders" on public.orders for select using (restaurant_id = public.my_restaurant_id());
create policy "all staff write orders" on public.orders for all using (restaurant_id = public.my_restaurant_id());
create policy "members read order_items" on public.order_items for select using (order_id in (select id from public.orders where restaurant_id = public.my_restaurant_id()));
create policy "all staff write order_items" on public.order_items for all using (order_id in (select id from public.orders where restaurant_id = public.my_restaurant_id()));

create trigger trg_menu_items_updated_at before update on public.menu_items for each row execute function public.set_updated_at();
create trigger trg_orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
