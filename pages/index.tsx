import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

function ChatPanel({
  aiId,
  messages,
  setMessages,
}: {
  aiId: string;
  messages: Message[];
  setMessages: (msgs: Message[]) => void;
}) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem(`chatMessages-${aiId}`, JSON.stringify(messages));
  }, [messages, aiId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      const replyMessage: Message = {
        role: 'assistant',
        content: data.reply ?? 'No response',
      };

      setMessages([...newMessages, replyMessage]);
    } catch (err) {
      console.error(err);
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Error talking to AI.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-white p-4 rounded-xl shadow-md w-full max-w-md h-[600px]">
      <div className="flex-1 overflow-y-auto space-y-2 mb-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-2 rounded ${
              msg.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
            }`}
          >
            <strong>{msg.role === 'user' ? 'You' : aiId}:</strong>{' '}
            {msg.content}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask ${aiId}...`}
          className="flex-1"
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <Button onClick={sendMessage} disabled={loading}>
          {loading ? '...' : 'Send'}
        </Button>
      </div>
    </div>
  );
}

export default function DualChat() {
  const [ai1Messages, setAi1Messages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatMessages-ai1');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [ai2Messages, setAi2Messages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatMessages-ai2');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  return (
    <div className="min-h-screen p-6 bg-gray-100 flex flex-col items-center justify-center">
      <div className="flex gap-6 flex-col md:flex-row">
        <ChatPanel aiId="AI 1" messages={ai1Messages} setMessages={setAi1Messages} />
        <ChatPanel aiId="AI 2" messages={ai2Messages} setMessages={setAi2Messages} />
      </div>
    </div>
  );
}
