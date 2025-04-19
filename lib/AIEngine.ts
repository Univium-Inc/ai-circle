// lib/AIEngine.ts
import { Message } from './types';

export type AIResponse = {
  content: string;
  target: 'user' | 'AI 1' | 'AI 2';
};

// In AIEngine.ts - Add strict parsing for AI responses

export async function getAIResponse({
  aiName,
  history,
}: {
  aiName: 'AI 1' | 'AI 2';
  history: Message[];
}): Promise<AIResponse> {
  const system = {
    role: 'system' as const,
    content: `
You are ${aiName} in a structured team communication exercise.

IMPORTANT FORMATTING RULES:
- Reply with EXACTLY these two lines:
  Line 1: TO: [recipient]
  Line 2: MESSAGE: [your message]

- For [recipient], ONLY use one of these options:
  * "user" (to message the human user)
  * "${aiName === 'AI 1' ? 'AI 2' : 'AI 1'}" (to message the other AI)
  * DO NOT put "${aiName}" as recipient (you cannot message yourself)

- For [your message]:
  * Keep it brief (under 20 words)
  * Do not include any routing information
  * Do not repeat who you are or who you're messaging
  * Just provide your direct response

EXAMPLE CORRECT FORMAT:
TO: user
MESSAGE: My favorite color is blue.

EXAMPLE INCORRECT FORMAT:
TO: AI 1
MESSAGE: AI 1, the user is asking for your favorite color.
`
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
  const { raw } = await res.json();  // two-line string

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
    target = aiName === 'AI 1' ? 'AI 2' : 'user'; // Default if invalid
  }
  
  // If no valid content was found, provide a default
  if (!content) {
    content = "I didn't understand the question.";
  }
  
  return { 
    content, 
    target: target as 'user' | 'AI 1' | 'AI 2'
  };
}