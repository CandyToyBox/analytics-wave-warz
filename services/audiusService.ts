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

interface AudiusSearchResponse {
  data?: AudiusTrack[];
}

/**
 * Extract artist handle and track slug from Audius URL
 * @param url Audius track URL (e.g., https://audius.co/artisthandle/track-slug)
 * @returns Object with handle and slug, or null
 */
function parseAudiusUrl(url: string): { handle: string; slug: string } | null {
  if (!url || !url.includes('audius.co')) {
    return null;
  }
  
  // Parse URL pattern: https://audius.co/{artistHandle}/{trackSlug}
  const match = url.match(/audius\.co\/([^\/]+)\/([^\/\?#]+)/);
  if (match && match[1] && match[2]) {
    return {
      handle: match[1],
      slug: match[2]
    };
  }
  
  return null;
}

/**
 * Fetch track information from Audius API by searching for artist handle and track slug
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
    const parsed = parseAudiusUrl(trackUrl);
    if (!parsed) {
      console.warn('Could not parse Audius URL:', trackUrl);
      return null;
    }

    // Search for tracks by the artist handle
    // This is more reliable than trying to extract track IDs
    const searchQuery = encodeURIComponent(`${parsed.slug.replace(/-/g, ' ')}`);
    const response = await fetch(`${AUDIUS_API_BASE}/tracks/search?query=${searchQuery}&limit=10`, {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      console.warn(`Audius API search error for "${parsed.slug}":`, response.status);
      return null;
    }

    const data: AudiusSearchResponse = await response.json();
    
    if (!data.data || data.data.length === 0) {
      console.warn('No tracks found in Audius API search for:', parsed.slug);
      return null;
    }

    // Find the track that matches both the artist handle and track slug
    const track = data.data.find(t => 
      t.user.handle.toLowerCase() === parsed.handle.toLowerCase() &&
      t.permalink.toLowerCase().includes(parsed.slug.toLowerCase())
    );

    if (!track) {
      // If exact match not found, try to find by artist handle only
      const trackByArtist = data.data.find(t => 
        t.user.handle.toLowerCase() === parsed.handle.toLowerCase()
      );
      
      if (!trackByArtist) {
        console.warn('No matching track found for artist:', parsed.handle, 'slug:', parsed.slug);
        return null;
      }
      
      // Use the first track by this artist as fallback
      console.log('Using fallback track match for:', parsed.handle);
      return extractTrackData(trackByArtist);
    }

    return extractTrackData(track);
  } catch (error) {
    console.error('Error fetching track info from Audius:', error);
    return null;
  }
}

/**
 * Extract track data from Audius API response
 */
function extractTrackData(track: AudiusTrack): {
  trackName: string;
  artistHandle: string;
  artistName: string;
  artwork: string | null;
  profilePicture: string | null;
} {
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
