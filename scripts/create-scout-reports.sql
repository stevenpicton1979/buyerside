-- ClearOffer — scout_reports table migration
-- Run this in the Supabase SQL editor for project: dqzqqfcepsqhaxovneen
-- URL: https://supabase.com/dashboard/project/dqzqqfcepsqhaxovneen/editor

-- Create table if it does not exist (safe to run even if table already exists)
create table if not exists scout_reports (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  address text not null,
  created_at timestamptz default now(),
  report_data jsonb,
  followup_sent boolean default false,
  converted_to_paid boolean default false,
  unique(email, address)
);

-- Add missing columns to existing table (idempotent — safe to re-run)
alter table scout_reports
  add column if not exists followup_sent boolean default false,
  add column if not exists converted_to_paid boolean default false;

-- Add unique constraint if it doesn't already exist
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'scout_reports_email_address_key'
    and conrelid = 'scout_reports'::regclass
  ) then
    alter table scout_reports add constraint scout_reports_email_address_key unique (email, address);
  end if;
end$$;
