import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { target_id } = req.body;
  // Human always id 1
  const attacker_id = 1;

  const { data: target } = await supabase.from('players').select('*').eq('id', target_id).single();
  const newHealth = target.health - 5;
  await supabase.from('players').update({ health: newHealth, last_attack: new Date().toISOString() }).eq('id', attacker_id);
  res.status(200).json({ success: true });
}