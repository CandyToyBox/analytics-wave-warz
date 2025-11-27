import { Request, Response } from 'express';
import { supabase } from '../../services/supabaseClient.js';

interface FrameMetadata {
  version: string;
  image: string;
  postUrl: string;
  buttons?: Array<{
    label: string;
    action?: 'post' | 'post_redirect' | 'link';
    target?: string;
  }>;
  input?: {
    text: string;
  };
}

/**
 * Generates Farcaster Frame HTML metadata for battles
 */
export async function frameHandler(req: Request, res: Response) {
  try {
    const battleId = req.params.battleId || req.body.battleId;
    const buttonIndex = req.body.untrustedData?.buttonIndex || 1;

    // Fetch battle data
    const battle = battleId
      ? await fetchBattle(battleId)
      : await fetchLatestBattle();

    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    // Generate Frame based on interaction
    const frame = generateBattleFrame(battle, buttonIndex);

    // Return Frame HTML
    const html = generateFrameHTML(frame);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    console.error('Frame error:', error);
    res.status(500).json({ error: 'Failed to generate frame' });
  }
}

/**
 * Generates dynamic battle image for Frame
 */
export async function frameImageHandler(req: Request, res: Response) {
  try {
    const battleId = req.query.battleId as string;

    if (!battleId) {
      return res.status(400).json({ error: 'battleId required' });
    }

    const battle = await fetchBattle(battleId);
    if (!battle) {
      return res.status(404).json({ error: 'Battle not found' });
    }

    // Option 1: Redirect to existing image
    if (battle.image_url) {
      return res.redirect(battle.image_url);
    }

    // Option 2: Generate dynamic image (requires canvas/image generation)
    // For now, return a placeholder
    const imageHtml = generateBattleImageHTML(battle);
    res.setHeader('Content-Type', 'text/html');
    res.send(imageHtml);

  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
}

/**
 * Fetch battle from Supabase
 */
async function fetchBattle(battleId: string) {
  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .eq('battle_id', battleId)
    .single();

  if (error) {
    console.error('Failed to fetch battle:', error);
    return null;
  }

  return data;
}

/**
 * Fetch latest battle
 */
async function fetchLatestBattle() {
  const { data, error } = await supabase
    .from('battles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('Failed to fetch latest battle:', error);
    return null;
  }

  return data;
}

/**
 * Generate Frame metadata based on battle and interaction
 */
function generateBattleFrame(battle: any, buttonIndex: number): FrameMetadata {
  const baseUrl = process.env.FRAME_BASE_URL || 'http://localhost:3001';
  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  // Calculate current state
  const poolA = battle.artist1_pool || 0;
  const poolB = battle.artist2_pool || 0;
  const total = poolA + poolB;
  const leader = poolA > poolB ? battle.artist1_name : battle.artist2_name;
  const status = battle.status || 'active';

  // Default view
  let frame: FrameMetadata = {
    version: 'vNext',
    image: `${baseUrl}/api/frames/battle/image?battleId=${battle.battle_id}`,
    postUrl: `${baseUrl}/api/frames/battle/${battle.battle_id}`,
    buttons: [
      {
        label: '🔄 Refresh Stats',
        action: 'post'
      },
      {
        label: `📊 ${battle.artist1_name}`,
        action: 'post'
      },
      {
        label: `📊 ${battle.artist2_name}`,
        action: 'post'
      },
      {
        label: '🌐 Open App',
        action: 'link',
        target: appUrl
      }
    ]
  };

  // Modify based on button clicked
  if (buttonIndex === 2) {
    // Show Artist A stats
    frame.image = `${baseUrl}/api/frames/battle/image?battleId=${battle.battle_id}&view=artist1`;
  } else if (buttonIndex === 3) {
    // Show Artist B stats
    frame.image = `${baseUrl}/api/frames/battle/image?battleId=${battle.battle_id}&view=artist2`;
  }

  return frame;
}

/**
 * Generate HTML with Frame meta tags
 */
function generateFrameHTML(frame: FrameMetadata): string {
  let metaTags = `
    <meta property="fc:frame" content="${frame.version}" />
    <meta property="fc:frame:image" content="${frame.image}" />
    <meta property="fc:frame:post_url" content="${frame.postUrl}" />
  `;

  // Add buttons
  if (frame.buttons) {
    frame.buttons.forEach((button, index) => {
      metaTags += `
    <meta property="fc:frame:button:${index + 1}" content="${button.label}" />`;

      if (button.action) {
        metaTags += `
    <meta property="fc:frame:button:${index + 1}:action" content="${button.action}" />`;
      }

      if (button.target) {
        metaTags += `
    <meta property="fc:frame:button:${index + 1}:target" content="${button.target}" />`;
      }
    });
  }

  // Add input field if present
  if (frame.input) {
    metaTags += `
    <meta property="fc:frame:input:text" content="${frame.input.text}" />`;
  }

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>WaveWarz Battle Frame</title>
    ${metaTags}
    <meta property="og:title" content="WaveWarz - Music Battle Royale" />
    <meta property="og:description" content="Watch artists battle it out in real-time trading wars!" />
</head>
<body>
    <h1>WaveWarz Battle Frame</h1>
    <p>This is a Farcaster Frame. View it in a Farcaster client like Warpcast.</p>
</body>
</html>
  `;
}

/**
 * Generate battle image HTML (placeholder until proper image generation is implemented)
 */
function generateBattleImageHTML(battle: any): string {
  const poolA = battle.artist1_pool || 0;
  const poolB = battle.artist2_pool || 0;
  const total = poolA + poolB;
  const percentA = total > 0 ? ((poolA / total) * 100).toFixed(1) : '50.0';
  const percentB = total > 0 ? ((poolB / total) * 100).toFixed(1) : '50.0';

  return `
<!DOCTYPE html>
<html>
<head>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            width: 1200px;
            height: 630px;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            font-family: 'Arial', sans-serif;
            color: white;
            overflow: hidden;
        }
        .title {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 30px;
            text-transform: uppercase;
            letter-spacing: 4px;
            background: linear-gradient(90deg, #06b6d4, #e879f9);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .battle-container {
            display: flex;
            gap: 40px;
            align-items: center;
            width: 90%;
        }
        .artist {
            flex: 1;
            text-align: center;
        }
        .artist-name {
            font-size: 36px;
            font-weight: bold;
            margin-bottom: 15px;
        }
        .artist-pool {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .artist-percent {
            font-size: 28px;
            opacity: 0.8;
        }
        .vs {
            font-size: 72px;
            font-weight: bold;
            opacity: 0.6;
        }
        .artist-a { color: #06b6d4; }
        .artist-b { color: #e879f9; }
        .status {
            margin-top: 30px;
            font-size: 24px;
            text-transform: uppercase;
            letter-spacing: 2px;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="title">🌊 WaveWarz Battle 🌊</div>
    <div class="battle-container">
        <div class="artist">
            <div class="artist-name artist-a">${battle.artist1_name || 'Artist A'}</div>
            <div class="artist-pool artist-a">${poolA.toFixed(2)} SOL</div>
            <div class="artist-percent artist-a">${percentA}%</div>
        </div>
        <div class="vs">VS</div>
        <div class="artist">
            <div class="artist-name artist-b">${battle.artist2_name || 'Artist B'}</div>
            <div class="artist-pool artist-b">${poolB.toFixed(2)} SOL</div>
            <div class="artist-percent artist-b">${percentB}%</div>
        </div>
    </div>
    <div class="status">${battle.status || 'Live'} • Battle #${battle.battle_id}</div>
</body>
</html>
  `;
}
