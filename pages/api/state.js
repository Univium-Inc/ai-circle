import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  // Fetch players
  const { data: players } = await supabase.from('players').select('*');
  // Fetch messages (last 50)
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(50);
  res.status(200).json({ players, messages });
}