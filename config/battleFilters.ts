// ============================================================================
// BATTLE FILTERS CONFIG
// ============================================================================
// Central config for test battle detection.
// All filtering logic should import from here so it is easy to edit later.

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
