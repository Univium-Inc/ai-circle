import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ChatApp() {
  const [messages, setMessages] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatMessages');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });
      const data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error(err);
      setMessages([...newMessages, { role: 'assistant', content: 'Error talking to AI.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-md p-4">
        <div className="h-[500px] overflow-y-auto space-y-2 mb-4">
          {messages.map((msg, i) => (
            <div key={i} className={\`p-2 rounded \${msg.role === 'user' ? 'bg-blue-100' : 'bg-gray-100'}\`}>
              <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong> {msg.content}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1"
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
          />
          <Button onClick={sendMessage} disabled={loading}>{loading ? '...' : 'Send'}</Button>
        </div>
      </div>
    </div>
  );
}
