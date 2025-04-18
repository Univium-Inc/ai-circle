import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedAI, setSelectedAI] = useState(null);
  const [msgContent, setMsgContent] = useState('');
  const [msgTokenReady, setMsgTokenReady] = useState(false);
  const [atkTokenReady, setAtkTokenReady] = useState(false);
  const [msgCountdown, setMsgCountdown] = useState(30);
  const [atkCountdown, setAtkCountdown] = useState(60);

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

  // Token logic
  useEffect(() => {
    let lastMsgTime = Date.now();
    let lastAtkTime = Date.now();
    setMsgTokenReady(true);
    setAtkTokenReady(true);
    const timer = setInterval(() => {
      const now = Date.now();
      const msgDiff = Math.floor((now - lastMsgTime) / 1000);
      const atkDiff = Math.floor((now - lastAtkTime) / 1000);
      setMsgCountdown(30 - (msgDiff % 30));
      setAtkCountdown(60 - (atkDiff % 60));
      setMsgTokenReady(msgDiff >= 30);
      setAtkTokenReady(atkDiff >= 60);
      if (msgDiff >= 30) lastMsgTime = now;
      if (atkDiff >= 60) lastAtkTime = now;
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const sendMessage = async () => {
    if (!selectedAI || !msgTokenReady) return;
    await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender_id: 1, recipient_id: selectedAI.id, content: msgContent })
    });
    setMsgContent('');
    setMsgTokenReady(false);
  };

  const attack = async (targetId) => {
    if (!atkTokenReady) return;
    await fetch('/api/attack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: targetId })
    });
    setAtkTokenReady(false);
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
      <aside className="w-1/4 bg-gray-800 text-white p-4">
        <h2 className="text-xl mb-4">AI Cultists</h2>
        <ul>
          {ais.map(ai => (
            <li key={ai.id} className={`p-2 mb-2 rounded cursor-pointer ${selectedAI?.id === ai.id ? 'bg-gray-700' : 'bg-gray-600'}`}
                onClick={() => setSelectedAI(ai)}>
              {ai.name} ({ai.health} HP)
            </li>
          ))}
        </ul>
        <div className="mt-auto">
          <div>Msg Token: {msgTokenReady ? 'Ready' : `${msgCountdown}s`}</div>
          <div>Atk Token: {atkTokenReady ? 'Ready' : `${atkCountdown}s`}</div>
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
              <div className="space-y-2">
                {chat.map((m, i) => (
                  <div key={i} className={`${m.sender_id === human.id ? 'text-right' : 'text-left'}`}>
                    <span className={`inline-block p-2 rounded ${m.sender_id === human.id ? 'bg-blue-500 text-white' : 'bg-gray-300 text-black'}`}>
                      {m.content}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex">
                <input
                  className="flex-1 border p-2 rounded"
                  value={msgContent}
                  onChange={e => setMsgContent(e.target.value)}
                  disabled={!msgTokenReady}
                  placeholder="Type a message..."
                />
                <button
                  className="ml-2 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                  onClick={sendMessage}
                  disabled={!msgTokenReady}
                >
                  Send
                </button>
              </div>
              <div className="mt-4">
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
                  onClick={() => attack(selectedAI.id)}
                  disabled={!atkTokenReady}
                >
                  Attack {selectedAI.name}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500">Select an AI to chat</div>
          )}
        </section>
      </main>
    </div>
);
}