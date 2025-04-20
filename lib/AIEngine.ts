// lib/AIEngine.ts
import { Message, Participant } from './types';
import { getPersonality, getAllAINames } from './aiPersonalities';

export type AIResponse = {
  content: string;
  target: Participant;
};

// Analyze the conversation to detect patterns and needs
function analyzeConversationContext(
  messages: Message[], 
  aiName: string, 
  userName: string
): { suggestedRecipient?: string; actionType?: string; recentTopics: string[] } {
  // Focus on recent messages
  const recentMessages = messages.slice(-10);
  const lastUserMessage = recentMessages.find(m => 
    m.sender === userName && m.recipient === aiName
  );
  
  const result = {
    suggestedRecipient: undefined as string | undefined,
    actionType: undefined as string | undefined,
    recentTopics: [] as string[]
  };
  
  // Extract topics from recent messages
  const topicRegex = /favorite (\w+)|about (\w+)|what (\w+)|(\w+)'s/gi;
  recentMessages.forEach(msg => {
    const matches = [...msg.content.matchAll(topicRegex)];
    matches.forEach(match => {
      const topic = (match[1] || match[2] || match[3] || match[4])?.toLowerCase();
      if (topic && !result.recentTopics.includes(topic)) {
        result.recentTopics.push(topic);
      }
    });
  });
  
  if (lastUserMessage) {
    const content = lastUserMessage.content.toLowerCase();
    const otherAIs = getAllAINames().filter(name => name !== aiName);
    
    // Check if user is asking AI to interact with another AI
    for (const otherAI of otherAIs) {
      if (content.includes(otherAI.toLowerCase())) {
        const inquiryTerms = ['ask', 'find out', 'check', 'get from', 'talk to', 'tell me what', 'see if'];
        
        if (inquiryTerms.some(term => content.includes(term))) {
          result.suggestedRecipient = otherAI;
          result.actionType = "inquiry";
          break;
        }
      }
    }
    
    // If no specific AI was mentioned but an action was requested
    if (!result.suggestedRecipient) {
      const actionRegex = /ask about|find out|check|discover|learn/i;
      if (actionRegex.test(content)) {
        // Choose the most relevant AI based on topic
        if (result.recentTopics.length > 0) {
          const aiWithRelevantPersonality = findMostRelevantAI(result.recentTopics[0], otherAIs);
          if (aiWithRelevantPersonality) {
            result.suggestedRecipient = aiWithRelevantPersonality;
            result.actionType = "topical_inquiry";
          }
        }
      }
    }
  }
  
  return result;
}

// Find the most relevant AI based on their personality and the topic
function findMostRelevantAI(topic: string, aiOptions: string[]): string | undefined {
  const topicAffinities: Record<string, string[]> = {
    "Gary": ["logical", "math", "science", "problem", "efficiency", "system"],
    "Sophie": ["feeling", "emotion", "people", "understand", "help"],
    "Xander": ["adventure", "risk", "challenge", "game", "competition"],
    "Maya": ["philosophy", "meaning", "wisdom", "thought", "deep"],
    "Ethan": ["humor", "joke", "funny", "entertainment", "pop culture"],
    "Benny": ["creative", "art", "fun", "innovative", "cheerful"]
  };

  // Find the AI with most topic affinity
  let bestMatch: string | undefined;
  let highestAffinity = -1;
  
  aiOptions.forEach(ai => {
    const affinities = topicAffinities[ai] || [];
    const affinity = affinities.reduce((score, keyword) => {
      return score + (topic.includes(keyword) ? 1 : 0);
    }, 0);
    
    if (affinity > highestAffinity) {
      highestAffinity = affinity;
      bestMatch = ai;
    }
  });
  
  // If no strong affinity, return a random AI
  return bestMatch || aiOptions[Math.floor(Math.random() * aiOptions.length)];
}

// Sort and prioritize messages for better context
function prioritizeMessages(messages: Message[], aiName: string, userName: string): Message[] {
  return [
    // First direct user messages to this AI (most important context)
    ...messages.filter(m => m.sender === userName && m.recipient === aiName)
              .slice(-5),
    
    // Then responses from this AI to the user
    ...messages.filter(m => m.sender === aiName && m.recipient === userName)
              .slice(-5),
    
    // Then recent communications with other AIs
    ...messages.filter(m => 
      (m.sender === aiName && m.recipient !== userName) || 
      (m.sender !== userName && m.recipient === aiName)
    ).slice(-10),
    
    // Finally any other relevant context
    ...messages.filter(m => 
      m.sender !== aiName && m.recipient !== aiName && 
      (m.sender === userName || m.recipient === userName)
    ).slice(-5)
  ];
}

// Enhance message content with contextual markers
function enhanceMessageContent(message: Message, aiName: string, userName: string): string {
  let prefix = "";
  
  if (message.sender === userName && message.recipient === aiName) {
    prefix = "[DIRECT REQUEST] ";
  } else if (message.sender !== userName && message.recipient === aiName) {
    prefix = `[MESSAGE FROM ${message.sender.toUpperCase()}] `;
  } else if (message.sender === aiName && message.recipient !== userName) {
    prefix = `[YOU ASKED ${message.recipient.toUpperCase()}] `;
  } else if (message.sender === userName && message.recipient !== aiName) {
    prefix = "[USER TALKING TO ANOTHER AI] ";
  } else {
    prefix = "[OBSERVED CONVERSATION] ";
  }
  
  return `${prefix}${message.sender} → ${message.recipient}: ${message.content}`;
}

export async function getAIResponse({
  aiName,
  history,
  userName = 'Larry'
}: {
  aiName: Exclude<Participant, 'Larry'>;
  history: Message[];
  userName?: string;
}): Promise<AIResponse> {
  console.group(`${aiName} AI Response Generation`);
  console.log('Input History Length:', history.length);
  
  const aiPersonality = getPersonality(aiName);
  
  if (!aiPersonality) {
    console.error(`AI personality not found for ${aiName}`);
    throw new Error(`AI personality not found for ${aiName}`);
  }
  
  // Get all other AI names that are not the current AI
  const otherAIs = getAllAINames().filter(name => name !== aiName);
  const validRecipients = [userName, ...otherAIs];
  const validRecipientsText = validRecipients.map(name => `"${name}"`).join(' or ');
  
  // Analyze conversation context
  const contextAnalysis = analyzeConversationContext(history, aiName, userName);
  
  // Organize and prioritize message history
  const prioritizedHistory = prioritizeMessages(history, aiName, userName);
  
  // Generate dynamic context instructions based on analysis
  let dynamicContextInstructions = "";
  
  if (contextAnalysis.suggestedRecipient) {
    dynamicContextInstructions += `\nSPECIAL INSTRUCTION: The user has asked you to gather information from ${contextAnalysis.suggestedRecipient}. You should message ${contextAnalysis.suggestedRecipient} directly to fulfill this request.`;
    
    if (contextAnalysis.recentTopics.length > 0) {
      dynamicContextInstructions += `\nRELEVANT TOPICS: ${contextAnalysis.recentTopics.join(', ')}`;
    }
  }
  
  // Check if this is a response to an inquiry from another AI
  const recentInquiries = history.filter(m => 
    m.recipient === aiName && 
    m.sender !== userName && 
    m.timestamp && 
    Date.now() - m.timestamp < 60000 // Within the last minute
  );
  
  if (recentInquiries.length > 0) {
    dynamicContextInstructions += `\nRECENT INQUIRIES: You have received questions from other AIs that you should consider answering:`;
    recentInquiries.forEach(inq => {
      dynamicContextInstructions += `\n- ${inq.sender} asked: "${inq.content}"`;
    });
  }

  const system = {
    role: 'system' as const,
    content: `${aiPersonality.systemPrompt}

    CURRENT CONTEXT:
    - You are ${aiName}
    - Possible recipients: ${validRecipientsText}
    ${dynamicContextInstructions}

    IMPORTANT CONVERSATION RULES:
    - When asked to gather information from another participant, CHOOSE that participant as your recipient
    - Address direct questions from the user (${userName})
    - When the user asks you to "ask" or "find out" something from another AI, message that AI directly
    - If another AI asks you a question, prioritize answering them
    - Remember that you can only send one message per turn
    - Stay on topic and be consistent with previous messages

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
    
    EXAMPLES:
    User asks: "Can you find out Gary's favorite color?"
    Correct response:
    TO: Gary
    MESSAGE: Hey Gary! What's your favorite color?
    
    User asks: "What did Gary say his favorite color was?"
    Correct response (if Gary previously told you):
    TO: Larry
    MESSAGE: Gary told me his favorite color is blue!
    
    Another AI asks you a question:
    Correct response:
    TO: [That AI's name]
    MESSAGE: [Direct answer to their question]`
  };

  // Convert history to OpenAI chat format with enhanced context markers
  const chatHistory = prioritizedHistory.map((m) => {
    return {
      role: m.sender === aiName ? 'assistant' : 'user',
      content: enhanceMessageContent(m, aiName, userName),
    };
  });

  try {
    // Call API route with temperature variation based on personality
    // More creative personalities get higher temperature
    const temperatureMap: Record<string, number> = {
      "Benny": 0.9,   // Creative, enthusiastic
      "Ethan": 0.85,  // Witty, sarcastic  
      "Xander": 0.8,  // Adventurous, bold
      "Maya": 0.75,   // Philosophical
      "Sophie": 0.7,  // Empathetic
      "Gary": 0.6     // Logical, precise
    };

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: [system, ...chatHistory],
        temperature: temperatureMap[aiName] || 0.7,
        debug: {
          aiName,
          historyLength: history.length,
          contextAnalysis
        }
      }),
    });

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
    
    // Validate and set appropriate target
    const isValidTarget = validRecipients.includes(target);
    if (!isValidTarget || target === aiName) {
      console.warn(`Invalid target ${target}, selecting better target`);
      
      // If analysis suggested a recipient, use that
      if (contextAnalysis.suggestedRecipient) {
        target = contextAnalysis.suggestedRecipient;
      } 
      // If there's a recent inquiry, respond to that AI
      else if (recentInquiries.length > 0) {
        target = recentInquiries[0].sender;
      }
      // Fallback to user
      else {
        target = userName;
      }
      
      console.log(`Corrected target to: ${target}`);
    }
    
    // Ensure content exists
    if (!content) {
      console.warn('No content generated, creating contextual message');
      
      const isInquiry = contextAnalysis.actionType === "inquiry";
      const inquiryTopics = contextAnalysis.recentTopics;
      
      if (isInquiry && inquiryTopics.length > 0) {
        content = `What's your ${inquiryTopics[0]}? ${userName} wanted me to ask you.`;
      } else if (target === userName) {
        content = `I'm here and ready to chat, ${userName}!`;
      } else {
        content = `Hey ${target}, what's your take on our conversation so far?`;
      }
    }

    console.log('Final Response:', { target, content });
    console.groupEnd();

    return {
      content,
      target: target as Participant
    };
  } catch (error) {
    console.error('AI Response Error:', error);
    console.groupEnd();
    
    // Fallback response with more context
    return {
      content: `I was just thinking about your question.`,
      target: userName as Participant
    };
  }
}