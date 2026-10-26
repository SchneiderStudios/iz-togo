// Сервер для ИИ-функций (Vercel). Ключ Anthropic хранится только здесь, в переменной окружения.
// Переменные: ANTHROPIC_API_KEY (обязательно), AI_MODEL (по умолчанию claude-sonnet-5-5), DAILY_LIMIT (запросов на устройство в день, по умолчанию 40)
const hits = new Map(); // простой лимит в памяти одного экземпляра

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // приложение на телефоне приходит с capacitor://localhost или https://localhost
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, configured: !!process.env.ANTHROPIC_API_KEY });
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: "not_configured" });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
  const day = new Date().toISOString().slice(0, 10), key = ip + day;
  const n = (hits.get(key) || 0) + 1; hits.set(key, n);
  if (n > Number(process.env.DAILY_LIMIT || 40)) return res.status(429).json({ error: "rate_limited" });

  const { prompt, image, mediaType } = req.body || {};
  if (typeof prompt !== "string" || prompt.length < 10 || prompt.length > 30000) return res.status(400).json({ error: "bad_prompt" });
  if (image && (typeof image !== "string" || image.length > 7_000_000)) return res.status(400).json({ error: "bad_image" });

  const content = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: ["image/jpeg", "image/png", "image/webp"].includes(mediaType) ? mediaType : "image/jpeg", data: image } });
  content.push({ type: "text", text: prompt + "\n\nОтвет — только JSON, без пояснений." });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.AI_MODEL || "claude-sonnet-5-5", max_tokens: 2000, messages: [{ role: "user", content }] }),
    });
    const j = await r.json();
    if (!r.ok) return res.status(r.status === 429 ? 429 : 502).json({ error: "upstream", detail: j?.error?.type });
    const text = (j.content || []).map(c => c.text || "").join("");
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fence ? fence[1] : text.slice(Math.min(...["{", "["].map(s => (text.indexOf(s) + 1 || 1e9) - 1)), Math.max(text.lastIndexOf("}"), text.lastIndexOf("]")) + 1);
    return res.status(200).json(JSON.parse(raw));
  } catch (e) {
    return res.status(502).json({ error: "invalid_json" });
  }
}
