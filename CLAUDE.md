# BigBoysBildBevis – instruktioner för Claude

## Automatiska kontroller

Efter varje implementation som rör ny funktionalitet, fas-övergångar, notiser, databasanrop eller Edge Functions: kör `/supabase-check` automatiskt och redovisa resultatet för användaren.

## Supabase-preferenser

Användaren hanterar Supabase via **Dashboard** (inte CLI). Instruktioner ska alltid referera till Dashboard-vägen:
- Edge Functions: Dashboard → Edge Functions
- Secrets/env-variabler: Dashboard → Settings → Edge Functions → Secrets
- SQL/migrationer: Dashboard → SQL Editor
- JWT verification: Dashboard → Edge Functions → [funktion] → Details → JWT verification toggle
- Inga `supabase` CLI-kommandon om inte användaren explicit ber om det
