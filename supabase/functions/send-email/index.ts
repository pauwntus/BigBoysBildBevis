import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_BASE = "https://pauwntus.github.io/BigBoysBildBevis/";

function escHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function buildResultsHtml(
  sb: ReturnType<typeof createClient>,
  game_id: string,
  round: number,
  playerName: string,
  gameCode: string,
): Promise<{ subject: string; html: string }> {
  const [{ data: game }, { data: votes }, { data: allPlayers }] = await Promise.all([
    sb.from("games").select("code, current_challenge").eq("id", game_id).single(),
    sb.from("votes").select("voted_for_id").eq("game_id", game_id).eq("round", round),
    sb.from("players").select("id, name, emoji, score").eq("game_id", game_id).order("score", { ascending: false }),
  ]);

  const challenge = game?.current_challenge || "";
  const code = game?.code || gameCode;

  // Tally votes
  const counts: Record<string, number> = {};
  (votes ?? []).forEach((v) => {
    counts[v.voted_for_id] = (counts[v.voted_for_id] || 0) + 1;
  });

  const sorted = [...(allPlayers ?? [])].sort(
    (a, b) => (counts[b.id] || 0) - (counts[a.id] || 0),
  );

  const MEDALS = ["🥇", "🥈", "🥉"];

  const rowsHtml = sorted.map((p, i) => {
    const medal = i < 3 ? MEDALS[i] : "";
    const voteCount = counts[p.id] || 0;
    const borderColor = i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.1)";
    return `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.07);font-size:20px;">${medal || ""}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.07);border-left:3px solid ${borderColor};">
          ${escHtml(p.emoji || "")} ${escHtml(p.name)}
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.07);color:#ff4d00;font-weight:bold;text-align:center;">${voteCount} röst${voteCount !== 1 ? "er" : ""}</td>
        <td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.07);color:#aaa;text-align:right;">${p.score}p totalt</td>
      </tr>`;
  }).join("");

  const winner = sorted[0];
  const winnerLine = winner
    ? `<p style="margin:0 0 24px;font-size:18px;">🥇 <strong>${escHtml(winner.emoji || "")} ${escHtml(winner.name)}</strong> vann runda ${round} med ${counts[winner.id] || 0} röst${(counts[winner.id] || 0) !== 1 ? "er" : ""}!</p>`
    : "";

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#1a1a1a;color:#f5f0e8;padding:32px;border-radius:12px;">
      <h1 style="font-size:26px;margin:0 0 4px;color:#ff4d00;">🏆 Resultat – Runda ${round}</h1>
      <p style="margin:0 0 20px;color:#aaa;">Hej ${escHtml(playerName)}!</p>
      ${challenge ? `<p style="margin:0 0 16px;background:rgba(255,255,255,0.05);padding:12px 16px;border-left:3px solid #ff4d00;font-size:15px;"><strong>Utmaningen:</strong> ${escHtml(challenge)}</p>` : ""}
      ${winnerLine}
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
        ${rowsHtml}
      </table>
      <a href="${APP_BASE}?code=${code}" style="display:inline-block;background:#ff4d00;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:bold;font-size:16px;">
        Gå till lobby ${code} →
      </a>
    </div>
  `;

  return { subject: `🏆 Runda ${round} klar – ${winner ? escHtml(winner.name) + " vann!" : "se resultaten!"}`, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { game_id, phase, round } = await req.json();

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
      recipients.map(async (player) => {
        let subject: string;
        let html: string;

        if (phase === "results" && round) {
          ({ subject, html } = await buildResultsHtml(sb, game_id, round, player.name, game?.code ?? ""));
        } else {
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
          const msg = MESSAGES[phase];
          if (!msg) return { skipped: true };
          subject = msg.subject;
          html = `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#1a1a1a;color:#f5f0e8;padding:32px;border-radius:12px;">
              <h1 style="font-size:28px;margin:0 0 8px;color:#ff4d00;">${msg.heading}</h1>
              <p style="margin:0 0 24px;color:#aaa;">Hej ${escHtml(player.name)}!</p>
              <p style="margin:0 0 32px;font-size:16px;">${msg.body}</p>
              <a href="${APP_BASE}?code=${game?.code}" style="display:inline-block;background:#ff4d00;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:bold;font-size:16px;">
                Gå till lobby ${game?.code} →
              </a>
            </div>
          `;
        }

        return fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Big Boys BildBevis <bigboys@jonestrom.com>",
            to: [player.email],
            subject,
            html,
          }),
        }).then(async (r) => {
          if (!r.ok) {
            const err = await r.text();
            throw new Error(`Resend error ${r.status}: ${err}`);
          }
          return r.json();
        });
      })
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
