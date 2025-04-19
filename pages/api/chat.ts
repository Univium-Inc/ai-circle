import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing API key' });

  const { messages } = req.body;

  try {
    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages,
      }),
    });

    const json = await completion.json();
    const reply = json.choices?.[0]?.message?.content ?? 'No response from AI';
    res.status(200).json({ reply });
  } catch (err) {
    console.error('API call failed:', err);
    res.status(500).json({ error: 'OpenAI request failed' });
  }
}
