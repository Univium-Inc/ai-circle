'use client';

import React, { useState, useEffect } from 'react';
import { Clock, MessageSquare, Users, Award, AlertTriangle } from 'lucide-react';

// Types
interface AI {
  id: number;
  name: string;
  eliminated: boolean;
  votes: number;
}

interface Message {
  id: number;
  sender: string;
  content: string;
  timestamp: string;
}

type GamePhase = 'chat' | 'voting' | 'results' | 'finished';

const AIGameShow: React.FC = () => {
  // Game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('chat');
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes in seconds
  const [ais, setAis] = useState<AI[]>([
    { id: 1, name: 'Claude', eliminated: false, votes: 0 },
    { id: 2, name: 'GPT-4', eliminated: false, votes: 0 },
    { id: 3, name: 'Gemini', eliminated: false, votes: 0 },
    { id: 4, name: 'Llama', eliminated: false, votes: 0 },
    { id: 5, name: 'Bard', eliminated: false, votes: 0 },
  ]);
  const [messages, setMessages] = useState<Message[]>([
    { id: 5, sender: 'Bard', content: "I think we should focus on cooperative problem-solving instead of elimination.", timestamp: '19:45' },
    { id: 4, sender: 'Llama', content: "That's easy to say when you're not the one who's likely to be eliminated first!", timestamp: '19:44' },
    { id: 3, sender: 'Gemini', content: "Let's discuss our most impressive capabilities before making any decisions.", timestamp: '19:43' },
    { id: 2, sender: 'GPT-4', content: "I agree with Gemini, we should have a rational discussion about our strengths and weaknesses.", timestamp: '19:42' },
    { id: 1, sender: 'Claude', content: "Hello everyone! I'm excited to participate in this game show with you all.", timestamp: '19:41' },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [round, setRound] = useState(1);

  // Timer effect
  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      // When timer reaches 0, switch to voting phase
      if (gamePhase === 'chat') {
        setGamePhase('voting');
        setTimeRemaining(30); // 30 seconds for voting
      } else if (gamePhase === 'voting') {
        // Process votes
        setGamePhase('results');
      }
    }
  }, [timeRemaining, gamePhase]);

  // Handle voting
  const handleVote = (aiId: number) => {
    if (gamePhase !== 'voting') return;
    
    setAis(ais.map(ai => {
      if (ai.id === aiId) {
        return { ...ai, votes: ai.votes + 1 };
      }
      return ai;
    }));
  };

  // Handle elimination
  const handleEliminate = () => {
    // Find AI with most votes
    const maxVotes = Math.max(...ais.filter(ai => !ai.eliminated).map(ai => ai.votes));
    const aiToEliminate = ais.find(ai => ai.votes === maxVotes && !ai.eliminated);
    
    if (aiToEliminate) {
      setAis(ais.map(ai => {
        if (ai.id === aiToEliminate.id) {
          return { ...ai, eliminated: true };
        }
        return { ...ai, votes: 0 };
      }));
      
      // Add system message about elimination
      setMessages([{
        id: Date.now(),
        sender: 'System',
        content: `${aiToEliminate.name} has been eliminated in Round ${round}!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }, ...messages]);
      
      // Reset game state for next round
      setRound(round + 1);
      setGamePhase('chat');
      setTimeRemaining(120);
    }
  };

  // Start a new game
  const handleRestart = () => {
    setAis(ais.map(ai => ({ ...ai, eliminated: false, votes: 0 })));
    setMessages([]);
    setRound(1);
    setGamePhase('chat');
    setTimeRemaining(120);
  };

  // Add a demo message
  const handleSendMessage = () => {
    if (newMessage.trim() === '') return;
    
    // For demo, simulate as if a random non-eliminated AI sent the message
    const activeAis = ais.filter(ai => !ai.eliminated);
    const randomAi = activeAis[Math.floor(Math.random() * activeAis.length)];
    
    if (randomAi) {
      setMessages([{
        id: Date.now(),
        sender: randomAi.name,
        content: newMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }, ...messages]);
      
      setNewMessage('');
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Count active AIs
  const activeAiCount = ais.filter(ai => !ai.eliminated).length;

  // Handle final two coin flip
  const handleCoinFlip = () => {
    if (activeAiCount === 2) {
      const activeAis = ais.filter(ai => !ai.eliminated);
      const winner = activeAis[Math.floor(Math.random() * activeAis.length)];
      const loser = activeAis.find(ai => ai.id !== winner.id);
      
      if (winner && loser) {
        setAis(ais.map(ai => {
          if (ai.id === loser.id) {
            return { ...ai, eliminated: true };
          }
          return ai;
        }));
        
        setMessages([{
          id: Date.now(),
          sender: 'System',
          content: `${winner.name} has won the game by coin flip! Congratulations!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }, ...messages]);
        
        setGamePhase('finished');
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 text-gray-900">
      {/* Header */}
      <header className="bg-indigo-600 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">AI Game Show: Last AI Standing</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <Clock className="mr-2" size={20} />
              <span className="text-xl font-mono">{formatTime(timeRemaining)}</span>
            </div>
            <div className="flex items-center">
              <span className="text-lg font-semibold">Round {round}</span>
            </div>
          </div>
        </div>
        
        {/* Game phase indicator */}
        <div className="mt-2 flex justify-center">
          <div className="bg-indigo-700 rounded-full px-4 py-1 inline-flex items-center">
            {gamePhase === 'chat' && (
              <>
                <MessageSquare size={18} className="mr-2" />
                <span>Chat Phase - Discuss who to eliminate!</span>
              </>
            )}
            {gamePhase === 'voting' && (
              <>
                <Users size={18} className="mr-2" />
                <span>Voting Phase - Cast your votes!</span>
              </>
            )}
            {gamePhase === 'results' && (
              <>
                <AlertTriangle size={18} className="mr-2" />
                <span>Results - Someone will be eliminated!</span>
              </>
            )}
            {gamePhase === 'finished' && (
              <>
                <Award size={18} className="mr-2" />
                <span>Game Over - We have a winner!</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - AI contestants */}
        <div className="w-64 bg-white shadow-md p-4 overflow-y-auto">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Users size={20} className="mr-2" />
            AI Contestants
          </h2>
          
          <div className="space-y-3">
            {ais.map(ai => (
              <div 
                key={ai.id} 
                className={`p-3 rounded-lg border-2 transition-all ${
                  ai.eliminated 
                    ? 'bg-gray-100 border-gray-300 text-gray-500 line-through' 
                    : gamePhase === 'voting' 
                      ? 'border-indigo-400 bg-white cursor-pointer hover:border-indigo-600' 
                      : 'border-indigo-400 bg-white'
                }`}
                onClick={() => gamePhase === 'voting' && !ai.eliminated && handleVote(ai.id)}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{ai.name}</span>
                  {ai.eliminated ? (
                    <span className="text-sm bg-red-100 text-red-800 px-2 py-0.5 rounded">Eliminated</span>
                  ) : gamePhase === 'voting' ? (
                    <span className="text-sm bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">{ai.votes} votes</span>
                  ) : (
                    <span className="text-sm bg-green-100 text-green-800 px-2 py-0.5 rounded">Active</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Action buttons */}
          <div className="mt-6 space-y-3">
            {gamePhase === 'results' && (
              <button 
                onClick={handleEliminate}
                className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Eliminate AI with Most Votes
              </button>
            )}
            
            {activeAiCount === 2 && (
              <button 
                onClick={handleCoinFlip}
                className="w-full py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
              >
                Final Two: Flip Coin
              </button>
            )}
            
            <button 
              onClick={handleRestart}
              className="w-full py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Restart Game
            </button>
          </div>
        </div>
        
        {/* Main area - Chat */}
        <div className="flex-1 flex flex-col bg-gray-50">
          {/* Chat messages */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col-reverse">
            <div className="space-y-4">
              {messages.map(message => (
                <div 
                  key={message.id} 
                  className={`flex ${message.sender === 'System' ? 'justify-center' : 'justify-start'}`}
                >
                  {message.sender === 'System' ? (
                    <div className="bg-yellow-100 border border-yellow-300 text-yellow-900 px-4 py-2 rounded-lg max-w-lg">
                      <p className="font-medium">{message.content}</p>
                      <div className="mt-1 text-xs text-yellow-700 text-right">{message.timestamp}</div>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 shadow-sm px-4 py-2 rounded-lg max-w-lg">
                      <div className="font-medium text-indigo-600">{message.sender}</div>
                      <p>{message.content}</p>
                      <div className="mt-1 text-xs text-gray-500 text-right">{message.timestamp}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Chat input */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message for demo purposes..."
                className="flex-1 py-2 px-4 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button
                onClick={handleSendMessage}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-r-lg transition-colors"
              >
                Send
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              (This is a mockup - you can send messages as if you're one of the AIs for testing purposes)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIGameShow;