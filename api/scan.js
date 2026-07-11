// Vercel serverless function — proxies the image appraisal to the Anthropic API.
// The API key stays here (server-side); the browser never sees it, and the
// same-origin call avoids the CORS block that killed the direct browser fetch.
//
// Set ANTHROPIC_API_KEY in the Vercel project's Environment Variables.

// Structured-output schemas force the model to return clean, parseable JSON
// every time (no markdown, no stray prose) — kills the "couldn't read the
// result" failures.
const SINGLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["item", "category", "bulk", "confidence", "resaleLow", "resaleTypical", "resaleHigh", "demand", "estDaysToSell", "reason", "confirmTip", "searchTerm"],
  properties: {
    item: { type: "string" },
    category: { type: "string" },
    bulk: { type: "string", enum: ["light", "standard", "heavy", "bulky"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    resaleLow: { type: "number" },
    resaleTypical: { type: "number" },
    resaleHigh: { type: "number" },
    demand: { type: "string", enum: ["fast", "moderate", "slow"] },
    estDaysToSell: { type: "number" },
    reason: { type: "string" },
    confirmTip: { type: "string" },
    searchTerm: { type: "string" },
  },
};

const GROUP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["gem", "others"],
  properties: {
    gem: {
      type: "object",
      additionalProperties: false,
      required: ["item", "why", "resaleTypical", "demand", "searchTerm"],
      properties: {
        item: { type: "string" },
        why: { type: "string" },
        resaleTypical: { type: "number" },
        demand: { type: "string", enum: ["fast", "moderate", "slow"] },
        searchTerm: { type: "string" },
      },
    },
    others: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "verdict", "note"],
        properties: {
          item: { type: "string" },
          verdict: { type: "string", enum: ["maybe", "skip"] },
          note: { type: "string" },
        },
      },
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not configured on the server." });
    return;
  }

  try {
    const { system, content, mode } = req.body || {};
    if (!system || !Array.isArray(content)) {
      res.status(400).json({ error: "Expected { system, content } in the request body." });
      return;
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        // Sonnet 5: near-Opus quality on vision + pricing at a fraction of the cost.
        model: "claude-sonnet-5",
        max_tokens: 3000,
        system,
        messages: [{ role: "user", content }],
        // Latest web-search tool (dynamic filtering); cap uses to bound per-scan cost.
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 }],
        // Guarantee the final answer is valid JSON in our exact shape.
        output_config: { format: { type: "json_schema", schema: mode === "group" ? GROUP_SCHEMA : SINGLE_SCHEMA } },
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || "Upstream error" });
      return;
    }
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e?.message || "Proxy error" });
  }
}
