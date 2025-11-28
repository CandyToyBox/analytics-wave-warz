import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Database configuration missing' });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Query parameters for pagination
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string;

    // Build query to get unique artists from battles
    let query = supabase
      .from('battles')
      .select('artist1_name, artist1_wallet, artist1_twitter, artist1_music_link, artist2_name, artist2_wallet, artist2_twitter, artist2_music_link, image_url');

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch artists',
        details: error.message 
      });
    }

    // Extract unique artists from battles
    const artistMap = new Map<string, {
      name: string;
      wallet: string;
      twitter?: string;
      musicLink?: string;
      imageUrl?: string;
      battlesCount: number;
    }>();

    (data || []).forEach((battle: Record<string, unknown>) => {
      // Artist 1
      const wallet1 = battle.artist1_wallet as string;
      const name1 = battle.artist1_name as string;
      if (wallet1 && name1) {
        const existing = artistMap.get(wallet1);
        artistMap.set(wallet1, {
          name: name1,
          wallet: wallet1,
          twitter: (battle.artist1_twitter as string) || existing?.twitter,
          musicLink: (battle.artist1_music_link as string) || existing?.musicLink,
          imageUrl: (battle.image_url as string) || existing?.imageUrl,
          battlesCount: (existing?.battlesCount || 0) + 1
        });
      }

      // Artist 2
      const wallet2 = battle.artist2_wallet as string;
      const name2 = battle.artist2_name as string;
      if (wallet2 && name2) {
        const existing = artistMap.get(wallet2);
        artistMap.set(wallet2, {
          name: name2,
          wallet: wallet2,
          twitter: (battle.artist2_twitter as string) || existing?.twitter,
          musicLink: (battle.artist2_music_link as string) || existing?.musicLink,
          imageUrl: (battle.image_url as string) || existing?.imageUrl,
          battlesCount: (existing?.battlesCount || 0) + 1
        });
      }
    });

    // Convert to array and apply search filter
    let artists = Array.from(artistMap.values());
    
    if (search) {
      const searchLower = search.toLowerCase();
      artists = artists.filter(a => 
        a.name.toLowerCase().includes(searchLower) ||
        a.wallet.toLowerCase().includes(searchLower)
      );
    }

    // Sort by battles count and apply pagination
    artists.sort((a, b) => b.battlesCount - a.battlesCount);
    const total = artists.length;
    const paginatedArtists = artists.slice(offset, offset + limit);

    return res.status(200).json({
      success: true,
      data: paginatedArtists,
      pagination: {
        total,
        limit,
        offset,
        hasMore: (offset + limit) < total
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
