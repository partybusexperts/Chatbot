// Next.js API route to proxy /api/quote to the backend
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const backendUrl = process.env.QUOTE_BACKEND_URL || "http://127.0.0.1:8000/quote";
    const r = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body)
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(500).json({ error: "Backend error" });
  }
}
