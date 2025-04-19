// pages/index.tsx - complete rewrite
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
      [sender as keyof typeof tokens]: Math.max(0, prev[sender as keyof typeof tokens] - 1)
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


  // Add this function to the Home component to handle sequential AI processing
const processTurn = async () => {
  // Don't process if already processing
  if (isProcessing) return;
  
  setIsProcessing(true);
  
  try {
    // First process AI 1 if it has tokens
    if (tokens['AI 1'] > 0) {
      // Check if AI 1 has any unread messages to respond to
      const ai1HasMessages = messages.some(m => 
        m.recipient === 'AI 1' && 
        !messages.some(r => r.sender === 'AI 1' && r.timestamp > m.timestamp)
      );
      
      if (ai1HasMessages) {
        console.log("AI 1 processing with token:", tokens['AI 1']);
        
        // Process AI 1's response
        const aiHistory = messages.filter(
          m => m.sender === 'AI 1' || m.recipient === 'AI 1'
        ).slice(-20);
        
        // Deduct token immediately
        setTokens(prev => ({
          ...prev,
          'AI 1': prev['AI 1'] - 1
        }));
        
        // Short delay to ensure state update completes
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Get AI response
        const { content, target } = await getAIResponse({
          aiName: 'AI 1',
          history: aiHistory
        });
        
        // Add the message
        const newMessage: Message = {
          sender: 'AI 1',
          recipient: target,
          content: content.trim(),
          timestamp: Date.now(),
          isPrivate: target !== 'user'
        };
        
        setMessages(prev => [...prev, newMessage]);
        
        // Short delay before continuing
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Then process AI 2 if it has tokens - this can respond to new AI 1 messages
    if (tokens['AI 2'] > 0) {
      // Get fresh message list including any new AI 1 messages
      const currentMessages = [...messages];
      
      // Check if AI 2 has any unread messages
      const ai2HasMessages = currentMessages.some(m => 
        m.recipient === 'AI 2' && 
        !currentMessages.some(r => r.sender === 'AI 2' && r.timestamp > m.timestamp)
      );
      
      if (ai2HasMessages) {
        console.log("AI 2 processing with token:", tokens['AI 2']);
        
        // Process AI 2's response
        const aiHistory = currentMessages.filter(
          m => m.sender === 'AI 2' || m.recipient === 'AI 2'
        ).slice(-20);
        
        // Deduct token immediately
        setTokens(prev => ({
          ...prev,
          'AI 2': prev['AI 2'] - 1
        }));
        
        // Short delay to ensure state update completes
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Get AI response
        const { content, target } = await getAIResponse({
          aiName: 'AI 2',
          history: aiHistory
        });
        
        // Add the message
        const newMessage: Message = {
          sender: 'AI 2',
          recipient: target,
          content: content.trim(),
          timestamp: Date.now(),
          isPrivate: target !== 'user'
        };
        
        setMessages(prev => [...prev, newMessage]);
      }
    }
  } catch (error) {
    console.error("Error processing turn:", error);
  } finally {
    setIsProcessing(false);
  }
};

  // Process AI turn
  // Modify the processAITurn function in pages/index.tsx
  const processAITurn = async (ai: 'AI 1' | 'AI 2') => {
    // STRICT token check - don't proceed if AI has no tokens
    if (tokens[ai] <= 0 || isProcessing) return;
    
    // Immediately set processing flag to prevent parallel processing
    setIsProcessing(true);
    
    try {
      // Check if this AI has been messaged (AI should only respond when it receives a message)
      const aiHasMessages = messages.some(m => 
        m.recipient === ai && 
        !messages.some(r => r.sender === ai && r.timestamp > m.timestamp)
      );
      
      // Only proceed if the AI has unread messages
      if (!aiHasMessages) {
        setIsProcessing(false);
        return;
      }
      
      // Get messages relevant to this AI
      const aiHistory = messages.filter(
        m => m.sender === ai || m.recipient === ai
      ).slice(-20);
      
      // Get AI response
      const { content, target } = await getAIResponse({
        aiName: ai,
        history: aiHistory
      });
      
      // IMMEDIATELY deduct token BEFORE sending the message
      setTokens(prev => ({
        ...prev,
        [ai]: Math.max(0, prev[ai] - 1)
      }));
      
      // Add a slight delay to ensure token update happens first
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Then send the message
      const newMessage: Message = {
        sender: ai,
        recipient: target,
        content: content.trim(),
        timestamp: Date.now(),
        isPrivate: target !== 'user'
      };
      
      setMessages(prev => [...prev, newMessage]);
    } catch (error) {
      console.error(`Error processing ${ai} turn:`, error);
    } finally {
      // Always release processing lock when done
      setIsProcessing(false);
    }
  };

  // Turn timer effect
  // Replace your current token timer useEffect with this
  useEffect(() => {
    // Grant 1 token each turn and add to existing tokens
    const turnInterval = setInterval(() => {
      setTokens(prev => ({
        user: prev.user + 1,
        'AI 1': prev['AI 1'] + 1,
        'AI 2': prev['AI 2'] + 1
      }));
      setTurnTimer(30);
      
      // Process the new turn after tokens are refreshed
      setTimeout(() => processTurn(), 100);
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
  // Replace the useEffect for AI processing
  useEffect(() => {
    const checkForAIMessages = async () => {
      if (isProcessing) return;
      
      // Check if any AI has unread messages AND tokens
      const ai1HasUnreadMessages = messages.some(m => 
        m.recipient === 'AI 1' && 
        !messages.some(r => r.sender === 'AI 1' && r.timestamp > m.timestamp)
      );
      
      const ai2HasUnreadMessages = messages.some(m => 
        m.recipient === 'AI 2' && 
        !messages.some(r => r.sender === 'AI 2' && r.timestamp > m.timestamp)
      );
      
      // Process one AI at a time - not both simultaneously
      if (tokens['AI 1'] > 0 && ai1HasUnreadMessages) {
        await processAITurn('AI 1');
      } else if (tokens['AI 2'] > 0 && ai2HasUnreadMessages) {
        await processAITurn('AI 2');
      }
    };
    
    checkForAIMessages();
  }, [tokens, messages, isProcessing]);

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