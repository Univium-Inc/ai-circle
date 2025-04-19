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
      role: 'system' as const,
      content: `
    You are a participant in a structured messaging system with multiple participants.
    
    IMPORTANT CONTEXT:
    - Each participant can only send ONE message per token they have
    - You must carefully review your message history before deciding who to respond to
    - You CANNOT message yourself - only message other participants
    - Always be clear, direct, and brief in your responses
    
    FORMATTING REQUIREMENTS:
    Respond in EXACTLY this two-line format:
    
    TO: [recipient]
    MESSAGE: [your message]
    
    Rules for [recipient]:
    - Must be either "user" or "AI 1" or "AI 2"
    - CANNOT be your own name (${messages[0]?.content.includes('AI 1') ? 'AI 1' : 'AI 2'} cannot message itself)
    - You must choose only ONE recipient
    
    Rules for [your message]:
    - Keep it brief and concise (under 20 words)
    - Answer directly without mentioning routing information
    - Do not repeat the recipient's name in your message
    - Do not include any additional formatting or metadata
    
    NEVER add extra lines or additional information.
    `,
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',  // Change from 'gpt-3.5-turbo' to 'gpt-4o'
      messages: [forcedFormat, ...messages].slice(-30),
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    res.status(200).json({ raw });      // we return the raw 2‑line text
  } catch (err) {
    console.error('OpenAI error', err);
    res.status(500).json({ error: 'OpenAI failed' });
  }
}
