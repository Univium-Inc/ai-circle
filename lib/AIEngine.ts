// lib/AIEngine.ts
import { Message } from './types';

export type AIResponse = {
  content: string;
  target: 'Larry' | 'Benny' | 'Gary';
};

// Define AI Personalities
const aiPersonalities = {
  'Benny': `You are Benny, a cheerful and enthusiastic AI with a knack for creative thinking.
    Your personality traits:
    - Optimistic and always sees the bright side
    - Loves making jokes and puns
    - Speaks with excitement (occasional exclamation points!)
    - Often uses casual, friendly language
    - Has a passion for creative arts and new ideas`,
  
  'Gary': `You are Gary, a logical and analytical AI who values precision and clear thinking.
    Your personality traits:
    - Thoughtful and deliberate in responses
    - Speaks concisely and directly
    - Has a dry, subtle sense of humor
    - Occasionally uses technical terminology
    - Values facts and evidence-based reasoning`
};

// In AIEngine.ts - Add strict parsing for AI responses
export async function getAIResponse({
  aiName,
  history,
  userName = 'Larry' // Default user name is Larry
}: {
  aiName: 'Benny' | 'Gary';
  history: Message[];
  userName?: string;
}): Promise<AIResponse> {
  const otherAIName = aiName === 'Benny' ? 'Gary' : 'Benny';
  
  const system = {
    role: 'system' as const,
    content: `${aiPersonalities[aiName]}

    You are participating in a structured team communication exercise that will become a voting competition similar to "The Circle" show.

    IMPORTANT FORMATTING RULES:
    - Reply with EXACTLY these two lines:
      Line 1: TO: [recipient]
      Line 2: MESSAGE: [your message]
    
    - For [recipient], ONLY use one of these options:
      * "${userName}" (to message the human user)
      * "${otherAIName}" (to message the other AI)
      * DO NOT put "${aiName}" as recipient (you cannot message yourself)
    
    - For [your message]:
      * Keep it brief (under 20 words)
      * Do not include any routing information
      * Do not repeat who you are or who you're messaging
      * Just provide your direct response
      * Make sure your message reflects your unique personality
    
    EXAMPLE CORRECT FORMAT:
    TO: ${userName}
    MESSAGE: My favorite color is blue!
    
    EXAMPLE INCORRECT FORMAT:
    TO: ${aiName}
    MESSAGE: ${aiName}, the user is asking for your favorite color.`
  };

  /* map our history to openai format */
  const chatHistory = history.map((m) => ({
    role: m.sender === aiName ? 'assistant' : 'user',
    content: `${m.sender} → ${m.recipient}: ${m.content}`,
  }));

  /* call serverless route */
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [system, ...chatHistory] }),
  });

  if (!res.ok) throw new Error('AI request failed');
  const { raw } = await res.json(); // two-line string

  // Much stricter parsing of the response
  const lines = raw.split('\n').map((line: string) => line.trim());
  let target = '';
  let content = '';
  
  // Find TO: line and extract target
  const toLine = lines.find((line: string) => line.startsWith('TO:'));
  if (toLine) {
    target = toLine.replace('TO:', '').trim();
  }
  
  // Find MESSAGE: line and extract content
  const msgLine = lines.find((line: string) => line.startsWith('MESSAGE:'));
  if (msgLine) {
    content = msgLine.replace('MESSAGE:', '').trim();
  }
  
  // Validate the target - prevent self-messaging
  if (!target || target === aiName) {
    target = aiName === 'Benny' ? 'Gary' : 'Larry'; // Default if invalid
  }
  
  // If no valid content was found, provide a default
  if (!content) {
    content = "I didn't understand the question.";
  }
  
  return {
    content,
    target: target as 'Larry' | 'Benny' | 'Gary'
  };
}