-- A8: Supabase schema. Run once in the Supabase SQL editor.
-- Each row stores the full contract object (contracts/types.ts) in `data`.

create table if not exists reports (
  id text primary key,
  created_at timestamptz not null default now(),
  data jsonb not null                         -- Report
);
create index if not exists reports_created_at_idx on reports (created_at);

create table if not exists mission_states (
  mission_id text primary key,
  updated_at timestamptz not null default now(),
  data jsonb not null                         -- MissionState
);

-- The server uses the service-role key, which bypasses RLS. Enable RLS so the public anon key
-- cannot write; allow anonymous reads of reports for the live big-screen feed.
alter table reports enable row level security;
alter table mission_states enable row level security;
drop policy if exists "public read reports" on reports;
create policy "public read reports" on reports for select using (true);
drop policy if exists "public read mission states" on mission_states;
create policy "public read mission states" on mission_states for select using (true);
