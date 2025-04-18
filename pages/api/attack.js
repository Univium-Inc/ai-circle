import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { target_id } = req.body;
  const attacker_id = 1; // human
  // Defer to state processor; optionally record log
  await supabase.from('players').update({
    atk_tokens: supabase.raw('atk_tokens - 1')
  }).eq('id', attacker_id);
  res.status(200).json({ success: true });
}