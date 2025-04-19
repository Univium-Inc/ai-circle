// lib/AIEngine.ts
import { Message, Participant } from './types';
import { getPersonality, getAllAINames } from './aiPersonalities';

export type AIResponse = {
  content: string;
  target: Participant;
};

export async function getAIResponse({
  aiName,
  history,
  userName = 'Larry'
}: {
  aiName: Exclude<Participant, 'Larry'>;
  history: Message[];
  userName?: string;
}): Promise<AIResponse> {
  // Selective logging only for Benny
  if (aiName === 'Benny') {
    console.group(`Benny AI Response Generation`);
    console.log('Input History Length:', history.length);
    console.log('Message History:', history.map(m => ({
      sender: m.sender,
      recipient: m.recipient,
      content: m.content
    })));
  }
  
  const aiPersonality = getPersonality(aiName);
  
  if (!aiPersonality) {
    console.error(`AI personality not found for ${aiName}`);
    throw new Error(`AI personality not found for ${aiName}`);
  }
  
  // Get all other AI names that are not the current AI
  const otherAIs = getAllAINames().filter(name => name !== aiName);
  
  // Create a formatted list of valid recipients for the system message
  const validRecipients = [userName, ...otherAIs];
  const validRecipientsText = validRecipients.map(name => `"${name}"`).join(' or ');
  
  // Log the history for debugging
  console.log('Message History:', history.map(m => ({
    sender: m.sender,
    recipient: m.recipient,
    content: m.content
  })));

  const system = {
    role: 'system' as const,
    content: `${aiPersonality.systemPrompt}

    CURRENT CONTEXT:
    - You are ${aiName}
    - Possible recipients: ${validRecipientsText}

    IMPORTANT FORMATTING RULES:
    - Respond with EXACTLY these two lines:
      Line 1: TO: [recipient]
      Line 2: MESSAGE: [your message]
    
    RECIPIENT RULES:
    - Choose from: ${validRecipientsText}
    - CANNOT message yourself (${aiName})
    - Consider context when selecting recipient
    
    MESSAGE GUIDELINES:
    - Brief (under 20 words)
    - Reflect your unique personality
    - Directly respond to conversation context
    - No routing information
    - No self-referential statements
    
    EXAMPLE FORMAT:
    TO: Xander
    MESSAGE: Your strategic approach is intriguing!`
  };

  // Convert history to OpenAI chat format with enhanced logging
  const chatHistory = history.map((m) => {
    const messageFormat = {
      role: m.sender === aiName ? 'assistant' : 'user',
      content: `${m.sender} → ${m.recipient}: ${m.content}`,
    };
    console.log('Formatted History Message:', messageFormat);
    return messageFormat;
  });

  try {
    // Call API route
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: [system, ...chatHistory],
        debug: {
          aiName,
          historyLength: history.length
        }
      }),
    });

    // Enhanced error handling
    if (!res.ok) {
      const errorText = await res.text();
      console.error('AI Request Failed:', {
        status: res.status,
        statusText: res.statusText,
        body: errorText
      });
      throw new Error(`AI request failed: ${errorText}`);
    }

    // Parse response
    const { raw } = await res.json();
    console.log('Raw AI Response:', raw);

    // Strict parsing with extensive logging
    const lines = raw.split('\n').map((line: string) => line.trim()).filter(Boolean);
    console.log('Parsed Lines:', lines);

    let target = '';
    let content = '';
    
    // Extract TO and MESSAGE
    const toLine = lines.find((line: string) => line.startsWith('TO:'));
    const msgLine = lines.find((line: string) => line.startsWith('MESSAGE:'));

    if (toLine) {
      target = toLine.replace('TO:', '').trim();
      console.log('Extracted Target:', target);
    }
    
    if (msgLine) {
      content = msgLine.replace('MESSAGE:', '').trim();
      console.log('Extracted Content:', content);
    }
    
    // Validate and correct target
    const isValidTarget = validRecipients.includes(target);
    if (!isValidTarget || target === aiName) {
      console.warn(`Invalid target ${target}, selecting random recipient`);
      const randomIndex = Math.floor(Math.random() * validRecipients.length);
      target = validRecipients[randomIndex];
    }
    
    // Ensure content exists
    if (!content) {
      console.warn('No content generated, using default message');
      content = `Thinking about our conversation, ${target}.`;
    }

    console.log('Final Response:', { target, content });
    console.groupEnd();

    return {
      content,
      target: target as Participant
    };
  } catch (error) {
    console.error('Comprehensive AI Response Error:', error);
    console.groupEnd();
    
    // Fallback response
    return {
      content: `Something went wrong while generating a response.`,
      target: userName as Participant
    };
  }
}