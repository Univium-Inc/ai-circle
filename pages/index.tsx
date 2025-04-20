// pages/index.tsx – Host now stirs the pot with provocative commentary
"use client";
import { useEffect, useRef, useState } from "react";

const OPENAI_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? "";
const OPENAI_EP  = "https://api.openai.com/v1/chat/completions";

const DISCUSSION_MS = 2 * 60 * 1000; // 2‑min chat
const VOTING_MS     = 2 * 60 * 1000; // voting (cancellable)
const TURN_MS       = 5 * 1000;      // one speaker every 5 s
const HOST_MS       = 30 * 1000;     // host stirs every 30 s

const PLAYERS = [
  { name: "Alice",  persona: "Outgoing optimist who trusts gut feelings." },
  { name: "Brian",  persona: "Skeptical logician who distrusts popularity." },
  { name: "Chloe",  persona: "Charismatic activist who sways crowds." },
  { name: "Derek",  persona: "Data‑driven realist focused on strategy." },
  { name: "Evelyn", persona: "Empathetic human‑rights advocate." },
  { name: "Felix",  persona: "Tech futurist who loves disruption." }
] as const;

type Phase = "idle" | "discussion" | "voting" | "end";
interface Msg { speaker: string; content: string; }

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(1);
  const [live, setLive]   = useState<string[]>(PLAYERS.map(p => p.name));
  const [msgs, setMsgs]   = useState<Msg[]>([]);
  const [tLeft, setTLeft] = useState(0);

  const turnPtr   = useRef(0);
  const phaseRef  = useRef<NodeJS.Timeout>();   // countdown per phase
  const turnRef   = useRef<NodeJS.Timeout>();   // player speaking cadence
  const hostRef   = useRef<NodeJS.Timeout>();   // host commentary cadence

  /* ---------------- helpers ---------------- */
  const fmt = (ms:number)=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,"0")}`;

  const startCountdown = (dur:number,next:Phase)=>{
    clearInterval(phaseRef.current!);
    setTLeft(dur);
    const t0 = Date.now();
    phaseRef.current = setInterval(()=>{
      const rem = Math.max(0,dur - (Date.now()-t0));
      setTLeft(rem);
      if(rem===0){clearInterval(phaseRef.current!);setPhase(next);} }, 1000);
  };

  /* ---------- OpenAI helpers ---------- */
  const callOpenAI = async (sysPrompt:string, conversation:any[])=>{
    if(!OPENAI_KEY){console.error("NEXT_PUBLIC_OPENAI_API_KEY missing");return "";}
    const body={
      model:"gpt-3.5-turbo-0125",
      temperature:0.8,
      messages:[{role:"system",content:sysPrompt},...conversation]
    } as const;
    try{
      const r=await fetch(OPENAI_EP,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${OPENAI_KEY}`},body:JSON.stringify(body)});
      const d=await r.json();
      return (d?.choices?.[0]?.message?.content??"").trim();
    }catch(e){console.error(e);return "";}
  };

  const aiSpeak = async (speaker:string, curPhase:"discussion"|"voting") => {
    const persona = PLAYERS.find(p => p.name === speaker)?.persona || "";
    const allowed = live.join(", ");
    // Prevent self-reference and self-voting
    const sys = `You are ${speaker}, ${persona} Current players: ${allowed}. Only mention names in that list. Respond without including your own name or referring to yourself.`;
    // Discussion or Voting prompts
    const prompt = curPhase === "discussion"
      ? "Discussion phase: in ≤120 words, argue who should be voted out and why, referencing others' valid points. Do NOT mention yourself."
      : `Voting phase: reply in exactly two lines:
VOTE: <Name from list>
REASON: <brief>. You MAY NOT vote for yourself. Choices: ${live.filter(n => n !== speaker).join(", ")}`;

    const recent = msgs.filter(m => m.speaker === "Host" || live.includes(m.speaker)).slice(-30);
    const conversation = [
      ...recent.map(m => ({ role: m.speaker === speaker ? "assistant" : "user", content: m.content })),
      { role: "user", content: prompt }
    ];

    const response = await callOpenAI(sys, conversation);
    if (response) setMsgs(prev => [...prev, { speaker, content: response }]);
  };

  const hostSpeak = async ()=>{
    const allowed=live.join(", ");
    const sys="You are the HOST of a reality elimination game. Your goal is to provoke discussion with spicy rumors, praise, or criticism about the **current players**."+
      " NEVER mention names outside this list: "+allowed+". Keep it to ≤60 words.";
    const recent=msgs.slice(-20).map(m=>({role:m.speaker==="Host"?"assistant":"user",content:m.content}));
    const response=await callOpenAI(sys,recent);
    if(response)setMsgs(p=>[...p,{speaker:"Host",content:response}]);
  };

  /* ------------- PHASE MACHINE ------------- */
  useEffect(()=>{
    if(phase==="idle"||phase==="end")return;

    if(phase==="discussion"){
      // player cadence
      turnPtr.current=0;
      aiSpeak(live[0],"discussion");
      turnRef.current=setInterval(()=>{
        turnPtr.current=(turnPtr.current+1)%live.length;
        aiSpeak(live[turnPtr.current],"discussion");
      },TURN_MS);
      // host commentary cadence
      hostSpeak();
      hostRef.current=setInterval(hostSpeak,HOST_MS);

      startCountdown(DISCUSSION_MS,"voting");
      return()=>{clearInterval(turnRef.current!);clearInterval(hostRef.current!);} ;
    }

    if(phase==="voting"){
      clearInterval(turnRef.current!);clearInterval(hostRef.current!);
      (async()=>{
        const tally:Record<string,number>={};
        for(const voter of live){await aiSpeak(voter,"voting");await new Promise(r=>setTimeout(r,TURN_MS));}
        setMsgs(prev=>{
          const slice=[...prev];
          const last=slice.slice(-live.length);
          last.forEach(m=>{const mt=m.content.match(/VOTE:\s*(\w+)/i);if(mt)tally[mt[1]]=(tally[mt[1]]||0)+1;});
          let out="",max=-1;Object.entries(tally).forEach(([n,c])=>{if(c>max){max=c;out=n;}});
          slice.push({speaker:"Host",content:`⌛ ${out} is eliminated with ${max} vote(s).`});
          setLive(l=>l.filter(n=>n!==out));
          return slice;});
        clearInterval(phaseRef.current!);
        if(live.length<=2){setMsgs(p=>[...p,{speaker:"Host",content:`🏆 Finalists: ${live.join(" & ")}`}]);setPhase("end");}
        else{setRound(r=>r+1);setPhase("discussion");}
      })();
      startCountdown(VOTING_MS,"discussion");
    }
  },[phase]);

  /* -------------- UI ACTIONS -------------- */
  const startGame=()=>{if(phase!=="idle")return;setMsgs([{speaker:"Host",content:"Round 1 begins!"}]);setPhase("discussion");};

  /* ----------------- UI ------------------- */
  return(
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Social Elimination – AI Edition</h1>
      <button onClick={startGame} disabled={phase!=="idle"} className="px-4 py-2 bg-black text-white rounded">Start Game</button>
      {phase!=="idle"&&<div className="mt-4 font-semibold">Round {round} | Phase: {phase.toUpperCase()} | Time: {fmt(tLeft)}<br/>Players: {live.join(", ")}</div>}
      <div className="mt-6 h-[60vh] overflow-y-auto space-y-3 border p-4">
        {msgs.map((m,i)=>(<p key={i}><strong>{m.speaker}:</strong> {m.content}</p>))}
      </div>
    </main>
  );
}
