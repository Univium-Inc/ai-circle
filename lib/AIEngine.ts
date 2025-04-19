// In lib/AIEngine.ts
import { Message } from './types';

export type AIResponse = {
  content: string;
  target: 'user' | 'AI 1' | 'AI 2';
};

export async function getAIResponse({
  aiName,
  secretWord,
  history,
}: {
  aiName: 'AI 1' | 'AI 2';
  secretWord: string;
  history: Message[];
}): Promise<AIResponse> {
  /* prepend game-specific system context for THIS AI */
  const system = {
    role: 'system' as const,
    content: `
You are ${aiName}.
Your secret word is "${secretWord}" - don't reveal it unless directly asked.
Rules recap:
  • You have a conversation with the user and another AI.
  • You can only send one message per turn.
  • Always respond to questions directed at you.
  • If asked to do something by the user, try to follow their instructions.

Remember: you MUST output exactly:

TO: <target>
MESSAGE: <text>

Where <target> is 'user', 'AI 1', or 'AI 2' (not yourself), and <text> is your message.
`,
  };

  /* map our history to openai format */
  const chatHistory = history.map((m) => ({
    role: m.sender === aiName ? 'assistant' : 'user',
    content: `${m.sender}: ${m.content}`,
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
  const target = (toLine?.replace('TO:', '').trim() || 
                 (aiName === 'AI 1' ? 'AI 2' : 'AI 1')) as
                 'user' | 'AI 1' | 'AI 2';
  
  // Make sure AI can't target itself
  const validTarget = target === aiName ? (aiName === 'AI 1' ? 'AI 2' : 'AI 1') : target;
  
  const content = (msgLine || '').replace(/^MESSAGE:\s*/i, '').trim() || raw;

  return { content, target: validTarget };
}