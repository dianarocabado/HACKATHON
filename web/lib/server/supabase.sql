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

-- Optional accounts: what a signed-in user did (report / claim / support / done). Users themselves live in
-- Supabase Auth. Deleting the account deletes this history; the reports stay, without any link to the person.
-- RLS on and no policies: only the server (secret key) can read or write it.
create table if not exists activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('report', 'claim', 'support', 'done')),
  ref text not null,                          -- report id or mission id
  created_at timestamptz not null default now()
);
create index if not exists activity_user_idx on activity (user_id, created_at);
alter table activity enable row level security;
