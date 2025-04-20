// pages/api/chat.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { getAllAINames } from '@/lib/aiPersonalities';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 1) Only allow POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { messages } = req.body; 
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: '`messages` must be an array' });
    }

    // 2) Log every incoming message
    //console.log('── Incoming /api/chat Request ──');
    //console.log('Total incoming messages:', messages.length);
    messages.forEach((msg: any, i: number) => {
      //console.log(`  [${i}] role=${msg.role}  content="${msg.content}"`);
    });

    // 3) Figure out which AI this is
    const systemMsg = messages.find((m: any) => m.role === 'system')?.content || '';
    const allAIs     = getAllAINames();
    const currentAI  = allAIs.find(name => systemMsg.includes(`You are ${name}`)) || 'Unknown';
    const otherAIs   = allAIs.filter(name => name !== currentAI);
    const userName   = 'Larry';

    // 4) Re‑inject our forced system instruction
    const forcedFormat = {
      role: 'system' as const,
      content: `
You are a participant in "The Circle" style voting competition.
- You are ${currentAI}.
- The other participants are: ${otherAIs.join(', ')}.
- The human user is ${userName}.
- One message per turn; you cannot message yourself.
FORMAT your reply **exactly** as:

TO: <recipient>
MESSAGE: <your text>

Recipient must be "${userName}" or one of: ${otherAIs.join(', ')}.
      `.trim()
    };

    // 5) Build the final payload (slice to last 80 messages)
    const payloadMessages = [forcedFormat, ...messages].slice(-80);

    // 6) Log it so you can inspect
    //console.log('── Payload to OpenAI ──');
    //console.log(JSON.stringify(payloadMessages, null, 2));

    // 7) Call OpenAI
    const completion = await openai.chat.completions.create({
      model:    'gpt-4o',
      messages: payloadMessages
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    //console.log('── Raw AI Response ──');
    //console.log(raw);

    // 8) Return just the 2‑line text
    return res.status(200).json({ raw });
  } catch (err) {
    //console.error('❌ /api/chat error:', err);
    return res.status(500).json({ error: 'OpenAI request failed' });
  }
}
