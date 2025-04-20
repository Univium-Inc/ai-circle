// pages/index.tsx
"use client";
import { useEffect, useRef, useState } from "react";

// Environment variables
const OPENAI_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? "";
const OPENAI_EP = "https://api.openai.com/v1/chat/completions";

// Game configuration (can be adjusted via UI later)
const CONFIG = {
  DISCUSSION_MS: 2 * 60 * 1000, // 2-min chat
  VOTING_MS: 2 * 60 * 1000,     // 2-min voting
  TURN_MS: 5 * 1000,            // one speaker every 5s
  HOST_MS: 30 * 1000,           // host commentary every 30s
  MODEL: "gpt-3.5-turbo-0125",  // can be changed to gpt-4 for better responses
  TEMPERATURE: 0.8
};

// Player definitions with more detailed personas
const PLAYERS = [
  { 
    name: "Alice", 
    persona: "Outgoing optimist who trusts gut feelings and tends to form alliances based on emotional connections.", 
    avatar: "A", 
    color: "#FF5252" 
  },
  { 
    name: "Brian", 
    persona: "Skeptical logician who distrusts popularity and analyzes others' motivations with careful precision.", 
    avatar: "B", 
    color: "#448AFF" 
  },
  { 
    name: "Chloe", 
    persona: "Charismatic activist who sways crowds and champions social causes within the group dynamic.", 
    avatar: "C", 
    color: "#7C4DFF" 
  },
  { 
    name: "Derek", 
    persona: "Data-driven realist focused on strategy who makes calculated decisions based on observed patterns.", 
    avatar: "D", 
    color: "#FF9800" 
  },
  { 
    name: "Evelyn", 
    persona: "Empathetic human-rights advocate who prioritizes fairness but can be swayed by compelling stories.", 
    avatar: "E", 
    color: "#26A69A" 
  },
  { 
    name: "Felix", 
    persona: "Tech futurist who loves disruption and frequently proposes unconventional solutions to group problems.", 
    avatar: "F", 
    color: "#78909C" 
  }
] as const;

// Game phases
type Phase = "setup" | "discussion" | "voting" | "elimination" | "end";

// Message interface with timestamp for ordering
interface Msg {
  speaker: string;
  content: string;
  timestamp: number;
  vote?: string; // Optional vote information for display
}

export default function Home() {
  // Game state
  const [phase, setPhase] = useState<Phase>("setup");
  const [round, setRound] = useState(1);
  const [live, setLive] = useState<string[]>([]);
  const [eliminated, setEliminated] = useState<string[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [gameConfig, setGameConfig] = useState(CONFIG);
  const [isProcessing, setIsProcessing] = useState(false);
  const [votes, setVotes] = useState<Record<string, string>>({});
  
  // References for timers and game control
  const turnPtr = useRef(0);
  const phaseTimer = useRef<NodeJS.Timeout>();
  const turnTimer = useRef<NodeJS.Timeout>();
  const hostTimer = useRef<NodeJS.Timeout>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  /* ================ HELPERS ================ */
  
  // Format milliseconds to MM:SS
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms / 1000) % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Start countdown timer for phases
  const startCountdown = (duration: number, nextPhase: Phase) => {
    clearInterval(phaseTimer.current!);
    setTimeLeft(duration);
    
    const startTime = Date.now();
    phaseTimer.current = setInterval(() => {
      const remaining = Math.max(0, duration - (Date.now() - startTime));
      setTimeLeft(remaining);
      
      if (remaining === 0) {
        clearInterval(phaseTimer.current!);
        setPhase(nextPhase);
      }
    }, 1000);
  };

  // Get player details by name
  const getPlayer = (name: string) => {
    return PLAYERS.find(p => p.name === name) || PLAYERS[0];
  };

  /* ================ API CALLS ================ */
  
  // Call OpenAI API 
  const callOpenAI = async (systemPrompt: string, conversation: any[]) => {
    if (!OPENAI_KEY) {
      console.error("NEXT_PUBLIC_OPENAI_API_KEY missing");
      return "";
    }
    
    const body = {
      model: gameConfig.MODEL,
      temperature: gameConfig.TEMPERATURE,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversation
      ]
    };
    
    try {
      const response = await fetch(OPENAI_EP, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_KEY}`
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      return (data?.choices?.[0]?.message?.content ?? "").trim();
    } catch (error) {
      console.error("OpenAI API error:", error);
      return "Error connecting to AI service";
    }
  };

  // AI character speaks
  const aiSpeak = async (speaker: string, currentPhase: "discussion" | "voting") => {
    try {
      const player = PLAYERS.find(p => p.name === speaker);
      if (!player) return;
      
      const persona = player.persona;
      const allowedPlayers = live.join(", ");
      
      // Enhanced system prompt for better role-playing
      const systemPrompt = `You are ${speaker}, ${persona}

Current round: ${round}
Current players: ${allowedPlayers}
Previous eliminations: ${eliminated.join(", ") || "None"}

IMPORTANT RULES:
- Only mention player names from the current player list
- Never refer to yourself in the third person or by name
- Stay in character consistently based on your persona
- Keep responses conversational and engaging`;

      // Enhanced phase-specific prompts
      const prompt = currentPhase === "discussion"
        ? `Discussion phase (Round ${round}):
In 120 words or less, strategically discuss who should be eliminated and why. 
Reference others' points where relevant. Be tactical and true to your character.
DO NOT mention yourself or refer to yourself in third person.`
        : `Voting phase (Round ${round}):
Reply in exactly two lines:
VOTE: <Name from list>
REASON: <brief explanation>

You CANNOT vote for yourself. Valid options: ${live.filter(n => n !== speaker).join(", ")}`;

      // Get recent conversation context with better formatting
      const recentMessages = msgs
        .filter(m => m.speaker === "Host" || live.includes(m.speaker))
        .slice(-30); // Increased context window
      
      // Format the conversation history to include speaker names
      const formattedHistory = recentMessages.map(m => ({
        role: "user",
        content: `${m.speaker}: ${m.content}`
      }));
      
      // Add the prompt as the final user message
      const conversation = [
        ...formattedHistory,
        { role: "user", content: prompt }
      ];

      // Call the AI and add the response
      const response = await callOpenAI(systemPrompt, conversation);
      
      if (response) {
        // Extract vote if in voting phase
        let vote = undefined;
        if (currentPhase === "voting") {
          const voteMatch = response.match(/VOTE:\s*(\w+)/i);
          if (voteMatch && voteMatch[1]) {
            vote = voteMatch[1];
            setVotes(prev => ({ ...prev, [speaker]: vote }));
          }
        }
        
        setMsgs(prev => [
          ...prev,
          { 
            speaker, 
            content: response, 
            timestamp: Date.now(),
            vote
          }
        ]);
      }
    } catch (error) {
      console.error(`Error with ${speaker}'s turn:`, error);
      // Add fallback message if API fails
      setMsgs(prev => [
        ...prev,
        { 
          speaker, 
          content: "Sorry, I'm having trouble connecting right now.", 
          timestamp: Date.now() 
        }
      ]);
    }
  };

  // Host commentary
  const hostSpeak = async (specialMessage?: string) => {
    if (specialMessage) {
      setMsgs(prev => [
        ...prev,
        { speaker: "Host", content: specialMessage, timestamp: Date.now() }
      ]);
      return;
    }
    
    try {
      const allowedPlayers = live.join(", ");
      
      // Enhanced host system prompt
      const systemPrompt = `You are the HOST of a reality elimination game show. Your goal is to:
1. Spark drama and intense discussion between players
2. Comment on alliances, betrayals, and strategies you observe
3. Stir controversy with provocative questions and observations

RULES:
- Only mention these current players: ${allowedPlayers}
- Keep commentary to 60 words maximum
- Be entertaining, dramatic and slightly antagonistic
- Create tension between players where possible
- Reference specific events from recent discussions`;

      // Get recent messages for context
      const recentMessages = msgs.slice(-15).map(m => ({
        role: m.speaker === "Host" ? "assistant" : "user",
        content: `${m.speaker}: ${m.content}`
      }));
      
      // Add a specific prompt for the host
      const hostPrompt = {
        role: "user",
        content: `We're in round ${round}, phase: ${phase}. Make a dramatic comment that will stir up conflict between the remaining players. Focus on observed tensions, potential alliances, or betrayals.`
      };
      
      const response = await callOpenAI(systemPrompt, [...recentMessages, hostPrompt]);
      
      if (response) {
        setMsgs(prev => [
          ...prev,
          { speaker: "Host", content: response, timestamp: Date.now() }
        ]);
      }
    } catch (error) {
      console.error("Host commentary error:", error);
    }
  };

  /* ================ GAME LOGIC ================ */
  
  // Process elimination and handle phase transitions
  const processElimination = async () => {
    setIsProcessing(true);
    
    // Tally votes
    const voteTally: Record<string, number> = {};
    live.forEach(player => {
      const playerVote = votes[player];
      if (playerVote && live.includes(playerVote)) {
        voteTally[playerVote] = (voteTally[playerVote] || 0) + 1;
      }
    });
    
    // Find player with most votes
    let maxVotes = -1;
    let eliminatedPlayer = "";
    
    Object.entries(voteTally).forEach(([player, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedPlayer = player;
      }
    });
    
    // If there's a tie or no clear elimination, pick randomly from those with max votes
    if (!eliminatedPlayer || maxVotes <= 0) {
      eliminatedPlayer = live[Math.floor(Math.random() * live.length)];
    }
    
    // Announce elimination
    await hostSpeak(`⌛ ${eliminatedPlayer} has been eliminated with ${maxVotes} vote(s)!`);
    
    // Update game state
    setLive(prev => prev.filter(p => p !== eliminatedPlayer));
    setEliminated(prev => [...prev, eliminatedPlayer]);
    setVotes({});
    
    // Check if game is ending
    if (live.length <= 2) {
      await hostSpeak(`🏆 We have our finalists: ${live.join(" & ")}!`);
      setPhase("end");
    } else {
      setRound(prev => prev + 1);
      await hostSpeak(`📢 Round ${round + 1} begins! Players remaining: ${live.filter(p => p !== eliminatedPlayer).join(", ")}`);
      setPhase("discussion");
    }
    
    setIsProcessing(false);
  };

  // Handle phase transitions
  useEffect(() => {
    // Clear timers when component unmounts or phase changes
    return () => {
      clearInterval(phaseTimer.current!);
      clearInterval(turnTimer.current!);
      clearInterval(hostTimer.current!);
    };
  }, []);

  // Main game state machine
  useEffect(() => {
    if (phase === "setup" || phase === "end") return;
    
    if (phase === "discussion") {
      // Reset turn pointer and clear previous intervals
      clearInterval(turnTimer.current!);
      clearInterval(hostTimer.current!);
      turnPtr.current = 0;
      
      // First player speaks immediately
      aiSpeak(live[0], "discussion");
      
      // Schedule remaining players
      turnTimer.current = setInterval(() => {
        turnPtr.current = (turnPtr.current + 1) % live.length;
        aiSpeak(live[turnPtr.current], "discussion");
      }, gameConfig.TURN_MS);
      
      // Host commentary
      hostSpeak();
      hostTimer.current = setInterval(() => hostSpeak(), gameConfig.HOST_MS);
      
      // Start countdown
      startCountdown(gameConfig.DISCUSSION_MS, "voting");
      return;
    }
    
    if (phase === "voting") {
      // Clear previous timers
      clearInterval(turnTimer.current!);
      clearInterval(hostTimer.current!);
      
      // Host announces voting phase
      hostSpeak("Voting has begun! Each player must now choose who to eliminate.");
      
      // Sequential voting process
      (async () => {
        for (const voter of live) {
          await aiSpeak(voter, "voting");
          await new Promise(resolve => setTimeout(resolve, gameConfig.TURN_MS));
        }
        
        // Move to elimination phase
        setPhase("elimination");
      })();
      
      // Start countdown (can be skipped if all votes are in)
      startCountdown(gameConfig.VOTING_MS, "elimination");
      return;
    }
    
    if (phase === "elimination") {
      // Clear timers
      clearInterval(phaseTimer.current!);
      clearInterval(turnTimer.current!);
      clearInterval(hostTimer.current!);
      
      // Process elimination and prepare next round
      processElimination();
      return;
    }
  }, [phase]);

  // Scroll to bottom of messages when new ones arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgs]);

  /* ================ UI ACTIONS ================ */
  
  // Start the game
  const startGame = () => {
    if (phase !== "setup") return;
    
    // Initialize game state
    setLive(PLAYERS.map(p => p.name));
    setEliminated([]);
    setVotes({});
    setRound(1);
    setMsgs([{ 
      speaker: "Host", 
      content: "Welcome to Social Elimination! Round 1 begins now!", 
      timestamp: Date.now() 
    }]);
    
    // Start game
    setPhase("discussion");
  };
  
  // Skip current phase
  const skipPhase = () => {
    clearInterval(phaseTimer.current!);
    
    if (phase === "discussion") {
      setPhase("voting");
    } else if (phase === "voting") {
      setPhase("elimination");
    }
  };
  
  // Reset game
  const resetGame = () => {
    // Clear all timers
    clearInterval(phaseTimer.current!);
    clearInterval(turnTimer.current!);
    clearInterval(hostTimer.current!);
    
    // Reset game state
    setPhase("setup");
    setLive([]);
    setEliminated([]);
    setMsgs([]);
    setVotes({});
    setRound(1);
  };

  /* ================ RENDER ================ */
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Top Navigation Bar */}
      <nav className="bg-black bg-opacity-40 backdrop-blur-sm border-b border-gray-700 p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Social Elimination – AI Edition
          </h1>
          
          {phase !== "setup" && (
            <div className="flex gap-2">
              <button 
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                onClick={skipPhase}
                disabled={phase === "elimination" || phase === "end" || isProcessing}
              >
                Skip Phase
              </button>
              <button 
                className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                onClick={resetGame}
                disabled={isProcessing}
              >
                Reset Game
              </button>
            </div>
          )}
        </div>
      </nav>
      
      <div className="max-w-6xl mx-auto p-4 md:p-6">
        {phase === "setup" ? (
          /* Game Start Screen */
          <div className="h-[80vh] flex flex-col items-center justify-center">
            <div className="text-center mb-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500">
                Welcome to Social Elimination
              </h2>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                A reality-style game where AI characters discuss strategy and vote each other out until only the finalists remain.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {PLAYERS.map(player => (
                <div 
                  key={player.name}
                  className="p-4 rounded-lg border border-gray-700 bg-gray-800 bg-opacity-50 flex items-center space-x-3"
                >
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold"
                    style={{ backgroundColor: player.color }}
                  >
                    {player.avatar}
                  </div>
                  <div>
                    <div className="font-bold">{player.name}</div>
                    <div className="text-sm text-gray-400 truncate">{player.persona.split(' ').slice(0, 5).join(' ')}...</div>
                  </div>
                </div>
              ))}
            </div>
            
            <button 
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-xl font-bold rounded-lg shadow-xl transition-all hover:scale-105"
              onClick={startGame}
            >
              Start Game
            </button>
          </div>
        ) : (
          /* Game in Progress UI */
          <>
            {/* Game Status Panel */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Round & Phase */}
              <div className="bg-gray-800 bg-opacity-50 border border-gray-700 rounded-lg p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Round & Phase</div>
                    <div className="text-xl font-bold">{round} • <span className="capitalize">{phase}</span></div>
                  </div>
                </div>
              </div>
              
              {/* Timer */}
              <div className="bg-gray-800 bg-opacity-50 border border-gray-700 rounded-lg p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-gray-400">Time Remaining</div>
                    <div className="text-xl font-bold">{formatTime(timeLeft)}</div>
                    <div className="w-full h-2 bg-gray-700 rounded-full mt-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-1000 ease-linear"
                        style={{
                          width: `${(timeLeft / (phase === "discussion" ? gameConfig.DISCUSSION_MS : gameConfig.VOTING_MS)) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Players */}
              <div className="bg-gray-800 bg-opacity-50 border border-gray-700 rounded-lg p-4 shadow-lg">
                <div className="text-sm text-gray-400 mb-2">Players</div>
                <div className="flex flex-wrap gap-2">
                  {live.map(name => {
                    const player = getPlayer(name);
                    return (
                      <div 
                        key={name}
                        className="flex items-center px-2 py-1 rounded-full shadow-sm"
                        style={{ backgroundColor: `${player.color}33`, borderLeft: `3px solid ${player.color}` }}
                      >
                        <span 
                          className="w-6 h-6 rounded-full inline-flex items-center justify-center text-sm font-bold mr-1"
                          style={{ backgroundColor: player.color }}
                        >
                          {player.avatar}
                        </span>
                        <span>{name}</span>
                      </div>
                    );
                  })}
                </div>
                
                {eliminated.length > 0 && (
                  <>
                    <div className="text-sm text-gray-400 mt-3 mb-2">Eliminated</div>
                    <div className="flex flex-wrap gap-2">
                      {eliminated.map(name => {
                        const player = getPlayer(name);
                        return (
                          <div 
                            key={name}
                            className="flex items-center px-2 py-1 rounded-full opacity-60 line-through shadow-sm"
                            style={{ backgroundColor: `${player.color}22`, borderLeft: `3px solid ${player.color}` }}
                          >
                            <span 
                              className="w-6 h-6 rounded-full inline-flex items-center justify-center text-sm font-bold mr-1"
                              style={{ backgroundColor: player.color }}
                            >
                              {player.avatar}
                            </span>
                            <span>{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Messages - modern chat interface with newest at top */}
            <div className="bg-gray-800 bg-opacity-30 border border-gray-700 rounded-lg shadow-lg h-[60vh] overflow-y-auto">
              <div className="flex flex-col-reverse p-4 space-y-reverse space-y-4">
                {msgs.map((msg, index) => {
                  const isHost = msg.speaker === "Host";
                  const player = isHost ? null : getPlayer(msg.speaker);
                  
                  // Check for vote messages
                  const isVoteMessage = msg.content.includes("VOTE:") && msg.content.includes("REASON:");
                  let votedFor = "";
                  let voteReason = "";
                  
                  if (isVoteMessage) {
                    const voteMatch = msg.content.match(/VOTE:\s*(\w+)/i);
                    const reasonMatch = msg.content.match(/REASON:\s*(.*?)(?:\n|$)/i);
                    
                    votedFor = voteMatch ? voteMatch[1] : "Unknown";
                    voteReason = reasonMatch ? reasonMatch[1] : "";
                  }
                  
                  return (
                    <div 
                      key={index}
                      className={`rounded-lg shadow-md transition-all duration-300 animate-fadeIn ${isHost ? 'bg-gradient-to-r from-gray-700 to-gray-800' : 'bg-gray-800'}`}
                      style={!isHost ? { borderLeft: `4px solid ${player?.color}` } : {}}
                    >
                      <div className="p-3">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center">
                            {isHost ? (
                              <span className="px-2 py-1 bg-purple-600 bg-opacity-40 text-purple-300 rounded-md text-sm font-medium">HOST</span>
                            ) : (
                              <div 
                                className="flex items-center gap-2"
                              >
                                <span 
                                  className="w-7 h-7 rounded-full inline-flex items-center justify-center text-sm font-bold"
                                  style={{ backgroundColor: player?.color }}
                                >
                                  {player?.avatar}
                                </span>
                                <span className="font-medium">{msg.speaker}</span>
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        
                        {isVoteMessage ? (
                          <div className="ml-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold">Votes for:</span>
                              <div 
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-sm"
                                style={{ backgroundColor: `${getPlayer(votedFor).color}33` }}
                              >
                                <span 
                                  className="w-5 h-5 rounded-full inline-flex items-center justify-center mr-1 text-xs font-bold"
                                  style={{ backgroundColor: getPlayer(votedFor).color }}
                                >
                                  {getPlayer(votedFor).avatar}
                                </span>
                                {votedFor}
                              </div>
                            </div>
                            <div className="text-gray-300">{voteReason}</div>
                          </div>
                        ) : (
                          <div className="text-gray-300 ml-1">{msg.content}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef}></div>
              </div>
            </div>
            
            {/* Game Over Screen */}
            {phase === "end" && (
              <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-20 backdrop-blur-sm">
                <div className="bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700 rounded-lg p-8 shadow-2xl max-w-md w-full text-center">
                  <h2 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-500">Game Over!</h2>
                  <div className="mb-6">
                    <p className="text-xl text-gray-300 mb-2">The finalists are:</p>
                    <div className="flex justify-center gap-4 mt-4">
                      {live.map(name => {
                        const player = getPlayer(name);
                        return (
                          <div 
                            key={name}
                            className="flex flex-col items-center"
                          >
                            <div 
                              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg mb-2"
                              style={{ backgroundColor: player.color }}
                            >
                              {player.avatar}
                            </div>
                            <span className="font-bold text-xl">{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button 
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-lg font-bold rounded-lg shadow-xl transition-all hover:scale-105 w-full"
                    onClick={resetGame}
                  >
                    Play Again
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}