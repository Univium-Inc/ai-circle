/*
  /pages/api/chat.ts – slimmer gateway to OpenAI
  ------------------------------------------------
  • Aligns with the new AIEngine: just forwards whatever messages array
    AIEngine gives us – _no extra prompt injections_ unless explicitly
    requested (this keeps system‑prompt logic in one place).
  • Supports gpt‑4o or falls back to 3.5‑turbo. Pick via env MODEL.
  • Restricts payload to last 80 chat items to stay under token limits.
  • Streams logs in dev but silences in production.
*/
import type { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MODEL  = process.env.OPENAI_MODEL || 'gpt-3'

export default async function handler (req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { messages, temperature = 0.7, debug } = req.body

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: '`messages` must be an array' })
    }

    const payloadMessages = messages.slice(-80) // cap history length

    if (process.env.NODE_ENV !== 'production') {
      console.log('▶︎ /api/chat call – model=%s temp=%s len=%d', MODEL, temperature, payloadMessages.length)
      if (debug) console.dir({ debug }, { depth: null })
    }

    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature,
      messages: payloadMessages
    })

    const raw = completion.choices[0]?.message?.content ?? ''

    if (process.env.NODE_ENV !== 'production') {
      console.log('◀︎ OpenAI raw response:\n', raw)
    }

    return res.status(200).json({ raw })
  } catch (err: any) {
    console.error('❌ /api/chat error:', err)
    return res.status(500).json({ error: 'OpenAI request failed', details: err.message })
  }
}
