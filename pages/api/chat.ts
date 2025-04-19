import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { messages } = req.body; // already in OpenAI chat format

    /** system rule that forces the TO/MESSAGE contract */
    const forcedFormat = {
      role   : 'system' as const,
      content: `
You are playing a message‑passing game.  
Respond in **exactly** this two‑line format each turn:

TO: user | AI 1 | AI 2
MESSAGE: <one concise sentence>

NEVER add extra lines.  
`,
    };

    const completion = await openai.chat.completions.create({
      model   : 'gpt-3.5-turbo',
      messages: [forcedFormat, ...messages].slice(-30),
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    res.status(200).json({ raw });      // we return the raw 2‑line text
  } catch (err) {
    console.error('OpenAI error', err);
    res.status(500).json({ error: 'OpenAI failed' });
  }
}
