-- ============================================================
-- BiteERP Sprint 3 — Permissions & Audit Trail
-- Run in Supabase SQL Editor
-- ============================================================

-- ── POS Permission settings ──────────────────────────────────
create table if not exists public.pos_permissions (
  id                    uuid primary key default uuid_generate_v4(),
  restaurant_id         uuid not null references public.restaurants(id) on delete cascade unique,
  -- Discount gates
  max_discount_cashier  numeric default 10,    -- max % a cashier can apply without override
  max_discount_manager  numeric default 100,   -- max % a manager can apply
  require_override_void    boolean default true,  -- void requires manager override
  require_override_refund  boolean default true,  -- refund requires manager override
  require_override_discount boolean default true, -- discount > max_discount_cashier needs override
  require_override_price_edit boolean default false,
  -- Manager PIN (4-digit)
  manager_pin           text default '0000',
  -- Cashier settings
  cashier_can_reopen    boolean default false,  -- cashier can reopen closed orders
  cashier_can_delete_item boolean default true, -- cashier can remove items before firing
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- ── Extend audit_log with more fields ───────────────────────
alter table public.audit_log
  add column if not exists override_by    uuid references auth.users(id),
  add column if not exists override_name  text,
  add column if not exists session_id     uuid;  -- links to cash_session

-- ── RLS ───────────────────────────────────────────────────────
alter table public.pos_permissions enable row level security;
create policy "members read pos_permissions"   on public.pos_permissions for select using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write pos_permissions"on public.pos_permissions for all   using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));

create trigger trg_pos_permissions_updated_at before update on public.pos_permissions for each row execute function public.set_updated_at();

-- Default permissions row for existing restaurants
-- (run manually per restaurant or via app on first load)

-- ── Hardware config (receipt printer + payment gateway) ───────
alter table public.restaurants
  add column if not exists hardware_config jsonb default '{}';
