-- Run this in the Supabase SQL editor (or `supabase db push` after linking).
-- RLS is on; the Next.js server uses the service role, so there are no anon policies.

create extension if not exists pgcrypto;

create table public.players (
  id uuid primary key default gen_random_uuid(),
  linkedin_urn text unique,
  profile_url text unique,
  profile_id text unique,
  display_name text not null,
  avatar_url text,
  is_tracked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.puzzles (
  id uuid primary key default gen_random_uuid(),
  game text not null default 'queens',
  puzzle_date date not null,
  puzzle_number integer,
  global_average_ms integer,
  created_at timestamptz not null default now(),
  unique (game, puzzle_date)
);

create table public.snapshots (
  id uuid primary key default gen_random_uuid(),
  puzzle_id uuid not null references public.puzzles (id) on delete cascade,
  captured_at timestamptz not null default now(),
  kind text not null default 'manual'
    check (kind in ('scheduled_final', 'scheduled_midday', 'manual')),
  status text not null default 'success'
    check (status in ('success', 'partial', 'failed')),
  visible_count integer not null default 0,
  global_average_ms integer,
  raw_json jsonb not null default '{}'::jsonb
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.snapshots (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  linkedin_rank integer,
  time_ms integer,
  visibility text not null default 'score'
    check (visibility in ('score', 'played_only')),
  no_hints boolean,
  no_mistakes boolean,
  unique (snapshot_id, player_id)
);

create index players_tracked_idx on public.players (is_tracked);
create index snapshots_puzzle_idx on public.snapshots (puzzle_id, captured_at desc);
create index scores_snapshot_idx on public.scores (snapshot_id);
create index puzzles_date_idx on public.puzzles (puzzle_date desc);

alter table public.players enable row level security;
alter table public.puzzles enable row level security;
alter table public.snapshots enable row level security;
alter table public.scores enable row level security;
