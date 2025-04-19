// pages/index.tsx - Enhanced with comprehensive logging and message tracking
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { getAIResponse } from '@/lib/AIEngine';
import { Message, MessageVisibility, Participant, ChatState } from '@/lib/types';
import { AI_PERSONALITIES, getAllAINames } from '@/lib/aiPersonalities';
import { CollapsibleChat } from '@/components/CollapsibleChat';

export default function Home() {
  // All messages in the system
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Get AI names
  const aiNames = getAllAINames();
  
  // User inputs and chat states for each AI
  const [chatStates, setChatStates] = useState<Record<string, ChatState>>(() => {
    const initialStates: Record<string, ChatState> = {};
    aiNames.forEach(name => {
      initialStates[name] = {
        expanded: false,
        input: ''
      };
    });
    return initialStates;
  });
  
  // Last seen message timestamps to track unread messages
  const [lastSeen, setLastSeen] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    aiNames.forEach(name => {
      initial[name] = 0;
    });
    return initial;
  });
  
  // Track which chat is currently expanded
  const [expandedChat, setExpandedChat] = useState<string | null>(null);
  
  // Tokens - everyone starts with 1
  const [tokens, setTokens] = useState<Record<Participant, number>>(() => {
    const initial: Partial<Record<Participant, number>> = {
      Larry: 1
    };
    
    aiNames.forEach(name => {
      initial[name as Participant] = 1;
    });
    
    return initial as Record<Participant, number>;
  });
  
  const [turnTimer, setTurnTimer] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [turnInProgress, setTurnInProgress] = useState(false);

  // Comprehensive logging for message changes
  useEffect(() => {
    // Tracking variable to prevent multiple logs
    let lastLogTime = 0;
  
    const logBennyMessages = () => {
      const currentTime = Date.now();
      
      // Check if last log was more than 15 seconds ago
      if (currentTime - lastLogTime > 15000) {
        // Filter messages involving Benny
        const bennyMessages = messages.filter(
          m => m.sender === 'Benny' || m.recipient === 'Benny'
        );
  
        if (bennyMessages.length > 0) {
          console.group('Benny Messages Update');
          console.log('Total Benny-related Messages:', bennyMessages.length);
          console.log('Last 5 Benny Messages:', bennyMessages.slice(-5));
          console.log('Most Recent Benny Message:', bennyMessages[bennyMessages.length - 1]);
          console.groupEnd();
  
          // Update last log time
          lastLogTime = currentTime;
        }
      }
    };
  
    // Call logging function
    logBennyMessages();
  
    // Optional: If you want to keep checking periodically
    const intervalId = setInterval(logBennyMessages, 15000);
  
    // Cleanup
    return () => clearInterval(intervalId);
  }, [messages]);

  // Function to toggle chat expansion
  const toggleChatExpansion = (aiName: string) => {
    console.log(`Toggling chat for: ${aiName}`);
    
    if (expandedChat === aiName) {
      setExpandedChat(null);
      setChatStates(prev => ({
        ...prev,
        [aiName]: {
          ...prev[aiName],
          expanded: false
        }
      }));
    } else {
      if (expandedChat) {
        setChatStates(prev => ({
          ...prev,
          [expandedChat]: {
            ...prev[expandedChat],
            expanded: false
          }
        }));
      }
      
      setExpandedChat(aiName);
      setChatStates(prev => ({
        ...prev,
        [aiName]: {
          ...prev[aiName],
          expanded: true
        }
      }));
      
      setLastSeen(prev => ({
        ...prev,
        [aiName]: Date.now()
      }));
    }
  };
  
  // Get filtered messages for each chat view
  const getUserToAIMessages = useCallback((aiName: string) => {
    const filteredMessages = messages.filter(
      m => (m.sender === 'Larry' && m.recipient === aiName) ||
           (m.sender === aiName && m.recipient === 'Larry')
    );
    
    //console.log(`Messages for ${aiName}:`, filteredMessages.length);
    return filteredMessages;
  }, [messages]);

  const getMonitorMessages = useCallback(() => {
    const aiToAiMessages = messages.filter(
      m => m.sender !== 'Larry' && m.recipient !== 'Larry'
    );
    
    //console.log('AI to AI Messages:', aiToAiMessages.length);
    return aiToAiMessages;
  }, [messages]);
  
  // Count unread messages for an AI
  const getUnreadCount = useCallback((aiName: string) => {
    const unreadCount = messages.filter(
      m => m.sender === aiName && 
           m.recipient === 'Larry' && 
           m.timestamp && 
           m.timestamp > (lastSeen[aiName] || 0)
    ).length;
    
    //console.log(`Unread messages from ${aiName}:`, unreadCount);
    return unreadCount;
  }, [messages, lastSeen]);

  // Determine message visibility based on context
  const determineVisibility = (
    sender: Participant, 
    recipient: Participant,
    content: string
  ): MessageVisibility => {
    // Messages between AIs are private
    if (sender !== 'Larry' && recipient !== 'Larry') {
      return 'private';
    }
    
    // Highlight messages containing specific keywords
    const highlightKeywords = ['vote', 'favorite', 'best', 'choose', 'like', 'prefer'];
    if (highlightKeywords.some(keyword => content.toLowerCase().includes(keyword))) {
      return 'highlighted';
    }
    
    // Default is public
    return 'public';
  };

  // Process a single AI response
  const processAIMessage = async (ai: Exclude<Participant, 'Larry'>) => {
    console.group(`Processing Message for ${ai}`);
    console.log('All Messages:', messages);
    
    // Log all messages related to this AI
    const relatedMessages = messages.filter(
      m => m.sender === ai || m.recipient === ai
    );
    
    console.log(`Related Messages for ${ai}:`, {
      total: relatedMessages.length,
      details: relatedMessages.map(m => ({
        sender: m.sender,
        recipient: m.recipient,
        content: m.content
      }))
    });
    
    if (tokens[ai] <= 0) {
      console.log(`${ai} has no tokens, skipping`);
      return false;
    }
    
    setIsProcessing(true);
    
    try {
      // Get messages relevant to this AI
      const aiHistory = messages.filter(
        m => m.sender === ai || m.recipient === ai
      ).slice(-20);
      
      console.log(`AI History for ${ai}:`, aiHistory.length);
      
      // Get AI response
      const { content, target } = await getAIResponse({
        aiName: ai,
        history: aiHistory,
        userName: 'Larry'
      });
      
      // Validate the target
      const validTarget = target === 'Larry' || (aiNames.includes(target) && target !== ai);
      const finalTarget = validTarget ? target : 'Larry';
      
      // Determine visibility of this message
      const visibility = determineVisibility(ai, finalTarget, content.trim());
      
      // Create message
      const newMessage: Message = {
        sender: ai,
        recipient: finalTarget,
        content: content.trim(),
        timestamp: Date.now(),
        visibility: visibility
      };
      
      console.log(`${ai} sending message to ${finalTarget}:`, newMessage);
      
      // Add message to state
      setMessages(prev => {
        const updatedMessages = [...prev, newMessage];
        console.log('Updated Messages After AI Send:', updatedMessages.length);
        return updatedMessages;
      });
      
      // Deduct token AFTER sending message
      setTokens(prev => ({
        ...prev,
        [ai]: prev[ai] - 1
      }));
      
      return true;
    } catch (error) {
      console.error(`Error processing ${ai} turn:`, error);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // Process AI turns in a random order
  const processTurn = async () => {
    if (turnInProgress) {
      console.log('Turn already in progress, skipping');
      return;
    }
    
    setTurnInProgress(true);
    
    try {
      // Randomize processing order of all AIs
      const shuffledAIs = [...aiNames].sort(() => Math.random() - 0.5);
      
      console.log(`Processing AIs in order: ${shuffledAIs.join(', ')}`);
      
      // Process each AI in the random order
      for (const ai of shuffledAIs) {
        if (tokens[ai as Participant] > 0) {
          await processAIMessage(ai as Exclude<Participant, 'Larry'>);
          // Small delay between AIs
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } finally {
      setTurnInProgress(false);
    }
  };

  // Send message function for user
  const sendMessage = (sender: Participant, recipient: Participant, content: string) => {
    console.group('Sending Message');
    console.log('Sender:', sender);
    console.log('Recipient:', recipient);
    console.log('Content:', content);
    console.log('Current Messages Before:', messages);
    console.log(`Sending message from ${sender} to ${recipient}:`, content);
    
    if (!content.trim() || tokens[sender] <= 0) {
      console.log('Message send blocked:', {
        content: content.trim(),
        tokens: tokens[sender]
      });
      return;
    }
    
    // Determine message visibility
    const visibility = determineVisibility(sender, recipient, content.trim());
    
    // Create message
    const newMessage: Message = {
      sender,
      recipient,
      content: content.trim(),
      timestamp: Date.now(),
      visibility: visibility
    };
    
    // Add message to state
    setMessages(prev => {
      const updatedMessages = [...prev, newMessage];
      console.log('Updated Messages After User Send:', updatedMessages.length);
      return updatedMessages;
    });
    
    // Deduct token
    setTokens(prev => ({
      ...prev,
      [sender]: prev[sender] - 1
    }));
    
    // If the user sent a message, trigger AI responses after a delay
    if (sender === 'Larry') {
      setTimeout(() => {
        processTurn();
      }, 500);
    }
    console.log('Current Messages After:', messages);
    console.groupEnd();
  };

  // User send functions
  const sendToAI = (aiName: string) => {
    console.log(`Preparing to send to ${aiName}`);
    
    if (tokens.Larry <= 0 || !chatStates[aiName].input.trim()) {
      console.log('Send to AI blocked:', {
        tokens: tokens.Larry,
        input: chatStates[aiName].input
      });
      return;
    }
    
    sendMessage('Larry', aiName as Participant, chatStates[aiName].input);
    
    // Clear input
    setChatStates(prev => ({
      ...prev,
      [aiName]: {
        ...prev[aiName],
        input: ''
      }
    }));
  };
  
  // Handle input change
  const handleInputChange = (aiName: string, value: string) => {
    setChatStates(prev => ({
      ...prev,
      [aiName]: {
        ...prev[aiName],
        input: value
      }
    }));
  };

  // Turn timer effect - replenish tokens every 30 seconds
  useEffect(() => {
    const turnInterval = setInterval(() => {
      setTokens(prev => {
        const newTokens = { ...prev };
        
        // Add token for the user
        newTokens.Larry = prev.Larry + 1;
        
        // Add tokens for all AIs
        aiNames.forEach(ai => {
          newTokens[ai as Participant] = prev[ai as Participant] + 1;
        });
        
        console.log('Tokens refreshed:', newTokens);
        return newTokens;
      });
      
      setTurnTimer(30);
      
      // Process AI turns after token refresh
      setTimeout(() => {
        processTurn();
      }, 500);
    }, 30000);
    
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setTurnTimer(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => {
      clearInterval(turnInterval);
      clearInterval(countdownInterval);
    };
  }, []);

  // Render component (rest of the component remains the same as your original implementation)
  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6">
      {/* [Your existing render logic remains unchanged] */}
      <div className="text-center text-sm text-gray-700">
        <h1 className="text-xl font-bold mb-2">The Circle: AI Edition</h1>
        ⏳ <strong>Next Turn In:</strong> {turnTimer}s<br/>
        🎟 <strong>Tokens</strong> — Larry: {tokens.Larry} | 
        {aiNames.map(ai => (
          <span key={ai}> {ai}: {tokens[ai as Participant]} |</span>
        ))}
      </div>

      {/* Chat boxes - Stacked collapsible chats */}
      <div className="flex flex-col space-y-2 w-full max-w-2xl mx-auto">
        {aiNames.map(aiName => {
          const aiPersonality = AI_PERSONALITIES.find(ai => ai.name === aiName);
          const unreadCount = getUnreadCount(aiName);
          
          return (
            <CollapsibleChat
              key={aiName}
              title={`Chat with ${aiName}`}
              aiName={aiName}
              messages={getUserToAIMessages(aiName)}
              input={chatStates[aiName].input}
              onInputChange={(value) => handleInputChange(aiName, value)}
              onSend={() => sendToAI(aiName)}
              canSend={tokens.Larry > 0}
              personality={aiPersonality?.shortDescription}
              isExpanded={chatStates[aiName].expanded}
              onToggleExpand={() => toggleChatExpansion(aiName)}
              unreadCount={unreadCount}
            />
          );
        })}
      </div>

      {/* Monitor panel - Always visible */}
      <div className="w-full max-w-2xl mx-auto bg-white shadow rounded p-4 h-[400px] overflow-y-auto">
        <h2 className="text-lg font-bold mb-2">AI Monitor Log</h2>
        <p className="text-xs text-gray-500 mb-2 italic">
          Watch the AIs interact with each other
        </p>
        {getMonitorMessages().map((m, i) => {
          // Find the AI personality to determine its color
          const aiIndex = AI_PERSONALITIES.findIndex(ai => ai.name === m.sender);
          const colorClasses = [
            'bg-blue-50', 'bg-green-50', 'bg-purple-50', 
            'bg-pink-50', 'bg-yellow-50', 'bg-indigo-50'
          ];
          // Determine background color based on sender
          const bgColorClass = colorClasses[aiIndex % colorClasses.length];
          
          return (
            <div 
              key={i} 
              className={`p-2 text-xs rounded my-1 ${bgColorClass} ${
                m.visibility === 'highlighted' 
                  ? 'border border-yellow-300' 
                  : ''
              }`}
            >
              <strong>{m.sender} → {m.recipient}:</strong> {m.content}
            </div>
          );
        })}
      </div>

      {/* Debug panel (optional) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="w-full max-w-2xl mx-auto mt-4 p-4 bg-gray-800 text-white rounded">
          <h3 className="text-sm font-bold mb-2">Debug Panel</h3>
          <div className="text-xs">
            <div>Expanded Chat: {expandedChat || 'None'}</div>
            <div>Turn Timer: {turnTimer}s</div>
            <div>Processing: {isProcessing ? 'Yes' : 'No'}</div>
            <div>Turn In Progress: {turnInProgress ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}
    </div>
  );
}