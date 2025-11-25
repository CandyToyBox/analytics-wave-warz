import { Router } from 'express';
import { supabaseAdmin } from '../supabase';
import { generateBattleFrameHtml } from '../utils/frame-generator';

export const frameRouter = Router();

const BASE_URL = process.env.FRAME_BASE_URL || 'http://localhost:3001';

// 1. Latest Active Battle Frame
frameRouter.get('/battle', async (req, res) => {
  try {
    // Fetch latest active battle
    const { data: battle } = await supabaseAdmin
      .from('battles')
      .select('*')
      .eq('status', 'Active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!battle) {
      return res.send(generateBattleFrameHtml(null, BASE_URL));
    }

    const html = generateBattleFrameHtml(battle, BASE_URL);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    console.error(error);
    res.status(500).send('Error generating frame');
  }
});

// 2. Specific Battle Frame
frameRouter.get('/battle/:id', async (req, res) => {
  const { id } = req.params;
  const { data: battle } = await supabaseAdmin
    .from('battles')
    .select('*')
    .eq('battle_id', id)
    .single();

  const html = generateBattleFrameHtml(battle, BASE_URL);
  res.send(html);
});

// 3. Handle Frame Interactions (Buttons)
frameRouter.post('/battle', async (req, res) => {
  // When user clicks "Refresh" or "View Stats"
  // Farcaster sends a POST with signed data
  const { untrustedData } = req.body;
  
  // Simply redirect them back to the GET frame to show updated stats
  // In a real app, you might check which button (1, 2, 3) was clicked
  // buttonIndex 1: Refresh -> Return Frame
  // buttonIndex 2: View App -> Redirect
  
  if (untrustedData?.buttonIndex === 2) {
     // Redirect to main app
     return res.redirect(302, 'https://wavewarz-analytics.vercel.app');
  }

  // Re-render the frame (essentially a refresh)
  // We assume the 'url' in the body points to the frame that was clicked
  // But for simplicity, we just fetch latest again or parse URL params
  
  // For now, just return the latest battle frame again
  const { data: battle } = await supabaseAdmin
      .from('battles')
      .select('*')
      .eq('status', 'Active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

  const html = generateBattleFrameHtml(battle, BASE_URL);
  res.send(html);
});
