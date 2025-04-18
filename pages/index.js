import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRight, MessageSquare } from 'lucide-react';

export default function Home() {
  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedAI, setSelectedAI] = useState(null);
  const [msgContent, setMsgContent] = useState('');
  const [lastRead, setLastRead] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [msgCountdown, setMsgCountdown] = useState(0);
  const [atkCountdown, setAtkCountdown] = useState(0);

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
    const human = players.find(p => p.is_human);
    if (!human) return;
    const elapsed = (Date.now() - new Date(human.last_token_refill)) / 1000;
    setMsgCountdown(30 - (elapsed % 30));
    setAtkCountdown(60 - (elapsed % 60));
    const timer = setInterval(() => {
      const elapsed = (Date.now() - new Date(human.last_token_refill)) / 1000;
      setMsgCountdown(30 - (elapsed % 30));
      setAtkCountdown(60 - (elapsed % 60));
    }, 1000);
    return () => clearInterval(timer);
  }, [players]);

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
    setMsgContent('');
  };

  const sendMessage = async () => {
    const human = players.find(p => p.is_human);
    if (!selectedAI || !human || human.msg_tokens <= 0 || !msgContent.trim()) return;
    await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender_id: human.id, recipient_id: selectedAI.id, content: msgContent.trim() })
    });
    setMsgContent('');
  };

  const attack = async id => {
    const human = players.find(p => p.is_human);
    if (!human || human.atk_tokens <= 0) return;
    await fetch('/api/attack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_id: id })
    });
  };

  const ais = players.filter(p => !p.is_human);
  const human = players.find(p => p.is_human) || { health:0, msg_tokens:0, atk_tokens:0, last_token_refill: new Date() };
  const chat = messages.filter(
    m => selectedAI && ((m.sender_id === selectedAI.id && m.recipient_id === human.id) ||
                         (m.sender_id === human.id && m.recipient_id === selectedAI.id))
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-72 bg-white shadow-lg p-4 flex flex-col">
        <h2 className="text-2xl font-bold mb-4">Cultists</h2>
        <ScrollArea className="flex-1 mb-4">
          <ul>
            {ais.map(ai => (
              <Card key={ai.id} onClick={()=>selectAI(ai)} className={`mb-2 cursor-pointer hover:bg-blue-50 ${selectedAI?.id===ai.id?'ring-2 ring-blue-500':'ring-1 ring-gray-200'}`}>
                <CardContent className="flex justify-between items-center">
                  <span className="font-medium">{ai.name}</span>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">{ai.health} HP</Badge>
                    <Badge variant="secondary">{ai.msg_tokens}💬</Badge>
                    <Badge variant="secondary">{ai.atk_tokens}🗡️</Badge>
                    {unreadCounts[ai.id]>0 && <Badge variant="destructive">{unreadCounts[ai.id]}</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </ul>
        </ScrollArea>
        <div className="space-y-2">
          <div>You: {human.health} HP</div>
          <div>Msg Tokens: {human.msg_tokens} (next in {Math.floor(msgCountdown)}s)</div>
          <div>Atk Tokens: {human.atk_tokens} (next in {Math.floor(atkCountdown)}s)</div>
        </div>
      </aside>
      <main className="flex-1 flex flex-col">
        <header className="bg-white shadow p-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">Cult Chat Duel</h1>
        </header>
        <div className="flex-1 flex overflow-hidden">
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
                  <Input placeholder="Type message..." value={msgContent} onChange={e=>setMsgContent(e.target.value)} disabled={human.msg_tokens<=0}/>
                  <Button disabled={human.msg_tokens<=0} onClick={sendMessage}><MessageSquare className="mr-2"/>Send</Button>
                  <Button variant="destructive" disabled={human.atk_tokens<=0} onClick={()=>attack(selectedAI.id)}><ArrowRight className="mr-2"/>Attack</Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-xl">Select a cultist to begin</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}