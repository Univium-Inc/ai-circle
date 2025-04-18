import { supabase } from '../../lib/supabase';
import openai from '../../lib/openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { sender_id, recipient_id, content } = req.body;
  const now = new Date().toISOString();

  // Insert human message
  await supabase.from('messages').insert([{ sender_id, recipient_id, content, created_at: now }]);
  await supabase.from('players').update({ last_message: now }).eq('id', sender_id);

  // If messaging an AI, generate AI reply
  const aiId = recipient_id;
  const humanId = sender_id;
  // You are AI so react
  const { data: ai } = await supabase.from('players').select('name').eq('id', aiId).single();
  const aiName = ai.name || 'AI';

  // Call OpenAI
  const chat = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: `You are ${aiName}, a cultist AI in a turn-based psychology game. Keep replies short and thematic.` },
      { role: 'user', content }
    ],
    max_tokens: 50,
  });
  const aiReply = chat.choices[0].message.content.trim();

  // Insert AI reply
  await supabase.from('messages').insert([{
    sender_id: aiId,
    recipient_id: humanId,
    content: aiReply,
    created_at: new Date().toISOString()
  }]);
  await supabase.from('players').update({ last_message: new Date().toISOString() }).eq('id', aiId);

  res.status(200).json({ success: true });
}