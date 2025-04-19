// pages/index.tsx - complete rewrite
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
  canSend: boolean;
};

const ChatBox = ({
  title,
  messages,
  input,
  onInputChange,
  onSend,
  canSend,
}: ChatBoxProps) => (
  <div className="flex flex-col w-full max-w-md bg-white shadow rounded p-4 h-[600px]">
    <h2 className="font-semibold mb-2">{title}</h2>
    <div className="flex-1 overflow-y-auto space-y-2 mb-2">
      {messages.map((m, i) => (
        <div key={i} className="p-2 rounded bg-gray-100 text-sm">
          <strong>{m.sender} → {m.recipient}:</strong> {m.content}
        </div>
      ))}
    </div>
    <div className="flex gap-2">
      <Input
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        placeholder={`Message to ${title.split(' ')[1]}…`}
        className="flex-1"
        onKeyDown={(e) => canSend && e.key === 'Enter' && onSend()}
        disabled={!canSend}
      />
      <Button onClick={onSend} disabled={!canSend}>Send</Button>
    </div>
  </div>
);

/* ---------- main page ---------- */
export default function Home() {
  // All messages in the system
  const [messages, setMessages] = useState<Message[]>([]);
  
  // User inputs
  const [userToAi1, setUserToAi1] = useState('');
  const [userToAi2, setUserToAi2] = useState('');
  
  // Tokens & turn timer
  const [tokens, setTokens] = useState({
    user: 1,
    'AI 1': 0,
    'AI 2': 0
  });
  
  const [turnTimer, setTurnTimer] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);

  // Secret words
  const [secrets] = useState({
    user: SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)],
    'AI 1': SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)],
    'AI 2': SECRET_WORDS[Math.floor(Math.random() * SECRET_WORDS.length)]
  });

  // Get filtered messages for each chat view
  const getUserToAI1Messages = () => {
    return messages.filter(
      m => (m.sender === 'user' && m.recipient === 'AI 1') ||
           (m.sender === 'AI 1' && m.recipient === 'user')
    );
  };

  const getUserToAI2Messages = () => {
    return messages.filter(
      m => (m.sender === 'user' && m.recipient === 'AI 2') ||
           (m.sender === 'AI 2' && m.recipient === 'user')
    );
  };

  const getMonitorMessages = () => {
    return messages.filter(
      m => m.sender !== 'user' && m.recipient !== 'user'
    );
  };

  // Send message function
  const sendMessage = (sender: string, recipient: string, content: string) => {
    if (!content.trim()) return;
    
    const newMessage: Message = {
      sender,
      recipient,
      content: content.trim(),
      timestamp: Date.now(),
      isPrivate: sender !== 'user' && recipient !== 'user'
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Spend token
    setTokens(prev => ({
      ...prev,
      [sender]: Math.max(0, prev[sender] - 1)
    }));
    
    // Process AI responses if necessary
    if (recipient === 'AI 1' || recipient === 'AI 2') {
      processAITurn(recipient);
    }
  };

  // User send functions
  const sendToAI1 = () => {
    if (tokens.user <= 0 || !userToAi1.trim()) return;
    sendMessage('user', 'AI 1', userToAi1);
    setUserToAi1('');
  };

  const sendToAI2 = () => {
    if (tokens.user <= 0 || !userToAi2.trim()) return;
    sendMessage('user', 'AI 2', userToAi2);
    setUserToAi2('');
  };

  // Process AI turn
  const processAITurn = async (ai: 'AI 1' | 'AI 2') => {
    if (tokens[ai] <= 0 || isProcessing) return;
    
    setIsProcessing(true);
    
    try {
      // Get all messages that this AI should see
      const aiHistory = messages.filter(
        m => m.sender === ai || m.recipient === ai
      ).slice(-20); // Limit to last 20 messages
      
      const { content, target } = await getAIResponse({
        aiName: ai,
        history: aiHistory
      });
      
      // Send the AI's message
      sendMessage(ai, target, content);
      
      // If target is another AI, process their turn next
      if (target !== 'user' && tokens[target] > 0) {
        setTimeout(() => processAITurn(target), 1000);
      }
    } catch (error) {
      console.error(`Error processing ${ai} turn:`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Turn timer effect
  useEffect(() => {
    // Grant 1 token each turn and add to existing tokens
    const turnInterval = setInterval(() => {
      setTokens(prev => ({
        user: prev.user + 1,
        'AI 1': prev['AI 1'] + 1,
        'AI 2': prev['AI 2'] + 1
      }));
      setTurnTimer(30);
    }, 30000);
    
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setTurnTimer(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    
    return () => {
      clearInterval(turnInterval);
      clearInterval(countdownInterval);
    };
  }, []);

  // Process AI turns when they get tokens
  useEffect(() => {
    const processAIs = async () => {
      // Don't process if we're already processing something
      if (isProcessing) return;
      
      // Process AI 1 if it has tokens and received messages
      if (tokens['AI 1'] > 0 && messages.some(m => m.recipient === 'AI 1')) {
        await processAITurn('AI 1');
      }
      
      // Process AI 2 if it has tokens and received messages
      if (tokens['AI 2'] > 0 && messages.some(m => m.recipient === 'AI 2')) {
        await processAITurn('AI 2');
      }
    };
    
    processAIs();
  }, [tokens, isProcessing]);

  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6">
      {/* Timer + token bar */}
      <div className="text-center text-sm text-gray-700">
        ⏳ <strong>Next Turn In:</strong> {turnTimer}s<br/>
        🎟 <strong>Tokens</strong> — User: {tokens.user} | AI 1: {tokens['AI 1']} | AI 2: {tokens['AI 2']}
      </div>

      {/* Chat boxes */}
      <div className="flex gap-4 flex-col md:flex-row justify-center">
        <ChatBox
          title="Chat with AI 1"
          messages={getUserToAI1Messages()}
          input={userToAi1}
          onInputChange={setUserToAi1}
          onSend={sendToAI1}
          canSend={tokens.user > 0}
        />

        <ChatBox
          title="Chat with AI 2"
          messages={getUserToAI2Messages()}
          input={userToAi2}
          onInputChange={setUserToAi2}
          onSend={sendToAI2}
          canSend={tokens.user > 0}
        />

        {/* Monitor panel */}
        <div className="w-full max-w-md bg-white shadow rounded p-4 h-[600px] overflow-y-auto">
          <h2 className="text-lg font-bold mb-2">AI Monitor Log</h2>
          {getMonitorMessages().map((m, i) => (
            <div key={i} className="p-2 text-xs bg-yellow-50 rounded my-1">
              <strong>{m.sender} → {m.recipient}:</strong> {m.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}