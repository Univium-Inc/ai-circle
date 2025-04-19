// lib/AIEngine.ts
import { Message, Participant } from './types';
import { getPersonality, getAllAINames } from './aiPersonalities';

export type AIResponse = {
  content: string;
  target: Participant;
};

// In AIEngine.ts - Add strict parsing for AI responses
export async function getAIResponse({
  aiName,
  history,
  userName = 'Larry' // Default user name is Larry
}: {
  aiName: Exclude<Participant, 'Larry'>;
  history: Message[];
  userName?: string;
}): Promise<AIResponse> {
  const aiPersonality = getPersonality(aiName);
  
  if (!aiPersonality) {
    throw new Error(`AI personality not found for ${aiName}`);
  }
  
  // Get all other AI names that are not the current AI
  const otherAIs = getAllAINames().filter(name => name !== aiName);
  
  // Create a formatted list of valid recipients for the system message
  const validRecipientsText = [`"${userName}"`, ...otherAIs.map(name => `"${name}"`)].join(' or ');
  
  const system = {
    role: 'system' as const,
    content: `${aiPersonality.systemPrompt}

    You are participating in a structured team communication exercise that will become a voting competition similar to "The Circle" show.

    IMPORTANT FORMATTING RULES:
    - Reply with EXACTLY these two lines:
      Line 1: TO: [recipient]
      Line 2: MESSAGE: [your message]
    
    - For [recipient], ONLY use one of these options:
      * ${validRecipientsText}
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
    // If invalid target, pick a random valid recipient
    const validRecipients = [userName, ...otherAIs];
    const randomIndex = Math.floor(Math.random() * validRecipients.length);
    target = validRecipients[randomIndex];
  }
  
  // If no valid content was found, provide a default
  if (!content) {
    content = "I didn't understand the question.";
  }
  
  return {
    content,
    target: target as Participant
  };
}