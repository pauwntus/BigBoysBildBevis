import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MESSAGES: Record<string, { subject: string; heading: string; body: string }> = {
  voting: {
    subject: "🗳️ Dags att rösta!",
    heading: "Dags att rösta!",
    body: "Alla har skickat in sina bilder – nu är det din tur att rösta. Gå in i spelet och kör!",
  },
  active: {
    subject: "📸 Ny utmaning!",
    heading: "Ny fotoutmaning!",
    body: "En ny utmaning har startat. Öppna appen och leverera ditt bästa bevis!",
  },
  results: {
    subject: "🏆 Röstningen är klar!",
    heading: "Resultaten är inne!",
    body: "Röstningen är avgjord – kolla in resultatet och se vem som vann!",
  },
};

const APP_BASE = "https://pauwntus.github.io/BigBoysBildBevis/";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { game_id, phase } = await req.json();

    const msg = MESSAGES[phase];
    if (!msg) {
      return new Response(JSON.stringify({ skipped: true, reason: "no message for phase" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: game }, { data: players }] = await Promise.all([
      sb.from("games").select("code").eq("id", game_id).single(),
      sb.from("players").select("name, email").eq("game_id", game_id).not("email", "is", null),
    ]);

    const recipients = (players ?? []).filter((p) => p.email);
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no email recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

    const results = await Promise.allSettled(
      recipients.map((player) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Big Boys BildBevis <noreply@jonestrom.com>",
            to: [player.email],
            subject: msg.subject,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#1a1a1a;color:#f5f0e8;padding:32px;border-radius:12px;">
                <h1 style="font-size:28px;margin:0 0 8px;color:#ff4d00;">${msg.heading}</h1>
                <p style="margin:0 0 24px;color:#aaa;">Hej ${player.name}!</p>
                <p style="margin:0 0 32px;font-size:16px;">${msg.body}</p>
                <a href="${APP_BASE}?code=${game?.code}" style="display:inline-block;background:#ff4d00;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:bold;font-size:16px;">
                  Gå till lobby ${game?.code} →
                </a>
              </div>
            `,
          }),
        }).then(async (r) => {
          if (!r.ok) {
            const err = await r.text();
            throw new Error(`Resend error ${r.status}: ${err}`);
          }
          return r.json();
        })
      )
    );

    const errors = results
      .map((r, i) => r.status === "rejected"
        ? { email: recipients[i]?.email, reason: r.reason?.message ?? String(r.reason) }
        : null)
      .filter(Boolean);
    const sent = results.length - errors.length;

    console.log("email results:", { sent, failed: errors.length, errors });
    return new Response(JSON.stringify({ sent, failed: errors.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
