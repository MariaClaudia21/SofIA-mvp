export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { messages, system } = req.body;

    const contents = system
      ? [{ role: 'user', parts: [{ text: system + '\n\n' + messages[messages.length - 1].content }] }]
      : messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY not set');
      res.status(500).json({ error: 'config_error' });
      return;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 500, temperature: 0.7 } }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Gemini API error:', response.status, errBody);
      res.status(502).json({ error: 'upstream_error', detail: response.status });
      return;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('Gemini empty response:', JSON.stringify(data));
      res.status(502).json({ error: 'empty_response' });
      return;
    }

    res.status(200).json({ content: [{ text }] });
  } catch (error) {
    console.error('Chat handler error:', error.message);
    res.status(500).json({ error: 'internal_error' });
  }
}
