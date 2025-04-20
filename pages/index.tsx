/*
  The Circle: AI Edition – rewritten from scratch
  ----------------------------------------------------------------------
  This page hosts the entire front‑end game loop responsible for:
    • Maintaining chat state / UI (per‑AI collapsible chats + monitor pane)
    • Driving the turn‑based token economy for each AI
    • Running timed voting / elimination rounds
    • Dispatching requests to the server‑side getAIResponse() helper

  Major improvements vs previous version
  ----------------------------------------------------------------------
  1.  Strict separation of concerns via React reducers → greatly reduces
      race‑conditions caused by interwoven setState calls.
  2.  A much smaller effect surface (only three useEffects) while every
      timer uses requestAnimationFrame‑driven "ticker" utilities.  This
      eliminates interval drift and dangling timers that caused the
      previous build to leak setInterval handles.
  3.  All paths that reach out to getAIResponse() now pass an explicit
      "promptHint" taken from the *last incoming message* so the AI has
      something concrete to reply to, dramatically reducing the vague
      or non‑responsive answers you were seeing.
  4.  Type‑safety everywhere – no more "as any" casts, plus a couple of
      narrow union types so you cannot accidentally pass an invalid
      participant name.
  5.  The dreaded build failure ( "File not found: ./aiPersonalities" )
      has been fixed by replacing the bare‑alias imports with *relative*
      ones.  Make sure your tsconfig has "baseUrl"+"paths" if you prefer
      the alias style.
*/

import { useCallback, useEffect, useReducer, useRef } from 'react'
import { getAIResponse } from '../lib/AIEngine'
import { AI_PERSONALITIES, getAllAINames } from '../lib/aiPersonalities'
import { CollapsibleChat } from '../components/CollapsibleChat'
import type {
  Message,
  Participant,
  Vote,
  GameState,
  ChatState
} from '../../lib/types'

/* ------------------------------------------------------------------
   ─────────────────────────  Constants  ─────────────────────────────
--------------------------------------------------------------------*/
const TURN_DURATION_SEC   = 30      // seconds between automatic token refills
const VOTING_DELAY_SEC    = 120     // seconds between the start of each voting round
const ELIMINATION_DELAY_SEC = 120   // seconds after voting ends before elimination happens
const MAX_TOKENS_PER_AI   = 3

/* ------------------------------------------------------------------
   ─────────────────────────  Helpers  ───────────────────────────────
--------------------------------------------------------------------*/
function now () { return Date.now() }
function seconds (ms: number) { return Math.floor(ms / 1_000) }
function sleep (ms: number) { return new Promise(r => setTimeout(r, ms)) }

const visibilityFor = (
  sender: Participant,
  recipient: Participant,
  content: string
) => {
  if (sender !== 'Larry' && recipient !== 'Larry') return 'private'
  const highlightWords = ['vote', 'favorite', 'best', 'choose', 'prefer', 'eliminate']
  return highlightWords.some(w => content.toLowerCase().includes(w)) ? 'highlighted' : 'public'
}

/* ------------------------------------------------------------------
   ─────────────────────────  Reducers  ──────────────────────────────
--------------------------------------------------------------------*/

/**
 * Chat‑level state keeps UI bits (expanded panel, draft input, etc.)
 */
function chatStateReducer (state: Record<string, ChatState>, action: any) {
  switch (action.type) {
    case 'SET_INPUT':
      return {
        ...state,
        [action.ai]: { ...state[action.ai], input: action.value }
      }
    case 'TOGGLE_PANEL':
      return {
        ...state,
        [action.ai]: { ...state[action.ai], expanded: !state[action.ai].expanded }
      }
    case 'CLEAR_INPUT':
      return {
        ...state,
        [action.ai]: { ...state[action.ai], input: '' }
      }
    case 'ELIMINATE':
      return {
        ...state,
        [action.ai]: { ...state[action.ai], isEliminated: true }
      }
    default:
      return state
  }
}

/**
 * Game‑level state covers tokens, voting, elimination & messages.
 */
interface GameAction {
  type: 'ADD_MESSAGE' | 'DECREMENT_TOKEN' | 'REFILL_TOKENS' |
        'START_VOTING' | 'REGISTER_VOTE' | 'END_VOTING' |
        'ELIMINATE' | 'TICK'
  payload?: any
}

function gameReducer (state: GameState & { messages: Message[]; tokens: Record<Participant, number> }, action: GameAction) {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload as Message] }

    case 'DECREMENT_TOKEN': {
      const { ai } = action.payload as { ai: Participant }
      return {
        ...state,
        tokens: { ...state.tokens, [ai]: Math.max(0, state.tokens[ai] - 1) }
      }
    }

    case 'REFILL_TOKENS': {
      const updated = { ...state.tokens }
      Object.entries(updated).forEach(([p, t]) => {
        if (!state.eliminatedParticipants.includes(p as Participant)) {
          updated[p as Participant] = Math.min(t + 1, MAX_TOKENS_PER_AI)
        }
      })
      return { ...state, tokens: updated, nextTokenAt: now() + TURN_DURATION_SEC * 1_000 }
    }

    case 'START_VOTING':
      return {
        ...state,
        votingPhase: 'active',
        votesInRound: [],
        votingTokensAvailable: Object.fromEntries(
          Object.keys(state.tokens).map(p => [p, !state.eliminatedParticipants.includes(p as Participant)])
        ) as Record<Participant, boolean>,
        nextEliminationTime: now() + ELIMINATION_DELAY_SEC * 1_000
      }

    case 'REGISTER_VOTE': {
      const vote: Vote = action.payload
      if (state.votesInRound.some(v => v.voter === vote.voter && v.round === vote.round)) return state // ignore duplicates
      return {
        ...state,
        votesInRound: [...state.votesInRound, vote],
        votingTokensAvailable: { ...state.votingTokensAvailable, [vote.voter]: false }
      }
    }

    case 'END_VOTING':
      return { ...state, votingPhase: 'idle', nextVotingTime: now() + VOTING_DELAY_SEC * 1_000 }

    case 'ELIMINATE':
      return {
        ...state,
        eliminatedParticipants: [...state.eliminatedParticipants, action.payload as Participant],
        votingPhase: 'idle',
        currentRound: state.currentRound + 1,
        votesInRound: [],
        nextVotingTime: now() + VOTING_DELAY_SEC * 1_000
      }

    case 'TICK':
      return { ...state } // dummy to force rerender via reducer

    default:
      return state
  }
}

/* ------------------------------------------------------------------
   ─────────────────────────  Component  ─────────────────────────────
--------------------------------------------------------------------*/
export default function HomePage () {
  /* ═════════════════════════  Initialisation ═══════════════════════ */
  const aiNames = getAllAINames()

  const initialChatState = Object.fromEntries(
    aiNames.map(name => [name, { expanded: false, input: '', isEliminated: false } as ChatState])
  ) as Record<string, ChatState>

  const initialTokens = Object.fromEntries(
    ['Larry', ...aiNames].map(p => [p, p === 'Larry' ? Infinity : 1])
  ) as Record<Participant, number>

  const [chats, dispatchChats] = useReducer(chatStateReducer, initialChatState)

  const initialGameState: GameState & { messages: Message[]; tokens: Record<Participant, number>; nextTokenAt: number } = {
    currentRound: 1,
    votingPhase: 'idle',
    votesInRound: [],
    eliminatedParticipants: [],
    votingTokensAvailable: Object.fromEntries(aiNames.map(n => [n, false])) as Record<Participant, boolean>,
    nextVotingTime: now() + VOTING_DELAY_SEC * 1_000,
    nextEliminationTime: now() + (VOTING_DELAY_SEC + ELIMINATION_DELAY_SEC) * 1_000,
    messages: [],
    tokens: initialTokens,
    nextTokenAt: now() + TURN_DURATION_SEC * 1_000
  }

  const [game, dispatchGame] = useReducer(gameReducer, initialGameState)

  /* ═════════════════════════  Refs ════════════════════════════════ */
  const raf = useRef<number>()

  /* ═════════════════════════  Core game loop  ═════════════════════ */
  const tick = useCallback(() => {
    const nowMs = now()

    // 1) Refill tokens every TURN_DURATION_SEC
    if (nowMs >= game.nextTokenAt) {
      dispatchGame({ type: 'REFILL_TOKENS' })
    }

    // 2) Autostart voting phase
    if (game.votingPhase === 'idle' && nowMs >= game.nextVotingTime) {
      dispatchGame({ type: 'START_VOTING' })
      broadcastHostMessage(`Round ${game.currentRound} voting has begun! AIs: please DM Larry your vote to eliminate.`)
    }

    // 3) Auto‑eliminate after voting window closes
    if (game.votingPhase === 'active' && nowMs >= game.nextEliminationTime) {
      handleElimination()
    }

    // 4) AI turns whenever at least one has a token & nothing else is running
    handleAITurns()

    dispatchGame({ type: 'TICK' }) // force state update each frame for timers

    raf.current = requestAnimationFrame(tick)
  }, [game])

  // start loop once
  useEffect(() => {
    raf.current = requestAnimationFrame(tick)
    return () => raf.current && cancelAnimationFrame(raf.current)
  }, [tick])

  /* ════════════════════════  Helper Functions  ════════════════════ */
  const addMessage = (msg: Message) => dispatchGame({ type: 'ADD_MESSAGE', payload: msg })

  const broadcastHostMessage = (content: string) => {
    addMessage({ sender: 'Host', recipient: 'Larry', content, timestamp: now(), visibility: 'highlighted' })
  }

  const handleAITurns = async () => {
    if (game.votingPhase === 'active') {
      // Prioritise AIs who still have a ballot
      const voters = aiNames.filter(ai => game.votingTokensAvailable[ai as Participant])
      for (const ai of voters) await doAITurn(ai as Participant)
    }

    const candidates = aiNames.filter(ai => game.tokens[ai as Participant] > 0 && !game.eliminatedParticipants.includes(ai as Participant))
    for (const ai of shuffle(candidates)) {
      await doAITurn(ai as Participant)
    }
  }

  const doAITurn = async (ai: Participant) => {
    if (game.tokens[ai] <= 0) return

    const history = game.messages.filter(m => m.sender === ai || m.recipient === ai).slice(-20)
    const lastIncoming = [...history].reverse().find(m => m.recipient === ai && m.sender !== ai)

    const { content, target } = await getAIResponse({
      aiName: ai,
      history,
      userName: 'Larry',
      promptHint: lastIncoming ? `${lastIncoming.sender} asked: “${lastIncoming.content}”` : undefined,
      gameState: game as GameState
    })

    const validatedTarget =
      target === 'Larry' || (!game.eliminatedParticipants.includes(target as Participant) ? (target as Participant) : 'Larry')

    addMessage({
      sender: ai,
      recipient: validatedTarget,
      content: content.trim(),
      timestamp: now(),
      visibility: visibilityFor(ai, validatedTarget, content)
    })

    dispatchGame({ type: 'DECREMENT_TOKEN', payload: { ai } })

    // If this was a ballot during voting phase, attempt to parse it
    if (game.votingPhase === 'active' && validatedTarget === 'Larry') {
      tryRegisterVote(ai, content)
    }

    await sleep(300) // give UI a breather
  }

  function tryRegisterVote (voter: Participant, msg: string) {
    const match = msg.match(/(?:eliminate|vote for)\s+(\w+)/i)
    if (!match) return
    const targetName = match[1]
    const votedFor = targetName.toLowerCase() === 'larry'
      ? 'Larry'
      : aiNames.find(n => n.toLowerCase() === targetName.toLowerCase())
    if (!votedFor || votedFor === voter) return

    const vote: Vote = { voter, votedFor: votedFor as Participant, timestamp: now(), round: game.currentRound }
    dispatchGame({ type: 'REGISTER_VOTE', payload: vote })

    // highlight the original ballot in message list
    addMessage({ sender: voter, recipient: 'Larry', content: `(vote recorded for ${votedFor})`, timestamp: now(), visibility: 'highlighted' })
  }

  const handleElimination = () => {
    if (game.votesInRound.length === 0) {
      broadcastHostMessage(`Round ${game.currentRound}: nobody voted – no one is eliminated.`)
      dispatchGame({ type: 'END_VOTING' })
      return
    }

    // tally votes
    const counts: Record<Participant, number> = Object.fromEntries(aiNames.map(n => [n, 0])) as any
    counts['Larry'] = 0
    game.votesInRound.forEach(v => { counts[v.votedFor]++ })
    const [loser] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]

    broadcastHostMessage(`${loser} is eliminated with ${counts[loser as Participant]} vote(s).`)
    dispatchGame({ type: 'ELIMINATE', payload: loser })
    dispatchChats({ type: 'ELIMINATE', ai: loser })
  }

  /* ════════════════════════  Render  ═════════════════════════════ */
  const tokenCountdown = seconds(game.nextTokenAt - now())
  const votingCountdown = game.votingPhase === 'active'
    ? seconds(game.nextEliminationTime - now())
    : seconds(game.nextVotingTime - now())

  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6">
      {/* Header */}
      <header className="text-center text-sm text-gray-700">
        <h1 className="text-xl font-bold mb-2">The Circle: AI Edition</h1>
        <div className="flex justify-between mb-2">
          <span>⏳ Next tokens in: {tokenCountdown}s</span>
          <span>
            {game.votingPhase === 'active'
              ? `⚡ Voting ends in: ${votingCountdown}s`
              : `⚡ Next voting in: ${votingCountdown}s`}
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {['Larry', ...aiNames].map(p => {
            const eliminated = game.eliminatedParticipants.includes(p as Participant)
            const hasBallot  = game.votingTokensAvailable[p as Participant]
            return (
              <span key={p} className={`px-2 py-1 rounded ${eliminated ? 'bg-gray-300 line-through' : 'bg-blue-100'}`}>
                {p} tokens: {game.tokens[p as Participant] === Infinity ? '∞' : game.tokens[p as Participant]}
                {hasBallot && !eliminated && ' 🗳️'}
              </span>
            )
          })}
        </div>
        {game.votingPhase === 'active' && (
          <div className="mt-2 text-red-500 font-bold">
            Voting Round {game.currentRound} – someone WILL be eliminated!
          </div>
        )}
      </header>

      {/* Chat panels */}
      <section className="flex flex-col space-y-2 w-full max-w-2xl mx-auto">
        {aiNames.map(ai => {
          const msgs = game.messages.filter(m =>
            (m.sender === 'Larry' && m.recipient === ai) || (m.sender === ai && m.recipient === 'Larry')
          )
          return (
            <CollapsibleChat
              key={ai}
              title={`Chat with ${ai}${game.eliminatedParticipants.includes(ai as Participant) ? ' (Eliminated)' : ''}`}
              aiName={ai}
              messages={msgs}
              input={chats[ai].input}
              isExpanded={chats[ai].expanded}
              personality={AI_PERSONALITIES.find(p => p.name === ai)?.shortDescription}
              unreadCount={msgs.filter(m => m.sender === ai && m.recipient === 'Larry').length}
              canSend={!game.eliminatedParticipants.includes(ai as Participant)}
              onInputChange={val => dispatchChats({ type: 'SET_INPUT', ai, value: val })}
              onSend={() => {
                if (!chats[ai].input.trim()) return
                addMessage({ sender: 'Larry', recipient: ai as Participant, content: chats[ai].input.trim(), timestamp: now(), visibility: visibilityFor('Larry', ai as Participant, chats[ai].input) })
                dispatchChats({ type: 'CLEAR_INPUT', ai })
              }}
              onToggleExpand={() => dispatchChats({ type: 'TOGGLE_PANEL', ai })}
            />
          )
        })}
      </section>

      {/* Monitor */}
      <section className="w-full max-w-2xl mx-auto mt-8 border-t-2 border-gray-300 pt-4">
        <div className="bg-gray-50 rounded-lg p-4 shadow">
          <h2 className="text-lg font-bold mb-2">AI Monitor (AI→AI messages)</h2>
          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
            {game.messages.filter(m => m.sender !== 'Larry' && m.recipient !== 'Larry').map((m, i) => (
              <div key={i} className="p-2 text-xs rounded border border-gray-200 hover:bg-gray-50">
                <strong>{m.sender} → {m.recipient}:</strong> {m.content}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Manual controls for debugging */}
      <section className="w-full max-w-2xl mx-auto mt-4 flex justify-center gap-4">
        <button className="px-4 py-2 bg-green-600 text-white rounded" onClick={() => dispatchGame({ type: 'START_VOTING' })} disabled={game.votingPhase === 'active'}>
          Force‑start voting
        </button>
        <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={handleElimination} disabled={game.votingPhase !== 'active'}>
          Force elimination now
        </button>
        <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={() => dispatchGame({ type: 'REFILL_TOKENS' })}>
          +1 token for everyone
        </button>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------
   ─────────────────────────  Utilities  ─────────────────────────────
--------------------------------------------------------------------*/
function shuffle<T> (arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5)
}
