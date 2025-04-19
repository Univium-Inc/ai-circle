// lib/types.ts - Updated with MessageVisibility

// Define a specific type for message visibility
export type MessageVisibility = 'public' | 'private' | 'highlighted';

export type Message = {
  sender: 'Larry' | 'Benny' | 'Gary';
  recipient: 'Larry' | 'Benny' | 'Gary';
  content: string;
  timestamp?: number;
  visibility: MessageVisibility; // Replace isPrivate with visibility
};

// Add any additional types you might need for your voting competition
export type Vote = {
  voter: 'Larry' | 'Benny' | 'Gary';
  votedFor: 'Larry' | 'Benny' | 'Gary';
  reason?: string;
  round: number;
};

export type AIProfileInfo = {
  name: 'Benny' | 'Gary';
  bio: string;
  personalityTraits: string[];
  interests: string[];
  avatar?: string; // URL to avatar image if you want to display one
};