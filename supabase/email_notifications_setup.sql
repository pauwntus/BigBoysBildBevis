-- ── 1. Lägg till e-post på players ────────────────────
alter table players add column if not exists email text;


-- ── 2. Uppdatera trigger för att även skicka e-post ───
-- Ersätter den befintliga notify_phase_change-funktionen
-- och lägger till ett anrop till send-email utöver send-push.

create or replace function notify_phase_change()
returns trigger as $$
begin
  if NEW.phase is distinct from OLD.phase
     and NEW.phase in ('voting', 'active', 'results') then

    -- Push-notiser (befintlig)
    perform net.http_post(
      url     := 'https://qfopolrxfnilhxzknmkl.supabase.co/functions/v1/send-push',
      body    := jsonb_build_object('game_id', NEW.id, 'phase', NEW.phase),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );

    -- E-postnotiser (ny)
    perform net.http_post(
      url     := 'https://qfopolrxfnilhxzknmkl.supabase.co/functions/v1/send-email',
      body    := jsonb_build_object('game_id', NEW.id, 'phase', NEW.phase),
      headers := jsonb_build_object('Content-Type', 'application/json')
    );

  end if;
  return NEW;
end;
$$ language plpgsql security definer;
