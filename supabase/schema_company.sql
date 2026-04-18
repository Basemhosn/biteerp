-- ============================================================
-- BiteERP Company Profile Extension
-- Run in Supabase SQL Editor
-- ============================================================
alter table public.restaurants
  add column if not exists trade_name     text,
  add column if not exists trn            text,
  add column if not exists address_line1  text,
  add column if not exists address_line2  text,
  add column if not exists phone          text,
  add column if not exists email          text,
  add column if not exists website        text,
  add column if not exists logo_url       text,
  add column if not exists bank_name      text,
  add column if not exists bank_iban      text,
  add column if not exists bank_swift     text,
  add column if not exists po_terms       text default 'Payment due within 30 days of invoice.',
  add column if not exists po_notes       text,
  add column if not exists next_po_number int  default 1,
  add column if not exists po_prefix      text default 'PO',
  add column if not exists quote_prefix   text default 'QT';
