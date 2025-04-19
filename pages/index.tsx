// pages/index.tsx - fixed version
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAIResponse } from '@/lib/AIEngine';
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
      {messages.map((m, i) => {
        // Simple clean rendering of the message
        return (
          <div key={i} className="p-2 rounded bg-gray-100 text-sm">
            <strong>{m.sender} → {m.recipient}:</strong> {m.content}
          </div>
        );
      })}
    </div>
    <div className="flex gap-2">
      <Input
        value={input}
        onChange={(e: { target: { value: string; }; }) => onInputChange(e.target.value)}
        placeholder={`Message to ${title.split(' ')[1]}…`}
        className="flex-1"
        onKeyDown={(e: { key: string; }) => canSend && e.key === 'Enter' && onSend()}
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
  
  // Tokens - everyone starts with 1
  const [tokens, setTokens] = useState({
    user: 1,
    'AI 1': 1,
    'AI 2': 1
  });
  
  const [turnTimer, setTurnTimer] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [turnInProgress, setTurnInProgress] = useState(false);

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

  // Process a single AI response, returns true if message sent, false otherwise
  const processAIMessage = async (ai: 'AI 1' | 'AI 2') => {
    // Don't proceed if AI has no tokens
    if (tokens[ai] <= 0) return false;
    
    // Set processing flag to prevent parallel processing
    setIsProcessing(true);
    
    try {
      // Get messages relevant to this AI
      const aiHistory = messages.filter(
        m => m.sender === ai || m.recipient === ai
      ).slice(-20);
      
      // Get AI response
      const { content, target } = await getAIResponse({
        aiName: ai,
        history: aiHistory
      });
      
      // Validate the target
      const validTarget = target === 'user' || target === (ai === 'AI 1' ? 'AI 2' : 'AI 1');
      const finalTarget = validTarget ? target : 'user'; // Default to user if invalid
      
      // Create message
      const newMessage: Message = {
        sender: ai,
        recipient: finalTarget,
        content: content.trim(),
        timestamp: Date.now(),
        isPrivate: finalTarget !== 'user'
      };
      
      // Add message to state
      setMessages(prev => [...prev, newMessage]);
      
      // Deduct token AFTER sending message
      setTokens(prev => ({
        ...prev,
        [ai]: prev[ai] - 1
      }));
      
      return true; // Message was sent
    } catch (error) {
      console.error(`Error processing ${ai} turn:`, error);
      return false; // No message was sent
    } finally {
      setIsProcessing(false);
    }
  };

  // Process AI turns in a random order
  const processTurn = async () => {
    if (turnInProgress) return;
    setTurnInProgress(true);
    
    try {
      // Randomize processing order
      const ais: ('AI 1' | 'AI 2')[] = Math.random() < 0.5 
        ? ['AI 1', 'AI 2'] 
        : ['AI 2', 'AI 1'];
      
      console.log(`Processing AIs in order: ${ais[0]}, then ${ais[1]}`);
      
      // Process first AI
      const firstAISent = await processAIMessage(ais[0]);
      
      // Small delay between processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Process second AI
      if (tokens[ais[1]] > 0) {
        await processAIMessage(ais[1]);
      }
    } finally {
      setTurnInProgress(false);
    }
  };

  // Send message function for user
  const sendMessage = (sender: string, recipient: string, content: string) => {
    if (!content.trim() || tokens[sender as keyof typeof tokens] <= 0) return;
    
    // Create message
    const newMessage: Message = {
      sender,
      recipient,
      content: content.trim(),
      timestamp: Date.now(),
      isPrivate: sender !== 'user' && recipient !== 'user'
    };
    
    // Add message to state
    setMessages(prev => [...prev, newMessage]);
    
    // Deduct token
    setTokens(prev => ({
      ...prev,
      [sender]: prev[sender as keyof typeof tokens] - 1
    }));
    
    // If the user sent a message, trigger AI responses after a delay
    if (sender === 'user') {
      setTimeout(() => {
        processTurn();
      }, 500);
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

  // Turn timer effect - replenish tokens every 30 seconds
  useEffect(() => {
    // Grant 1 token to all participants every turn
    const turnInterval = setInterval(() => {
      setTokens(prev => ({
        user: prev.user + 1,
        'AI 1': prev['AI 1'] + 1,
        'AI 2': prev['AI 2'] + 1
      }));
      setTurnTimer(30);
      
      // Process AI turns after token refresh
      setTimeout(() => {
        processTurn();
      }, 500);
    }, 30000);
    
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setTurnTimer(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => {
      clearInterval(turnInterval);
      clearInterval(countdownInterval);
    };
  }, []);

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
            <div 
              key={i} 
              className={`p-2 text-xs rounded my-1 ${
                m.sender === 'AI 1' ? 'bg-blue-50' : 'bg-green-50'
              }`}
            >
              <strong>{m.sender} → {m.recipient}:</strong> {m.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}