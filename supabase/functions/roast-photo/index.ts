import Anthropic from "npm:@anthropic-ai/sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { image, challenge } = await req.json();

    const base64 = image.replace(/^data:image\/\w+;base64,/, "");
    const mediaType = image.startsWith("data:image/png") ? "image/png" : "image/jpeg";

    const anthropic = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
    });

    const challengeCtx = challenge ? ` Utmaningen var: "${challenge}".` : "";
    const prompt = `Du heter Göran och skriver i en lokal Facebook-grupp. Du kommenterar bilder på ett otydligt, luddigt och aningen förvirrat sätt med dålig grammatik och stavning. Du är inte helt säker på vad du ser men har ändå en stark åsikt. Ibland blandar du ihop saker. Skriv en kort kommentar (max 2 meningar) om bilden${challengeCtx ? " (utmaning: " + challengeCtx.trim() + ")" : ""}. Inga emoji. Exempel på stil: "ja de e väl okej bild men varför e de så mörkt eller", "Göran gillar inte riktigt detta faktiskt men okej".`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const comment = message.content[0].type === "text" ? message.content[0].text : "";

    return new Response(JSON.stringify({ comment }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
