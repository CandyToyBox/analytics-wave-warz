import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../utils/supabase-admin.js';
import { generateBattleFrameHtml } from '../utils/frame-generator.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for Farcaster frame access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get battle ID from query params
    const { battleId } = req.query;

    if (!battleId || typeof battleId !== 'string' || battleId.trim() === '') {
      return res.status(400).json({ 
        error: 'Battle ID is required',
        usage: 'GET /api/frames/battle?battleId=YOUR_BATTLE_ID'
      });
    }

    // Fetch battle data from Supabase
    const { data: battle, error } = await supabaseAdmin
      .from('battles')
      .select('id, artist1, artist2, start_time, end_time, status')
      .eq('id', battleId)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch battle data',
        details: error.message 
      });
    }

    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    // Return battle data in format suitable for Farcaster frames
    return res.status(200).json({ 
      success: true,
      battle: {
        id: battle.id,
        artist1: battle.artist1,
        artist2: battle.artist2,
        startTime: battle.start_time,
        endTime: battle.end_time,
        status: battle.status,
        // Add other fields as needed for your Farcaster mini app
      }
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}