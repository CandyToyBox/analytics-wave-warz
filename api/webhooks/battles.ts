import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type, table, record, old_record } = req.body;

  console.log(`📥 Received webhook: ${type} on ${table}`);

  try {
    if (table !== 'battles') {
      return res.status(200).json({ message: 'Ignored table' });
    }

    if (type === 'INSERT') {
      // New Battle Created
      console.log(`🆕 NEW BATTLE: ${record.artist1_name} vs ${record.artist2_name}`);
      // Add logic here to post to Farcaster if desired
    } 
    else if (type === 'UPDATE') {
      // Battle Updated
      if (record.winner_decided && !old_record.winner_decided) {
        const winner = record.winner_artist_a ? record.artist1_name : record.artist2_name;
        console.log(`🏆 WINNER DECIDED: ${winner} won battle ${record.battle_id}`);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    return res.status(500).json({ error: error.message });
  }
}