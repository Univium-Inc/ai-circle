// pages/index.tsx - updated with message visibility
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAIResponse } from '@/lib/AIEngine';
import { Message, MessageVisibility } from '@/lib/types';

/* ---------- reusable chat component ---------- */
type ChatBoxProps = {
  title: string;
  messages: Message[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  canSend: boolean;
  personality?: string;
};

const ChatBox = ({
  title,
  messages,
  input,
  onInputChange,
  onSend,
  canSend,
  personality,
}: ChatBoxProps) => (
  <div className="flex flex-col w-full max-w-md bg-white shadow rounded p-4 h-[600px]">
    <h2 className="font-semibold mb-2">{title}</h2>
    {personality && (
      <div className="text-xs text-gray-500 mb-2 italic">
        {personality}
      </div>
    )}
    <div className="flex-1 overflow-y-auto space-y-2 mb-2">
      {messages.map((m, i) => {
        // Rendering message with appropriate styling based on visibility
        return (
          <div 
            key={i} 
            className={`p-2 rounded text-sm ${
              m.visibility === 'highlighted' 
                ? 'bg-yellow-100 border border-yellow-300' 
                : 'bg-gray-100'
            }`}
          >
            <strong>{m.sender} → {m.recipient}:</strong> {m.content}
          </div>
        );
      })}
    </div>
    <div className="flex gap-2">
      <Input
        value={input}
        onChange={(e: { target: { value: string; }; }) => onInputChange(e.target.value)}
        placeholder={`Message to ${title.split(' ')[2]}…`}
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
  const [userToBenny, setUserToBenny] = useState('');
  const [userToGary, setUserToGary] = useState('');
  
  // AI Personalities
  const aiPersonalities = {
    'Benny': 'Cheerful and enthusiastic AI with a knack for creative thinking',
    'Gary': 'Logical and analytical AI who values precision and clear thinking'
  };
  
  // Tokens - everyone starts with 1
  const [tokens, setTokens] = useState({
    Larry: 1,
    'Benny': 1,
    'Gary': 1
  });
  
  const [turnTimer, setTurnTimer] = useState(30);
  const [isProcessing, setIsProcessing] = useState(false);
  const [turnInProgress, setTurnInProgress] = useState(false);
  
  // Get filtered messages for each chat view
  const getUserToBennyMessages = () => {
    return messages.filter(
      m => (m.sender === 'Larry' && m.recipient === 'Benny') ||
           (m.sender === 'Benny' && m.recipient === 'Larry')
    );
  };

  const getUserToGaryMessages = () => {
    return messages.filter(
      m => (m.sender === 'Larry' && m.recipient === 'Gary') ||
           (m.sender === 'Gary' && m.recipient === 'Larry')
    );
  };

  const getMonitorMessages = () => {
    return messages.filter(
      m => m.sender !== 'Larry' && m.recipient !== 'Larry'
    );
  };

  // Determine message visibility based on context
  const determineVisibility = (
    sender: 'Larry' | 'Benny' | 'Gary', 
    recipient: 'Larry' | 'Benny' | 'Gary',
    content: string
  ): MessageVisibility => {
    // Messages between AIs are private
    if (sender !== 'Larry' && recipient !== 'Larry') {
      return 'private';
    }
    
    // Highlight messages containing specific keywords (customize as needed)
    const highlightKeywords = ['vote', 'favorite', 'best', 'choose', 'like', 'prefer'];
    if (highlightKeywords.some(keyword => content.toLowerCase().includes(keyword))) {
      return 'highlighted';
    }
    
    // Default is public
    return 'public';
  };

  // Process a single AI response, returns true if message sent, false otherwise
  const processAIMessage = async (ai: 'Benny' | 'Gary') => {
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
        history: aiHistory,
        userName: 'Larry'
      });
      
      // Validate the target
      const validTarget = target === 'Larry' || target === (ai === 'Benny' ? 'Gary' : 'Benny');
      const finalTarget = validTarget ? target : 'Larry'; // Default to user if invalid
      
      // Determine visibility of this message
      const visibility = determineVisibility(ai, finalTarget, content.trim());
      
      // Create message
      const newMessage: Message = {
        sender: ai,
        recipient: finalTarget,
        content: content.trim(),
        timestamp: Date.now(),
        visibility: visibility
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
      const ais: ('Benny' | 'Gary')[] = Math.random() < 0.5 
        ? ['Benny', 'Gary'] 
        : ['Gary', 'Benny'];
      
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
  const sendMessage = (sender: 'Larry' | 'Benny' | 'Gary', recipient: 'Larry' | 'Benny' | 'Gary', content: string) => {
    if (!content.trim() || tokens[sender as keyof typeof tokens] <= 0) return;
    
    // Determine message visibility
    const visibility = determineVisibility(sender, recipient, content.trim());
    
    // Create message
    const newMessage: Message = {
      sender,
      recipient,
      content: content.trim(),
      timestamp: Date.now(),
      visibility: visibility
    };
    
    // Add message to state
    setMessages(prev => [...prev, newMessage]);
    
    // Deduct token
    setTokens(prev => ({
      ...prev,
      [sender]: prev[sender as keyof typeof tokens] - 1
    }));
    
    // If the user sent a message, trigger AI responses after a delay
    if (sender === 'Larry') {
      setTimeout(() => {
        processTurn();
      }, 500);
    }
  };

  // User send functions
  const sendToBenny = () => {
    if (tokens.Larry <= 0 || !userToBenny.trim()) return;
    sendMessage('Larry', 'Benny', userToBenny);
    setUserToBenny('');
  };

  const sendToGary = () => {
    if (tokens.Larry <= 0 || !userToGary.trim()) return;
    sendMessage('Larry', 'Gary', userToGary);
    setUserToGary('');
  };

  // Turn timer effect - replenish tokens every 30 seconds
  useEffect(() => {
    // Grant 1 token to all participants every turn
    const turnInterval = setInterval(() => {
      setTokens(prev => ({
        Larry: prev.Larry + 1,
        'Benny': prev['Benny'] + 1,
        'Gary': prev['Gary'] + 1
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
        <h1 className="text-xl font-bold mb-2">The Circle: AI Edition</h1>
        ⏳ <strong>Next Turn In:</strong> {turnTimer}s<br/>
        🎟 <strong>Tokens</strong> — Larry: {tokens.Larry} | Benny: {tokens['Benny']} | Gary: {tokens['Gary']}
      </div>

      {/* Chat boxes */}
      <div className="flex gap-4 flex-col md:flex-row justify-center">
        <ChatBox
          title="Chat with Benny"
          messages={getUserToBennyMessages()}
          input={userToBenny}
          onInputChange={setUserToBenny}
          onSend={sendToBenny}
          canSend={tokens.Larry > 0}
          personality={aiPersonalities['Benny']}
        />

        <ChatBox
          title="Chat with Gary"
          messages={getUserToGaryMessages()}
          input={userToGary}
          onInputChange={setUserToGary}
          onSend={sendToGary}
          canSend={tokens.Larry > 0}
          personality={aiPersonalities['Gary']}
        />

        {/* Monitor panel */}
        <div className="w-full max-w-md bg-white shadow rounded p-4 h-[600px] overflow-y-auto">
          <h2 className="text-lg font-bold mb-2">AI Monitor Log</h2>
          <p className="text-xs text-gray-500 mb-2 italic">
            Watch Benny and Gary chat with each other
          </p>
          {getMonitorMessages().map((m, i) => (
            <div 
              key={i} 
              className={`p-2 text-xs rounded my-1 ${
                m.sender === 'Benny' 
                  ? 'bg-blue-50' 
                  : 'bg-green-50'
              } ${
                m.visibility === 'highlighted' 
                  ? 'border border-yellow-300' 
                  : ''
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