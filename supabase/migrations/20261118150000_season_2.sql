-- Close Season 1 the day before Season 2 starts, then open Season 2.
-- The single-active trigger clears is_active on every other season.

update public.seasons
set end_date = '2026-11-17'
where slug = '2026-s1'
  and end_date is null;

insert into public.seasons (slug, name, start_date, is_active)
values ('2026-s2', 'Season 2', '2026-11-18', true)
on conflict (slug) do update
set
  name = excluded.name,
  start_date = excluded.start_date,
  end_date = null,
  is_active = true;
