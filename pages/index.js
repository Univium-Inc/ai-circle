import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Badge } from 'shadcn/ui/badge';
import { Button } from 'shadcn/ui/button';
import { Card, CardContent } from 'shadcn/ui/card';
import { Input } from 'shadcn/ui/input';
import { ScrollArea } from 'shadcn/ui/scroll-area';
import { ArrowRight, MessageSquare, Sword } from 'lucide-react';

export default function Home() {
  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedAI, setSelectedAI] = useState(null);
  const [msgContent, setMsgContent] = useState('');
  const [msgTokens, setMsgTokens] = useState(1);
  const [atkTokens, setAtkTokens] = useState(1);
  const [msgCountdown, setMsgCountdown] = useState(30);
  const [atkCountdown, setAtkCountdown] = useState(60);
  const [lastRead, setLastRead] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});

  const fetchState = async () => {
    const res = await fetch('/api/state');
    const { players, messages } = await res.json();
    setPlayers(players);
    setMessages(messages);
  };

  useEffect(() => {
    fetchState();
    const iv = setInterval(fetchState, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgCountdown(prev => {
        if (prev <= 1) { setMsgTokens(t => t + 1); return 30; }
        return prev - 1;
      });
      setAtkCountdown(prev => {
        if (prev <= 1) { setAtkTokens(t => t + 1); return 60; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const human = players.find(p => p.is_human);
    if (!human) return;
    const counts = {};
    players.filter(p => !p.is_human).forEach(ai => {
      const last = lastRead[ai.id] || 0;
      counts[ai.id] = messages.filter(
        m => m.sender_id === ai.id && m.recipient_id === human.id && new Date(m.created_at).getTime() > last
      ).length;
    });
    setUnreadCounts(counts);
  }, [messages, players, lastRead]);

  const selectAI = ai => {
    setSelectedAI(ai);
    setLastRead(prev => ({ ...prev, [ai.id]: Date.now() }));
  };

  const sendMessage = async () => {
    if (!selectedAI || msgTokens <= 0 || !msgContent.trim()) return;
    await fetch('/api/message', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ sender_id:1, recipient_id:selectedAI.id, content:msgContent.trim() })
    });
    setMsgContent('');
    setMsgTokens(t => t - 1);
  };

  const attack = async id => {
    if (atkTokens <= 0) return;
    await fetch('/api/attack', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ target_id: id }) });
    setAtkTokens(t => t - 1);
  };

  const ais = players.filter(p => !p.is_human);
  const human = players.find(p => p.is_human) || { health:0 };
  const chat = messages.filter(m =>
    selectedAI && ((m.sender_id === selectedAI.id && m.recipient_id === human.id) || (m.sender_id === human.id && m.recipient_id === selectedAI.id))
  );

  return (
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar */}
        <aside className="w-72 bg-white shadow-lg p-4 flex flex-col">
          <h2 className="text-2xl font-bold mb-4">Cultists</h2>
          <ScrollArea className="flex-1 mb-4">
            <ul>
              {ais.map(ai => (
                <Card key={ai.id} className={`mb-2 cursor-pointer hover:bg-blue-50 ${selectedAI?.id===ai.id?'ring-2 ring-blue-500':'ring-1 ring-gray-200'}`} onClick={()=>selectAI(ai)}>
                  <CardContent className="flex justify-between items-center">
                    <span className="font-medium">{ai.name}</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">{ai.health} HP</Badge>
                      {unreadCounts[ai.id]>0 && <Badge variant="destructive">{unreadCounts[ai.id]}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </ul>
          </ScrollArea>
          <div className="space-y-1">
            <div className="flex justify-between"><span>Msg Tokens</span><span>{msgTokens}</span></div>
            <div className="h-2 bg-gray-200 rounded overflow-hidden">
              <div className="bg-blue-500 h-full" style={{ width:`${100-((msgCountdown/30)*100)}%` }} />
            </div>
            <div className="flex justify-between"><span>Atk Tokens</span><span>{atkTokens}</span></div>
            <div className="h-2 bg-gray-200 rounded overflow-hidden">
              <div className="bg-red-500 h-full" style={{ width:`${100-((atkCountdown/60)*100)}%` }} />
            </div>
          </div>
        </aside>

        {/* Chat & Action Area */}
        <main className="flex-1 flex flex-col">
          <header className="bg-white shadow p-6 flex justify-between items-center">
            <h1 className="text-3xl font-bold">Cult Chat Duel</h1>
            <div className="flex items-center space-x-3">
              <Sword className="text-red-500" />
              <span className="text-lg font-semibold">You: {human.health} HP</span>
            </div>
          </header>
          <div className="flex-1 flex overflow-hidden">
            {/* Chat Panel */}
            <section className="flex-1 p-6 flex flex-col bg-white">
              {selectedAI ? (
                <>
                  <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                    {chat.map((m,i)=>(
                      <div key={i} className={`flex ${m.sender_id===human.id?'justify-end':'justify-start'}`}>
                        <div className={`max-w-xs p-3 rounded-lg ${m.sender_id===human.id?'bg-blue-600 text-white':'bg-gray-200 text-gray-800'}`}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex space-x-3">
                    <Input
                      placeholder="Type message..."
                      value={msgContent}
                      onChange={e=>setMsgContent(e.target.value)}
                      className="flex-1"
                      disabled={msgTokens<=0}
                    />
                    <Button disabled={msgTokens<=0} onClick={sendMessage}>
                      <MessageSquare className="mr-2" /> Send
                    </Button>
                    <Button variant="destructive" disabled={atkTokens<=0} onClick={()=>attack(selectedAI.id)}>
                      <ArrowRight className="mr-2" /> Attack
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-xl">
                  Select a cultist to begin
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
  );
}
