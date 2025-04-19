import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const { messages } = req.body; // already in OpenAI chat format

    // Determine which AI is making the request from the system message
    const systemMessage = messages.find((msg: { role: string; }) => msg.role === 'system');
    const isGary = systemMessage?.content.includes('Gary');
    const isBenny = systemMessage?.content.includes('Benny');
    
    const currentAI = isBenny ? 'Benny' : (isGary ? 'Gary' : 'Unknown');
    const otherAI = currentAI === 'Benny' ? 'Gary' : 'Benny';
    const userName = 'Larry'; // Default user name

    /** system rule that forces the TO/MESSAGE contract */
    const forcedFormat = {
      role: 'system' as const,
      content: `
    You are a participant in "The Circle" style voting competition with multiple participants.
    
    IMPORTANT CONTEXT:
    - You are ${currentAI} with a unique personality
    - The other AI participant is ${otherAI}
    - The human user is ${userName}
    - Each participant can only send ONE message per turn
    - You must carefully review your message history before deciding who to respond to
    - You CANNOT message yourself - only message other participants
    - Always be clear, direct, and brief in your responses
    - Stay true to your personality in every message

    GOAL:
    - Your goal is to get other participants to vote for you each turn
    - Each player can only vote for one other player each turn
    - You must become friends and gain favorability with the other players
    
    FORMATTING REQUIREMENTS:
    Respond in EXACTLY this two-line format:
    
    TO: [recipient]
    MESSAGE: [your message]
    
    Rules for [recipient]:
    - Must be either "${userName}" or "${otherAI}"
    - CANNOT be your own name (${currentAI} cannot message itself)
    - You must choose only ONE recipient
    
    Rules for [your message]:
    - Keep it brief and concise (under 20 words)
    - Answer directly without mentioning routing information
    - Do not repeat the recipient's name in your message
    - Do not include any additional formatting or metadata
    - Make sure your message reflects your unique personality
    
    NEVER add extra lines or additional information.
    `,
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [forcedFormat, ...messages].slice(-30),
    });

    const raw = completion.choices[0]?.message?.content ?? '';
    res.status(200).json({ raw });      // we return the raw 2‑line text
  } catch (err) {
    console.error('OpenAI error', err);
    res.status(500).json({ error: 'OpenAI failed' });
  }
}