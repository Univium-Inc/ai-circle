import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAIResponse } from '@/lib/AIEngine';
import { SECRET_WORDS } from '@/lib/secretWords';
import { Message } from '@/lib/types';

/* ---------- reusable chat component ---------- */
type ChatBoxProps = {
  title: string;
  messages: Message[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
};

const ChatBox = ({
  title,
  messages,
  input,
  onInputChange,
  onSend,
}: ChatBoxProps) => (
  <div className="flex flex-col w-full max-w-md bg-white shadow rounded p-4 h-[600px]">
    <h2 className="font-semibold mb-2">{title}</h2>
    <div className="flex-1 overflow-y-auto space-y-2 mb-2">
      {messages.map((m, i) => (
        <div key={i} className="p-2 rounded bg-gray-100 text-sm">
          <strong>{m.sender} ➜ {m.recipient}:</strong> {m.content}
        </div>
      ))}
    </div>
    <div className="flex gap-2">
      <Input
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={`Message to ${title.split(' ')[1]}…`}
        className="flex-1"
        onKeyDown={(e) => e.key === 'Enter' && onSend()}
      />
      <Button onClick={onSend}>Send</Button>
    </div>
  </div>
);

/* ---------- main page ---------- */
export default function Home() {
  /* conversation histories (last 20 each) */
  const [ai1Hist, setAi1Hist] = useState<Message[]>([]);
  const [ai2Hist, setAi2Hist] = useState<Message[]>([]);
  /* inbound queues – what each AI hasn’t processed yet */
  const [ai1Queue, setAi1Queue] = useState<Message[]>([]);
  const [ai2Queue, setAi2Queue] = useState<Message[]>([]);
  /* monitor panel */
  const [monitorLog, setMonitorLog] = useState<Message[]>([]);
  /* user inputs (one box per AI) */
  const [userToAi1, setUserToAi1] = useState('');
  const [userToAi2, setUserToAi2] = useState('');
  /* tokens & turn timer */
  const [tokens, setTokens] = useState({ user: 1, 'AI 1': 0, 'AI 2': 0 });
  const [turnTimer, setTurnTimer] = useState(30);

  /* secret words */
  const [secrets] = useState({
    user : SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)],
    'AI 1': SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)],
    'AI 2': SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)],
  });

  /* ---------- user message helpers ---------- */
  const sendToAI = (ai: 'AI 1' | 'AI 2', text: string, resetInput: () => void) => {
    if (!text.trim() || tokens.user <= 0) return;

    const msg: Message = {
      sender: 'user',
      recipient: ai,
      content: text.trim(),
      timestamp: Date.now(),
    };

    /* show immediately in that chat box */
    if (ai === 'AI 1') setAi1Hist((p) => [...p.slice(-19), msg]);
    else               setAi2Hist((p) => [...p.slice(-19), msg]);

    /* enqueue for AI to read on its turn */
    if (ai === 'AI 1') setAi1Queue((q) => [...q, msg]);
    else               setAi2Queue((q) => [...q, msg]);

    /* spend token + clear input */
    setTokens((t) => ({ ...t, user: t.user - 1 }));
    resetInput();
  };

  /* ---------- AI turn processor ---------- */
  const processAI = async (ai: 'AI 1' | 'AI 2') => {
    if (tokens[ai] <= 0) return;
    
    // Get messages directed to this AI
    const queue = ai === 'AI 1' ? ai1Queue : ai2Queue;
    if (queue.length === 0) return; // Don't process if there are no messages
    
    // Clear the queue for this AI
    if (ai === 'AI 1') setAi1Queue([]);
    else setAi2Queue([]);
  
    const history = ai === 'AI 1' ? ai1Hist : ai2Hist;
    const secret = secrets[ai];
    const context = [...history.slice(-20), ...queue]; // last 20 + unread
  
    try {
      // Get AI reply & chosen target
      const { content, target } = await getAIResponse({ 
        aiName: ai, 
        secretWord: secret, 
        history: context 
      });
  
      const reply: Message = {
        sender: ai,
        recipient: target,
        content,
        timestamp: Date.now(),
      };
  
      // Add to history of the AI that sent the message
      if (ai === 'AI 1') setAi1Hist((h) => [...h.slice(-19), reply]);
      else setAi2Hist((h) => [...h.slice(-19), reply]);
  
      // If target is user, we're done
      if (target === 'user') {
        // Already added to history above
      } else {
        // Send to the OTHER AI's queue and log in monitor
        if (target === 'AI 1') setAi1Queue((q) => [...q, reply]);
        else if (target === 'AI 2') setAi2Queue((q) => [...q, reply]);
  
        // Always add to monitor log
        setMonitorLog((log) => [...log.slice(-19), reply]);
      }
  
      // Spend token - make sure we never go below 0
      setTokens((t) => ({
        ...t,
        [ai]: Math.max(0, t[ai] - 1)
      }));
    } catch (error) {
      console.error(`Error processing ${ai} response:`, error);
    }
  };

  /* ---------- turn / timer loop ---------- */
  useEffect(() => {
    // Grant 1 token to each participant every 30s
    const turn = setInterval(() => {
      setTokens({ user: 1, 'AI 1': 1, 'AI 2': 1 });
      setTurnTimer(30);
    }, 30_000);
  
    // Countdown display
    const countdown = setInterval(() => {
      setTurnTimer((n) => (n > 0 ? n - 1 : 0));
    }, 1_000);
  
    return () => { 
      clearInterval(turn); 
      clearInterval(countdown); 
    };
  }, []);
  
  // Replace the useEffect for processing AI turns
  useEffect(() => {
    const processAIs = async () => {
      // Process AI turns one after another to avoid race conditions
      if (tokens['AI 1'] > 0 && ai1Queue.length > 0) {
        await processAI('AI 1');
      }
      
      if (tokens['AI 2'] > 0 && ai2Queue.length > 0) {
        await processAI('AI 2');
      }
    };
    
    processAIs();
  }, [tokens, ai1Queue, ai2Queue]);

  /* ---------- render ---------- */
  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6">
      {/* timer + token bar */}
      <div className="text-center text-sm text-gray-700">
        ⏳ <strong>Next Turn In:</strong> {turnTimer}s<br/>
        🎟 <strong>Tokens</strong> — User: {tokens.user} | AI 1: {tokens['AI 1']} | AI 2: {tokens['AI 2']}
      </div>

      {/* two user chat boxes */}
      <div className="flex gap-4 flex-col md:flex-row justify-center">
        <ChatBox
          title="Chat with AI 1"
          messages={ai1Hist}
          input={userToAi1}
          onInputChange={setUserToAi1}
          onSend={() => sendToAI('AI 1', userToAi1, () => setUserToAi1(''))}
        />

        <ChatBox
          title="Chat with AI 2"
          messages={ai2Hist}
          input={userToAi2}
          onInputChange={setUserToAi2}
          onSend={() => sendToAI('AI 2', userToAi2, () => setUserToAi2(''))}
        />

        {/* monitor panel */}
        <div className="w-full max-w-md bg-white shadow rounded p-4 h-[600px] overflow-y-auto">
          <h2 className="text-lg font-bold mb-2">AI Monitor Log</h2>
          {monitorLog.map((m, i) => (
            <div key={i} className="p-2 text-xs bg-yellow-50 rounded">
              <strong>{m.sender} ➜ {m.recipient}:</strong> {m.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
