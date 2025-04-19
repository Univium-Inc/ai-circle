import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAIResponse } from '@/lib/AIEngine';
import { SECRET_WORDS } from '@/lib/secretWords';
import { Message } from '@/lib/types';

type ChatBoxProps = {
  name: string;
  messages: Message[];
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
};

const ChatBox = ({ name, messages, input, onInputChange, onSend }: ChatBoxProps) => (
  <div className='flex flex-col w-full max-w-md bg-white shadow rounded p-4 h-[600px]'>
    <div className='flex-1 overflow-y-auto space-y-2 mb-2'>
      {messages.map((msg, idx) => (
        <div key={idx} className='p-2 rounded bg-gray-100'>
          <strong>{msg.sender} ➜ {msg.recipient}:</strong> {msg.content}
        </div>
      ))}
    </div>
    <div className='flex gap-2'>
      <Input
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={`Message from ${name}...`}
        className='flex-1'
      />
      <Button onClick={onSend}>Send</Button>
    </div>
  </div>
);

export default function Home() {
  const [ai1Messages, setAI1Messages] = useState<Message[]>([]);
  const [ai2Messages, setAI2Messages] = useState<Message[]>([]);
  const [monitorLog, setMonitorLog] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [userMessages, setUserMessages] = useState<Message[]>([]);
  const [tokens, setTokens] = useState({ user: 1, 'AI 1': 0, 'AI 2': 0 });

  const [secrets] = useState({
    user: SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)],
    'AI 1': SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)],
    'AI 2': SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)],
  });

  const sendUserMessage = () => {
    if (!userInput || tokens.user <= 0) return;

    const msg: Message = {
      sender: 'user',
      recipient: 'AI 1',
      content: userInput,
      timestamp: Date.now(),
    };

    setUserMessages((prev) => [...prev.slice(-19), msg]);
    setAI1Messages((prev) => [...prev.slice(-19), msg]);
    setTokens((prev) => ({ ...prev, user: prev.user - 1 }));
    setUserInput('');
  };

  const aiThink = (aiName: 'AI 1' | 'AI 2') => {
    if (tokens[aiName] <= 0) return;

    const selfHistory = aiName === 'AI 1' ? ai1Messages : ai2Messages;
    const secret = secrets[aiName];
    const { content, target } = getAIResponse({ aiName, secretWord: secret, history: selfHistory });

    const msg: Message = {
      sender: aiName,
      recipient: target,
      content,
      timestamp: Date.now(),
    };

    if (target === 'user') {
      setUserMessages((prev) => [...prev.slice(-19), msg]);
      if (aiName === 'AI 1') setAI1Messages((prev) => [...prev.slice(-19), msg]);
      else setAI2Messages((prev) => [...prev.slice(-19), msg]);
    } else {
      setMonitorLog((prev) => [...prev.slice(-19), msg]);
    }

    setTokens((prev) => ({ ...prev, [aiName]: prev[aiName] - 1 }));
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setTokens({ user: 1, 'AI 1': 1, 'AI 2': 1 });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (tokens['AI 1'] > 0) aiThink('AI 1');
    if (tokens['AI 2'] > 0) aiThink('AI 2');
  }, [tokens]);

  return (
    <div className='min-h-screen bg-gray-100 p-6 space-y-6'>
      <div className='flex gap-4 flex-col md:flex-row justify-center'>
        <ChatBox name='User' messages={userMessages} input={userInput} onInputChange={setUserInput} onSend={sendUserMessage} />
        <div className='w-full max-w-md bg-white shadow rounded p-4 h-[600px] overflow-y-auto'>
          <h2 className='text-lg font-bold mb-2'>AI Monitor Log</h2>
          {monitorLog.map((m, i) => (
            <div key={i} className='p-2 text-sm bg-yellow-50 rounded'>
              <strong>{m.sender} ➜ {m.recipient}:</strong> {m.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
