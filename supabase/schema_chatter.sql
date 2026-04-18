-- ============================================================
-- BiteERP — Chatter & User Management
-- Run in Supabase SQL Editor
-- ============================================================

-- ── Extend profiles with more user data ──────────────────────
alter table public.profiles
  add column if not exists email           text,
  add column if not exists phone           text,
  add column if not exists job_title       text,
  add column if not exists last_seen_at    timestamptz,
  add column if not exists is_online       boolean default false,
  add column if not exists allowed_modules text[] default '{}',  -- empty = all modules
  add column if not exists avatar_color    text default '#0D7377';

-- ── User module permissions ───────────────────────────────────
-- Fine-grained: which modules a user can access
-- If empty array = inherits from role defaults
create table if not exists public.user_permissions (
  id              uuid primary key default uuid_generate_v4(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  module          text not null,   -- 'pos' | 'purchase' | 'inventory' | 'accounting' | etc.
  can_read        boolean default true,
  can_write       boolean default false,
  can_delete      boolean default false,
  unique (profile_id, restaurant_id, module)
);

-- ── Chatter messages ─────────────────────────────────────────
create table if not exists public.chatter_messages (
  id              uuid primary key default uuid_generate_v4(),
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  -- Optionally attached to a record
  record_type     text,    -- 'order' | 'invoice' | 'purchase_order' | 'general'
  record_id       uuid,    -- the specific record this message belongs to
  -- Message content
  author_id       uuid not null references auth.users(id),
  author_name     text not null,
  author_color    text default '#0D7377',
  message_type    text not null default 'comment',  -- comment | note | system
  content         text not null,
  mentions        uuid[] default '{}',  -- user IDs mentioned with @
  attachments     jsonb default '[]',
  edited          boolean default false,
  edited_at       timestamptz,
  -- Thread support
  parent_id       uuid references public.chatter_messages(id),
  created_at      timestamptz default now()
);

-- ── Chatter reads (unread tracking) ──────────────────────────
create table if not exists public.chatter_reads (
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  restaurant_id   uuid not null references public.restaurants(id) on delete cascade,
  last_read_at    timestamptz default now(),
  primary key (profile_id, restaurant_id)
);

-- ── RLS ───────────────────────────────────────────────────────
alter table public.user_permissions    enable row level security;
alter table public.chatter_messages    enable row level security;
alter table public.chatter_reads       enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='user_permissions' and policyname='members read user_permissions') then
    create policy "members read user_permissions" on public.user_permissions for select using (restaurant_id = public.my_restaurant_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='user_permissions' and policyname='owners write user_permissions') then
    create policy "owners write user_permissions" on public.user_permissions for all using (restaurant_id = public.my_restaurant_id() and public.my_role() = 'owner');
  end if;
  if not exists (select 1 from pg_policies where tablename='chatter_messages' and policyname='members read chatter') then
    create policy "members read chatter" on public.chatter_messages for select using (restaurant_id = public.my_restaurant_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='chatter_messages' and policyname='members write chatter') then
    create policy "members write chatter" on public.chatter_messages for insert with check (restaurant_id = public.my_restaurant_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='chatter_messages' and policyname='author edit chatter') then
    create policy "author edit chatter" on public.chatter_messages for update using (author_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='chatter_reads' and policyname='members chatter_reads') then
    create policy "members chatter_reads" on public.chatter_reads for all using (profile_id = auth.uid());
  end if;
end $$;

create index if not exists idx_chatter_restaurant  on public.chatter_messages(restaurant_id, created_at desc);
create index if not exists idx_chatter_record      on public.chatter_messages(record_type, record_id);
create index if not exists idx_chatter_mentions    on public.chatter_messages using gin(mentions);
