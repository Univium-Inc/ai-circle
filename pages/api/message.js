import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { sender_id, recipient_id, content } = req.body;
  // Insert into messages
  await supabase.from('messages').insert([{
    sender_id, recipient_id, content
  }]);
  // If recipient is AI, queue for response
  const { data: ai } = await supabase.from('players').select('is_human').eq('id', recipient_id).single();
  if (!ai.is_human) {
    await supabase.from('message_queue').insert([{
      ai_id: recipient_id,
      human_id: sender_id,
      content
    }]);
  }
  res.status(200).json({ success: true });
}