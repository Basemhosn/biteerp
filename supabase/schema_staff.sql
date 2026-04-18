-- BiteERP Staff / HR module
create table if not exists public.staff (
  id                  uuid primary key default uuid_generate_v4(),
  restaurant_id       uuid not null references public.restaurants(id) on delete cascade,
  full_name           text not null,
  position            text,
  department          text default 'Restaurant',
  nationality         text,
  phone               text,
  email               text,
  passport_number     text,
  visa_expiry         date,
  contract_start      date,
  contract_end        date,
  basic_salary        numeric,
  housing_allowance   numeric default 0,
  transport_allowance numeric default 0,
  food_allowance      numeric default 0,
  other_allowance     numeric default 0,
  bank_name           text,
  bank_account        text,
  iban                text,
  notes               text,
  active              boolean default true,
  created_at          timestamptz default now()
);

alter table public.staff enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='staff' and policyname='members read staff') then
    create policy "members read staff" on public.staff for select using (restaurant_id = public.my_restaurant_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='staff' and policyname='managers write staff') then
    create policy "managers write staff" on public.staff for all using (restaurant_id = public.my_restaurant_id() and public.my_role() in ('owner','manager'));
  end if;
end $$;

create index if not exists idx_staff_restaurant on public.staff(restaurant_id);

-- Add reconciliation columns to journal_entries
alter table public.journal_entries
  add column if not exists reconciled     boolean default false,
  add column if not exists reconciled_ref text;

-- Add lang_preference to profiles
alter table public.profiles
  add column if not exists lang_preference text default 'en';
