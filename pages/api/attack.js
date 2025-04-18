import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { target_id } = req.body;
  // Human always id 1
  const attacker_id = 1;

  // Fetch target, reduce health
  const { data: target } = await supabase.from('players').select('*').eq('id', target_id).single();
  const newHealth = target.health - 5;
  await supabase
    .from('players')
    .update({ health: newHealth, last_attack: new Date().toISOString() })
    .eq('id', target_id); // Fix: update target, not attacker

  res.status(200).json({ success: true });
}