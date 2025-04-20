// pages/index.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { getAIResponse } from '@/lib/AIEngine';
import {
  Message,
  MessageVisibility,
  Participant,
  ChatState
} from '@/lib/types';
import { AI_PERSONALITIES, getAllAINames } from '@/lib/aiPersonalities';
import { CollapsibleChat } from '@/components/CollapsibleChat';

export default function Home() {
  const aiNames = getAllAINames();
  
  // Reference for interval IDs to ensure proper cleanup
  const intervalRefs = useRef<{tokenTimer: NodeJS.Timeout | null, countdownTimer: NodeJS.Timeout | null}>({
    tokenTimer: null,
    countdownTimer: null
  });

  // — state hooks —
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatStates, setChatStates] = useState<Record<string, ChatState>>(() => {
    const s: Record<string, ChatState> = {};
    aiNames.forEach(n => { s[n] = { expanded: false, input: '' }; });
    return s;
  });
  const [lastSeen, setLastSeen] = useState<Record<string, number>>(() => {
    const s: Record<string, number> = {};
    aiNames.forEach(n => { s[n] = 0; });
    return s;
  });
  const [expandedChat, setExpandedChat] = useState<string | null>(null);
  // Only track tokens for AIs
  const [tokens, setTokens] = useState<Record<Participant, number>>(() => {
    return aiNames.reduce((acc, ai) => {
      acc[ai as Participant] = 1;
      return acc;
    }, {} as Record<Participant, number>);
  });
  const [turnTimer, setTurnTimer] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [turnInProgress, setTurnInProgress] = useState(false);
  
  // State to track when a token refresh should happen
  const [shouldRefreshTokens, setShouldRefreshTokens] = useState(false);

  // — per‑AI logging hook —
  const lastLogTimes = useRef<Record<string, number>>(
    aiNames.reduce((acc, ai) => { acc[ai] = 0; return acc; }, {} as Record<string, number>)
  );
  
  useEffect(() => {
    const logAllAIs = () => {
      const now = Date.now();
      aiNames.forEach(ai => {
        if (now - lastLogTimes.current[ai] < 15_000) return;
        const aiMsgs = messages.filter(
          m => m.sender === ai || m.recipient === ai
        );
        if (!aiMsgs.length) return;
        console.group(`${ai} Messages Update`);
        console.log('Total messages:', aiMsgs.length);
        console.log('Last 5 messages:', aiMsgs.slice(-5));
        console.log('Most recent message:', aiMsgs[aiMsgs.length - 1]);
        console.groupEnd();
        lastLogTimes.current[ai] = now;
      });
    };
    logAllAIs();
    const iv = setInterval(logAllAIs, 15_000);
    return () => clearInterval(iv);
  }, [messages, aiNames]);

  // — helpers —
  const determineVisibility = (
    sender: Participant,
    recipient: Participant,
    content: string
  ): MessageVisibility => {
    if (sender !== 'Larry' && recipient !== 'Larry') return 'private';
    const keywords = ['vote','favorite','best','choose','like','prefer'];
    return keywords.some(k => content.toLowerCase().includes(k))
      ? 'highlighted'
      : 'public';
  };

  const getUserToAIMessages = useCallback(
    (aiName: string) =>
      messages.filter(
        m =>
          (m.sender === 'Larry' && m.recipient === aiName) ||
          (m.sender === aiName && m.recipient === 'Larry')
      ),
    [messages]
  );

  const getMonitorMessages = useCallback(
    () => messages.filter(m => m.sender !== 'Larry' && m.recipient !== 'Larry'),
    [messages]
  );

  const getUnreadCount = useCallback(
    (aiName: string) =>
      messages.filter(
        m =>
          m.sender === aiName &&
          m.recipient === 'Larry' &&
          (m.timestamp ?? 0) > (lastSeen[aiName] || 0)
      ).length,
    [messages, lastSeen]
  );

  // — single AI turn —
  const processAIMessage = useCallback(
    async (ai: Exclude<Participant,'Larry'>) => {
      setIsProcessing(true);
      try {
        const history = messages
          .filter(m => m.sender === ai || m.recipient === ai)
          .slice(-20);

        console.log(`Processing turn for ${ai}`, history);

        const { content, target } = await getAIResponse({
          aiName: ai,
          history,
          userName: 'Larry'
        });

        const finalTarget =
          target === 'Larry' || (aiNames.includes(target) && target !== ai)
            ? target
            : 'Larry';

        const newMsg: Message = {
          sender: ai,
          recipient: finalTarget as Participant,
          content: content.trim(),
          timestamp: Date.now(),
          visibility: determineVisibility(ai, finalTarget as Participant, content)
        };

        setMessages(prev => [...prev, newMsg]);
        return true;
      } catch (error) {
        console.error(`Error processing message for ${ai}:`, error);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [aiNames, messages]
  );

  // — all AIs in random order, spending exactly one token each —
  const processTurn = useCallback(
    async () => {
      if (turnInProgress) {
        console.log("Turn already in progress, skipping");
        return;
      }
      
      console.log("Starting new turn with tokens:", tokens);
      setTurnInProgress(true);

      try {
        const available = { ...tokens };
        const order = [...aiNames].sort(() => Math.random() - 0.5);

        for (const ai of order) {
          if (available[ai as Participant] > 0) {
            available[ai as Participant]--;
            console.log(`${ai} spending token, ${available[ai as Participant]} remaining`);
            await processAIMessage(ai as Exclude<Participant,'Larry'>);
            await new Promise(r => setTimeout(r, 300));
          } else {
            console.log(`${ai} has no tokens to spend`);
          }
        }

        setTokens(available);
      } catch (error) {
        console.error("Error in processTurn:", error);
      } finally {
        setTurnInProgress(false);
      }
    },
    [aiNames, tokens, processAIMessage]
  );

  // — send message helper (no user token gating) —
  const sendMessage = (
    sender: Participant,
    recipient: Participant,
    content: string
  ) => {
    if (!content.trim()) return;
    const msg: Message = {
      sender,
      recipient,
      content: content.trim(),
      timestamp: Date.now(),
      visibility: determineVisibility(sender, recipient, content)
    };
    setMessages(prev => [...prev, msg]);
    // only decrement AI tokens elsewhere
  };

  // — trigger AI turn after Larry's message —
  const lastSender = messages[messages.length - 1]?.sender;
  useEffect(() => {
    if (lastSender === 'Larry' && !turnInProgress) {
      processTurn();
    }
  }, [lastSender, processTurn, turnInProgress]);

  // — UI handlers —
  const sendToAI = (aiName: string) => {
    if (!chatStates[aiName].input.trim()) return;
    sendMessage('Larry', aiName as Participant, chatStates[aiName].input);
    setChatStates(s => ({
      ...s,
      [aiName]: { ...s[aiName], input: '' }
    }));
  };

  const toggleChat = (aiName: string) => {
    if (expandedChat === aiName) {
      setExpandedChat(null);
      setChatStates(s => ({
        ...s,
        [aiName]: { ...s[aiName], expanded: false }
      }));
    } else {
      if (expandedChat) {
        setChatStates(s => ({
          ...s,
          [expandedChat]: { ...s[expandedChat], expanded: false }
        }));
      }
      setExpandedChat(aiName);
      setChatStates(s => ({
        ...s,
        [aiName]: { ...s[aiName], expanded: true }
      }));
      setLastSeen(ls => ({ ...ls, [aiName]: Date.now() }));
    }
  };

  const handleInputChange = (aiName: string, v: string) =>
    setChatStates(s => ({ ...s, [aiName]: { ...s[aiName], input: v } }));

  // Timer countdown effect - Uses ref to prevent recreation
  useEffect(() => {
    // Clear any existing interval
    if (intervalRefs.current.countdownTimer) {
      clearInterval(intervalRefs.current.countdownTimer);
    }
    
    // Setup countdown timer
    const countdownInterval = setInterval(() => {
      setTurnTimer(prev => {
        const newValue = Math.max(0, prev - 1);
        // When timer hits zero, trigger token refresh
        if (newValue === 0) {
          setShouldRefreshTokens(true);
        }
        return newValue;
      });
    }, 1000);
    
    // Store reference for cleanup
    intervalRefs.current.countdownTimer = countdownInterval;
    
    return () => {
      if (intervalRefs.current.countdownTimer) {
        clearInterval(intervalRefs.current.countdownTimer);
        intervalRefs.current.countdownTimer = null;
      }
    };
  }, []); // No dependencies to prevent recreation

  // Token refresh effect - Triggered when timer hits zero
  useEffect(() => {
    if (shouldRefreshTokens) {
      console.log("Refreshing tokens and resetting timer");
      
      // Reset tokens
      setTokens(prev => {
        const next = { ...prev };
        aiNames.forEach(ai => {
          next[ai as Participant] = Math.min(prev[ai as Participant] + 1, 3);
        });
        return next;
      });
      
      // Reset timer
      setTurnTimer(30);
      
      // Reset flag
      setShouldRefreshTokens(false);
      
      // Process turn with new tokens
      if (!turnInProgress) {
        setTimeout(() => {
          processTurn();
        }, 500);
      }
    }
  }, [shouldRefreshTokens, aiNames, processTurn, turnInProgress]);

  // Initial setup of token refresh timer
  useEffect(() => {
    // Clear any existing interval
    if (intervalRefs.current.tokenTimer) {
      clearInterval(intervalRefs.current.tokenTimer);
    }
    
    // Create backup timer for token refresh in case the countdown timer fails
    const tokenInterval = setInterval(() => {
      setShouldRefreshTokens(true);
    }, 30000);
    
    intervalRefs.current.tokenTimer = tokenInterval;
    
    return () => {
      if (intervalRefs.current.tokenTimer) {
        clearInterval(intervalRefs.current.tokenTimer);
        intervalRefs.current.tokenTimer = null;
      }
    };
  }, []); // Empty dependency array to run only once

  // — render UI —
  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6">
      {/* header */}
      <div className="text-center text-sm text-gray-700">
        <h1 className="text-xl font-bold mb-2">
          The Circle: AI Edition
        </h1>
        ⏳ Next in: {turnTimer}s
        {aiNames.map(ai => (
          <span key={ai}> | {ai} tokens: {tokens[ai as Participant]}</span>
        ))}
      </div>

      {/* per‑AI chats */}
      <div className="flex flex-col space-y-2 w-full max-w-2xl mx-auto">
        {aiNames.map(aiName => (
          <CollapsibleChat
            key={aiName}
            title={`Chat with ${aiName}`}
            aiName={aiName}
            messages={getUserToAIMessages(aiName)}
            input={chatStates[aiName].input}
            onInputChange={v => handleInputChange(aiName, v)}
            onSend={() => sendToAI(aiName)}
            canSend={true}
            personality={
              AI_PERSONALITIES.find(a => a.name === aiName)
                ?.shortDescription
            }
            isExpanded={chatStates[aiName].expanded}
            onToggleExpand={() => toggleChat(aiName)}
            unreadCount={getUnreadCount(aiName)}
          />
        ))}
      </div>

      {/* AI‑to‑AI monitor */}
      <div className="w-full max-w-2xl mx-auto bg-white shadow rounded p-4 h-[400px] overflow-y-auto">
        <h2 className="text-lg font-bold mb-2">AI Monitor Log</h2>
        <p className="text-xs text-gray-500 mb-2 italic">
          Watch the AIs interact
        </p>
        {getMonitorMessages().map((m, i) => {
          const idx = AI_PERSONALITIES.findIndex(a => a.name === m.sender);
          const colors = [
            'bg-blue-50','bg-green-50','bg-purple-50',
            'bg-pink-50','bg-yellow-50','bg-indigo-50'
          ];
          const bg = colors[idx % colors.length];
          return (
            <div
              key={i}
              className={`p-2 text-xs rounded my-1 ${bg} ${
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

      {/* debug panel */}
      {process.env.NODE_ENV === 'development' && (
        <div className="w-full max-w-2xl mx-auto mt-4 p-4 bg-gray-800 text-white rounded">
          <h3 className="text-sm font-bold mb-2">Debug Panel</h3>
          <div className="text-xs">
            <div>Expanded Chat: {expandedChat || 'None'}</div>
            <div>Turn In Progress: {turnInProgress ? 'Yes' : 'No'}</div>
            <div>Processing: {isProcessing ? 'Yes' : 'No'}</div>
            <div>Turn Timer: {turnTimer}s</div>
            <div>Should Refresh Tokens: {shouldRefreshTokens ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}
    </div>
  );
}