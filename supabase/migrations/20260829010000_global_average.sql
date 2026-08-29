-- LinkedIn publishes a community average on each game's results page
-- ("Today's avg"). Capture stores it on the puzzle and on each snapshot.

alter table public.puzzles
  add column if not exists global_average_ms integer;

alter table public.snapshots
  add column if not exists global_average_ms integer;
