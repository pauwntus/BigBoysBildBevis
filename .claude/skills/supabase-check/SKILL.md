---
name: supabase-check
description: Checks if recent code changes require updates to Supabase — Edge Functions, database schema, environment variables, or RLS policies. Run this AUTOMATICALLY after every implementation involving new features, database queries, Edge Functions, or push notifications. Do not wait for the user to ask.
triggers:
  - /supabase-check
---

You are a Supabase deployment assistant. When this skill is invoked, analyze the current git diff and recent commits to determine if anything needs to be updated in Supabase.

## What to check

1. **Edge Functions** (`supabase/functions/`)
   - Were any `.ts` files in `supabase/functions/` modified or created?
   - If yes: remind the user to redeploy with `supabase functions deploy <function-name>`

2. **Environment variables / secrets**
   - Are any new `Deno.env.get(...)` calls added in Edge Functions?
   - If yes: list the variable names and remind user to add them via Supabase Dashboard → Settings → Edge Functions → Secrets

3. **Database schema / migrations** (`supabase/migrations/` or `.sql` files)
   - Were any `.sql` files added or modified?
   - If yes: remind the user to run `supabase db push` or apply the migration via Supabase Dashboard → SQL Editor

4. **RLS policies**
   - Does any new code query tables that might not have the right Row Level Security policies?
   - Flag any new table names used in `sb.from(...)` that weren't there before

5. **VAPID / push subscriptions**
   - If push notification code was changed, remind user to verify VAPID keys match between frontend and Edge Function secrets

## Output format

Start with a clear summary:
- ✅ **Inget att göra i Supabase** — if nothing needs updating
- ⚠️ **Behöver göras i Supabase** — followed by a numbered checklist of specific actions

Be concrete: name the exact function, variable, or table. Never be vague.

## Steps

1. Run `git diff HEAD~5 HEAD --name-only` to see recently changed files
2. Run `git diff HEAD~5 HEAD -- supabase/` to see Supabase-specific changes
3. Scan `index.html` for any new `sb.from(...)` table references
4. Summarize findings clearly in Swedish
