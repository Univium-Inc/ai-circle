import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  const now = new Date();
  // Fetch players
  let { data: players } = await supabase.from('players').select('*');
  // Process AI tokens and actions
  for (let p of players) {
    if (!p.is_human) {
      // Calculate tokens
      const diffMsg = Math.floor((now - new Date(p.last_message)) / 30000);
      const diffAtk = Math.floor((now - new Date(p.last_attack)) / 60000);
      if (diffMsg >= 1) {
        // AI sends random greeting to human (id 1)
        await supabase.from('messages').insert({
          sender_id: p.id,
          recipient_id: 1,
          content: 'Hello from ' + p.name + '!'
        });
        p.last_message = now.toISOString();
        await supabase.from('players').update({ last_message: p.last_message }).eq('id', p.id);
      }
      if (diffAtk >= 1) {
        // AI attacks human (id 1)
        let human = players.find(h => h.id === 1);
        const newHealth = human.health - 5;
        await supabase.from('players').update({ health: newHealth }).eq('id', 1);
        p.last_attack = now.toISOString();
        await supabase.from('players').update({ last_attack: p.last_attack }).eq('id', p.id);
      }
    }
  }
  // Return state
  const { data: updatedPlayers } = await supabase.from('players').select('*');
  const { data: messages } = await supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(50);
  res.status(200).json({ players: updatedPlayers, messages });
}