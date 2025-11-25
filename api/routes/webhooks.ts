import { Router } from 'express';

export const webhookRouter = Router();

webhookRouter.post('/battles', async (req, res) => {
  const { type, table, record, old_record } = req.body;

  console.log(`📥 Received webhook: ${type} on ${table}`);

  try {
    if (table !== 'battles') {
      return res.status(200).json({ message: 'Ignored table' });
    }

    if (type === 'INSERT') {
      // New Battle Created
      await handleNewBattle(record);
    } else if (type === 'UPDATE') {
      // Battle Updated (e.g. stats changed or winner decided)
      await handleBattleUpdate(record, old_record);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Webhook Error:', error);
    res.status(500).json({ error: error.message });
  }
});

async function handleNewBattle(battle: any) {
  console.log(`🆕 NEW BATTLE: ${battle.artist1_name} vs ${battle.artist2_name}`);
  // Here you would trigger Farcaster notification bot
  // e.g. await farcasterClient.publishCast(`⚔️ New WaveWarz Battle! ...`);
}

async function handleBattleUpdate(newBattle: any, oldBattle: any) {
  // Check if winner was just decided
  if (newBattle.winner_decided && !oldBattle.winner_decided) {
    const winner = newBattle.winner_artist_a ? newBattle.artist1_name : newBattle.artist2_name;
    console.log(`🏆 WINNER DECIDED: ${winner} won battle ${newBattle.battle_id}`);
    // Trigger winner announcement
  }
}
