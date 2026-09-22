// api/grade.js - Vercel Serverless Function
// Nhan prompt tu web, goi Gemini, tra ve text de web cham diem.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const prompt = req.body && req.body.prompt;
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Thieu noi dung bai viet (prompt)." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Chua cau hinh GEMINI_API_KEY tren Vercel." });
  }

  async function listModels() {
    try {
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models?key=" + apiKey + "&pageSize=100"
      );
      const data = await r.json().catch(() => ({}));
      const models = (data.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => (m.name || "").replace("models/", ""));
      // Uu tien flash 3.x, roi den flash khac, roi den con lai
      models.sort((a, b) => {
        const score = (n) => {
          n = n.toLowerCase();
          if (n.includes("3.6") && n.includes("flash")) return 0;
          if (n.includes("3") && n.includes("flash")) return 1;
          if (n.includes("flash")) return 2;
          return 3;
        };
        return score(a) - score(b);
      });
      return models.slice(0, 5);
    } catch {
      return [];
    }
  }

  const discovered = await listModels();
  const MODELS = discovered.length ? discovered : ["gemini-3.6-flash"];

  let lastError = "Gemini bao loi.";
  for (const model of MODELS) {
    try {
      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt.slice(0, 8000) }] }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 4000, responseMimeType: "application/json" }
          })
        }
      );

      const data = await r.json().catch(() => ({}));
      const text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts || [])
        .map((p) => p.text || "")
        .join("");

      if (r.ok && text) {
        return res.status(200).json({ text });
      }
      lastError = (data.error && data.error.message) || ("Loi model " + model);
      // Model qua tai / het quota -> thu model tiep theo ngay
      const retryable = r.status === 429 || r.status === 500 || r.status === 503 || r.status === 404 ||
        /high demand|overloaded|quota|try again|no longer available|not available|not found|unsupported/i.test(lastError);
      if (!retryable) {
        return res.status(500).json({ error: lastError });
      }
    } catch (e) {
      lastError = "Loi ket noi toi Gemini.";
    }
  }
  return res.status(500).json({ error: lastError });
}
