import { supabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { attacker_id, target_id } = req.body;
    // Reduce target health by 5
    let { data: target } = await supabase.from('players').select('*').eq('id', target_id).single();
    const newHealth = target.health - 5;
    await supabase.from('players').update({ health: newHealth, last_attack: new Date().toISOString() }).eq('id', attacker_id);
    res.status(200).json({ success: true });
  } else {
    res.status(405).end();
  }
}