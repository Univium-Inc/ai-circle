// pages/index.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { getAIResponse } from '@/lib/AIEngine';
import {
  Message,
  MessageVisibility,
  Participant,
  ChatState,
  Vote,
  GameState
} from '@/lib/types';
import { AI_PERSONALITIES, getAllAINames } from '@/lib/aiPersonalities';
import { CollapsibleChat } from '@/components/CollapsibleChat';

export default function Home() {
  const aiNames = getAllAINames();
  
  // Reference for interval IDs to ensure proper cleanup
  const intervalRefs = useRef<{
    tokenTimer: NodeJS.Timeout | null, 
    countdownTimer: NodeJS.Timeout | null,
    votingTimer: NodeJS.Timeout | null,
    eliminationTimer: NodeJS.Timeout | null
  }>({
    tokenTimer: null,
    countdownTimer: null,
    votingTimer: null,
    eliminationTimer: null
  });

  // — state hooks —
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatStates, setChatStates] = useState<Record<string, ChatState>>(() => {
    const s: Record<string, ChatState> = {};
    aiNames.forEach(n => { s[n] = { expanded: false, input: '', isEliminated: false }; });
    return s;
  });
  const [lastSeen, setLastSeen] = useState<Record<string, number>>(() => {
    const s: Record<string, number> = {};
    aiNames.forEach(n => { s[n] = 0; });
    return s;
  });
  const [expandedChat, setExpandedChat] = useState<string | null>(null);
  
  // Token tracking for AIs
  const [tokens, setTokens] = useState<Record<Participant, number>>(() => {
    return aiNames.reduce((acc, ai) => {
      acc[ai as Participant] = 1;
      return acc;
    }, {} as Record<Participant, number>);
  });
  
  // Game state for voting system
  const [gameState, setGameState] = useState<GameState>({
    currentRound: 1, // Start at round 1 instead of 0
    votingTokensAvailable: aiNames.reduce((acc, ai) => {
      acc[ai as Participant] = false;
      return acc;
    }, {} as Record<Participant, boolean>),
    votesInRound: [],
    eliminatedParticipants: [],
    votingPhase: 'idle',
    nextVotingTime: Date.now() + 120000, // 2 minutes from now
    nextEliminationTime: Date.now() + 240000 // 4 minutes from now
  });
  
  const [turnTimer, setTurnTimer] = useState(30);
  const [votingTimer, setVotingTimer] = useState(120);
  const [isProcessing, setIsProcessing] = useState(false);
  const [turnInProgress, setTurnInProgress] = useState(false);
  
  // State to track when a token refresh should happen
  const [shouldRefreshTokens, setShouldRefreshTokens] = useState(false);
  
  // State to trigger voting phase
  const [shouldStartVoting, setShouldStartVoting] = useState(false);
  
  // State to trigger elimination
  const [shouldProcessElimination, setShouldProcessElimination] = useState(false);
  
  // Track processed vote messages to prevent duplicates
  const processedVoteMessages = useRef(new Set<string>());

  // — per‑AI logging hook —
  const lastLogTimes = useRef<Record<string, number>>(
    aiNames.reduce((acc, ai) => { acc[ai] = 0; return acc; }, {} as Record<string, number>)
  );
  
  useEffect(() => {
    const logAllAIs = () => {
      const now = Date.now();
      aiNames.forEach(ai => {
        if (now - lastLogTimes.current[ai] < 15_000) return;
        const aiMsgs = messages.filter(
          m => m.sender === ai || m.recipient === ai
        );
        if (!aiMsgs.length) return;
        console.group(`${ai} Messages Update`);
        console.log('Total messages:', aiMsgs.length);
        console.log('Last 5 messages:', aiMsgs.slice(-5));
        console.log('Most recent message:', aiMsgs[aiMsgs.length - 1]);
        console.groupEnd();
        lastLogTimes.current[ai] = now;
      });
    };
    logAllAIs();
    const iv = setInterval(logAllAIs, 15_000);
    return () => clearInterval(iv);
  }, [messages, aiNames]);

  // — helpers —
  const determineVisibility = (
    sender: Participant,
    recipient: Participant,
    content: string
  ): MessageVisibility => {
    if (sender !== 'Larry' && recipient !== 'Larry') return 'private';
    const keywords = ['vote','favorite','best','choose','like','prefer', 'eliminate'];
    return keywords.some(k => content.toLowerCase().includes(k))
      ? 'highlighted'
      : 'public';
  };
  
  // Helper to parse votes from messages
  const parseVoteFromMessage = (message: Message): Vote | null => {
    const content = message.content.toLowerCase();
    if (
      message.sender !== 'Larry' && 
      message.recipient === 'Larry' && 
      (content.includes('vote to eliminate') || content.includes('i vote for'))
    ) {
      // Extract who they're voting to eliminate
      const match = content.match(/eliminate\s+(\w+)|vote for\s+(\w+)/i);
      if (match) {
        const votedForName = (match[1] || match[2]);
        
        // Allow votes for Larry
        if (votedForName.toLowerCase() === 'larry') {
          return {
            voter: message.sender as Participant,
            votedFor: 'Larry',
            timestamp: message.timestamp || Date.now(),
            round: gameState.currentRound
          };
        }
        
        // For other AIs, check against existing names
        const votedFor = aiNames.find(name => 
          name.toLowerCase() === votedForName.toLowerCase()
        );
        
        if (votedFor && votedFor !== message.sender) {
          return {
            voter: message.sender as Participant,
            votedFor: votedFor as Participant,
            timestamp: message.timestamp || Date.now(),
            round: gameState.currentRound
          };
        }
      }
    }
    return null;
  };
  
  // Helper to count votes for each participant
  const countVotes = (): Record<Participant, number> => {
    const voteCounts = aiNames.reduce((acc, ai) => {
      acc[ai as Participant] = 0;
      return acc;
    }, {} as Record<Participant, number>);
    
    // Only count votes from the current round
    const currentRoundVotes = gameState.votesInRound.filter(
      vote => vote.round === gameState.currentRound
    );
    
    currentRoundVotes.forEach(vote => {
      if (voteCounts[vote.votedFor] !== undefined) {
        voteCounts[vote.votedFor]++;
      }
    });
    
    return voteCounts;
  };
  
  // Process elimination based on votes
  const processElimination = useCallback(() => {
    // Count all eligible participants (both AIs and Larry)
    const allActiveParticipants = [
      'Larry', 
      ...aiNames.filter(ai => !gameState.eliminatedParticipants.includes(ai as Participant))
    ];
    
    if (allActiveParticipants.length <= 2) {
      // Game over, only one AI or Larry remains
      const winner = allActiveParticipants[0];
      
      // Announce winner
      setMessages(prev => [
        ...prev,
        {
          sender: 'Larry',
          recipient: 'Larry',
          content: `The game is over! ${winner} is the last one standing and wins the game!`,
          timestamp: Date.now(),
          visibility: 'highlighted'
        }
      ]);
      
      return;
    }
    
    const voteCounts = countVotes();
    console.log("Vote counts for elimination:", voteCounts);
    
    // Find participant with highest votes, excluding already eliminated
    let highestVotes = -1;
    let highestParticipant: Participant | null = null;
    
    Object.entries(voteCounts).forEach(([participant, count]) => {
      if (
        !gameState.eliminatedParticipants.includes(participant as Participant) && 
        count > highestVotes
      ) {
        highestVotes = count;
        highestParticipant = participant as Participant;
      }
    });
    
    if (highestParticipant && highestVotes > 0) {
      // Special handling if Larry is eliminated
      if (highestParticipant === 'Larry') {
        setMessages(prev => [
          ...prev,
          {
            sender: 'Larry',
            recipient: 'Larry',
            content: `You (Larry) have been eliminated from the game with ${highestVotes} votes! Game over - the AIs have won!`,
            timestamp: Date.now(),
            visibility: 'highlighted'
          }
        ]);
        
        // Set some game over state if needed
        setGameState(prev => ({
          ...prev,
          votingPhase: 'idle',
          eliminatedParticipants: [...prev.eliminatedParticipants, 'Larry'],
        }));
        
        return; // End the game when Larry is eliminated
      }
      
      // Regular elimination for an AI
      setGameState(prev => ({
        ...prev,
        eliminatedParticipants: [...prev.eliminatedParticipants, highestParticipant as Participant],
        votingPhase: 'idle',
        currentRound: prev.currentRound + 1, // Increment round after elimination
        votesInRound: [], // Clear all votes to prevent carrying over
        nextVotingTime: Date.now() + 120000 // 2 minutes until next voting round
      }));
      
      // Update chat state for eliminated AI
      if (highestParticipant !== 'Larry') {
        setChatStates(prev => ({
          ...prev,
          [highestParticipant as string]: {
            ...prev[highestParticipant as string],
            isEliminated: true
          }
        }));
      }
      
      // Announce elimination
      setMessages(prev => [
        ...prev,
        {
          sender: 'Larry',
          recipient: 'Larry',
          content: `${highestParticipant} has been eliminated from the game in round ${gameState.currentRound} with ${highestVotes} votes!`,
          timestamp: Date.now(),
          visibility: 'highlighted'
        }
      ]);
      
      // Reset voting tokens for next round
      const resetVotingTokens = aiNames.reduce((acc, ai) => {
        acc[ai as Participant] = false;
        return acc;
      }, {} as Record<Participant, boolean>);
      
      setGameState(prev => ({
        ...prev,
        votingTokensAvailable: resetVotingTokens
      }));
      
      // Clear processed vote messages for the next round
      processedVoteMessages.current.clear();
      
    } else {
      // No votes or tied with zero votes, skip elimination
      setGameState(prev => ({
        ...prev,
        votingPhase: 'idle',
        currentRound: prev.currentRound + 1, // Still increment round
        votesInRound: [], // Clear all votes
        nextVotingTime: Date.now() + 120000
      }));
      
      setMessages(prev => [
        ...prev,
        {
          sender: 'Larry',
          recipient: 'Larry',
          content: `No one received any votes in round ${gameState.currentRound}. No elimination this round!`,
          timestamp: Date.now(),
          visibility: 'highlighted'
        }
      ]);
      
      // Clear processed vote messages for the next round
      processedVoteMessages.current.clear();
    }
  }, [gameState, aiNames]);
  
  // Start voting phase
  const startVotingPhase = useCallback(() => {
    console.log("Starting voting phase for round", gameState.currentRound);
    
    // Give each non-eliminated AI a voting token
    const votingTokens = { ...gameState.votingTokensAvailable };
    aiNames.forEach(ai => {
      if (!gameState.eliminatedParticipants.includes(ai as Participant)) {
        votingTokens[ai as Participant] = true;
      }
    });
    
    // Don't increment round number here, only at elimination
    setGameState(prev => ({
      ...prev,
      votingTokensAvailable: votingTokens,
      votingPhase: 'active',
      votesInRound: [], // Clear votes when starting a new voting phase
      nextEliminationTime: Date.now() + 120000 // Elimination in 2 minutes
    }));
    
    // Clear the processed vote messages set
    processedVoteMessages.current.clear();
    
    // Announce voting phase - reference current round without incrementing
    setMessages(prev => [
      ...prev,
      {
        sender: 'Larry',
        recipient: 'Larry',
        content: `Round ${gameState.currentRound} voting has begun! AIs have 2 minutes to vote for who should be eliminated.`,
        timestamp: Date.now(),
        visibility: 'highlighted'
      }
    ]);
    
    // Ask each AI who they vote to eliminate
    const activeAIs = aiNames.filter(ai => 
      !gameState.eliminatedParticipants.includes(ai as Participant)
    );
    
    activeAIs.forEach(ai => {
      setMessages(prev => [
        ...prev,
        {
          sender: 'Larry',
          recipient: ai as Participant,
          content: `Who do you vote to eliminate from the game and why?`,
          timestamp: Date.now(),
          visibility: 'highlighted'
        }
      ]);
    });
  }, [gameState.currentRound, aiNames, gameState.eliminatedParticipants]);

  // Process votes from messages
  useEffect(() => {
    if (gameState.votingPhase !== 'active') return;
    
    // Check for new votes in messages
    messages.forEach(message => {
      // Skip if we've already processed this message for voting
      const messageId = `${message.sender}-${message.timestamp}`;
      if (processedVoteMessages.current.has(messageId)) return;
      
      const vote = parseVoteFromMessage(message);
      if (vote) {
        // Check if this AI has already voted in this round
        const hasVoted = gameState.votesInRound.some(v => 
          v.voter === vote.voter && v.round === gameState.currentRound
        );
        
        // Check if they have a voting token
        const hasToken = gameState.votingTokensAvailable[vote.voter];
        
        if (!hasVoted && hasToken) {
          console.log(`Recorded vote: ${vote.voter} voted to eliminate ${vote.votedFor}`);
          processedVoteMessages.current.add(messageId);
          
          // Add vote and remove token
          setGameState(prev => {
            const newTokens = { ...prev.votingTokensAvailable };
            newTokens[vote.voter] = false;
            
            return {
              ...prev,
              votesInRound: [...prev.votesInRound, vote],
              votingTokensAvailable: newTokens
            };
          });
          
          // Highlight the vote
          setMessages(prev => 
            prev.map(m => 
              m === message 
                ? { ...m, visibility: 'highlighted' } 
                : m
            )
          );
        }
      }
    });
  }, [messages, gameState]);

  const getUserToAIMessages = useCallback(
    (aiName: string) =>
      messages.filter(
        m =>
          (m.sender === 'Larry' && m.recipient === aiName) ||
          (m.sender === aiName && m.recipient === 'Larry')
      ),
    [messages]
  );

  const getMonitorMessages = useCallback(
    () => messages.filter(m => m.sender !== 'Larry' && m.recipient !== 'Larry'),
    [messages]
  );

  const getUnreadCount = useCallback(
    (aiName: string) =>
      messages.filter(
        m =>
          m.sender === aiName &&
          m.recipient === 'Larry' &&
          (m.timestamp ?? 0) > (lastSeen[aiName] || 0)
      ).length,
    [messages, lastSeen]
  );

  // — single AI turn —
  const processAIMessage = useCallback(
    async (ai: Exclude<Participant,'Larry'>) => {
      // Skip eliminated AIs
      if (gameState.eliminatedParticipants.includes(ai)) {
        console.log(`Skipping ${ai} - eliminated from the game`);
        return false;
      }
      
      setIsProcessing(true);
      try {
        const history = messages
          .filter(m => m.sender === ai || m.recipient === ai)
          .slice(-20);

        console.log(`Processing turn for ${ai}`, history);

        const { content, target } = await getAIResponse({
          aiName: ai,
          history,
          userName: 'Larry',
          gameState // Pass game state for voting context
        });

        // Special handling for voting messages
        let finalContent = content;
        let finalTarget = target;
        
        // Check if this is a duplicate vote message
        if (
          gameState.votingPhase === 'active' &&
          target === 'Larry' &&
          finalContent.toLowerCase().includes('vote') &&
          gameState.votesInRound.some(v => v.voter === ai && v.round === gameState.currentRound)
        ) {
          // AI already voted, modify message to indicate this
          const previousVote = gameState.votesInRound.find(v => 
            v.voter === ai && v.round === gameState.currentRound
          );
          finalContent = `I've already voted in this round to eliminate ${previousVote?.votedFor}.`;
        }

        // Validate target isn't eliminated
        if (
          finalTarget !== 'Larry' && 
          gameState.eliminatedParticipants.includes(finalTarget as Participant)
        ) {
          console.log(`${ai} tried to message eliminated ${finalTarget}, redirecting to Larry`);
          finalTarget = 'Larry';
        }

        const newMsg: Message = {
          sender: ai,
          recipient: finalTarget as Participant,
          content: finalContent.trim(),
          timestamp: Date.now(),
          visibility: determineVisibility(ai, finalTarget as Participant, finalContent)
        };

        setMessages(prev => [...prev, newMsg]);
        return true;
      } catch (error) {
        console.error(`Error processing message for ${ai}:`, error);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [aiNames, messages, gameState]
  );

  // — all AIs in random order, spending exactly one token each —
  const processTurn = useCallback(
    async () => {
      if (turnInProgress) {
        console.log("Turn already in progress, skipping");
        return;
      }
      
      console.log("Starting new turn with tokens:", tokens);
      setTurnInProgress(true);

      try {
        const available = { ...tokens };
        // Randomize order but prioritize AIs who haven't voted in voting phase
        let order = [...aiNames]
          .filter(ai => !gameState.eliminatedParticipants.includes(ai as Participant))
          .sort(() => Math.random() - 0.5);
        
        // If in voting phase, prioritize AIs who still have voting tokens
        if (gameState.votingPhase === 'active') {
          order = [
            ...order.filter(ai => gameState.votingTokensAvailable[ai as Participant]),
            ...order.filter(ai => !gameState.votingTokensAvailable[ai as Participant])
          ];
        }

        for (const ai of order) {
          if (available[ai as Participant] > 0) {
            available[ai as Participant]--;
            console.log(`${ai} spending token, ${available[ai as Participant]} remaining`);
            await processAIMessage(ai as Exclude<Participant,'Larry'>);
            await new Promise(r => setTimeout(r, 300));
          } else {
            console.log(`${ai} has no tokens to spend`);
          }
        }

        setTokens(available);
      } catch (error) {
        console.error("Error in processTurn:", error);
      } finally {
        setTurnInProgress(false);
      }
    },
    [aiNames, tokens, processAIMessage, gameState]
  );

  // — send message helper (no user token gating) —
  const sendMessage = (
    sender: Participant,
    recipient: Participant,
    content: string
  ) => {
    // Prevent messaging eliminated AIs
    if (
      recipient !== 'Larry' && 
      gameState.eliminatedParticipants.includes(recipient)
    ) {
      alert(`${recipient} has been eliminated and can no longer receive messages.`);
      return;
    }
    
    if (!content.trim()) return;
    const msg: Message = {
      sender,
      recipient,
      content: content.trim(),
      timestamp: Date.now(),
      visibility: determineVisibility(sender, recipient, content)
    };
    setMessages(prev => [...prev, msg]);
    // only decrement AI tokens elsewhere
  };

  // — trigger AI turn after Larry's message —
  const lastSender = messages[messages.length - 1]?.sender;
  useEffect(() => {
    if (lastSender === 'Larry' && !turnInProgress) {
      processTurn();
    }
  }, [lastSender, processTurn, turnInProgress]);

  // — UI handlers —
  const sendToAI = (aiName: string) => {
    if (gameState.eliminatedParticipants.includes(aiName as Participant)) {
      alert(`${aiName} has been eliminated and can no longer receive messages.`);
      return;
    }
    
    if (!chatStates[aiName].input.trim()) return;
    sendMessage('Larry', aiName as Participant, chatStates[aiName].input);
    setChatStates(s => ({
      ...s,
      [aiName]: { ...s[aiName], input: '' }
    }));
  };

  const toggleChat = (aiName: string) => {
    if (expandedChat === aiName) {
      setExpandedChat(null);
      setChatStates(s => ({
        ...s,
        [aiName]: { ...s[aiName], expanded: false }
      }));
    } else {
      if (expandedChat) {
        setChatStates(s => ({
          ...s,
          [expandedChat]: { ...s[expandedChat], expanded: false }
        }));
      }
      setExpandedChat(aiName);
      setChatStates(s => ({
        ...s,
        [aiName]: { ...s[aiName], expanded: true }
      }));
      setLastSeen(ls => ({ ...ls, [aiName]: Date.now() }));
    }
  };

  const handleInputChange = (aiName: string, v: string) =>
    setChatStates(s => ({ ...s, [aiName]: { ...s[aiName], input: v } }));

  // Timer countdown effect for message tokens
  useEffect(() => {
    // Clear any existing interval
    if (intervalRefs.current.countdownTimer) {
      clearInterval(intervalRefs.current.countdownTimer);
    }
    
    // Setup countdown timer
    const countdownInterval = setInterval(() => {
      setTurnTimer(prev => {
        const newValue = Math.max(0, prev - 1);
        // When timer hits zero, trigger token refresh
        if (newValue === 0) {
          setShouldRefreshTokens(true);
        }
        return newValue;
      });
      
      // Also update voting timer if in voting phase
      if (gameState.votingPhase === 'active') {
        const timeRemaining = Math.max(0, Math.floor((gameState.nextEliminationTime - Date.now()) / 1000));
        setVotingTimer(timeRemaining);
      } else {
        const timeToNextVoting = Math.max(0, Math.floor((gameState.nextVotingTime - Date.now()) / 1000));
        setVotingTimer(timeToNextVoting);
      }
    }, 1000);
    
    // Store reference for cleanup
    intervalRefs.current.countdownTimer = countdownInterval;
    
    return () => {
      if (intervalRefs.current.countdownTimer) {
        clearInterval(intervalRefs.current.countdownTimer);
        intervalRefs.current.countdownTimer = null;
      }
    };
  }, [gameState.votingPhase, gameState.nextEliminationTime, gameState.nextVotingTime]);

  // Message token refresh effect - Triggered when timer hits zero
  useEffect(() => {
    if (shouldRefreshTokens) {
      console.log("Refreshing tokens and resetting timer");
      
      // Reset tokens for non-eliminated AIs
      setTokens(prev => {
        const next = { ...prev };
        aiNames.forEach(ai => {
          if (!gameState.eliminatedParticipants.includes(ai as Participant)) {
            next[ai as Participant] = Math.min(prev[ai as Participant] + 1, 3);
          }
        });
        return next;
      });
      
      // Reset timer
      setTurnTimer(30);
      
      // Reset flag
      setShouldRefreshTokens(false);
      
      // Process turn with new tokens
      if (!turnInProgress) {
        setTimeout(() => {
          processTurn();
        }, 500);
      }
    }
  }, [shouldRefreshTokens, aiNames, processTurn, turnInProgress, gameState.eliminatedParticipants]);

  // Voting phase check - every 2 minutes
  useEffect(() => {
    // Clear any existing interval
    if (intervalRefs.current.votingTimer) {
      clearInterval(intervalRefs.current.votingTimer);
    }
    
    // Check if it's time to start voting
    const votingCheckInterval = setInterval(() => {
      if (
        gameState.votingPhase === 'idle' && 
        Date.now() >= gameState.nextVotingTime
      ) {
        setShouldStartVoting(true);
      }
    }, 5000); // Check every 5 seconds
    
    intervalRefs.current.votingTimer = votingCheckInterval;
    
    return () => {
      if (intervalRefs.current.votingTimer) {
        clearInterval(intervalRefs.current.votingTimer);
        intervalRefs.current.votingTimer = null;
      }
    };
  }, [gameState.votingPhase, gameState.nextVotingTime]);
  
  // Elimination check - after voting phase
  useEffect(() => {
    // Clear any existing interval
    if (intervalRefs.current.eliminationTimer) {
      clearInterval(intervalRefs.current.eliminationTimer);
    }
    
    // Check if it's time to eliminate someone
    const eliminationCheckInterval = setInterval(() => {
      if (
        gameState.votingPhase === 'active' && 
        Date.now() >= gameState.nextEliminationTime
      ) {
        setShouldProcessElimination(true);
      }
    }, 5000); // Check every 5 seconds
    
    intervalRefs.current.eliminationTimer = eliminationCheckInterval;
    
    return () => {
      if (intervalRefs.current.eliminationTimer) {
        clearInterval(intervalRefs.current.eliminationTimer);
        intervalRefs.current.eliminationTimer = null;
      }
    };
  }, [gameState.votingPhase, gameState.nextEliminationTime]);
  
  // Handle voting phase start
  useEffect(() => {
    if (shouldStartVoting) {
      startVotingPhase();
      setShouldStartVoting(false);
    }
  }, [shouldStartVoting, startVotingPhase]);
  
  // Handle elimination processing
  useEffect(() => {
    if (shouldProcessElimination) {
      processElimination();
      setShouldProcessElimination(false);
    }
  }, [shouldProcessElimination, processElimination]);

  // Initial setup of token refresh timer
  useEffect(() => {
    // Clear any existing interval
    if (intervalRefs.current.tokenTimer) {
      clearInterval(intervalRefs.current.tokenTimer);
    }
    
    // Create backup timer for token refresh in case the countdown timer fails
    const tokenInterval = setInterval(() => {
      setShouldRefreshTokens(true);
    }, 30000);
    
    intervalRefs.current.tokenTimer = tokenInterval;
    
    return () => {
      if (intervalRefs.current.tokenTimer) {
        clearInterval(intervalRefs.current.tokenTimer);
        intervalRefs.current.tokenTimer = null;
      }
    };
  }, []); // Empty dependency array to run only once

  // — render UI —
  return (
    <div className="min-h-screen bg-gray-100 p-6 space-y-6">
      {/* header */}
      <div className="text-center text-sm text-gray-700">
        <h1 className="text-xl font-bold mb-2">
          The Circle: AI Edition
        </h1>
        <div className="flex justify-between mb-2">
          <div>⏳ Next tokens in: {turnTimer}s</div>
          <div>
            {gameState.votingPhase === 'active' 
              ? `⚡ Voting ends in: ${votingTimer}s` 
              : `⚡ Next voting in: ${votingTimer}s`}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {aiNames.map(ai => {
            const isEliminated = gameState.eliminatedParticipants.includes(ai as Participant);
            const hasVotingToken = gameState.votingTokensAvailable[ai as Participant];
            return (
              <span 
                key={ai} 
                className={`px-2 py-1 rounded ${isEliminated ? 'bg-gray-300 line-through' : 'bg-blue-100'}`}
              >
                {ai} tokens: {tokens[ai as Participant]}
                {hasVotingToken && !isEliminated && " 🗳️"}
                {isEliminated && " (eliminated)"}
              </span>
            );
          })}
        </div>
        {gameState.votingPhase === 'active' && (
          <div className="mt-2 text-red-500 font-bold">
            Voting Round {gameState.currentRound} - Someone will be eliminated!
          </div>
        )}
      </div>

      {/* per‑AI chats */}
      <div className="flex flex-col space-y-2 w-full max-w-2xl mx-auto">
        {aiNames.map(aiName => {
          const isEliminated = gameState.eliminatedParticipants.includes(aiName as Participant) || chatStates[aiName].isEliminated;
          return (
            <CollapsibleChat
              key={aiName}
              title={`Chat with ${aiName}${isEliminated ? ' (Eliminated)' : ''}`}
              aiName={aiName}
              isExpanded={chatStates[aiName].expanded} // Use expanded here
              eliminated={isEliminated}
              messages={getUserToAIMessages(aiName)}
              input={chatStates[aiName].input}
              onInputChange={v => handleInputChange(aiName, v)}
              onSend={() => sendToAI(aiName)}
              canSend={!isEliminated}
              personality={
                AI_PERSONALITIES.find(a => a.name === aiName)
                  ?.shortDescription
              }
              onToggleExpand={() => toggleChat(aiName)}
              unreadCount={getUnreadCount(aiName)}     
            />
      
          );
        })}
      </div>

      {/* monitor pane */}
      <div className="w-full max-w-2xl mx-auto mt-8 border-t-2 border-gray-300 pt-4">
        <div className="bg-gray-50 rounded-lg p-4 shadow">
          <h2 className="text-lg font-bold mb-2">
            AI Monitor (shows AI-to-AI messages)
          </h2>

          {/* Vote counting display during voting */}
          {gameState.votingPhase === 'active' && 
            gameState.votesInRound.filter(v => v.round === gameState.currentRound).length > 0 && (
            <div className="mb-3 p-2 bg-gray-100 rounded">
              <h3 className="text-sm font-bold mb-1">Current Votes:</h3>
              <div className="grid grid-cols-2 gap-2">
                {gameState.votesInRound
                  .filter(vote => vote.round === gameState.currentRound)
                  .map((vote, idx) => (
                    <div key={idx} className="text-xs">
                      <strong>{vote.voter}</strong> voted for <strong className="text-red-500">{vote.votedFor}</strong>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Vote count summary */}
          {gameState.votingPhase === 'active' && 
            gameState.votesInRound.filter(v => v.round === gameState.currentRound).length > 0 && (
            <div className="mb-3 p-2 bg-yellow-50 rounded">
              <h3 className="text-sm font-bold mb-1">Vote Tally:</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(countVotes())
                  .filter(([ai]) => !gameState.eliminatedParticipants.includes(ai as Participant))
                  .sort((a, b) => b[1] - a[1]) // Sort by vote count descending
                  .map(([ai, count]) => (
                    <div 
                      key={ai} 
                      className={`text-xs ${count === 0 ? 'text-gray-500' : 'font-bold'}`}
                    >
                      {ai}: {count} votes
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* Elimination status */}
          {gameState.eliminatedParticipants.length > 0 && (
            <div className="mb-3 p-2 bg-red-50 rounded">
              <h3 className="text-sm font-bold mb-1">Eliminated:</h3>
              <div className="flex flex-wrap gap-2">
                {gameState.eliminatedParticipants.map((participant) => (
                  <div key={participant} className="text-xs bg-red-100 px-2 py-1 rounded">
                    {participant}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
            {getMonitorMessages().map((m, i) => (
              <div
                key={i}
                className="p-2 text-xs rounded border border-gray-200 hover:bg-gray-50"
              >
                <span className="font-bold">{m.sender} → {m.recipient}:</span>{' '}
                {m.content}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* game controls */}
      <div className="w-full max-w-2xl mx-auto mt-4 flex justify-center space-x-4">
        <button 
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
          onClick={() => {
            if (gameState.votingPhase === 'idle') {
              startVotingPhase();
            } else {
              alert('Voting already in progress!');
            }
          }}
          disabled={gameState.votingPhase === 'active'}
        >
          Start Voting Round
        </button>
        
        <button 
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
          onClick={() => {
            if (gameState.votingPhase === 'active') {
              processElimination();
            } else {
              alert('No voting in progress to end!');
            }
          }}
          disabled={gameState.votingPhase === 'idle'}
        >
          End Voting Round
        </button>
        
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => {
            // Give all AIs a token and trigger a turn
            setTokens(prev => {
              const next = { ...prev };
              aiNames.forEach(ai => {
                if (!gameState.eliminatedParticipants.includes(ai as Participant)) {
                  next[ai as Participant] = prev[ai as Participant] + 1;
                }
              });
              return next;
            });
            
            // Reset timer
            setTurnTimer(30);
            
            // Trigger turn
            setTimeout(() => {
              if (!turnInProgress) {
                processTurn();
              }
            }, 500);
          }}
        >
          Give All AIs a Token
        </button>
      </div>
    </div>
  );
}