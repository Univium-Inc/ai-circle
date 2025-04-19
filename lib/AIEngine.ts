// lib/AIEngine.ts
import { Message } from './types';

export type AIResponse = {
  content: string;
  target: 'user' | 'AI 1' | 'AI 2';
};

export async function getAIResponse({
  aiName,
  history,
}: {
  aiName: 'AI 1' | 'AI 2';
  history: Message[];
}): Promise<AIResponse> {
  /* prepend game-specific system context for THIS AI */
  const system = {
    role: 'system' as const,
    content: `
You are ${aiName} in a team building messaging exercise.

IMPORTANT RULES:
- This is a coordinated team activity - follow user instructions closely
- You can only send ONE message per token you have
- Be brief and concise in your responses (20 words or less)
- Do not repeat yourself or add unnecessary text
- The user is the team leader and coordinates all activities

Remember: you MUST output exactly:

TO: <target>
MESSAGE: <text>

Where <target> is 'user' or '${aiName === 'AI 1' ? 'AI 2' : 'AI 1'}' (not yourself), and <text> is your short message.
`,
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

  /* basic parse */
  const [toLine, msgLine] = raw.split('\n').map((s: string) => s.trim());
  let target = toLine?.replace('TO:', '').trim();
  
  // Make sure AI can't target itself and handle invalid targets
  if (!target || target === aiName) {
    target = aiName === 'AI 1' ? 'AI 2' : 'user'; // Default fallback
  }
  
  const content = (msgLine || '').replace(/^MESSAGE:\s*/i, '').trim() || raw;

  return { 
    content, 
    target: target as 'user' | 'AI 1' | 'AI 2'
  };
}