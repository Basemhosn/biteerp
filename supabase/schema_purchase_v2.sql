-- ============================================================
-- BiteERP Purchase v2 — Quotations, POs, Receipts
-- Run AFTER schema_inventory.sql
-- ============================================================

-- Add quotation fields to purchase_orders
alter table public.purchase_orders
  add column if not exists doc_type       text not null default 'po',  -- 'quotation' | 'po'
  add column if not exists quote_number   text,
  add column if not exists currency       text default 'AED',
  add column if not exists payment_terms  text,
  add column if not exists delivery_address text,
  add column if not exists confirmed_at   timestamptz,
  add column if not exists confirmed_by   uuid references auth.users(id);

-- Receipts (Goods Receipt Notes)
create table if not exists public.receipts (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  po_id           uuid references public.purchase_orders(id),
  receipt_number  text not null,
  status          text not null default 'draft', -- draft | validated | cancelled
  receipt_date    date not null default current_date,
  supplier_id     uuid references public.suppliers(id),
  notes           text,
  validated_by    uuid references auth.users(id),
  validated_at    timestamptz,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Receipt lines
create table if not exists public.receipt_lines (
  id              uuid primary key default uuid_generate_v4(),
  receipt_id      uuid not null references public.receipts(id) on delete cascade,
  po_line_id      uuid references public.po_lines(id),
  ingredient_id   uuid references public.ingredients(id),
  description     text not null,
  qty_expected    numeric default 0,
  qty_received    numeric not null default 0,
  unit            text not null default 'kg',
  unit_cost       numeric not null default 0,
  total_cost      numeric not null default 0,
  sort_order      int default 0
);

-- RLS
alter table public.receipts      enable row level security;
alter table public.receipt_lines enable row level security;

create policy "members read receipts"      on public.receipts for select using (restaurant_id = public.my_restaurant_id());
create policy "managers+ write receipts"   on public.receipts for all    using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));
create policy "members read receipt_lines" on public.receipt_lines for select using (receipt_id in (select id from public.receipts where restaurant_id = public.my_restaurant_id()));
create policy "managers+ write receipt_lines" on public.receipt_lines for all using (receipt_id in (select id from public.receipts where restaurant_id = public.my_restaurant_id()));

create trigger trg_receipts_updated_at before update on public.receipts for each row execute function public.set_updated_at();
