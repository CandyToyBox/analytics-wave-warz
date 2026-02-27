// ============================================================================
// BATTLE FILTERS CONFIG
// ============================================================================
// Central config for test battle detection.
// All filtering logic should import from here so it is easy to edit later.

import { BattleSummary } from '../types';

/**
 * Artist names used in test battles.
 * Used as a fallback when `is_test_battle` flag is not present on a record.
 */
export const testArtistNames: string[] = [
  'Artist 4g2w',
  'Artist 9RbU',
];

/**
 * Wallet addresses associated with test battles.
 * Used as a fallback when `is_test_battle` flag is not present on a record.
 */
export const testWallets: string[] = [
  '9RbUvEftkY9Q7teDaCYjGs1w5n7318GUaJ1KdLDCQM1B',
  '4g2wDCUN1WcsMRd2czDSVhxgk5eCLH4CpVLk3thfv5rG',
];

/**
 * Returns true if a battle should be treated as a test/internal battle and
 * excluded from all public views (grid, events tab, leaderboards).
 *
 * Detection rules (any one match = test battle):
 *  1. DB flag `is_test_battle === true`
 *  2. Either artist uses a known test wallet address
 *  3. Either artist uses a known test artist name
 *  4. Both artist wallets are identical (self-battle — same person on both sides)
 *
 * NOTE: We deliberately do NOT short-circuit when `is_test_battle === false`.
 * Some DB records have the flag set to false but still use test wallets, so
 * wallet/name/self-battle checks must always run as a safety net.
 */
export function isTestBattle(b: BattleSummary): boolean {
  if (b.isTestBattle === true) return true;

  const walletA = b.artistA?.wallet ?? '';
  const walletB = b.artistB?.wallet ?? '';

  if (walletA && testWallets.includes(walletA)) return true;
  if (walletB && testWallets.includes(walletB)) return true;

  if (testArtistNames.includes(b.artistA?.name ?? '')) return true;
  if (testArtistNames.includes(b.artistB?.name ?? '')) return true;

  // Self-battle: same non-empty wallet on both sides (e.g. hurric4n3ike vs hurric4n3ike)
  if (walletA && walletB && walletA === walletB) return true;

  return false;
}
