import { useState, useEffect, useRef, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function ChatApp() {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatMessages');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(messages));
  }, [messages]);

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
    <div className="min-h-screen p-4 flex flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-md p-4">
        <div className="h-[500px] overflow-y-auto space-y-2 mb-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-2 rounded ${
                msg.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'
              }`}
            >
              <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong>{' '}
              {msg.content}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e: { target: { value: SetStateAction<string>; }; }) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
            onKeyDown={(e: { key: string; }) => e.key === 'Enter' && sendMessage()}
          />
          <Button onClick={sendMessage} disabled={loading}>
            {loading ? '...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
