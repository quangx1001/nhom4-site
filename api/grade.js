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

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" + apiKey,
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

    if (!r.ok) {
      return res.status(500).json({ error: (data.error && data.error.message) || "Gemini bao loi." });
    }
    if (!text) {
      return res.status(500).json({ error: "Gemini khong tra ve noi dung." });
    }
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: "Loi ket noi toi Gemini." });
  }
}
