/**
 * Farcaster integration utilities for WaveWarz
 */

interface AnnounceBattleParams {
  battleId: string;
  artist1Name: string;
  artist2Name: string;
  imageUrl?: string;
}

interface AnnounceBattleResult {
  success: boolean;
  hash?: string;
  error?: string;
}

/**
 * Announce a new battle to Farcaster
 * Posts a cast about the battle to the configured Farcaster channel
 */
export async function announceBattle(params: AnnounceBattleParams): Promise<AnnounceBattleResult> {
  const { battleId, artist1Name, artist2Name, imageUrl } = params;
  
  // Check if Farcaster credentials are configured
  const farcasterApiKey = process.env.FARCASTER_API_KEY;
  const farcasterSignerUuid = process.env.FARCASTER_SIGNER_UUID;
  
  if (!farcasterApiKey || !farcasterSignerUuid) {
    return {
      success: false,
      error: 'Farcaster credentials not configured'
    };
  }

  try {
    const appUrl = process.env.APP_URL || 'https://wavewarz-analytics.vercel.app';
    const castMessage = `🎵 New WaveWarz Battle! 🎵\n\n${artist1Name} vs ${artist2Name}\n\nWho will win? Cast your vote now!\n\n${appUrl}`;
    
    const response = await fetch('https://api.neynar.com/v2/farcaster/cast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_key': farcasterApiKey,
      },
      body: JSON.stringify({
        signer_uuid: farcasterSignerUuid,
        text: castMessage,
        embeds: imageUrl ? [{ url: imageUrl }] : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Farcaster API error:', errorText);
      return {
        success: false,
        error: `API error: ${response.status}`
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      hash: data.cast?.hash
    };
  } catch (error) {
    console.error('Failed to post to Farcaster:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
