import webpush from "npm:web-push";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = "BAARI6S69neZkeZ1Pr5hUHHFse7UmwAyY36tjeT9j9Qcq9Qq4rorsubBPXF4OLbQqjtzyAXgjfKC4P1G8ZS84P0";

const MESSAGES: Record<string, { title: string; body: string }> = {
  voting:    { title: "🗳️ Dags att rösta!", body: "Alla har skickat in – gå in och rösta nu!" },
  active:    { title: "📸 Ny utmaning!", body: "En ny fotoutmaning väntar. Kolla in den!" },
  challenge: { title: "📸 Ny utmaning!", body: "En ny fotoutmaning väntar. Kolla in den!" },
  results:   { title: "🏆 Röstningen är klar!", body: "Kolla in resultatet – vem vann?" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { game_id, phase } = await req.json();

    webpush.setVapidDetails(
      "mailto:noreply@areolympiaden.local",
      VAPID_PUBLIC,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("game_id", game_id);

    const msg = MESSAGES[phase] ?? { title: "Åre Olympiaden", body: "Något nytt har hänt!" };
    const payload = JSON.stringify({ ...msg, url: "https://pauwntus.github.io/BigBoysBildBevis/" });

    const results = await Promise.allSettled(
      (subs ?? []).map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        )
      )
    );

    const failed = results.filter(r => r.status === "rejected").length;
    return new Response(JSON.stringify({ sent: results.length - failed, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
