-- Run this in the Supabase SQL editor after the init migration.
-- RLS is on; the Next.js server uses the service role, so there are no anon policies.

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  start_date date not null,
  end_date date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint seasons_dates_ok check (end_date is null or end_date >= start_date)
);

create unique index seasons_one_active_idx
  on public.seasons (is_active)
  where is_active;

create index seasons_start_idx on public.seasons (start_date desc);

alter table public.seasons enable row level security;

create function public.seasons_deactivate_others()
returns trigger
language plpgsql
as $$
begin
  if new.is_active then
    update public.seasons
      set is_active = false
      where is_active
        and id is distinct from new.id;
  end if;
  return new;
end;
$$;

create trigger seasons_single_active
before insert or update of is_active on public.seasons
for each row
when (new.is_active)
execute procedure public.seasons_deactivate_others();

insert into public.seasons (slug, name, start_date, is_active)
values ('2026-s1', 'Season 1', '2026-08-31', true);
