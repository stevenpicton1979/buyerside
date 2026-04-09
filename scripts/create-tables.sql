-- ============================================================
-- ClearOffer — Supabase schema
-- Project: dqzqqfcepsqhaxovneen
-- Run this in the Supabase SQL editor
-- ============================================================

-- Scout reports — email captures + conversion tracking
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

-- Add columns if table already exists from previous build
alter table scout_reports
  add column if not exists followup_sent boolean default false,
  add column if not exists converted_to_paid boolean default false;

-- Index for follow-up job: find reports not yet followed up, not yet paid
create index if not exists idx_scout_reports_followup
  on scout_reports (followup_sent, converted_to_paid, created_at);

-- Index for email lookup (one-free-per-email enforcement)
create index if not exists idx_scout_reports_email
  on scout_reports (email);

-- Suburb stats cache — populated monthly from PropTechData
-- Serves free report suburb stats without per-lookup PropTechData calls
create table if not exists suburb_stats_cache (
  id uuid default gen_random_uuid() primary key,
  suburb text not null,
  state text not null default 'QLD',
  median_house_price integer,
  median_dom integer,
  clearance_rate numeric,
  growth_12m numeric,
  cagr_10yr numeric,
  active_listings integer,
  updated_at timestamptz default now(),
  unique(suburb, state)
);

create index if not exists idx_suburb_stats_cache_lookup
  on suburb_stats_cache (suburb, state);
