-- ============================================================
-- BiteERP Sprint 1 — FTA compliance + auto-posting
-- Run in Supabase SQL Editor
-- ============================================================

-- ── FTA Invoice numbering ────────────────────────────────────
-- Each restaurant gets a sequential invoice counter
alter table public.restaurants
  add column if not exists next_invoice_number  int  default 1,
  add column if not exists invoice_prefix        text default 'INV',
  add column if not exists vat_return_period     text default 'quarterly'; -- monthly | quarterly

-- ── Extend orders with FTA fields ───────────────────────────
alter table public.orders
  add column if not exists invoice_number     text,       -- e.g. INV-0001
  add column if not exists invoice_issued_at  timestamptz,
  add column if not exists vat_number         text,       -- buyer's TRN (for B2B)
  add column if not exists is_credit_note     boolean default false,
  add column if not exists original_order_id  uuid references public.orders(id);

-- ── Extend order_items with VAT breakdown ───────────────────
alter table public.order_items
  add column if not exists tax_rate    numeric default 5,
  add column if not exists tax_amount  numeric default 0,
  add column if not exists net_amount  numeric default 0;  -- price before VAT

-- ── Audit log ────────────────────────────────────────────────
create table if not exists public.audit_log (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  user_id         uuid references auth.users(id),
  user_name       text,
  action          text not null,      -- 'order_closed' | 'order_voided' | 'refund_issued' | 'discount_applied' | 'stock_adjusted' | 'journal_posted'
  entity_type     text not null,      -- 'order' | 'refund' | 'stock_movement' | 'journal_entry'
  entity_id       uuid,
  details         jsonb default '{}', -- flexible metadata
  ip_address      text,
  created_at      timestamptz default now()
);

alter table public.audit_log enable row level security;
create policy "managers read audit_log"  on public.audit_log for select using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));
create policy "system write audit_log"   on public.audit_log for insert with check (restaurant_id = public.my_restaurant_id());

-- Index for fast audit queries
create index if not exists idx_audit_log_restaurant on public.audit_log(restaurant_id, created_at desc);
create index if not exists idx_audit_log_entity     on public.audit_log(entity_type, entity_id);
create index if not exists idx_orders_invoice       on public.orders(restaurant_id, invoice_number) where invoice_number is not null;

-- ── Auto-posting function ────────────────────────────────────
-- Called when an order is closed — posts journal entries automatically
create or replace function public.auto_post_pos_sale(
  p_order_id       uuid,
  p_restaurant_id  uuid,
  p_user_id        uuid
) returns uuid language plpgsql security definer as $$
declare
  v_order          record;
  v_accounts       jsonb;
  v_entry_id       uuid;
  v_entry_number   text;
  v_count          int;
  v_period_id      uuid;
  v_year           int;
  v_month          int;
  -- Account IDs
  v_cash_id        uuid;
  v_revenue_id     uuid;
  v_vat_id         uuid;
  v_cogs_id        uuid;
  v_inventory_id   uuid;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then return null; end if;
  if v_order.total <= 0 then return null; end if;

  -- Get or create accounting period
  v_year  := extract(year  from now());
  v_month := extract(month from now());
  insert into public.accounting_periods (restaurant_id, year, month, status)
    values (p_restaurant_id, v_year, v_month, 'open')
    on conflict (restaurant_id, year, month) do nothing;
  select id into v_period_id from public.accounting_periods
    where restaurant_id = p_restaurant_id and year = v_year and month = v_month;

  -- Get account IDs
  select id into v_cash_id      from public.accounts where restaurant_id = p_restaurant_id and code = '1010' limit 1;
  select id into v_revenue_id   from public.accounts where restaurant_id = p_restaurant_id and code = '4000' limit 1;
  select id into v_vat_id       from public.accounts where restaurant_id = p_restaurant_id and code = '2100' limit 1;
  select id into v_cogs_id      from public.accounts where restaurant_id = p_restaurant_id and code = '5000' limit 1;
  select id into v_inventory_id from public.accounts where restaurant_id = p_restaurant_id and code = '1200' limit 1;

  -- Only post if chart of accounts is set up
  if v_cash_id is null or v_revenue_id is null then return null; end if;

  -- Generate entry number
  select count(*) into v_count from public.journal_entries where restaurant_id = p_restaurant_id;
  v_entry_number := 'JE-' || lpad((v_count + 1)::text, 5, '0');

  -- Insert journal entry
  insert into public.journal_entries (
    restaurant_id, entry_number, entry_date, description,
    source, reference_id, period_id, posted, created_by
  ) values (
    p_restaurant_id, v_entry_number, current_date,
    'POS Sale — Order #' || v_order.order_number || ' (' || v_order.payment_method || ')',
    'pos_sale', p_order_id, v_period_id, true, p_user_id
  ) returning id into v_entry_id;

  -- Dr Cash / Card  |  Cr Revenue (net) + Cr VAT Payable
  insert into public.journal_lines (entry_id, account_id, description, debit, credit, sort_order) values
    (v_entry_id, v_cash_id,    'Cash/card received',      v_order.total,       0,                    1),
    (v_entry_id, v_revenue_id, 'Sales revenue (net)',      0,                   v_order.subtotal - coalesce(v_order.discount,0), 2);

  if v_vat_id is not null then
    insert into public.journal_lines (entry_id, account_id, description, debit, credit, sort_order) values
      (v_entry_id, v_vat_id, 'VAT payable 5%', 0, v_order.vat_amount, 3);
  end if;

  -- Dr COGS  |  Cr Inventory (if we have the accounts and recipe costs)
  if v_cogs_id is not null and v_inventory_id is not null then
    declare
      v_total_cost numeric;
    begin
      select coalesce(sum(cost * quantity), 0) into v_total_cost
        from public.order_items where order_id = p_order_id;
      if v_total_cost > 0 then
        insert into public.journal_lines (entry_id, account_id, description, debit, credit, sort_order) values
          (v_entry_id, v_cogs_id,      'Cost of goods sold', v_total_cost, 0,            4),
          (v_entry_id, v_inventory_id, 'Inventory consumed', 0,            v_total_cost, 5);
      end if;
    end;
  end if;

  -- Audit log
  insert into public.audit_log (restaurant_id, user_id, action, entity_type, entity_id, details)
    values (p_restaurant_id, p_user_id, 'order_closed', 'order', p_order_id,
      jsonb_build_object('order_number', v_order.order_number, 'total', v_order.total, 'payment_method', v_order.payment_method));

  return v_entry_id;
end;
$$;
