import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { sender_id, recipient_id, content } = req.body;
    const now = new Date().toISOString();
    await supabase.from('messages').insert([{ sender_id, recipient_id, content, created_at: now }]);
    await supabase.from('players').update({ last_message: now }).eq('id', sender_id);
    res.status(200).json({ success: true });
  } else {
    res.status(405).end();
  }
}