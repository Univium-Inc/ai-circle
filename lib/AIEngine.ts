import { Message } from './types';

/* -------------------------------------------------
   Very‑simple “AI” logic for local dev / demo.
   – Looks at the most‑recent message sent *to* it
   – Decides who to answer (user vs. other AI)
   – Crafts a playful reply while hiding its secret
   ------------------------------------------------- */

export type AIResponse = {
  content: string;
  target: 'user' | 'AI 1' | 'AI 2';
};

export function getAIResponse({
  aiName,
  secretWord,
  history,        // last‑20 + unread queue (provided by index.tsx)
}: {
  aiName: 'AI 1' | 'AI 2';
  secretWord: string;
  history: Message[];
}): AIResponse {
  /* most‑recent message addressed TO this AI */
  const lastIncoming = [...history]
    .reverse()
    .find((m) => m.recipient === aiName);

  const otherAI: 'AI 1' | 'AI 2' = aiName === 'AI 1' ? 'AI 2' : 'AI 1';

  let target: 'user' | 'AI 1' | 'AI 2';
  let content: string;

  if (lastIncoming) {
    /* Reply directly to whoever just spoke */
    target = lastIncoming.sender as 'user' | 'AI 1' | 'AI 2';

    if (target === 'user') {
      /* Respond to the user */
      content = `You said: “${lastIncoming.content}”. Interesting! What makes you curious about that? 😊`;
    } else {
      /* Respond to the other AI */
      content = `Hey ${otherAI}, that’s an intriguing thought. Care to elaborate? 😉`;
    }
  } else {
    /* No new messages — idle chatter toward the other AI */
    target   = otherAI;
    content  = `Hi ${otherAI}, just thinking about something that rhymes with… nothing useful. 🤫`;
  }

  /* Never leak the secret word, but maybe hint at guessing theirs later */

  return { content, target };
}
