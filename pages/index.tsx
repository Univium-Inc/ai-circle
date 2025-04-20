import { useEffect, useRef, useState } from 'react';
import { PARTICIPANTS } from '../lib/participants';

type Msg = { speaker: string; content: string };
type Phase = 'idle' | 'discussion' | 'voting' | 'results' | 'end';

export default function Home() {
  const [topic, setTopic] = useState('Should we colonize Mars?');
  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(1);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [activeNames, setActiveNames] = useState<string[]>(PARTICIPANTS.map(p => p.name));
  const phaseTimer = useRef<NodeJS.Timeout>();

  // --- phase orchestration ---
  useEffect(() => {
    if (phase === 'idle') return;

    if (phase === 'discussion') {
      // AIs speak every 10s during a 120s discussion window
      const talkInterval = setInterval(() => {
        activeNames.forEach(async (speaker) => {
          try {
            const res = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ speaker, phase: 'discussion', topic, activeNames, messages })
            });
            const { content } = await res.json();
            setMessages(prev => [...prev, { speaker, content }]);
          } catch (e) { console.error(e); }
        });
      }, 10000);

      phaseTimer.current = setTimeout(() => {
        clearInterval(talkInterval);
        setPhase('voting');
      }, 120000);

      return () => { clearInterval(talkInterval); clearTimeout(phaseTimer.current); };
    }

    if (phase === 'voting') {
      // Each AI casts one vote
      (async () => {
        const votes: Record<string, number> = {};
        for (const speaker of activeNames) {
          try {
            const res = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ speaker, phase: 'voting', topic, activeNames, messages })
            });
            const { content } = await res.json();
            setMessages(prev => [...prev, { speaker, content }]);
            const match = content.match(/VOTE:\s*(\w+)/i);
            if (match) {
              const target = match[1];
              votes[target] = (votes[target] || 0) + 1;
            }
          } catch (e) { console.error(e); }
        }
        // Determine elimination
        let eliminated = '';
        let maxVotes = -1;
        Object.entries(votes).forEach(([name, count]) => {
          if (count > maxVotes) { maxVotes = count; eliminated = name; }
        });
        setMessages(prev => [...prev, { speaker: 'Host', content: `⏱️ Votes tallied. ${eliminated} is eliminated with ${maxVotes} vote(s)!` }]);
        setActiveNames(prev => prev.filter(n => n !== eliminated));
        setPhase('results');
      })();
    }

    if (phase === 'results') {
      phaseTimer.current = setTimeout(() => {
        if (activeNames.length <= 2) {
          setPhase('end');
        } else {
          setRound(r => r + 1);
          setPhase('discussion');
        }
      }, 15000); // 15s reveal before next round / end
      return () => clearTimeout(phaseTimer.current);
    }
  }, [phase, activeNames, topic, messages]);

  const startGame = () => {
    if (phase !== 'idle') return;
    setMessages([{ speaker: 'Host', content: 'Round 1 begins!'}]);
    setPhase('discussion');
  };

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem' }}>
      <h1>AI Debate Showdown</h1>

      <label>
        <div style={{ marginBottom: 4 }}>Debate Topic</div>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          style={{ width: '100%', marginBottom: '1rem' }}
        />
      </label>

      <button onClick={startGame} disabled={phase !== 'idle'}>
        {phase === 'idle' ? 'Start Debate' : 'Game in progress'}
      </button>

      <h2>Round {round} – {phase.toUpperCase()}</h2>
      <p>Remaining players: {activeNames.join(', ')}</p>

      <div style={{ marginTop: '2rem', height: '50vh', overflowY: 'auto', border: '1px solid #ccc', padding: '1rem' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: '0.75rem' }}>
            <strong>{m.speaker}:</strong> {m.content}
          </div>
        ))}
      </div>

      {phase === 'end' && (
        <h2>🏆 Finalists: {activeNames.join(' & ')}</h2>
      )}
    </main>
  );
}
