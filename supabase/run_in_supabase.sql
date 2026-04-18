-- Step 1: Create tables if missing
create table if not exists public.contacts (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null default 'customer',
  name text not null,
  company text, phone text, email text, address text, city text,
  country text default 'UAE', trn text, website text, birthday date, gender text,
  notes text, tags text[] default '{}', credit_limit numeric default 0,
  payment_terms int default 0, currency text default 'AED',
  opening_balance numeric default 0, loyalty_points int default 0,
  lifetime_spend numeric default 0, visit_count int default 0,
  last_visit_at timestamptz, tier text default 'bronze',
  active boolean default true, source text default 'manual',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.branches (
  id uuid primary key default uuid_generate_v4(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null, code text, address text, city text, phone text,
  manager_name text, is_main boolean default false, active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.company_groups (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id),
  name text not null, created_at timestamptz default now()
);

-- Step 2: Enable RLS
alter table public.contacts enable row level security;
alter table public.branches enable row level security;
alter table public.company_groups enable row level security;

-- Step 3: Wipe ALL existing policies on these tables
do $$ 
declare r record;
begin
  for r in select policyname from pg_policies where tablename in ('contacts','branches','company_groups') loop
    execute 'drop policy if exists "' || r.policyname || '" on public.' || 
      (select tablename from pg_policies where policyname = r.policyname limit 1);
  end loop;
end $$;

-- Step 4: Drop known policies explicitly (belt and suspenders)
drop policy if exists "contacts_select"          on public.contacts;
drop policy if exists "contacts_insert"          on public.contacts;
drop policy if exists "contacts_update"          on public.contacts;
drop policy if exists "contacts_delete"          on public.contacts;
drop policy if exists "members read contacts"    on public.contacts;
drop policy if exists "all staff write contacts" on public.contacts;
drop policy if exists "branches_select"          on public.branches;
drop policy if exists "branches_insert"          on public.branches;
drop policy if exists "branches_update"          on public.branches;
drop policy if exists "branches_delete"          on public.branches;
drop policy if exists "members read branches"    on public.branches;
drop policy if exists "managers write branches"  on public.branches;
drop policy if exists "groups_select"            on public.company_groups;
drop policy if exists "groups_insert"            on public.company_groups;
drop policy if exists "owner read company_groups" on public.company_groups;
drop policy if exists "owner write company_groups" on public.company_groups;

-- Step 5: Create correct policies
create policy "contacts_select" on public.contacts
  for select using (restaurant_id = public.my_restaurant_id());
create policy "contacts_insert" on public.contacts
  for insert with check (restaurant_id = public.my_restaurant_id());
create policy "contacts_update" on public.contacts
  for update using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());
create policy "contacts_delete" on public.contacts
  for delete using (restaurant_id = public.my_restaurant_id());

create policy "branches_select" on public.branches
  for select using (restaurant_id = public.my_restaurant_id());
create policy "branches_insert" on public.branches
  for insert with check (restaurant_id = public.my_restaurant_id());
create policy "branches_update" on public.branches
  for update using (restaurant_id = public.my_restaurant_id());
create policy "branches_delete" on public.branches
  for delete using (restaurant_id = public.my_restaurant_id());

create policy "groups_select" on public.company_groups
  for select using (owner_id = auth.uid());
create policy "groups_insert" on public.company_groups
  for insert with check (owner_id = auth.uid());
create policy "groups_update" on public.company_groups
  for update using (owner_id = auth.uid());
create policy "groups_delete" on public.company_groups
  for delete using (owner_id = auth.uid());

select 'Done! Tables and policies created successfully.' as result;
