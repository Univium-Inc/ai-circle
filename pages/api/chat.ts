import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { messages, speaker, topic } = req.body as {
      messages: { speaker: string; content: string }[];
      speaker: string;
      topic: string;
    };

    const chatMessages = [
      {
        role: 'system',
        content: `You are ${speaker}. Debate the topic: "${topic}" with conviction. Respond in ≤120 words.`
      },
      ...messages.map(m => ({
        role: m.speaker === speaker ? 'assistant' : 'user',
        content: m.content
      }))
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125',
      messages: chatMessages,
      temperature: 0.7
    });

    return res.status(200).json({ content: completion.choices[0].message.content.trim() });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'OpenAI request failed' });
  }
}
