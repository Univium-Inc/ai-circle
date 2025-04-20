import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { PARTICIPANTS } from '../../lib/participants';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { speaker, phase, topic, activeNames, messages } = req.body as {
      speaker: string;
      phase: 'discussion' | 'voting';
      topic: string;
      activeNames: string[];
      messages: { speaker: string; content: string }[];
    };

    const persona = PARTICIPANTS.find(p => p.name === speaker)?.persona || '';

    const systemBase = `You are ${speaker}, ${persona} Debate topic: "${topic}". You believe you are a human participant.`;

    const phaseSystem = phase === 'discussion'
      ? 'Speak persuasively in ≤120 words.'
      : `It is time to vote one participant out. Output exactly:
VOTE: <Name>
REASON: <brief>
Choose ONLY among: ${activeNames.filter(n => n !== speaker).join(', ')}.`;

    const chatMessages = [
      { role: 'system', content: systemBase + ' ' + phaseSystem },
      ...messages.map(m => ({
        role: m.speaker === speaker ? 'assistant' : 'user',
        content: m.content
      }))
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125',
      messages: chatMessages,
      temperature: 0.8
    });

    return res.status(200).json({ content: completion.choices[0].message.content.trim() });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'openai failed' });
  }
}
