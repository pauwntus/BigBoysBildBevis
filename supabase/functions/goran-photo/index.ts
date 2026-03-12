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

    const GORAN_IMAGE_URL = Deno.env.get("GORAN_IMAGE_URL");
    if (!GORAN_IMAGE_URL) throw new Error("GORAN_IMAGE_URL not set");

    const authHeaders = {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    };

    // ── Step 1: Fetch Göran reference image ──────────────────────────────
    const imgRes = await fetch(GORAN_IMAGE_URL);
    if (!imgRes.ok) throw new Error("Could not fetch Göran reference image");
    const imgBytes = new Uint8Array(await imgRes.arrayBuffer());
    let imgBinary = '';
    for (let i = 0; i < imgBytes.byteLength; i++) imgBinary += String.fromCharCode(imgBytes[i]);
    const imgB64 = btoa(imgBinary);
    const imgMime = imgRes.headers.get("content-type") || "image/jpeg";

    // ── Step 2: GPT-4o decides if Göran should appear + writes the prompt ─
    // It sees the reference photo and the challenge, and decides intelligently
    // whether the challenge calls for a person in the shot or just a scene.
    const decisionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 400,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `You are a creative director for a ski trip photo challenge game. ` +
              `The attached image is Göran — a heavyset, cheerful middle-aged Swedish man in a loud neon 90s ski suit ` +
              `(purple, yellow, hot pink, neon green chevron pattern) with a rainbow headband, on skis. ` +
              `Your job is to decide: should Göran personally appear in the photo for this challenge, or should the photo just show the scene/subject? ` +
              `Include Göran if the challenge implies a selfie, a portrait, a person doing something, or human presence. ` +
              `Exclude Göran (scene only) if the challenge is about an object, a landscape, food, signage, or something where a person would be incidental. ` +
              `Then write a DALL-E 3 image prompt for the photo. ` +
              `When including Göran, describe him in full detail from the reference image so DALL-E recreates his look faithfully. ` +
              `Always make the photo look like a candid amateur phone shot from a ski trip — slightly imperfect composition, natural light. ` +
              `Respond with JSON: { "include_goran": boolean, "reason": string, "dalle_prompt": string }`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${imgMime};base64,${imgB64}` },
              },
              {
                type: "text",
                text: `Photo challenge: "${challenge || "fritt motiv på skidorten"}"`,
              },
            ],
          },
        ],
      }),
    });

    if (!decisionRes.ok) {
      const err = await decisionRes.text();
      throw new Error(`GPT-4o error: ${err}`);
    }

    const decisionData = await decisionRes.json();
    const decision = JSON.parse(decisionData.choices[0].message.content);
    const dallePrompt: string = decision.dalle_prompt;

    // ── Step 3: DALL-E 3 generates the actual photo ───────────────────────
    const genRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: dallePrompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });

    if (!genRes.ok) {
      const err = await genRes.text();
      throw new Error(`DALL-E error: ${err}`);
    }

    const genData = await genRes.json();
    const b64 = genData.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned from DALL-E");

    const photo = `data:image/png;base64,${b64}`;

    // ── Step 4: Save to submissions ───────────────────────────────────────
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await sb.from("submissions").upsert(
      { game_id, player_id, round, photo },
      { onConflict: "game_id,player_id,round" },
    );

    if (error) throw new Error(`DB error: ${error.message}`);

    return new Response(JSON.stringify({ ok: true, include_goran: decision.include_goran }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
