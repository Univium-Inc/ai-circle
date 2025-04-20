// lib/types.ts - Add these types for voting

// Define a specific type for message visibility
export type MessageVisibility = 'public' | 'private' | 'highlighted';

// Define all possible participants
export type Participant = 'Larry' | 'Benny' | 'Gary' | 'Sophie' | 'Xander' | 'Maya' | 'Ethan';

export type Sender = Participant | 'Host';
export type Recipient = Participant | 'Host' | 'All';

export type Message = {
  sender: Sender;
  recipient: Recipient;
  content: string;
  timestamp?: number;
  visibility: MessageVisibility;
};

// New type for votes
export type Vote = {
  voter: Participant;
  votedFor: Participant;
  timestamp: number;
  round: number;
};

export type AIPersonality = {
  name: Exclude<Participant, 'Larry'>;
  shortDescription: string;
  traits: string[];
  interests: string[];
  communicationStyle: string;
  avatar?: string; // URL to avatar image if you want to display one
  systemPrompt: string;
};

// Extended ChatState with elimination tracking
export type ChatState = {
  expanded: boolean;
  input: string;
  isEliminated?: boolean; // Track if AI is eliminated
};

// Game state for voting mechanism
export interface GameState {
  currentRound: number;
  votingPhase: 'idle' | 'active';
  votesInRound: Vote[];
  eliminatedParticipants: Participant[];
  votingTokensAvailable: Record<Participant, boolean>;
  nextVotingTime: number;
  nextEliminationTime: number;
  nextTokenAt: number; // Added this property
}