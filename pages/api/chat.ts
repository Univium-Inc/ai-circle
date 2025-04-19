import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// create client with key from env
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { messages } = req.body; // array in OpenAI chat format

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages,
    });

    const reply = completion.choices[0]?.message?.content ?? '...';
    const target = req.body.target ?? null; // optional passthrough

    res.status(200).json({ reply, target });
  } catch (err) {
    console.error('OpenAI error', err);
    res.status(500).json({ error: 'OpenAI request failed' });
  }
}
