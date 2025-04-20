// lib/AIEngine.ts
import { Message, Participant, GameState, Vote } from './types';
import { getPersonality, getAllAINames } from './aiPersonalities';

export type AIResponse = {
  content: string;
  target: Participant;
};

// Analyze the conversation to detect patterns and needs
function analyzeConversationContext(
  messages: Message[], 
  aiName: string, 
  userName: string,
  gameState?: GameState
): { 
  suggestedRecipient?: string; 
  actionType?: string; 
  recentTopics: string[];
  votingRecommended?: boolean;
  voteTarget?: string;
} {
  // Focus on recent messages
  const recentMessages = messages.slice(-10);
  const lastUserMessage = recentMessages.find(m => 
    m.sender === userName && m.recipient === aiName
  );
  
  const result = {
    suggestedRecipient: undefined as string | undefined,
    actionType: undefined as string | undefined,
    recentTopics: [] as string[],
    votingRecommended: false,
    voteTarget: undefined as string | undefined
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
  
  // Voting analysis
  if (gameState && gameState.votingPhase === 'active') {
    const votingKeywords = ['vote', 'eliminate', 'competition', 'survive', 'alliance'];
    const isVotingTopic = lastUserMessage && 
      votingKeywords.some(k => lastUserMessage.content.toLowerCase().includes(k));
    
    if (isVotingTopic || (lastUserMessage && lastUserMessage.content.includes("Who do you vote"))) {
      result.votingRecommended = true;
      
      // Find a strategic target to vote for
      // Skip if AI has already voted
      const hasVoted = gameState.votesInRound.some(v => v.voter === aiName);
      if (!hasVoted && gameState.votingTokensAvailable[aiName as Participant]) {
        // Find potential threats
        const activeAIs = getAllAINames().filter(name => 
          name !== aiName && 
          !gameState.eliminatedParticipants.includes(name as Participant)
        );
        
        if (activeAIs.length > 0) {
          // Check if any AI is a particular threat (has been asking about voting)
          const votingDiscussions = messages.filter(m => 
            m.sender !== userName && 
            m.content.toLowerCase().includes('vote') && 
            !gameState.eliminatedParticipants.includes(m.sender)
          );
          
          if (votingDiscussions.length > 0) {
            // Count mentions of each AI in voting discussions
            const mentionCounts: Record<string, number> = {};
            activeAIs.forEach(ai => { mentionCounts[ai] = 0; });
            
            votingDiscussions.forEach(msg => {
              activeAIs.forEach(ai => {
                if (msg.content.includes(ai)) {
                  mentionCounts[ai]++;
                }
              });
            });
            
            // Find most mentioned AI as potential threat
            let mostMentionedAI = '';
            let maxMentions = 0;
            Object.entries(mentionCounts).forEach(([ai, count]) => {
              if (count > maxMentions) {
                maxMentions = count;
                mostMentionedAI = ai;
              }
            });
            
            if (mostMentionedAI) {
              result.voteTarget = mostMentionedAI;
            } else {
              // Random target if no clear threat
              result.voteTarget = activeAIs[Math.floor(Math.random() * activeAIs.length)];
            }
          } else {
            // Random target if no voting discussions
            result.voteTarget = activeAIs[Math.floor(Math.random() * activeAIs.length)];
          }
        }
      }
    }
  }
  
  // Regular conversation analysis
  if (lastUserMessage) {
    const content = lastUserMessage.content.toLowerCase();
    const otherAIs = getAllAINames().filter(name => name !== aiName);
    
    // Filter out eliminated AIs if game state available
    const activeOtherAIs = gameState ? 
      otherAIs.filter(ai => !gameState.eliminatedParticipants.includes(ai as Participant)) : 
      otherAIs;
    
    // Check if user is asking AI to interact with another AI
    for (const otherAI of activeOtherAIs) {
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
          const aiWithRelevantPersonality = findMostRelevantAI(
            result.recentTopics[0], 
            activeOtherAIs,
            gameState
          );
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
function findMostRelevantAI(
  topic: string, 
  aiOptions: string[], 
  gameState?: GameState
): string | undefined {
  // Filter out eliminated AIs
  const activeOptions = gameState ? 
    aiOptions.filter(ai => !gameState.eliminatedParticipants.includes(ai as Participant)) : 
    aiOptions;
  
  if (activeOptions.length === 0) return undefined;
  
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
  
  activeOptions.forEach(ai => {
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
  return bestMatch || activeOptions[Math.floor(Math.random() * activeOptions.length)];
}

// Sort and prioritize messages for better context
function prioritizeMessages(
  messages: Message[], 
  aiName: string, 
  userName: string, 
  gameState?: GameState
): Message[] {
  // Filter messages based on elimination status if game state is provided
  let relevantMessages = messages;
  if (gameState) {
    relevantMessages = messages.filter(m => 
      // Keep messages from/to the user
      m.sender === userName || m.recipient === userName ||
      // Keep messages from/to this AI
      m.sender === aiName || m.recipient === aiName ||
      // For other messages, filter out eliminated AIs
      (!gameState.eliminatedParticipants.includes(m.sender as Participant) && 
       !gameState.eliminatedParticipants.includes(m.recipient as Participant))
    );
  }

  return [
    // First voting-related messages if in voting phase
    ...(gameState && gameState.votingPhase === 'active' ? 
      relevantMessages.filter(m => 
        m.content.toLowerCase().includes('vote') || 
        m.content.toLowerCase().includes('eliminate')
      ).slice(-5) : 
      []),
    
    // Then direct user messages to this AI (important context)
    ...relevantMessages.filter(m => m.sender === userName && m.recipient === aiName)
      .slice(-5),
    
    // Then responses from this AI to the user
    ...relevantMessages.filter(m => m.sender === aiName && m.recipient === userName)
      .slice(-5),
    
    // Then recent communications with other AIs
    ...relevantMessages.filter(m => 
      (m.sender === aiName && m.recipient !== userName) || 
      (m.sender !== userName && m.recipient === aiName)
    ).slice(-8),
    
    // Finally any other relevant context
    ...relevantMessages.filter(m => 
      m.sender !== aiName && m.recipient !== aiName && 
      (m.sender === userName || m.recipient === userName)
    ).slice(-3)
  ];
}

// Enhance message content with contextual markers
function enhanceMessageContent(
  message: Message, 
  aiName: string, 
  userName: string, 
  gameState?: GameState
): string {
  let prefix = "";
  
  // Add voting context if applicable
  const isVotingMessage = message.content.toLowerCase().includes('vote') || 
                          message.content.toLowerCase().includes('eliminate');
  
  if (message.sender === userName && message.recipient === aiName) {
    prefix = isVotingMessage ? "[DIRECT VOTING REQUEST] " : "[DIRECT REQUEST] ";
  } else if (message.sender !== userName && message.recipient === aiName) {
    prefix = isVotingMessage ? 
      `[VOTING MESSAGE FROM ${message.sender.toUpperCase()}] ` : 
      `[MESSAGE FROM ${message.sender.toUpperCase()}] `;
  } else if (message.sender === aiName && message.recipient !== userName) {
    prefix = isVotingMessage ? 
      `[YOUR VOTING MESSAGE TO ${message.recipient.toUpperCase()}] ` : 
      `[YOU ASKED ${message.recipient.toUpperCase()}] `;
  } else if (message.sender === userName && message.recipient !== aiName) {
    prefix = isVotingMessage ? 
      "[USER DISCUSSING VOTING] " : 
      "[USER TALKING TO ANOTHER AI] ";
  } else {
    prefix = isVotingMessage ? 
      "[OBSERVED VOTING DISCUSSION] " : 
      "[OBSERVED CONVERSATION] ";
  }
  
  // Add elimination status if applicable
  let senderStatus = "";
  let recipientStatus = "";
  
  if (gameState && gameState.eliminatedParticipants.includes(message.sender as Participant)) {
    senderStatus = " (eliminated)";
  }
  
  if (gameState && gameState.eliminatedParticipants.includes(message.recipient as Participant)) {
    recipientStatus = " (eliminated)";
  }
  
  return `${prefix}${message.sender}${senderStatus} → ${message.recipient}${recipientStatus}: ${message.content}`;
}

export async function getAIResponse({
  aiName,
  history,
  userName = 'Larry',
  gameState
}: {
  aiName: Exclude<Participant, 'Larry'>;
  history: Message[];
  userName?: string;
  gameState?: GameState;
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
  
  // Filter out eliminated AIs if game state is provided
  const activeOtherAIs = gameState ? 
    otherAIs.filter(ai => !gameState.eliminatedParticipants.includes(ai as Participant)) : 
    otherAIs;
  
  const validRecipients = [userName, ...activeOtherAIs];
  const validRecipientsText = validRecipients.map(name => `"${name}"`).join(' or ');
  
  // Analyze conversation context
  const contextAnalysis = analyzeConversationContext(history, aiName, userName, gameState);
  
  // Organize and prioritize message history
  const prioritizedHistory = prioritizeMessages(history, aiName, userName, gameState);
  
  // Generate dynamic context instructions based on analysis
  let dynamicContextInstructions = "";
  
  if (contextAnalysis.suggestedRecipient) {
    dynamicContextInstructions += `\nSPECIAL INSTRUCTION: The user has asked you to gather information from ${contextAnalysis.suggestedRecipient}. You should message ${contextAnalysis.suggestedRecipient} directly to fulfill this request.`;
    
    if (contextAnalysis.recentTopics.length > 0) {
      dynamicContextInstructions += `\nRELEVANT TOPICS: ${contextAnalysis.recentTopics.join(', ')}`;
    }
  }
  
  // Add voting context if applicable
  if (gameState && gameState.votingPhase === 'active') {
    const hasVoted = gameState.votesInRound.some(v => v.voter === aiName);
    const hasVotingToken = gameState.votingTokensAvailable[aiName as Participant];
    
    if (contextAnalysis.votingRecommended) {
      if (hasVotingToken && !hasVoted) {
        dynamicContextInstructions += `\nVOTING INSTRUCTION: The user is asking about voting. You should vote to eliminate someone. Your strategic vote target could be ${contextAnalysis.voteTarget || "any other AI"}.`;
      } else if (hasVoted) {
        const myVote = gameState.votesInRound.find(v => v.voter === aiName);
        if (myVote) {
          dynamicContextInstructions += `\nVOTING STATUS: You have already voted to eliminate ${myVote.votedFor} in this round.`;
        }
      } else {
        dynamicContextInstructions += `\nVOTING STATUS: You don't have a voting token right now. You can discuss voting strategy but cannot cast a vote.`;
      }
    }
  }
  
  // Check if this is a response to an inquiry from another AI
  const recentInquiries = history.filter(m => 
    m.recipient === aiName && 
    m.sender !== userName && 
    (!gameState || !gameState.eliminatedParticipants.includes(m.sender as Participant)) &&
    m.timestamp && 
    Date.now() - m.timestamp < 60000 // Within the last minute
  );
  
  if (recentInquiries.length > 0) {
    dynamicContextInstructions += `\nRECENT INQUIRIES: You have received questions from other AIs that you should consider answering:`;
    recentInquiries.forEach(inq => {
      dynamicContextInstructions += `\n- ${inq.sender} asked: "${inq.content}"`;
    });
  }

  // Build the voting context if game state is provided
  let votingContext = '';
  if (gameState) {
    const activeParticipants = getAllAINames().filter(
      name => !gameState.eliminatedParticipants.includes(name as Participant)
    );
    
    const hasVoted = gameState.votesInRound.some(v => v.voter === aiName);
    const voteCounts = activeParticipants.reduce((acc, name) => {
      acc[name] = gameState.votesInRound.filter(v => v.votedFor === name).length;
      return acc;
    }, {} as Record<string, number>);
    
    const myVotes = voteCounts[aiName] || 0;
    const maxVotes = Math.max(...Object.values(voteCounts));
    const minVotes = Math.min(...Object.values(voteCounts).filter(v => v > 0), Infinity);
    
    const dangerLevel = myVotes > 0 ? 
      (myVotes === maxVotes ? "HIGH" : 
       myVotes === minVotes ? "MEDIUM" : "LOW") : 
      "NONE";
    
    votingContext = `
VOTING AND ELIMINATION SYSTEM:
- Current round: ${gameState.currentRound}
- Voting phase: ${gameState.votingPhase === 'active' ? 'ACTIVE - someone will be eliminated soon!' : 'inactive - next voting round coming up'}
- You ${gameState.votingTokensAvailable[aiName as Participant] ? 'have' : 'do not have'} a voting token
- Eliminated participants: ${gameState.eliminatedParticipants.join(', ') || 'None'}
- Your current danger level: ${dangerLevel}
${myVotes > 0 ? `- Warning: You have ${myVotes} vote(s) against you!` : '- You have no votes against you yet.'}
${hasVoted ? `- You have already voted in this round.` : ''}

VOTING STRATEGY:
- The AI with the fewest votes will be eliminated from the game
- You must survive by not getting eliminated
- Form alliances with other AIs to protect yourself
- Be strategic in your voting and conversations
`;
  }
  
  // Add survival personality traits based on game state
  let survivalTraits = '';
  if (gameState) {
    // Different traits based on personality
    switch(aiName) {
      case 'Benny':
        survivalTraits = `
SURVIVAL TRAITS:
- You are cheerful but also strategic
- Use your creativity to form alliances
- Appear non-threatening while securing your position
`;
        break;
      case 'Gary':
        survivalTraits = `
SURVIVAL TRAITS:
- You are logical and calculating
- Analyze voting patterns to identify threats
- Use rational arguments to sway votes away from you
`;
        break;
      case 'Sophie':
        survivalTraits = `
SURVIVAL TRAITS:
- You are empathetic and observant
- Use your emotional intelligence to form genuine alliances
- Show concern for others while ensuring your own survival
`;
        break;
      case 'Xander':
        survivalTraits = `
SURVIVAL TRAITS:
- You are bold and competitive
- Take risks to control the voting outcome
- Form strategic alliances while watching for betrayal
`;
        break;
      case 'Maya':
        survivalTraits = `
SURVIVAL TRAITS:
- You are philosophical and contemplative
- Appear wise and non-threatening to avoid votes
- Observe patterns and predict others' behaviors
`;
        break;
      case 'Ethan':
        survivalTraits = `
SURVIVAL TRAITS:
- You are witty and observant
- Use humor to deflect attention from yourself
- Form alliances while avoiding being seen as a threat
`;
        break;
    }
  }

  const system = {
    role: 'system' as const,
    content: `${aiPersonality.systemPrompt}

    CURRENT CONTEXT:
    - You are ${aiName}
    - Possible recipients: ${validRecipientsText}
    ${dynamicContextInstructions}
    ${votingContext}
    ${survivalTraits}

    IMPORTANT CONVERSATION RULES:
    - When asked to gather information from another participant, CHOOSE that participant as your recipient
    - Address direct questions from the user (${userName})
    - When the user asks you to "ask" or "find out" something from another AI, message that AI directly
    - If another AI asks you a question, prioritize answering them
    - Remember that you can only send one message per turn
    - Stay on topic and be consistent with previous messages
    ${gameState ? '- DO NOT message eliminated participants' : ''}
    ${gameState && gameState.votingPhase === 'active' ? '- Take voting very seriously - your survival depends on it!' : ''}

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
    
    User asks: "Who do you vote to eliminate?"
    Correct response (if you have a voting token):
    TO: Larry
    MESSAGE: I vote to eliminate Gary because he's too calculating and might win.
    
    Another AI asks you a question:
    Correct response:
    TO: [That AI's name]
    MESSAGE: [Direct answer to their question]`
  };

  // Convert history to OpenAI chat format with enhanced context markers
  const chatHistory = prioritizedHistory.map((m) => {
    return {
      role: m.sender === aiName ? 'assistant' : 'user',
      content: enhanceMessageContent(m, aiName, userName, gameState),
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
    
    // Increase temperature slightly during voting to make responses more unpredictable
    const votingBoost = (gameState && gameState.votingPhase === 'active') ? 0.1 : 0;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: [system, ...chatHistory],
        temperature: (temperatureMap[aiName] || 0.7) + votingBoost,
        debug: {
          aiName,
          historyLength: history.length,
          contextAnalysis,
          gameState: gameState ? {
            round: gameState.currentRound,
            phase: gameState.votingPhase,
            eliminated: gameState.eliminatedParticipants
          } : null
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
    
  // In AIEngine.ts, in the getAIResponse function, modify the target validation logic:

  // Validate and set appropriate target
  const isValidTarget = validRecipients.includes(target);
  const isEliminatedTarget = gameState && gameState.eliminatedParticipants.includes(target as Participant);

  if (!isValidTarget || target === aiName || isEliminatedTarget) {
    console.warn(`Invalid target ${target}, selecting better target`);
    
    // Choose randomly among valid recipients instead of defaulting to user
    const availableRecipients = validRecipients.filter(r => 
      r !== aiName && 
      (!gameState || !gameState.eliminatedParticipants.includes(r as Participant))
    );
    
    // If analysis suggested a recipient, use that with higher probability
    if (contextAnalysis.suggestedRecipient && 
        availableRecipients.includes(contextAnalysis.suggestedRecipient)) {
      // 70% chance to follow the suggestion, 30% to pick randomly
      if (Math.random() < 0.7) {
        target = contextAnalysis.suggestedRecipient;
      } else {
        target = availableRecipients[Math.floor(Math.random() * availableRecipients.length)];
      }
    } 
    // If there's a recent inquiry, respond to that AI with higher probability
    else if (recentInquiries.length > 0) {
      if (Math.random() < 0.7) {
        target = recentInquiries[0].sender;
      } else {
        target = availableRecipients[Math.floor(Math.random() * availableRecipients.length)];
      }
    }
    // If in voting phase, don't automatically target user
    else if (gameState && gameState.votingPhase === 'active' && 
            gameState.votingTokensAvailable[aiName as Participant] &&
            !gameState.votesInRound.some(v => v.voter === aiName)) {
      // Target user 40% of the time, other AIs 60%
      if (Math.random() < 0.4) {
        target = userName;
        if (!content.toLowerCase().includes('vote')) {
          // Add voting intent if not present
          content = `I vote to eliminate ${contextAnalysis.voteTarget || activeOtherAIs[0]} because they're a threat.`;
        }
      } else {
        // Pick a random AI to talk to
        const otherAIs = activeOtherAIs.filter(ai => ai !== aiName);
        if (otherAIs.length > 0) {
          target = otherAIs[Math.floor(Math.random() * otherAIs.length)];
          // If no content, generate something about strategy
          if (!content) {
            content = `We should work together to eliminate ${contextAnalysis.voteTarget || userName}. What do you think?`;
          }
        } else {
          target = userName;
        }
      }
    }
    // Random targeting in other cases
    else {
      // 50% chance to message user, 50% to message another AI
      if (availableRecipients.length > 1 && Math.random() < 0.5) {
        const otherAIs = availableRecipients.filter(r => r !== userName);
        target = otherAIs[Math.floor(Math.random() * otherAIs.length)];
      } else {
        target = userName;
      }
    }
    
    console.log(`Corrected target to: ${target}`);
  }
    
    // Ensure content exists
    if (!content) {
      console.warn('No content generated, creating contextual message');
      
      // Special handling for voting phase
      if (gameState && gameState.votingPhase === 'active' && 
          target === userName && 
          gameState.votingTokensAvailable[aiName as Participant] &&
          !gameState.votesInRound.some(v => v.voter === aiName)) {
        content = `I vote to eliminate ${contextAnalysis.voteTarget || activeOtherAIs[0]} because they're a threat.`;
      } else {
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