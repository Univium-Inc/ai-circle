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

// Tokens & turn timer
const [tokens, setTokens] = useState({
  user: 1,
  'AI 1': 0,
  'AI 2': 0
});

const [turnTimer, setTurnTimer] = useState(30);
const [isProcessing, setIsProcessing] = useState(false);

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

// New consolidated function to process a single AI response
const processAIResponse = async (ai: 'AI 1' | 'AI 2') => {
  // Don't proceed if AI has no tokens or we're already processing
  if (tokens[ai] <= 0 || isProcessing) return;
  
  // We'll always process AIs regardless of whether they have unread messages
  // This ensures they always send a message each turn when they have tokens
  
  // Set processing flag to prevent parallel processing
  setIsProcessing(true);
  
  try {
    // Get messages relevant to this AI
    const aiHistory = messages.filter(
      m => m.sender === ai || m.recipient === ai
    ).slice(-20);
    
    // Deduct token BEFORE getting response
    setTokens(prev => ({
      ...prev,
      [ai]: Math.max(0, prev[ai] - 1)
    }));
    
    // Short delay to ensure token update happens
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Get AI response
    const { content, target } = await getAIResponse({
      aiName: ai,
      history: aiHistory
    });
    
    // Add validation check for the target
    const validTarget = target === 'user' || target === (ai === 'AI 1' ? 'AI 2' : 'AI 1');
    const finalTarget = validTarget ? target : 'user'; // Default to user if invalid
    
    const newMessage: Message = {
      sender: ai,
      recipient: finalTarget,
      content: content.trim(),
      timestamp: Date.now(),
      isPrivate: finalTarget !== 'user'
    };
    
    setMessages(prev => [...prev, newMessage]);
  } catch (error) {
    console.error(`Error processing ${ai} turn:`, error);
    // Restore the token if there was an error
    setTokens(prev => ({
      ...prev,
      [ai]: prev[ai] + 1
    }));
  } finally {
    setIsProcessing(false);
  }
};

// Simplified checkAndProcessAI function
const checkAndProcessAI = async () => {
  if (isProcessing) return;
  
  // Process both AIs if they have tokens, one at a time
  // Process AI 1 first
  if (tokens['AI 1'] > 0) {
    await processAIResponse('AI 1');
    
    // Small delay before processing AI 2
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Then process AI 2 if not still processing
    if (!isProcessing && tokens['AI 2'] > 0) {
      await processAIResponse('AI 2');
    }
  } 
  // If AI 1 has no tokens but AI 2 does, process AI 2
  else if (tokens['AI 2'] > 0) {
    await processAIResponse('AI 2');
  }
};

// Send message function (simplified)
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
  
  // Spend token for user messages only
  // AI tokens are spent in processAIResponse
  if (sender === 'user') {
    setTokens(prev => ({
      ...prev,
      user: Math.max(0, prev.user - 1)
    }));
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

// Turn timer effect 
useEffect(() => {
  // Grant 1 token each turn and process AI messages
  const turnInterval = setInterval(() => {
    setTokens(prev => ({
      user: prev.user + 1,
      'AI 1': prev['AI 1'] + 1,
      'AI 2': prev['AI 2'] + 1
    }));
    setTurnTimer(30);
    
    // Process AI messages after token refresh with slight delay
    setTimeout(() => {
      checkAndProcessAI();
    }, 300);
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

// Process AI responses when messages or tokens change
useEffect(() => {
  // Only check for messages when not currently processing
  if (!isProcessing) {
    // Check if any AI has a token but hasn't sent a message in this round
    const lastMessageTimestamp = Math.max(
      0,
      ...messages.map(m => m.timestamp)
    );
    
    // Get the timestamp when tokens were last refreshed (approximately)
    const tokenRefreshTime = Date.now() - (turnTimer * 1000);
    
    // Check if AIs have tokens but haven't sent messages since token refresh
    const ai1ShouldMessage = tokens['AI 1'] > 0 && 
      !messages.some(m => m.sender === 'AI 1' && m.timestamp > tokenRefreshTime);
    
    const ai2ShouldMessage = tokens['AI 2'] > 0 && 
      !messages.some(m => m.sender === 'AI 2' && m.timestamp > tokenRefreshTime);
      
    // If either AI should message, run the checkAndProcessAI function
    if (ai1ShouldMessage || ai2ShouldMessage) {
      checkAndProcessAI();
    }
  }
}, [messages, tokens, isProcessing, turnTimer]);

// Add an initial AI 2 message when the application starts
useEffect(() => {
  // If there are no messages yet and AI 2 has tokens, make AI 2 initiate
  if (messages.length === 0) {
    // Set initial token for AI 2 to ensure it can send a message
    setTokens(prev => ({
      ...prev,
      'AI 2': 1
    }));
    
    // Small delay to ensure token state is updated
    setTimeout(() => {
      processAIResponse('AI 2');
    }, 500);
  }
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