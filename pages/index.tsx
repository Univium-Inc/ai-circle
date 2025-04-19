// pages/index.tsx
import { useEffect, useState, useCallback } from 'react';
import { getAIResponse } from '@/lib/AIEngine';
import { Message, MessageVisibility, Participant, ChatState } from '@/lib/types';
import { AI_PERSONALITIES, getAllAINames } from '@/lib/aiPersonalities';
import { CollapsibleChat } from '@/components/CollapsibleChat';

export default function Home() {
  // Helper: only log when Benny is involved
  const isBenny = (p: Participant) => p === 'Benny';

  // — State Hooks —
  const [messages, setMessages] = useState<Message[]>([]);
  const aiNames = getAllAINames();

  const [chatStates, setChatStates] = useState<Record<string, ChatState>>(() => {
    const init: Record<string, ChatState> = {};
    aiNames.forEach(name => (init[name] = { expanded: false, input: '' }));
    return init;
  });

  const [lastSeen, setLastSeen] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    aiNames.forEach(name => (init[name] = 0));
    return init;
  });

  const [expandedChat, setExpandedChat] = useState<string | null>(null);

  const [tokens, setTokens] = useState<Record<Participant, number>>(() => {
    const init: Partial<Record<Participant, number>> = { Larry: 1 };
    aiNames.forEach(name => (init[name as Participant] = 1));
    return init as Record<Participant, number>;
  });

  const [turnTimer, setTurnTimer] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [turnInProgress, setTurnInProgress] = useState(false);

  // — Benny‐only Logging Hook —
  useEffect(() => {
    let lastLog = 0;
    const logBenny = () => {
      const now = Date.now();
      if (now - lastLog < 15_000) return;
      const bMsgs = messages.filter(
        m => m.sender === 'Benny' || m.recipient === 'Benny'
      );
      if (!bMsgs.length) return;
      console.group('Benny Messages Update');
      console.log('Total Benny-related Messages:', bMsgs.length);
      console.log('Last 5 Benny Messages:', bMsgs.slice(-5));
      console.log('Most Recent Benny Message:', bMsgs[bMsgs.length - 1]);
      console.groupEnd();
      lastLog = now;
    };
    logBenny();
    const iv = setInterval(logBenny, 15_000);
    return () => clearInterval(iv);
  }, [messages]);

  // — Helpers —
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

  // — Process a single AI turn —
  const processAIMessage = async (ai: Exclude<Participant, 'Larry'>) => {
    if (isBenny(ai)) console.group(`Processing for ${ai}`);
    if (isBenny(ai)) console.log('Messages:', messages);

    if (tokens[ai] <= 0) {
      if (isBenny(ai)) console.log(`${ai} has no tokens.`);
      if (isBenny(ai)) console.groupEnd();
      return false;
    }

    setIsProcessing(true);
    try {
      const history = messages
        .filter(m => m.sender === ai || m.recipient === ai)
        .slice(-20);
      if (isBenny(ai)) console.log(`History length for ${ai}:`, history.length);

      const { content, target } = await getAIResponse({
        aiName: ai,
        history,
        userName: 'Larry',
      });

      const validTarget =
        target === 'Larry' || (aiNames.includes(target) && target !== ai);
      const finalTarget = (validTarget ? target : 'Larry') as Participant;
      const visibility = determineVisibility(ai, finalTarget, content.trim());

      const newMsg: Message = {
        sender: ai,
        recipient: finalTarget,
        content: content.trim(),
        timestamp: Date.now(),
        visibility,
      };

      if (isBenny(ai)) console.log(`Benny → ${finalTarget}:`, newMsg);

      setMessages(prev => [...prev, newMsg]);
      setTokens(prev => ({ ...prev, [ai]: prev[ai] - 1 }));
      return true;
    } catch (err) {
      if (isBenny(ai)) console.error(`Error for ${ai}:`, err);
      return false;
    } finally {
      setIsProcessing(false);
      if (isBenny(ai)) console.groupEnd();
    }
  };

  // — Process all AI turns —
  const processTurn = async () => {
    if (turnInProgress) return;
    setTurnInProgress(true);

    const order = [...aiNames].sort(() => Math.random() - 0.5);
    if (order.includes('Benny')) console.log('AI order:', order.join(', '));

    for (const ai of order) {
      if (tokens[ai as Participant] > 0) {
        await processAIMessage(ai as Exclude<Participant, 'Larry'>);
        await new Promise(r => setTimeout(r, 300));
      }
    }

    setTurnInProgress(false);
  };

  // — Send message utility (logs only if Benny is sender or recipient) —
  const sendMessage = (
    sender: Participant,
    recipient: Participant,
    content: string
  ) => {
    if (isBenny(sender) || isBenny(recipient)) {
      console.group('Benny Message');
      console.log('→', sender, '→', recipient, ':', content);
      console.groupEnd();
    }

    if (!content.trim() || tokens[sender] <= 0) return;

    const visibility = determineVisibility(sender, recipient, content.trim());
    const msg: Message = {
      sender,
      recipient,
      content: content.trim(),
      timestamp: Date.now(),
      visibility,
    };

    setMessages(prev => [...prev, msg]);
    setTokens(prev => ({ ...prev, [sender]: prev[sender] - 1 }));

    if (sender === 'Larry') setTimeout(processTurn, 500);
  };

  // — Handlers —
  const sendToAI = (aiName: string) => {
    if (isBenny(aiName as Participant)) console.log(`User → ${aiName}`);
    if (tokens.Larry <= 0 || !chatStates[aiName].input.trim()) return;
    sendMessage('Larry', aiName as Participant, chatStates[aiName].input);
    setChatStates(s => ({
      ...s,
      [aiName]: { ...s[aiName], input: '' },
    }));
  };

  const toggleChat = (aiName: string) => {
    if (isBenny(aiName as Participant)) console.log(`Toggle ${aiName}`);
    if (expandedChat === aiName) {
      setExpandedChat(null);
      setChatStates(s => ({ ...s, [aiName]: { ...s[aiName], expanded: false } }));
    } else {
      if (expandedChat) {
        setChatStates(s => ({
          ...s,
          [expandedChat]: { ...s[expandedChat], expanded: false },
        }));
      }
      setExpandedChat(aiName);
      setChatStates(s => ({ ...s, [aiName]: { ...s[aiName], expanded: true } }));
      setLastSeen(ls => ({ ...ls, [aiName]: Date.now() }));
    }
  };

  const handleInputChange = (aiName: string, v: string) =>
    setChatStates(s => ({ ...s, [aiName]: { ...s[aiName], input: v } }));

  // — Token refresh & turn timer —
  useEffect(() => {
    const turnIv = setInterval(() => {
      setTokens(prev => {
        const next = { ...prev, Larry: prev.Larry + 1 };
        aiNames.forEach(ai => {
          next[ai as Participant] = prev[ai as Participant] + 1;
        });
        if (isBenny('Benny')) console.log('Tokens refreshed for Benny:', next.Benny);
        return next;
      });
      setTurnTimer(30);
      setTimeout(processTurn, 500);
    }, 30_000);

    const countdownIv = setInterval(() => {
      setTurnTimer(t => Math.max(0, t - 1));
    }, 1_000);

    return () => {
      clearInterval(turnIv);
      clearInterval(countdownIv);
    };
  }, []);

  // — Render —
  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6">
      <div className="text-center text-sm text-gray-700">
        <h1 className="text-xl font-bold mb-2">The Circle: AI Edition</h1>
        ⏳ <strong>Next Turn In:</strong> {turnTimer}s<br/>
        🎟 <strong>Tokens</strong> — Larry: {tokens.Larry} |{' '}
        {aiNames.map(ai => (
          <span key={ai}>{ai}: {tokens[ai as Participant]} | </span>
        ))}
      </div>

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
              AI_PERSONALITIES.find(a => a.name === aiName)?.shortDescription
            }
            isExpanded={chatStates[aiName].expanded}
            onToggleExpand={() => toggleChat(aiName)}
            unreadCount={getUnreadCount(aiName)}
          />
        ))}
      </div>

      <div className="w-full max-w-2xl mx-auto bg-white shadow rounded p-4 h-[400px] overflow-y-auto">
        <h2 className="text-lg font-bold mb-2">AI Monitor Log</h2>
        <p className="text-xs text-gray-500 mb-2 italic">
          Watch the AIs interact with each other
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
                m.visibility === 'highlighted' ? 'border border-yellow-300' : ''
              }`}
            >
              <strong>{m.sender} → {m.recipient}:</strong> {m.content}
            </div>
          );
        })}
      </div>

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
