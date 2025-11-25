import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../utils/supabase-admin';
import { generateBattleFrameHtml } from '../utils/frame-generator';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const BASE_URL = `https://${req.headers.host}`;

  try {
    // 1. Handle Button Clicks (POST from Farcaster)
    if (req.method === 'POST') {
      const { untrustedData } = req.body;
      // Farcaster sends a POST when a user clicks a button.
      // For 'Refresh', we just fall through to fetch the latest data and re-render the HTML.
    }

    // 2. Fetch Data (Latest Active Battle or Specific ID)
    const { id } = req.query;
    
    let query = supabaseAdmin.from('battles').select('*');

    if (id) {
      query = query.eq('battle_id', id);
    } else {
      // Default: Latest Active
      query = query.eq('status', 'Active').order('created_at', { ascending: false }).limit(1);
    }

    const { data, error } = await query.single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows found"
       console.error("DB Error:", error);
    }

    // 3. Generate and Return HTML
    const html = generateBattleFrameHtml(data, BASE_URL);
    
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);

  } catch (error) {
    console.error(error);
    return res.status(500).send('Error generating frame');
  }
}