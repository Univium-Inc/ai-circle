export type Message = {
  sender: string;
  recipient: string;
  content: string;
  timestamp: number;
  isPrivate?: boolean; // Flag for AI-to-AI messages
};