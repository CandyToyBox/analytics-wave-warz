/**
 * Farcaster Integration Utilities
 *
 * Helper functions for posting to Farcaster and managing Frame interactions
 */

export interface FarcasterCast {
  text: string;
  embeds?: string[];
  parent?: string; // Parent cast hash for replies
  channelKey?: string; // Channel to post in
}

export interface FrameValidationData {
  buttonIndex: number;
  castId: {
    fid: number;
    hash: string;
  };
  inputText?: string;
  state?: string;
  address?: string;
  timestamp: number;
}

/**
 * Post a cast to Farcaster
 * Requires Farcaster Hub API or a service like Neynar
 *
 * @param cast - The cast content
 * @param signerUuid - Your Farcaster signer UUID
 */
export async function postToFarcaster(
  cast: FarcasterCast,
  signerUuid?: string
): Promise<{ success: boolean; hash?: string; error?: string }> {
  try {
    // TODO: Implement actual Farcaster posting
    // Options:
    // 1. Use Neynar API: https://docs.neynar.com/
    // 2. Use Farcaster Hub API directly
    // 3. Use a service like Pinata Farcaster

    console.log('📣 Would post to Farcaster:', cast);

    // Example using Neynar (you'll need to install @neynar/nodejs-sdk):
    /*
    const { NeynarAPIClient } = require("@neynar/nodejs-sdk");
    const client = new NeynarAPIClient(process.env.NEYNAR_API_KEY);

    const result = await client.publishCast(
      signerUuid,
      cast.text,
      {
        embeds: cast.embeds,
        channelKey: cast.channelKey
      }
    );

    return {
      success: true,
      hash: result.hash
    };
    */

    return {
      success: false,
      error: 'Farcaster posting not yet implemented. See api/_utils/farcaster.ts'
    };
  } catch (error) {
    console.error('Failed to post to Farcaster:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Announce a new battle on Farcaster
 */
export async function announceBattle(battle: {
  battleId: string;
  artist1Name: string;
  artist2Name: string;
  imageUrl?: string;
  frameUrl?: string;
}) {
  const frameUrl = battle.frameUrl ||
    `${process.env.FRAME_BASE_URL}/api/frames/battle/${battle.battleId}`;

  const cast: FarcasterCast = {
    text: `🌊 New WaveWarz Battle!\n\n🎵 ${battle.artist1Name} vs ${battle.artist2Name}\n\nWho will win? Place your bets! 👇`,
    embeds: [frameUrl],
    channelKey: 'wavewarz' // Update to your channel
  };

  return await postToFarcaster(cast);
}

/**
 * Announce battle results
 */
export async function announceBattleResults(battle: {
  battleId: string;
  artist1Name: string;
  artist2Name: string;
  winnerName: string;
  finalPoolA: number;
  finalPoolB: number;
  totalVolume: number;
}) {
  const winEmoji = '🏆';
  const volumeFormatted = battle.totalVolume.toFixed(2);

  const cast: FarcasterCast = {
    text: `${winEmoji} Battle #${battle.battleId} Results!\n\n` +
      `Winner: ${battle.winnerName}\n` +
      `Final: ${battle.finalPoolA.toFixed(2)} SOL vs ${battle.finalPoolB.toFixed(2)} SOL\n` +
      `Total Volume: ${volumeFormatted} SOL\n\n` +
      `See the replay 👇`,
    embeds: [
      `${process.env.APP_URL}?battle=${battle.battleId}`
    ],
    channelKey: 'wavewarz'
  };

  return await postToFarcaster(cast);
}

/**
 * Validate Frame POST data
 * Ensures the data comes from a legitimate Farcaster client
 */
export function validateFrameMessage(data: any): FrameValidationData | null {
  try {
    // Basic validation
    if (!data.untrustedData) {
      return null;
    }

    const untrusted = data.untrustedData;

    return {
      buttonIndex: untrusted.buttonIndex || 1,
      castId: {
        fid: untrusted.fid,
        hash: untrusted.castId?.hash || ''
      },
      inputText: untrusted.inputText,
      state: untrusted.state,
      address: untrusted.address,
      timestamp: untrusted.timestamp || Date.now()
    };

    // TODO: Add cryptographic validation using trustedData
    // See: https://docs.farcaster.xyz/reference/frames/spec#frame-signature-packet
  } catch (error) {
    console.error('Frame validation error:', error);
    return null;
  }
}

/**
 * Generate a shareable cast with Frame
 */
export function generateFrameCast(battleId: string, customText?: string): FarcasterCast {
  const frameUrl = `${process.env.FRAME_BASE_URL}/api/frames/battle/${battleId}`;

  return {
    text: customText || `Check out this WaveWarz battle! 🌊`,
    embeds: [frameUrl]
  };
}
