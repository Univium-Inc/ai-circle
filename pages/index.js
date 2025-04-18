import { useState, useEffect } from 'react';

export default function Home() {
  const [state, setState] = useState({ players: [], messages: [] });
  const [msgContent, setMsgContent] = useState('');
  const [targetId, setTargetId] = useState(2);

  useEffect(() => {
    const fetchState = async () => {
      const res = await fetch('/api/state');
      const json = await res.json();
      setState(json);
    };
    fetchState();
    const interval = setInterval(fetchState, 1000);
    return () => clearInterval(interval);
  }, []);

  const sendMessage = async () => {
    await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender_id: 1, recipient_id: targetId, content: msgContent })
    });
    setMsgContent('');
  };

  const attack = async (target) => {
    await fetch('/api/attack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attacker_id: 1, target_id: target })
    });
  };

  return (
    <div style={{ padding: '1rem', fontFamily: 'sans-serif' }}>
      <h1>Cult Simulator Chat</h1>
      <div>
        <h2>Players</h2>
        <ul>
          {state.players.map(p => (
            <li key={p.id}>
              {p.name} ({p.health} HP) {p.id !== 1 && <button onClick={() => attack(p.id)}>Attack</button>}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2>Chat</h2>
        <div style={{ border: '1px solid #ccc', padding: '1rem', height: '200px', overflowY: 'scroll' }}>
          {state.messages.map(m => (
            <div key={m.id}><strong>{m.sender_id === 1 ? 'You' : 'AI ' + m.sender_id}:</strong> {m.content}</div>
          ))}
        </div>
        <div style={{ marginTop: '1rem' }}>
          <select value={targetId} onChange={e => setTargetId(parseInt(e.target.value, 10))}>
            {state.players.filter(p => p.id !== 1).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={msgContent}
            onChange={e => setMsgContent(e.target.value)}
            placeholder="Your message"
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
);
}