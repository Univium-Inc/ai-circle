/*
  vote.ts – stateless helpers for all voting‑related logic
  -------------------------------------------------------
  All functions are **pure** – they never mutate the incoming
  GameState but instead return a brand‑new copy.  This makes them
  compatible with React reducer patterns or any other immutable‑state
  approach.
*/
import type { Participant, Vote, GameState } from '../../lib/types'
import { getAllAINames } from '../../lib/aiPersonalities'

/*─────────────────────────  Utilities  ───────────────────────────*/
const activeAIs = (gs: GameState) => getAllAINames().filter(n => !gs.eliminatedParticipants.includes(n as Participant))

/*─────────────────────  Public API functions  ───────────────────*/
export function startVoting (gs: GameState): GameState {
  const tokens = Object.fromEntries(
    activeAIs(gs).map(ai => [ai, true])
  ) as Record<Participant, boolean>

  return {
    ...gs,
    votingPhase: 'active',
    votesInRound: [],
    votingTokensAvailable: tokens,
    nextEliminationTime: Date.now() + 120_000 // 2 min
  }
}

export function registerVote (gs: GameState, vote: Vote): GameState {
  if (gs.votingPhase !== 'active') return gs
  if (!gs.votingTokensAvailable[vote.voter]) return gs // no token
  if (gs.votesInRound.some(v => v.voter === vote.voter && v.round === vote.round)) return gs // already voted

  return {
    ...gs,
    votesInRound: [...gs.votesInRound, vote],
    votingTokensAvailable: { ...gs.votingTokensAvailable, [vote.voter]: false }
  }
}

export function tally (gs: GameState): Record<Participant, number> {
  const counts: Record<Participant, number> = { Larry: 0 } as any
  getAllAINames().forEach(ai => { counts[ai as Participant] = 0 })
  gs.votesInRound.filter(v => v.round === gs.currentRound).forEach(v => { counts[v.votedFor]++ })
  return counts
}

export function determineElimination (gs: GameState): Participant | null {
  const counts = tally(gs)
  let loser: Participant | null = null
  let max = -1
  Object.entries(counts).forEach(([p, c]) => {
    if (!gs.eliminatedParticipants.includes(p as Participant) && c > max) {
      max = c; loser = p as Participant
    }
  })
  return max > 0 ? loser : null
}

export function eliminate (gs: GameState, participant: Participant): GameState {
  return {
    ...gs,
    eliminatedParticipants: [...gs.eliminatedParticipants, participant],
    votingPhase: 'idle',
    currentRound: gs.currentRound + 1,
    votesInRound: [],
    votingTokensAvailable: Object.fromEntries(
      getAllAINames().map(ai => [ai, false])
    ) as Record<Participant, boolean>,
    nextVotingTime: Date.now() + 120_000
  }
}
