import { supabase } from '../../lib/supabase';
import openai from '../../lib/openai';

// Refill tokens, process AI queues, autonomous messages, and attacks
export default async function handler(req, res) {
  const now = new Date();
  // 1) Refill tokens based on elapsed time
  let { data: players } = await supabase.from('players').select('*');
  for (let p of players) {
    const elapsed = (now - new Date(p.last_token_refill)) / 1000;
    const msgAdd = Math.floor(elapsed / 30);
    const atkAdd = Math.floor(elapsed / 60);
    if (msgAdd > 0 || atkAdd > 0) {
      await supabase.from('players').update({
        msg_tokens: p.msg_tokens + msgAdd,
        atk_tokens: p.atk_tokens + atkAdd,
        last_token_refill: now.toISOString()
      }).eq('id', p.id);
    }
  }
  // 2) Process message queues
  const { data: queue } = await supabase.from('message_queue')
    .select('*')
    .eq('processed', false);
  for (let q of queue) {
    // Only if AI has at least one token
    const { data: ai } = await supabase.from('players').select('*').eq('id', q.ai_id).single();
    if (ai.msg_tokens > 0) {
      // Call OpenAI to generate reply
      const chat = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are ${ai.name}, respond succinctly.` },
          { role: 'user', content: q.content }
        ],
        max_tokens: 50
      });
      const reply = chat.choices[0].message.content.trim();
      // Insert reply
      await supabase.from('messages').insert([{
        sender_id: ai.id,
        recipient_id: q.human_id,
        content: reply
      }]);
      // Decrement token
      await supabase.from('players')
        .update({ msg_tokens: ai.msg_tokens - 1 })
        .eq('id', ai.id);
      // Mark processed
      await supabase.from('message_queue')
        .update({ processed: true })
        .eq('id', q.id);
    }
  }
  // 3) Autonomous AI messages
  for (let p of players.filter(p => !p.is_human)) {
    if (p.msg_tokens > 0) {
      // Random human target
      const humanList = players.filter(h => h.is_human);
      if (humanList.length) {
        const target = humanList[Math.floor(Math.random() * humanList.length)];
        const content = `Hi ${target.name}, how are you?`;
        await supabase.from('messages').insert([{
          sender_id: p.id,
          recipient_id: target.id,
          content
        }]);
        await supabase.from('players')
          .update({ msg_tokens: p.msg_tokens - 1 })
          .eq('id', p.id);
      }
    }
  }
  // 4) AI attacks
  for (let p of players.filter(p => !p.is_human)) {
    if (p.atk_tokens > 0) {
      // Choose random target not self
      const targets = players.filter(t => t.id !== p.id && t.health > 0);
      if (targets.length) {
        const t = targets[Math.floor(Math.random() * targets.length)];
        await supabase.from('players')
          .update({ health: t.health - 5 })
          .eq('id', t.id);
        await supabase.from('players')
          .update({ atk_tokens: p.atk_tokens - 1 })
          .eq('id', p.id);
      }
    }
  }
  // Return updated state
  const { data: updatedPlayers } = await supabase.from('players').select('*');
  const { data: messages } = await supabase.from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(100);
  res.status(200).json({ players: updatedPlayers, messages });
}