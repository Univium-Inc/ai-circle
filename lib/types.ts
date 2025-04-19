// lib/types.ts - Updated with expanded AI support

// Define a specific type for message visibility
export type MessageVisibility = 'public' | 'private' | 'highlighted';

// Define all possible participants
export type Participant = 'Larry' | 'Benny' | 'Gary' | 'Sophie' | 'Xander' | 'Maya' | 'Ethan';

export type Message = {
  sender: Participant;
  recipient: Participant;
  content: string;
  timestamp?: number;
  visibility: MessageVisibility;
};

// Add any additional types you might need for your voting competition
export type Vote = {
  voter: Participant;
  votedFor: Participant;
  reason?: string;
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

// Track the state of the chat UI
export type ChatState = {
  expanded: boolean;
  input: string;
};