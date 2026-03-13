-- ── 1. Tabell för push-prenumerationer ──────────────────
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid references players(id) on delete cascade,
  game_id    uuid references games(id)   on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now(),
  unique(endpoint)
);

alter table push_subscriptions enable row level security;
create policy "allow all" on push_subscriptions for all using (true) with check (true);


-- ── 2. Databas-trigger: skicka push när fas ändras ──────
-- Kräver att pg_net är aktiverat (är det i alla Supabase-projekt).
-- Ersätt <ANON_KEY> med din anon-nyckel nedan.

create or replace function notify_phase_change()
returns trigger as $$
begin
  if NEW.phase is distinct from OLD.phase
     and NEW.phase in ('voting', 'active', 'results') then
    perform net.http_post(
      url     := 'https://qfopolrxfnilhxzknmkl.supabase.co/functions/v1/send-push',
      body    := jsonb_build_object('game_id', NEW.id, 'phase', NEW.phase),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer sb_publishable_G1axvniFKDW0xQt94bhLYQ_CImljqte'
      )
    );
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_phase_change on games;
create trigger on_phase_change
  after update on games
  for each row execute function notify_phase_change();


-- ── 3. Supabase secrets att sätta via CLI eller Dashboard ──
-- supabase secrets set VAPID_PRIVATE_KEY=S4_hENzBsmEjP98cYxDZ4a8sXiLCpQRAaN_-BpWFt0g
