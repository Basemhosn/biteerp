-- ============================================================
-- BiteERP — Fix RLS policies for contacts, invoices, staff
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── Contacts ─────────────────────────────────────────────────
drop policy if exists "members read contacts"    on public.contacts;
drop policy if exists "all staff write contacts" on public.contacts;

create policy "members read contacts"
  on public.contacts for select
  using (restaurant_id = public.my_restaurant_id());

create policy "all staff write contacts"
  on public.contacts for insert
  with check (restaurant_id = public.my_restaurant_id());

create policy "all staff update contacts"
  on public.contacts for update
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

create policy "all staff delete contacts"
  on public.contacts for delete
  using (restaurant_id = public.my_restaurant_id());

-- ── Partner ledger ────────────────────────────────────────────
drop policy if exists "members read partner_ledger"    on public.partner_ledger;
drop policy if exists "managers+ write partner_ledger" on public.partner_ledger;

create policy "members read partner_ledger"
  on public.partner_ledger for select
  using (restaurant_id = public.my_restaurant_id());

create policy "all staff write partner_ledger"
  on public.partner_ledger for insert
  with check (restaurant_id = public.my_restaurant_id());

create policy "all staff update partner_ledger"
  on public.partner_ledger for update
  using (restaurant_id = public.my_restaurant_id());

-- ── Invoices ──────────────────────────────────────────────────
drop policy if exists "members read invoices"    on public.invoices;
drop policy if exists "all staff write invoices" on public.invoices;

create policy "members read invoices"
  on public.invoices for select
  using (restaurant_id = public.my_restaurant_id());

create policy "all staff insert invoices"
  on public.invoices for insert
  with check (restaurant_id = public.my_restaurant_id());

create policy "all staff update invoices"
  on public.invoices for update
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

create policy "all staff delete invoices"
  on public.invoices for delete
  using (restaurant_id = public.my_restaurant_id());

-- ── Invoice lines ─────────────────────────────────────────────
drop policy if exists "members read invoice_lines"    on public.invoice_lines;
drop policy if exists "all staff write invoice_lines" on public.invoice_lines;

create policy "members read invoice_lines"
  on public.invoice_lines for select
  using (invoice_id in (
    select id from public.invoices
    where restaurant_id = public.my_restaurant_id()
  ));

create policy "all staff insert invoice_lines"
  on public.invoice_lines for insert
  with check (invoice_id in (
    select id from public.invoices
    where restaurant_id = public.my_restaurant_id()
  ));

create policy "all staff update invoice_lines"
  on public.invoice_lines for update
  using (invoice_id in (
    select id from public.invoices
    where restaurant_id = public.my_restaurant_id()
  ));

create policy "all staff delete invoice_lines"
  on public.invoice_lines for delete
  using (invoice_id in (
    select id from public.invoices
    where restaurant_id = public.my_restaurant_id()
  ));

-- ── Staff ─────────────────────────────────────────────────────
drop policy if exists "members read staff"   on public.staff;
drop policy if exists "managers write staff" on public.staff;

create policy "members read staff"
  on public.staff for select
  using (restaurant_id = public.my_restaurant_id());

create policy "managers insert staff"
  on public.staff for insert
  with check (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

create policy "managers update staff"
  on public.staff for update
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

create policy "managers delete staff"
  on public.staff for delete
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

-- ── Branches ─────────────────────────────────────────────────
drop policy if exists "members read branches"   on public.branches;
drop policy if exists "managers write branches" on public.branches;

create policy "members read branches"
  on public.branches for select
  using (restaurant_id = public.my_restaurant_id());

create policy "managers insert branches"
  on public.branches for insert
  with check (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

create policy "managers update branches"
  on public.branches for update
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));

create policy "managers delete branches"
  on public.branches for delete
  using (restaurant_id = public.my_restaurant_id()
    and public.my_role() in ('owner','manager'));
