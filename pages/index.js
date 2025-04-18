import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedAI, setSelectedAI] = useState(null);
  const [msgContent, setMsgContent] = useState('');
  const [msgTokens, setMsgTokens] = useState(1);
  const [atkTokens, setAtkTokens] = useState(1);
  const [msgCountdown, setMsgCountdown] = useState(30);
  const [atkCountdown, setAtkCountdown] = useState(60);
  const [lastRead, setLastRead] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});

  // Fetch state
  const fetchState = async () => {
    const res = await fetch('/api/state');
    const { players, messages } = await res.json();
    setPlayers(players);
    setMessages(messages);
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, []);

  // Token accumulation logic
  useEffect(() => {
    const timer = setInterval(() => {
      setMsgCountdown(prev => {
        if (prev <= 1) {
          setMsgTokens(tokens => tokens + 1);
          return 30;
        }
        return prev - 1;
      });
      setAtkCountdown(prev => {
        if (prev <= 1) {
          setAtkTokens(tokens => tokens + 1);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate unread per AI
  useEffect(() => {
    const human = players.find(p => p.is_human);
    const counts = {};
    players.filter(p => !p.is_human).forEach(ai => {
      const last = lastRead[ai.id] || 0;
      counts[ai.id] = messages.filter(
        m => m.sender_id === ai.id && m.recipient_id === human.id && new Date(m.created_at).getTime() > last
      ).length;
    });
    setUnreadCounts(counts);
  }, [messages, players, lastRead]);

  const selectAI = (ai) => {
    setSelectedAI(ai);
    const now = Date.now();
    setLastRead(prev => ({ ...prev, [ai.id]: now }));
  };

  const sendMessage = async () => {
    if (!selectedAI || msgTokens <= 0) return;
    await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender_id: 1, recipient_id: selectedAI.id, content: msgContent })
    });
    setMsgContent('');
    setMsgTokens(tokens => tokens - 1);
  };

  const attack = async (targetId) => {
    if (atkTokens <= 0) return;
    await fetch('/api/attack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: targetId })
    });
    setAtkTokens(tokens => tokens - 1);
  };

  const ais = players.filter(p => !p.is_human);
  const human = players.find(p => p.is_human);
  const chat = messages.filter(m =>
    (m.sender_id === selectedAI?.id && m.recipient_id === human?.id) ||
    (m.sender_id === human?.id && m.recipient_id === selectedAI?.id)
  );

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-1/4 bg-gray-800 text-white p-4 flex flex-col">
        <h2 className="text-xl mb-4">Cultists</h2>
        <ul className="flex-1 overflow-y-auto">
          {ais.map(ai => (
            <li
              key={ai.id}
              onClick={() => selectAI(ai)}
              className={\`p-2 mb-2 rounded cursor-pointer \${selectedAI?.id === ai.id ? 'bg-blue-600' : 'bg-gray-600'} hover:bg-gray-500 relative\`}
            >
              {ai.name} ({ai.health} HP)
              {unreadCounts[ai.id] > 0 && (
                <span className="absolute top-0 right-0 inline-block h-4 w-4 bg-red-500 text-xs text-white rounded-full flex items-center justify-center">
                  {unreadCounts[ai.id]}
                </span>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <div>Msg Tokens: {msgTokens} (next in {msgCountdown}s)</div>
          <div>Atk Tokens: {atkTokens} (next in {atkCountdown}s)</div>
        </div>
      </aside>
      {/* Main */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow p-4 flex justify-between">
          <h1 className="text-2xl">Cult Chat Duel</h1>
          <div>You: {human?.health} HP</div>
        </header>
        {/* Chat */}
        <section className="flex-1 bg-gray-100 p-4 overflow-y-auto">
          {selectedAI ? (
            <>
              <h3 className="text-xl mb-2">Chat with {selectedAI.name}</h3>
              <div className="space-y-2 mb-4">
                {chat.map((m, i) => (
                  <div key={i} className={m.sender_id === human.id ? 'text-right' : 'text-left'}>
                    <span className={\`inline-block p-2 rounded \${m.sender_id === human.id ? 'bg-blue-500 text-white' : 'bg-gray-300 text-black'}\`}>
                      {m.content}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex mb-4">
                <input
                  className="flex-1 border p-2 rounded"
                  value={msgContent}
                  onChange={e => setMsgContent(e.target.value)}
                  disabled={msgTokens <= 0}
                  placeholder={msgTokens > 0 ? "Type a message..." : "Waiting for tokens..."}
                />
                <button
                  className="ml-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                  onClick={sendMessage}
                  disabled={msgTokens <= 0}
                >
                  Send
                </button>
              </div>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
                onClick={() => attack(selectedAI.id)}
                disabled={atkTokens <= 0}
              >
                Attack {selectedAI.name}
              </button>
            </>
          ) : (
            <div className="text-center text-gray-500">Select a cultist to chat</div>
          )}
        </section>
      </main>
    </div>
  );
}