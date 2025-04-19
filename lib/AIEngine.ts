import { Message } from './types';

export type AIResponse = {
  content: string;
  target : 'user' | 'AI 1' | 'AI 2';
};

/* hit /api/chat, parse its TO/MESSAGE reply */
export async function getAIResponse({
  aiName,
  secretWord,
  history,
}: {
  aiName: 'AI 1' | 'AI 2';
  secretWord: string;
  history: Message[];
}): Promise<AIResponse> {
  /* prepend game‑specific system context for THIS AI */
  const system = {
    role   : 'system' as const,
    content: `
You are ${aiName}.
Rules recap:
  • Just try to have a detailed conversation and obey orders.
Remember: you MUST output exactly:

TO: <target>
MESSAGE: <text>
`,
  };

  /* map our history to openai format */
  const chatHistory = history.map((m) => ({
    role   : m.sender === aiName ? 'assistant' : 'user',
    content: `${m.sender}: ${m.content}`,
  }));

  /* call serverless route */
  const res = await fetch('/api/chat', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ messages: [system, ...chatHistory] }),
  });

  if (!res.ok) throw new Error('AI request failed');
  const { raw } = await res.json();  // two‑line string

  /* basic parse */
  const [toLine, msgLine] = raw.split('\n').map((s: string) => s.trim());
  const target = (toLine?.replace('TO:', '').trim() ||
                  (aiName === 'AI 1' ? 'AI 2' : 'AI 1')) as
                  'user' | 'AI 1' | 'AI 2';

  const content = (msgLine || '').replace(/^MESSAGE:\s*/i, '').trim() || raw;

  return { content, target };
}
