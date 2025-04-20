// pages/index.tsx – prevents phantom names by enforcing allowed list
"use client";
import { useEffect, useRef, useState } from "react";

const OPENAI_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? "";
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const DISCUSSION_LEN = 2 * 60 * 1000;
const VOTING_LEN     = 2 * 60 * 1000;
const TURN_MS        = 5 * 1000;

const PLAYERS = [
  { name: "Alice",  persona: "Outgoing optimist who trusts gut feelings." },
  { name: "Brian",  persona: "Skeptical logician who distrusts popularity." },
  { name: "Chloe",  persona: "Charismatic activist who sways crowds." },
  { name: "Derek",  persona: "Data‑driven realist focused on strategy." },
  { name: "Evelyn", persona: "Empathetic human‑rights advocate." },
  { name: "Felix",  persona: "Tech futurist who loves disruption." }
] as const;

type Phase = "idle" | "discussion" | "voting" | "results" | "end";
interface Msg { speaker: string; content: string; }

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState(1);
  const [live, setLive]   = useState<string[]>(PLAYERS.map(p => p.name));
  const [msgs, setMsgs]   = useState<Msg[]>([]);
  const [timeLeft, setTL] = useState(0);
  const turnPtr           = useRef(0);
  const countdownRef      = useRef<NodeJS.Timeout>();
  const turnRef           = useRef<NodeJS.Timeout>();

  /* utils */
  const fmt = (ms:number)=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,"0")}`;

  const startTimer = (dur:number,next:Phase)=>{
    setTL(dur); clearInterval(countdownRef.current!);
    const t0=Date.now();
    countdownRef.current=setInterval(()=>{
      const rem=Math.max(0,dur-(Date.now()-t0));
      setTL(rem);
      if(rem===0){clearInterval(countdownRef.current!);setPhase(next);} },1000);
  };

  /** Prevent hallucinated names by telling the model the allowed list & filtering history */
  const promptAI = async (speaker:string, curPhase:"discussion"|"voting")=>{
    if(!OPENAI_KEY){console.error("NEXT_PUBLIC_OPENAI_API_KEY missing");return;}
    const persona=PLAYERS.find(p=>p.name===speaker)?.persona||"";
    const allowed=live.join(", ");
    const sys=`You are ${speaker}, ${persona} Current players: ${allowed}. ONLY reference, discuss, or vote for names in that list. If you mention a player, it must be one of exactly those names. Do NOT invent new names.`;

    const phasePrompt = curPhase==="discussion"
      ? `Discussion phase: in ≤120 words, persuade the group who to vote out. Reference prior arguments **only** if those arguments mention valid player names.`
      : `Voting phase: reply in exactly TWO lines:\nVOTE: <Name from list>\nREASON: <brief>. Choices: ${live.filter(n=>n!==speaker).join(", ")}`;

    // recent context limited to host + valid player messages (drops ones with fake names)
    const recent=msgs.filter(m=>m.speaker==="Host"||live.includes(m.speaker)).slice(-30);

    const body={
      model:"gpt-3.5-turbo-0125",
      temperature:0.8,
      messages:[
        {role:"system",content:sys+" "+phasePrompt},
        ...recent.map(m=>({role:m.speaker===speaker?"assistant":"user",content:m.content}))
      ]
    } as const;

    try{
      const r=await fetch(OPENAI_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${OPENAI_KEY}`},body:JSON.stringify(body)});
      const data=await r.json();
      const content=(data?.choices?.[0]?.message?.content??"").trim();
      if(content)setMsgs(p=>[...p,{speaker,content}]);
    }catch(e){console.error(e);} };

  /* phase flow */
  useEffect(()=>{
    if(phase==="idle"||phase==="end")return;

    if(phase==="discussion"){
      turnPtr.current=0; promptAI(live[0],"discussion");
      turnRef.current=setInterval(()=>{
        turnPtr.current=(turnPtr.current+1)%live.length;
        promptAI(live[turnPtr.current],"discussion");
      },TURN_MS);
      startTimer(DISCUSSION_LEN,"voting");
      return()=>clearInterval(turnRef.current!);
    }

    if(phase==="voting"){
      clearInterval(turnRef.current!);
      (async()=>{
        const tally:Record<string,number>={};
        for(const voter of live){await promptAI(voter,"voting");await new Promise(r=>setTimeout(r,TURN_MS));}
        setMsgs(prev=>{
          const slice=[...prev];
          const votes=slice.slice(-live.length);
          votes.forEach(m=>{const mt=m.content.match(/VOTE:\s*(\w+)/i);if(mt)tally[mt[1]]=(tally[mt[1]]||0)+1;});
          let out="",max=-1;Object.entries(tally).forEach(([n,c])=>{if(c>max){out=n;max=c;}});
          slice.push({speaker:"Host",content:`⌛ ${out} is eliminated with ${max} vote(s).`});
          setLive(l=>l.filter(n=>n!==out));
          return slice;});})();
      startTimer(VOTING_LEN,"results");
    }

    if(phase==="results"){
      startTimer(15000,live.length<=2?"end":"discussion");
      if(live.length<=2)setMsgs(p=>[...p,{speaker:"Host",content:`🏆 Finalists: ${live.join(" & ")}`}]);
      else setRound(r=>r+1);
    }
  },[phase]);

  const startGame=()=>{if(phase!=="idle")return;setMsgs([{speaker:"Host",content:"Round 1 begins!"}]);setPhase("discussion");};

  return(
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Social Elimination – AI Edition</h1>
      <button onClick={startGame} disabled={phase!=="idle"} className="px-4 py-2 bg-black text-white rounded">Start Game</button>
      {phase!=="idle"&&<div className="mt-4 font-semibold">Round {round} | Phase: {phase.toUpperCase()} | Time: {fmt(timeLeft)}<br/>Players: {live.join(", ")}</div>}
      <div className="mt-6 h-[60vh] overflow-y-auto space-y-3 border p-4">
        {msgs.map((m,i)=>(<p key={i}><strong>{m.speaker}:</strong> {m.content}</p>))}
      </div>
    </main>
  );
}
