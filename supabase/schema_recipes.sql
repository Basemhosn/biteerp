-- ============================================================
-- BiteERP Recipe Engine Schema
-- Run in Supabase SQL Editor AFTER schema.sql and schema_pos.sql
-- ============================================================

-- ── Ingredients / Raw Materials ──────────────────────────────
create table public.ingredients (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  name            text not null,
  category        text default 'General',     -- Meat, Dairy, Produce, Dry Goods, etc.
  unit            text not null default 'kg', -- kg, g, L, ml, pcs, box, bag
  cost_per_unit   numeric not null default 0, -- cost in AED per unit
  stock_qty       numeric default 0,          -- current stock level
  min_stock       numeric default 0,          -- reorder point
  supplier_id     uuid references public.suppliers(id),
  barcode         text,
  notes           text,
  active          boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Recipes ──────────────────────────────────────────────────
create table public.recipes (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  name            text not null,
  type            text not null default 'recipe', -- 'recipe' | 'sub_recipe'
  category        text,
  description     text,
  yield_qty       numeric not null default 1,     -- how many portions/units this recipe makes
  yield_unit      text not null default 'portion',
  prep_time_mins  int default 0,
  cook_time_mins  int default 0,
  instructions    text,
  image_url       text,
  active          boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ── Recipe Lines (ingredients + sub-recipes used in a recipe) ─
create table public.recipe_lines (
  id              uuid primary key default uuid_generate_v4(),
  recipe_id       uuid not null references public.recipes(id) on delete cascade,
  -- Either ingredient_id OR sub_recipe_id is set, not both
  ingredient_id   uuid references public.ingredients(id) on delete set null,
  sub_recipe_id   uuid references public.recipes(id) on delete set null,
  quantity        numeric not null default 0,
  unit            text,   -- overrides ingredient unit if different (e.g. g vs kg)
  notes           text,
  sort_order      int default 0,
  created_at      timestamptz default now(),
  constraint recipe_line_has_source check (
    (ingredient_id is not null and sub_recipe_id is null) or
    (ingredient_id is null and sub_recipe_id is not null)
  )
);

-- ── Menu Item → Recipe link ───────────────────────────────────
create table public.menu_item_recipes (
  id              uuid primary key default uuid_generate_v4(),
  menu_item_id    uuid not null references public.menu_items(id) on delete cascade,
  recipe_id       uuid not null references public.recipes(id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  portions        numeric not null default 1, -- how many recipe portions per menu item sold
  unique (menu_item_id, recipe_id)
);

-- ── Production Log ────────────────────────────────────────────
create table public.production_log (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  recipe_id       uuid not null references public.recipes(id) on delete cascade,
  qty_produced    numeric not null default 1,  -- number of portions/batches made
  batch_notes     text,
  produced_by     uuid references auth.users(id),
  produced_at     timestamptz default now(),
  total_cost      numeric default 0,           -- computed at time of production
  created_at      timestamptz default now()
);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.ingredients        enable row level security;
alter table public.recipes            enable row level security;
alter table public.recipe_lines       enable row level security;
alter table public.menu_item_recipes  enable row level security;
alter table public.production_log     enable row level security;

-- Ingredients
create policy "members read ingredients"
  on public.ingredients for select
  using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write ingredients"
  on public.ingredients for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

-- Recipes
create policy "members read recipes"
  on public.recipes for select
  using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write recipes"
  on public.recipes for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

-- Recipe lines
create policy "members read recipe_lines"
  on public.recipe_lines for select
  using (recipe_id in (
    select id from public.recipes where restaurant_id = public.my_restaurant_id()
  ));
create policy "managers+ write recipe_lines"
  on public.recipe_lines for all
  using (recipe_id in (
    select id from public.recipes where restaurant_id = public.my_restaurant_id()
  ));

-- Menu item recipes
create policy "members read menu_item_recipes"
  on public.menu_item_recipes for select
  using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write menu_item_recipes"
  on public.menu_item_recipes for all
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

-- Production log
create policy "members read production_log"
  on public.production_log for select
  using (restaurant_id = public.my_restaurant_id());
create policy "all staff write production_log"
  on public.production_log for all
  using (restaurant_id = public.my_restaurant_id());

-- Triggers
create trigger trg_ingredients_updated_at
  before update on public.ingredients
  for each row execute function public.set_updated_at();

create trigger trg_recipes_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();
