// Vercel serverless function — proxies the image appraisal to the Anthropic API.
// The API key stays here (server-side); the browser never sees it, and the
// same-origin call avoids the CORS block that killed the direct browser fetch.
//
// Set ANTHROPIC_API_KEY in the Vercel project's Environment Variables.

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
    const { system, content } = req.body || {};
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
        model: "claude-opus-4-8",
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content }],
        // Latest web-search tool (dynamic filtering) — Opus 4.8, no beta header.
        tools: [{ type: "web_search_20260209", name: "web_search" }],
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
