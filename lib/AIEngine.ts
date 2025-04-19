import { Message } from './types';

export function getAIResponse({
  aiName,
  secretWord,
  history,
}: {
  aiName: string;
  secretWord: string;
  history: Message[];
}): { content: string; target: 'user' | 'AI 1' | 'AI 2' } {
  const recipient = Math.random() < 0.5 ? 'user' : aiName === 'AI 1' ? 'AI 2' : 'AI 1';
  const context = history.map(m => `${m.role === 'user' ? 'User' : 'Other'}: ${m.content}`).join('\n');

  const message = `Hey ${recipient}, just thinking about something that rhymes with... nothing important 😉`;

  return {
    content: message,
    target: recipient as 'user' | 'AI 1' | 'AI 2',
  };
}
