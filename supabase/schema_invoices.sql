-- ============================================================
-- BiteERP — Invoices & Bills
-- Run this in Supabase SQL Editor
-- ============================================================

create table if not exists public.invoices (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  type            text not null default 'invoice',
  number          text not null,
  contact_id      uuid references public.contacts(id),
  partner_name    text,
  invoice_date    date,
  due_date        date,
  subtotal        numeric default 0,
  vat_amount      numeric default 0,
  total           numeric default 0,
  status          text default 'draft',
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists public.invoice_lines (
  id              uuid primary key default uuid_generate_v4(),
  invoice_id      uuid not null references public.invoices(id) on delete cascade,
  product_name    text,
  account_ref     text,
  quantity        numeric default 1,
  unit_price      numeric default 0,
  subtotal        numeric default 0,
  uom             text default 'Units',
  notes           text
);

alter table public.invoices       enable row level security;
alter table public.invoice_lines  enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='invoices' and policyname='members read invoices') then
    create policy "members read invoices" on public.invoices for select using (restaurant_id = public.my_restaurant_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='invoices' and policyname='all staff write invoices') then
    create policy "all staff write invoices" on public.invoices for all using (restaurant_id = public.my_restaurant_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='invoice_lines' and policyname='members read invoice_lines') then
    create policy "members read invoice_lines" on public.invoice_lines for select using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
  end if;
  if not exists (select 1 from pg_policies where tablename='invoice_lines' and policyname='all staff write invoice_lines') then
    create policy "all staff write invoice_lines" on public.invoice_lines for all using (invoice_id in (select id from public.invoices where restaurant_id = public.my_restaurant_id()));
  end if;
end $$;

create index if not exists idx_invoices_type    on public.invoices(restaurant_id, type);
create index if not exists idx_invoices_contact on public.invoices(contact_id);
create index if not exists idx_invoices_status  on public.invoices(restaurant_id, status);
