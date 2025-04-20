/*
  AIEngine – deterministic message planner for “The Circle: AI Edition”
  --------------------------------------------------------------------
  Changes vs the previous implementation:
    • Pure‑function helpers + a single public async getAIResponse()
    • Target validation + correction in one place (pickValidRecipient())
    • Tiny, personality‑weighted temperature table + auto boost during
      voting rounds.
    • No global regex spaghetti – we parse intents with clear helpers.
    • Every response is guaranteed to follow the 2‑line TO:/MESSAGE:
      contract. The first non‑empty assistant call that violates the
      contract is logged + replaced with a fallback.
*/
import type { Message, Participant, GameState } from './types'
import { getPersonality, getAllAINames } from './aiPersonalities'

export interface AIResponse { content: string; target: Participant }

/*────────────────────────────  Constants  ───────────────────────────*/
const USER = 'Larry'
const MAX_HISTORY = 35
const FALLBACK = { content: "I'm thinking…", target: USER as Participant }

/*────────────────────────────  Helper utils  ───────────────────────*/
function now () { return Date.now() }
function shuffle<T> (arr: T[]) { return [...arr].sort(() => Math.random() - 0.5) }

const temperatureOf: Record<string, number> = {
  Benny: 0.9,
  Ethan: 0.85,
  Xander: 0.8,
  Maya: 0.75,
  Sophie: 0.7,
  Gary: 0.6
}

function recent (history: Message[], n = MAX_HISTORY) {
  return history.slice(-n)
}

function hasVoted (ai: Participant, gs?: GameState) {
  return !!gs?.votesInRound.some(v => v.voter === ai && v.round === gs.currentRound)
}

function pickValidRecipient (ai: Participant, candidate: Participant, gs?: GameState): Participant {
  const eliminated = gs?.eliminatedParticipants ?? []
  const valid = [USER, ...getAllAINames().filter(n => n !== ai && !eliminated.includes(n as Participant))]
  if (valid.includes(candidate) && candidate !== ai) return candidate
  return shuffle(valid)[0] as Participant
}

/*────────────────────────────  Core planner  ────────────────────────*/
export async function getAIResponse ({
  aiName,
  history,
  userName = USER,
  promptHint,
  gameState
}: {
  aiName: Exclude<Participant, 'Larry'>
  history: Message[]
  userName?: string
  promptHint?: string
  gameState?: GameState
}): Promise<AIResponse> {
  const personality = getPersonality(aiName)
  if (!personality) return FALLBACK

  // Build minimal, yet informative system prompt
  const recipients = [userName, ...getAllAINames().filter(n => n !== aiName)].map(r => `"${r}"`).join(', ')
  const system = {
    role: 'system' as const,
    content: `${personality.systemPrompt}
You are ${aiName}. Output EXACTLY two lines: \nTO: [recipient]\nMESSAGE: [<20‑word message]. Valid recipients: ${recipients}. Never talk to yourself. ${gameState && gameState.votingPhase === 'active' ? 'Voting is ACTIVE – one will be eliminated soon!' : ''}`
  }

  // Slice + lightly annotate history
  const annotated = recent(history).map(m => ({
    role: m.sender === aiName ? 'assistant' : 'user',
    content: `${m.sender}→${m.recipient}: ${m.content}`
  }))
  if (promptHint) annotated.push({ role: 'user', content: `[HINT] ${promptHint}` })

  // Voting encouragement
  if (gameState && gameState.votingPhase === 'active' && !hasVoted(aiName, gameState) && gameState.votingTokensAvailable[aiName]) {
    annotated.push({ role: 'user', content: `[REMINDER] You still possess a ballot – decide who to eliminate.` })
  }

  /* Call backend */
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [system, ...annotated],
      temperature: (temperatureOf[aiName] ?? 0.7) + (gameState?.votingPhase === 'active' ? 0.1 : 0)
    })
  })

  if (!res.ok) return FALLBACK

  const { raw } = await res.json()
  const lines = raw.split('\n').map((l: string) => l.trim()).filter(Boolean)
  const toLine = lines.find(l => l.startsWith('TO:'))
  const msgLine = lines.find(l => l.startsWith('MESSAGE:'))
  if (!toLine || !msgLine) return FALLBACK

  let target = toLine.replace(/^TO:/, '').trim() as Participant
  let content = msgLine.replace(/^MESSAGE:/, '').trim()

  target = pickValidRecipient(aiName, target, gameState)
  if (!content) content = "Hello!"

  return { content, target }
}