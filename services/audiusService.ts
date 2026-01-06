/**
 * Audius API Service
 * 
 * Fetches track metadata from Audius API to get correct artwork and track information.
 * App Name: WaveWarz Statz App
 * 
 * Note: Audius API v1 is public and does not require authentication for read operations.
 * API keys are provided but not currently required by the public API endpoints.
 */

const AUDIUS_API_BASE = 'https://api.audius.co/v1';

interface AudiusTrack {
  id: string;
  title: string;
  user: {
    handle: string;
    name: string;
    profile_picture?: {
      '150x150'?: string;
      '480x480'?: string;
      '1000x1000'?: string;
    };
  };
  artwork?: {
    '150x150'?: string;
    '480x480'?: string;
    '1000x1000'?: string;
  };
  permalink: string;
}

interface AudiusApiResponse {
  data?: AudiusTrack;
}

/**
 * Extract track ID from Audius URL
 * @param url Audius track URL (e.g., https://audius.co/artisthandle/track-slug-12345)
 * @returns Track ID or null
 */
function extractTrackIdFromUrl(url: string): string | null {
  if (!url || !url.includes('audius.co')) {
    return null;
  }
  
  // Audius URLs can have track ID at the end: /artist/track-slug-{trackId}
  // Try to extract the numeric ID at the end
  const match = url.match(/-(\d+)$/);
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
}

/**
 * Fetch track information from Audius API
 * @param trackUrl Audius track URL
 * @returns Track metadata including artwork
 */
export async function fetchAudiusTrackInfo(trackUrl: string): Promise<{
  trackName: string;
  artistHandle: string;
  artistName: string;
  artwork: string | null;
  profilePicture: string | null;
} | null> {
  try {
    const trackId = extractTrackIdFromUrl(trackUrl);
    if (!trackId) {
      console.warn('Could not extract track ID from URL:', trackUrl);
      return null;
    }

    const response = await fetch(`${AUDIUS_API_BASE}/tracks/${trackId}`, {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.warn(`Audius API error for track ${trackId}:`, response.status);
      return null;
    }

    const data: AudiusApiResponse = await response.json();
    
    if (!data.data) {
      console.warn('No track data returned from Audius API');
      return null;
    }

    const track = data.data;
    
    // Get the best quality artwork available
    const artwork = track.artwork?.['480x480'] 
      || track.artwork?.['1000x1000'] 
      || track.artwork?.['150x150'] 
      || null;
    
    // Get the artist's profile picture
    const profilePicture = track.user.profile_picture?.['480x480']
      || track.user.profile_picture?.['1000x1000']
      || track.user.profile_picture?.['150x150']
      || null;

    return {
      trackName: track.title,
      artistHandle: track.user.handle,
      artistName: track.user.name,
      artwork: artwork,
      profilePicture: profilePicture
    };
  } catch (error) {
    console.error('Error fetching track info from Audius:', error);
    return null;
  }
}

/**
 * Batch fetch track information for multiple URLs
 * @param trackUrls Array of Audius track URLs
 * @returns Map of URL to track info
 */
export async function batchFetchAudiusTrackInfo(
  trackUrls: string[]
): Promise<Map<string, NonNullable<Awaited<ReturnType<typeof fetchAudiusTrackInfo>>>>> {
  const results = new Map();
  
  // Fetch tracks in parallel with a reasonable concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < trackUrls.length; i += BATCH_SIZE) {
    const batch = trackUrls.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (url) => {
        const info = await fetchAudiusTrackInfo(url);
        return { url, info };
      })
    );
    
    batchResults.forEach(({ url, info }) => {
      if (info) {
        results.set(url, info);
      }
    });
    
    // Add a small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < trackUrls.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}
