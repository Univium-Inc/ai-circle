import { useEffect, useState } from 'react';

type Msg = {
  speaker: string;
  content: string;
};

export default function Home() {
  const [topic, setTopic] = useState('Is pineapple on pizza acceptable?');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [running, setRunning] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<'AI 1' | 'AI 2'>('AI 1');

  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, speaker: currentSpeaker, topic }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setMessages(prev => [...prev, { speaker: currentSpeaker, content: data.content }]);
        setCurrentSpeaker(s => (s === 'AI 1' ? 'AI 2' : 'AI 1'));
      } catch (err) {
        console.error(err);
        setRunning(false);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [running, messages, currentSpeaker, topic]);

  const startDebate = () => {
    if (running) return;
    setMessages([]);
    setCurrentSpeaker('AI 1');
    setRunning(true);
  };

  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      <h1>AI Debate Arena</h1>

      <label>
        <span style={{ display: 'block', marginBottom: 4 }}>Debate topic</span>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          style={{ width: '100%', marginBottom: '1rem' }}
        />
      </label>

      <button onClick={startDebate} disabled={running}>
        {running ? 'Debating…' : 'Start Debate'}
      </button>

      <section style={{ marginTop: '2rem' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: '1rem' }}>
            <strong>{m.speaker}:</strong> {m.content}
          </div>
        ))}
      </section>
    </main>
  );
}
