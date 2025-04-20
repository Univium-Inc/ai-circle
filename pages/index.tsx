


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

/* Add proper CSS animation keyframes */
const GlobalStyles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(66, 153, 225, 0.5); }
    70% { box-shadow: 0 0 0 10px rgba(66, 153, 225, 0); }
    100% { box-shadow: 0 0 0 0 rgba(66, 153, 225, 0); }
  }
  
  @keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
  }
  
  @keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.5s ease-out forwards;
  }
  
  .animate-pulse {
    animation: pulse 2s infinite;
  }
  
  .animate-float {
    animation: float 3s ease-in-out infinite;
  }
  
  .shimmer {
    background: linear-gradient(
      to right,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.2) 20%,
      rgba(255, 255, 255, 0) 40%
    );
    background-size: 1000px 100%;
    animation: shimmer 2s infinite linear;
  }
  
  /* Scrollbar styling */
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: rgba(15, 23, 42, 0.3);
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(100, 116, 139, 0.5);
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(100, 116, 139, 0.7);
  }
  
  /* Glass effect */
  .glass-effect {
    backdrop-filter: blur(8px);
    background: rgba(17, 25, 40, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.125);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  }
  
  /* Button effects */
  .button-glow {
    position: relative;
    z-index: 0;
    overflow: hidden;
  }
  
  .button-glow:before {
    content: '';
    background: linear-gradient(45deg, #ff0000, #ff7300, #fffb00, #48ff00, #00ffd5, #002bff, #7a00ff, #ff00c8, #ff0000);
    position: absolute;
    top: -2px;
    left: -2px;
    background-size: 400%;
    z-index: -1;
    filter: blur(5px);
    width: calc(100% + 4px);
    height: calc(100% + 4px);
    animation: glowing 20s linear infinite;
    opacity: 0;
    transition: opacity .3s ease-in-out;
    border-radius: 10px;
  }
  
  .button-glow:active:after {
    background: transparent;
  }
  
  .button-glow:hover:before {
    opacity: 1;
  }
  
  .button-glow:after {
    z-index: -1;
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
    border-radius: 10px;
  }
  
  @keyframes glowing {
    0% { background-position: 0 0; }
    50% { background-position: 400% 0; }
    100% { background-position: 0 0; }
  }
`;


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
  <main className="min-h-screen text-white overflow-x-hidden" style={{
    background: `
      radial-gradient(circle at 10% 20%, rgba(0, 0, 80, 0.8) 0%, rgba(15, 23, 42, 1) 90%),
      url('data:image/svg+xml,%3Csvg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z" fill="rgba(255,255,255,0.05)" fill-rule="evenodd"/%3E%3C/svg%3E')
    `
  }}>
    {/* Add global CSS */}
    <style dangerouslySetInnerHTML={{ __html: GlobalStyles }} />
    
    {/* Aesthetic particles background */}
    <div className="fixed inset-0 z-0 opacity-40 pointer-events-none">
      <div className="absolute top-1/4 left-1/4 w-1 h-1 rounded-full bg-blue-400 animate-ping"></div>
      <div className="absolute top-1/3 left-2/3 w-2 h-2 rounded-full bg-purple-400 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.5s' }}></div>
      <div className="absolute top-2/3 left-1/3 w-1 h-1 rounded-full bg-emerald-400 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.7s' }}></div>
      <div className="absolute top-3/4 left-3/4 w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping" style={{ animationDuration: '4s', animationDelay: '1s' }}></div>
    </div>
    
    {/* Premium Header with blur effect */}
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-opacity-30 bg-gray-900 border-b border-gray-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="relative flex-shrink-0 h-10 w-10 mr-3">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 animate-spin-slow opacity-75" style={{ animationDuration: '8s' }}></div>
              <div className="absolute inset-1 rounded-full bg-gray-900 flex items-center justify-center">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-600 font-bold">SE</span>
              </div>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
              Social Elimination – AI Edition
            </h1>
          </div>
          
          {phase !== "setup" && (
            <div className="flex gap-3">
              <button 
                className="px-3 py-2 rounded-md font-medium text-sm text-white shadow-lg relative overflow-hidden transition-all duration-500 ease-in-out bg-gradient-to-r from-indigo-500 to-indigo-700 hover:from-indigo-600 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={skipPhase}
                disabled={phase === "elimination" || phase === "end" || isProcessing}
              >
                <span className="relative z-10">Skip Phase</span>
                <span className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-indigo-800 opacity-0 hover:opacity-100 transition-opacity duration-500"></span>
              </button>
              <button 
                className="px-3 py-2 rounded-md font-medium text-sm text-white shadow-lg relative overflow-hidden transition-all duration-500 ease-in-out bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={resetGame}
                disabled={isProcessing}
              >
                <span className="relative z-10">Reset Game</span>
                <span className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-800 opacity-0 hover:opacity-100 transition-opacity duration-500"></span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
    
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
      {phase === "setup" ? (
        /* Premium Game Start Screen */
        <div className="min-h-[85vh] relative">
          {/* Hero section with animated gradient */}
          <div className="py-16 md:py-24 text-center relative overflow-hidden">
            <div className="absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 opacity-50"></div>
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500 to-transparent"></div>
            </div>
            
            <h2 className="text-5xl md:text-7xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 tracking-tight animate-float">
              Welcome to Social Elimination
            </h2>
            
            <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-12">
              A high-stakes reality game where AI characters form alliances, plot strategies, and vote each other out until only the finalists remain.
            </p>
            
            <div className="relative w-48 h-48 mx-auto mb-16">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-spin-slow" style={{ animationDuration: '20s' }}></div>
              <div className="absolute inset-1 rounded-full bg-gray-900 flex items-center justify-center text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-600">
                AI
              </div>
            </div>
          </div>
          
          {/* Player cards with premium design */}
          <div className="mb-16">
            <h3 className="text-2xl font-bold mb-8 text-center text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400">
              Meet the Contestants
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {PLAYERS.map(player => (
                <div 
                  key={player.name}
                  className="group relative overflow-hidden rounded-xl glass-effect transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl"
                >
                  <div className="absolute -inset-1 bg-gradient-to-r opacity-50 blur-sm group-hover:opacity-100 transition-opacity duration-500"
                    style={{ backgroundImage: `linear-gradient(to right, ${player.color}33, ${player.color}66)` }}
                  ></div>
                  
                  <div className="relative p-6 h-full flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <div 
                          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl font-extrabold mr-4 border-2"
                          style={{ 
                            backgroundColor: `${player.color}22`,
                            borderColor: player.color,
                            boxShadow: `0 0 15px ${player.color}66`
                          }}
                        >
                          {player.avatar}
                        </div>
                        
                        <div>
                          <h4 className="text-2xl font-bold">{player.name}</h4>
                          <div className="h-0.5 w-16 mt-1 mb-1 rounded-full" style={{ backgroundColor: player.color }}></div>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-gray-300 italic flex-grow">{player.persona}</p>
                    
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <div className="flex flex-wrap gap-2">
                        {/* Extract personality traits as tags */}
                        {player.persona.split(' who ')[0].split(' ').map((trait, i) => (
                          <span 
                            key={i}
                            className="px-2 py-1 rounded-full text-xs font-medium"
                            style={{ 
                              backgroundColor: `${player.color}22`,
                              color: `${player.color}dd`
                            }}
                          >
                            {trait}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Premium start button */}
          <div className="text-center">
            <button 
              onClick={startGame}
              className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold tracking-wider text-white rounded-lg button-glow overflow-hidden shadow-2xl transition-all duration-500 ease-in-out bg-gradient-to-br from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600"
            >
              <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-600 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 ease-in-out transform group-hover:translate-x-0"></span>
              <span className="absolute w-0 h-0 transition-all duration-500 ease-out bg-white rounded-full group-hover:w-56 group-hover:h-56 opacity-10"></span>
              <span className="relative flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Begin Elimination Game
              </span>
            </button>
          </div>
        </div>
      ) : (
        /* Premium Game in Progress UI */
        <>
          {/* Premium Game Status Panel */}
          <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Round & Phase */}
            <div className="glass-effect rounded-xl p-5 shadow-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-500 animate-fadeIn" style={{animationDelay: '0.1s'}}>
              <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-20 blur group-hover:opacity-30 transition-opacity duration-500"></div>
              <div className="absolute right-0 top-0 h-20 w-20 bg-indigo-500 opacity-20 blur-2xl rounded-full"></div>
              
              <div className="flex items-center relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center mr-4 shadow-lg animate-pulse">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                
                <div>
                  <div className="text-sm uppercase tracking-wider text-indigo-300 font-medium">Game Status</div>
                  <div className="text-3xl font-bold">Round {round}</div>
                  <div className="flex items-center mt-1">
                    <div className="w-2 h-2 rounded-full bg-indigo-400 mr-2"></div>
                    <span className="capitalize text-lg text-indigo-100">{phase}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Timer with premium design */}
            <div className="glass-effect rounded-xl p-5 shadow-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-500 animate-fadeIn" style={{animationDelay: '0.2s'}}>
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-20 blur group-hover:opacity-30 transition-opacity duration-500"></div>
              <div className="absolute right-0 top-0 h-20 w-20 bg-blue-500 opacity-20 blur-2xl rounded-full"></div>
              
              <div className="flex items-center relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center mr-4 shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                
                <div className="flex-1">
                  <div className="text-sm uppercase tracking-wider text-blue-300 font-medium">Time Remaining</div>
                  <div className="text-3xl font-bold">{formatTime(timeLeft)}</div>
                  
                  <div className="mt-2 h-2.5 bg-gray-700 rounded-full overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-300 via-blue-500 to-indigo-600 blur-sm opacity-30"></div>
                    <div 
                      className="h-full relative z-10 rounded-full bg-gradient-to-r from-blue-400 to-indigo-500 transition-all duration-1000 ease-linear flex items-center justify-end px-1"
                      style={{
                        width: `${(timeLeft / (phase === "discussion" ? gameConfig.DISCUSSION_MS : gameConfig.VOTING_MS)) * 100}%`
                      }}
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Players */}
            <div className="glass-effect rounded-xl p-5 shadow-xl relative overflow-hidden group hover:shadow-2xl transition-all duration-500 animate-fadeIn" style={{animationDelay: '0.3s'}}>
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 opacity-20 blur group-hover:opacity-30 transition-opacity duration-500"></div>
              <div className="absolute right-0 top-0 h-20 w-20 bg-purple-500 opacity-20 blur-2xl rounded-full"></div>
              
              <div className="relative">
                <div className="text-sm uppercase tracking-wider text-purple-300 font-medium mb-3">Contestants</div>
                
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {live.map(name => {
                    const player = getPlayer(name);
                    return (
                      <div 
                        key={name}
                        className="relative group/player overflow-hidden"
                      >
                        <div 
                          className="flex flex-col items-center p-2 rounded-lg transition-transform duration-300 transform group-hover/player:-translate-y-1"
                          style={{ backgroundColor: `${player.color}22` }}
                        >
                          <div className="absolute inset-0 opacity-0 group-hover/player:opacity-100 transition-opacity duration-300" 
                            style={{ 
                              background: `linear-gradient(to bottom, ${player.color}00, ${player.color}44)`
                            }}
                          ></div>
                          
                          <div 
                            className="relative w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold mb-1 shadow-lg"
                            style={{ 
                              backgroundColor: player.color,
                              boxShadow: `0 0 10px ${player.color}66`
                            }}
                          >
                            {player.avatar}
                          </div>
                          <span className="relative text-sm font-medium">{name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {eliminated.length > 0 && (
                  <div>
                    <div className="text-sm uppercase tracking-wider text-gray-400 font-medium mb-2 mt-4">Eliminated</div>
                    <div className="flex flex-wrap gap-2">
                      {eliminated.map(name => {
                        const player = getPlayer(name);
                        return (
                          <div 
                            key={name}
                            className="flex items-center px-2 py-1 rounded-full opacity-60 group/eliminated"
                            style={{ 
                              backgroundColor: `${player.color}22`,
                              textDecoration: 'line-through'
                            }}
                          >
                            <span 
                              className="w-5 h-5 rounded-full inline-flex items-center justify-center text-xs font-bold mr-1 group-hover/eliminated:animate-spin transition-all duration-500"
                              style={{ backgroundColor: player.color }}
                            >
                              {player.avatar}
                            </span>
                            <span>{name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Premium Messages Interface */}
          <div className="glass-effect rounded-xl shadow-2xl overflow-hidden relative group mb-10 animate-fadeIn" style={{animationDelay: '0.4s'}}>
            <div className="absolute -inset-0.5 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-10 blur group-hover:opacity-20 transition-opacity duration-500"></div>
            
            {/* Messages header */}
            <div className="bg-gray-900 bg-opacity-60 border-b border-gray-700 p-4 flex justify-between items-center">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <h3 className="text-lg font-bold text-purple-100">Live Conversation</h3>
              </div>
              <div className="flex items-center text-sm text-gray-400">
                <span className="relative flex h-3 w-3 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                Live
              </div>
            </div>
            
            {/* Messages with premium styling */}
            <div className="h-[60vh] overflow-y-auto custom-scrollbar relative bg-opacity-50 backdrop-blur-sm">
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
                      className="transition-all duration-300 transform animate-fadeIn"
                      style={{ animationDelay: `${0.1 * (index % 10)}s` }}
                    >
                      <div 
                        className={`rounded-2xl shadow-xl backdrop-blur-sm overflow-hidden ${isHost ? 'bg-gradient-to-br from-gray-800/70 to-gray-900/70 border border-gray-700/50' : 'glass-effect'}`}
                        style={!isHost ? {
                          borderLeft: `3px solid ${player?.color}`,
                          background: `linear-gradient(to right, ${player?.color}22, rgba(17, 25, 40, 0.7))`,
                          boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.37), 0 0 12px 0 ${player?.color}22`
                        } : {}}
                      >
                        <div className="p-4">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center">
                              {isHost ? (
                                <div className="flex items-center">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 flex items-center justify-center shadow-lg mr-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <span className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-violet-400">HOST</span>
                                    <div className="h-0.5 w-12 mt-0.5 rounded-full bg-gradient-to-r from-pink-500 to-violet-500"></div>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center">
                                  <div 
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg mr-3"
                                    style={{ 
                                      background: `linear-gradient(135deg, ${player?.color}, ${player?.color}bb)`,
                                      boxShadow: `0 0 12px ${player?.color}66`
                                    }}
                                  >
                                    {player?.avatar}
                                  </div>
                                  <div>
                                    <span className="font-bold text-lg" style={{ color: `${player?.color}ee` }}>{msg.speaker}</span>
                                    <div className="h-0.5 w-12 mt-0.5 rounded-full" style={{ background: `linear-gradient(to right, ${player?.color}, ${player?.color}66)` }}></div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center">
                              <span className="text-xs text-gray-400 bg-gray-800/30 px-2 py-1 rounded-full">
                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                            </div>
                          </div>
                          
                          {isVoteMessage ? (
                            <div className="ml-13 mt-2">
                              <div className="mb-3 px-3 py-2 bg-gray-900/50 rounded-lg border-l-2 border-gray-700">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-semibold text-gray-300">Votes to eliminate:</span>
                                  <div 
                                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold shadow-md"
                                    style={{ 
                                      backgroundColor: `${getPlayer(votedFor).color}22`,
                                      color: `${getPlayer(votedFor).color}ee`,
                                      boxShadow: `0 0 8px ${getPlayer(votedFor).color}44`
                                    }}
                                  >
                                    <span 
                                      className="w-6 h-6 rounded-full inline-flex items-center justify-center mr-2 text-xs font-bold"
                                      style={{ backgroundColor: getPlayer(votedFor).color }}
                                    >
                                      {getPlayer(votedFor).avatar}
                                    </span>
                                    {votedFor}
                                  </div>
                                </div>
                                <div className="text-gray-300 font-medium pl-2 border-l-2 border-gray-600">{voteReason}</div>
                              </div>
                            </div>
                          ) : (
                            <div className="ml-13 mt-2">
                              <div className="text-gray-200 leading-relaxed">
                                {msg.content.split('\n').map((paragraph, i) => (
                                  <p key={i} className={i > 0 ? 'mt-2' : ''}>{paragraph}</p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef}></div>
              </div>
            </div>
          </div>
          
          {/* Game Over Modal with premium design */}
          {phase === "end" && (
            <div className="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-lg">
              <div className="relative max-w-2xl w-full">
                {/* Animated confetti particles */}
                <div className="absolute inset-0 -z-10 overflow-hidden">
                  {Array.from({ length: 50 }).map((_, i) => (
                    <div 
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: ['#FF5252', '#448AFF', '#7C4DFF', '#FF9800', '#26A69A', '#78909C'][i % 6],
                        top: `${Math.random() * 100}%`,
                        left: `${Math.random() * 100}%`,
                        opacity: Math.random() * 0.7 + 0.3,
                        transform: `scale(${Math.random() * 2 + 0.5})`,
                        animation: `float ${Math.random() * 3 + 2}s ease-in-out infinite`
                      }}
                    ></div>
                  ))}
                </div>
                
                <div className="glass-effect rounded-xl shadow-2xl overflow-hidden animate-fadeIn mx-4">
                  <div className="absolute -inset-0.5 bg-gradient-to-br from-yellow-500 via-amber-500 to-orange-500 opacity-20 blur group-hover:opacity-30 transition-opacity duration-500"></div>
                  
                  <div className="px-8 py-8 text-center relative">
                    <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500"></div>
                    
                    <div className="mb-4">
                      <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-r from-yellow-400 to-amber-600 p-1 shadow-xl animate-spin-slow" style={{ animationDuration: '10s' }}>
                        <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
                          <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-400">
                            🏆
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <h2 className="text-4xl font-extrabold mb-2 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400">
                      Game Over!
                    </h2>
                    
                    <p className="text-xl text-gray-300 mb-8">
                      Our finalists have survived the elimination rounds and emerged victorious!
                    </p>
                    
                    <div className="flex justify-center gap-8 mb-10">
                      {live.map(name => {
                        const player = getPlayer(name);
                        return (
                          <div 
                            key={name}
                            className="flex flex-col items-center animate-float"
                            style={{ animationDelay: `${Math.random() * 0.5}s` }}
                          >
                            <div className="relative mb-3">
                              <div className="w-24 h-24 rounded-full bg-gradient-to-r p-1 shadow-xl animate-pulse"
                                style={{ 
                                  backgroundImage: `linear-gradient(to right, ${player.color}, ${player.color}bb)`,
                                  boxShadow: `0 0 20px ${player.color}66`
                                }}
                              >
                                <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
                                  <span className="text-3xl font-black">{player.avatar}</span>
                                </div>
                              </div>
                              <div className="absolute inset-0 rounded-full border-2 border-dashed border-gray-600 animate-spin-slow" style={{ animationDuration: '20s' }}></div>
                            </div>
                            <div className="text-2xl font-bold">{name}</div>
                            <div className="h-1 w-16 rounded-full mt-2" style={{ backgroundColor: player.color }}></div>
                          </div>
                        );
                      })}
                    </div>
                    
                    <button 
                      onClick={resetGame}
                      className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold tracking-wider text-white rounded-lg button-glow overflow-hidden shadow-2xl transition-all duration-500 ease-in-out bg-gradient-to-br from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600"
                    >
                      <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-indigo-600 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 ease-in-out transform group-hover:translate-x-0"></span>
                      <span className="absolute w-0 h-0 transition-all duration-500 ease-out bg-white rounded-full group-hover:w-56 group-hover:h-56 opacity-10"></span>
                      <span className="relative flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Play Again
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  </main>
);
}