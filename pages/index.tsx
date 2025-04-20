// pages/index.tsx – SINGLE‑FILE implementation (no separate API route)
"use client";
import { useEffect, useRef, useState } from "react";

/** SECURITY NOTE
 * This variant calls OpenAI directly from the browser.
 * Your key will be exposed to anyone who can view network traffic.
 * Set it in the client bundle via NEXT_PUBLIC_OPENAI_API_KEY.
 */

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? ""; // must be defined at build/deploy

/** Game timings */
const DISCUSSION_MS = 2 * 60 * 1000;
const VOTING_MS     = 2 * 60 * 1000;

/** Contestants */
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
  const [live, setLive]   = useState<string[]>(PLAYERS.map(p=>p.name));
  const [msgs, setMsgs]   = useState<Msg[]>([]);
  const [timeLeft, setTL] = useState(0);

  const clock = useRef<NodeJS.Timeout>();
  const talk  = useRef<NodeJS.Timeout>();

  const timer = (dur:number,next:Phase)=>{
    setTL(dur); clearInterval(clock.current!);
    const t0=Date.now();
    clock.current=setInterval(()=>{
      const rem=Math.max(0,dur-(Date.now()-t0));
      setTL(rem);
      if(rem===0){clearInterval(clock.current!);setPhase(next);} },1000);
  };

  /** OpenAI call */
  const promptAI = async (speaker:string, curPhase:Phase)=>{
    if(!OPENAI_KEY){ console.error("Missing NEXT_PUBLIC_OPENAI_API_KEY"); return; }
    const persona = PLAYERS.find(p=>p.name===speaker)?.persona||"";
    const sys = `You are ${speaker}, ${persona} You think you're a human player.`;
    const phasePrompt = curPhase==="discussion"
      ? "Persuade others whom to vote out, ≤120 words."
      : `Voting time. Reply exactly:\nVOTE: <Name>\nREASON: <brief>. Choices: ${live.filter(n=>n!==speaker).join(", ")}`;
    const body = {
      model:"gpt-3.5-turbo-0125",
      messages:[
        {role:"system",content:sys+" "+phasePrompt},
        ...msgs.map(m=>({role:m.speaker===speaker?"assistant":"user",content:m.content}))
      ],
      temperature:0.8
    };
    try{
      const r=await fetch(OPENAI_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+OPENAI_KEY},body:JSON.stringify(body)});
      const data=await r.json();
      const content=data.choices[0].message.content.trim();
      setMsgs(p=>[...p,{speaker,content}]);
    }catch(e){console.error(e);} };

  /** Phase machine */
  useEffect(()=>{
    if(phase==="idle"||phase==="end")return;

    if(phase==="discussion"){
      live.forEach(s=>promptAI(s,"discussion"));
      talk.current=setInterval(()=>live.forEach(s=>promptAI(s,"discussion")),15000);
      timer(DISCUSSION_MS,"voting");
      return()=>clearInterval(talk.current!);
    }

    if(phase==="voting"){
      clearInterval(talk.current!);
      (async()=>{
        const tally:Record<string,number>={};
        for(const v of live)await promptAI(v,"voting");
        setMsgs(prev=>{
          const slice=[...prev];
          const newVotes=slice.slice(-live.length);
          newVotes.forEach(m=>{const mt=m.content.match(/VOTE:\s*(\w+)/i);if(mt)tally[mt[1]]=(tally[mt[1]]||0)+1;});
          let out="";let max=-1;Object.entries(tally).forEach(([n,c])=>{if(c>max){out=n;max=c;}});
          slice.push({speaker:"Host",content:`⌛ ${out} is eliminated with ${max} vote(s).`});
          setLive(l=>l.filter(n=>n!==out));
          return slice;});})();
      timer(VOTING_MS,"results");
    }

    if(phase==="results"){
      timer(15000,live.length<=2?"end":"discussion");
      if(live.length<=2)setMsgs(p=>[...p,{speaker:"Host",content:`🏆 Finalists: ${live.join(" & ")}`}]);
      else setRound(r=>r+1);
    }
  },[phase]);

  const fmt=(ms:number)=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,"0")}`;
  const start=()=>phase==="idle"&&(setMsgs([{speaker:"Host",content:"Round 1 begins!"}]),setPhase("discussion"));

  return(
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Social Elimination – AI Edition (Client‑Only)</h1>
      <button onClick={start} disabled={phase!=="idle"} className="px-4 py-2 bg-black text-white rounded">Start Game</button>
      {phase!=="idle"&&<div className="mt-4 font-semibold">Round {round} | Phase: {phase.toUpperCase()} | Time: {fmt(timeLeft)}<br/>Players: {live.join(", ")}</div>}
      <div className="mt-6 h-[60vh] overflow-y-auto space-y-3 border p-4">
        {msgs.map((m,i)=>(<p key={i}><strong>{m.speaker}:</strong> {m.content}</p>))}
      </div>
    </main>
  );
}
