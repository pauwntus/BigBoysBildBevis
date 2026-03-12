import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { game_id, player_id, round, challenge } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not set");

    // Build a prompt that fits Göran's vibe — a slightly confused older guy
    // who tries his best at the challenge
    const challengeCtx = challenge
      ? `The photo challenge is: "${challenge}". `
      : "";
    const prompt =
      `${challengeCtx}A candid, slightly blurry, poorly-composed amateur photo taken by a confused middle-aged Swedish man named Göran on a ski trip. ` +
      `The photo is an honest attempt at the challenge but something is slightly off or awkward about it. ` +
      `Realistic photo style, natural lighting, no text overlays. The scene is outdoors in a snowy Swedish mountain environment.`;

    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`DALL-E error: ${err}`);
    }

    const imageData = await res.json();
    const b64 = imageData.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data returned from DALL-E");

    const photo = `data:image/png;base64,${b64}`;

    // Insert Göran's photo into submissions (service role bypasses RLS)
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await sb.from("submissions").upsert(
      { game_id, player_id, round, photo },
      { onConflict: "game_id,player_id,round" },
    );

    if (error) throw new Error(`DB error: ${error.message}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
