# Scan Quick Battles from Blockchain

## Problem
Quick Battles show 0 volume because they haven't been scanned from the blockchain yet.
The volume data only gets updated when someone views a battle's detail page.

## Solution
You need to scan all Quick Battles from the Solana blockchain to populate the database.

## Option 1: Automatic Backend Job (Recommended)
Create a cron job or scheduled function that:
1. Fetches all Quick Battles from database
2. For each battle, calls the Solana blockchain
3. Updates the database with real volume/trade data
4. Refreshes the materialized view

## Option 2: Manual Scan from Frontend
Add a button to the Quick Battles leaderboard that:
1. Fetches all Quick Battle IDs from database
2. Calls `fetchBattleOnChain()` for each
3. This triggers `updateBattleDynamicStats()` automatically
4. Refreshes the materialized view

## Option 3: Database Query with Blockchain Scanner
Run this SQL to get battle IDs that need scanning:

```sql
SELECT battle_id, artist1_name, artist2_name, status
FROM battles
WHERE is_quick_battle = true
  AND artist1_music_link IS NOT NULL
  AND artist2_music_link IS NOT NULL
  AND artist1_music_link LIKE '%audius.co%'
  AND artist2_music_link LIKE '%audius.co%'
  AND (total_volume_a = 0 OR total_volume_a IS NULL)
ORDER BY created_at DESC;
```

Then create a script to scan these battles.

## Why This Happens
- Frontend `solanaService.ts` only scans battles when viewed
- Quick Battles created but never viewed = never scanned
- Database columns stay at 0 until scanned
- Materialized view aggregates from database = shows 0

## After Scanning
Once battles are scanned, run:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY v_quick_battle_leaderboard_public;
```

The leaderboard will then show real volume data!
