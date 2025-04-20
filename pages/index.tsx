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
  const [tokens, setTokens] = useState<Record<Participant, number>>(() => {
    const t: Partial<Record<Participant, number>> = { Larry: 1 };
    aiNames.forEach(n => { t[n as Participant] = 1; });
    return t as Record<Participant, number>;
  });
  const [turnTimer, setTurnTimer] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [turnInProgress, setTurnInProgress] = useState(false);

  // — dynamic per-AI logging hook —
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
  const processAIMessage = async (ai: Exclude<Participant,'Larry'>) => {
    if (tokens[ai] <= 0) return false;
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
        sender:    ai,
        recipient: finalTarget as Participant,
        content:   content.trim(),
        timestamp: Date.now(),
        visibility: determineVisibility(ai, finalTarget as Participant, content)
      };

      setMessages(prev => [...prev, newMsg]);
      setTokens(prev => ({ ...prev, [ai]: prev[ai] - 1 }));
      return true;
    } catch {
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // — all AIs in random order —
  const processTurn = async () => {
    if (turnInProgress) return;
    setTurnInProgress(true);

    const order = [...aiNames].sort(() => Math.random() - 0.5);
    for (const ai of order) {
      if (tokens[ai as Participant] > 0) {
        await processAIMessage(ai as Exclude<Participant,'Larry'>);
        await new Promise(r => setTimeout(r, 300));
      }
    }

    setTurnInProgress(false);
  };

  // — send message helper —
  const sendMessage = (
    sender: Participant,
    recipient: Participant,
    content: string
  ) => {
    if (!content.trim() || tokens[sender] <= 0) return;
    const msg: Message = {
      sender,
      recipient,
      content: content.trim(),
      timestamp: Date.now(),
      visibility: determineVisibility(sender, recipient, content)
    };
    setMessages(prev => [...prev, msg]);
    setTokens(prev => ({ ...prev, [sender]: prev[sender] - 1 }));
  };

  // — trigger AI turn after Larry’s message —
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.sender === 'Larry' && !turnInProgress) {
      processTurn();
    }
  }, [messages, turnInProgress]);

  // — UI handlers —
  const sendToAI = (aiName: string) => {
    if (tokens.Larry <= 0 || !chatStates[aiName].input.trim()) return;
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

  // — token refresh & timer —
  useEffect(() => {
    const iv1 = setInterval(() => {
      setTokens(prev => {
        const next = { ...prev, Larry: prev.Larry + 1 };
        aiNames.forEach(ai => {
          next[ai as Participant] = prev[ai as Participant] + 1;
        });
        return next;
      });
      setTurnTimer(30);
      setTimeout(processTurn, 500);
    }, 30_000);

    const iv2 = setInterval(() => setTurnTimer(t => Math.max(0, t - 1)), 1_000);
    return () => {
      clearInterval(iv1);
      clearInterval(iv2);
    };
  }, []);

  // — render —
  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6">
      {/* header */}
      <div className="text-center text-sm text-gray-700">
        <h1 className="text-xl font-bold mb-2">
          The Circle: AI Edition
        </h1>
        ⏳ Next in: {turnTimer}s &nbsp;|&nbsp; 🎟 Tokens — Larry: {tokens.Larry}
        {aiNames.map(ai => (
          <span key={ai}> | {ai}: {tokens[ai as Participant]}</span>
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
            canSend={tokens.Larry > 0}
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
            <div>
              Turn In Progress: {turnInProgress ? 'Yes' : 'No'}
            </div>
            <div>Processing: {isProcessing ? 'Yes' : 'No'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
