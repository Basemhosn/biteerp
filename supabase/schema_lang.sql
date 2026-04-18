-- Add language preference to user profiles
alter table public.profiles
  add column if not exists lang_preference text default 'en';
