# Song-Level Aggregation for Quick Battle Leaderboard

## Overview

Quick Battles in WaveWarz are **song vs song** competitions, not artist vs artist. The leaderboard now properly aggregates data at the song level, showing each unique track's performance across all its battles.

## The Change

### Before (Battle-Level)
Each row represented a single battle:
```
Row 1: Song A vs Song B (Battle #1) - 5 SOL volume
Row 2: Song A vs Song C (Battle #2) - 4 SOL volume
Row 3: Song B vs Song D (Battle #3) - 3 SOL volume
```

### After (Song-Level)
Each row represents a unique song with aggregated stats:
```
Row 1: Song A - 9 SOL total (2 battles, 1W-1L, 50% win rate)
Row 2: Song B - 8 SOL total (2 battles, 0W-2L, 0% win rate)
Row 3: Song C - 4 SOL total (1 battle, 1W-0L, 100% win rate)
Row 4: Song D - 3 SOL total (1 battle, 1W-0L, 100% win rate)
```

## Implementation Details

### New Function: `aggregateQuickBattlesBySong()`

Located in `services/supabaseClient.ts`, this function:

1. **Processes All Quick Battles**
   - Queries all battles with `is_quick_battle = true`
   - Iterates through each battle

2. **Identifies Each Song**
   - Extracts track name from Audius URLs
   - Falls back to artist name if URL parsing fails
   - Groups battles by track identifier

3. **Aggregates Per Song**
   - Sums volume from all battles
   - Counts wins and losses
   - Tracks total trades
   - Maintains latest update time
   - Keeps best artwork URL

4. **Calculates Statistics**
   - Total battles participated
   - Overall win rate percentage
   - Total volume generated
   - Total trades and unique traders

### Aggregation Logic

```typescript
For each battle:
  Extract track1 info (name, link, artwork)
  Extract track2 info (name, link, artwork)
  
  Determine scores and winner:
    - score1 = total_volume_a or artist1_pool
    - score2 = total_volume_b or artist2_pool
    - winner determined by winner_artist_a flag
  
  Aggregate track1:
    - battles_participated += 1
    - total_volume += score1
    - wins += 1 if won, losses += 1 if lost
    - track trades and traders
  
  Aggregate track2:
    - battles_participated += 1
    - total_volume += score2
    - wins += 1 if won, losses += 1 if lost
    - track trades and traders
```

### Track Identification

The system identifies tracks using a priority chain:

1. **Audius URL Parsing**
   ```typescript
   // URL: audius.co/Hurric4n3Ike/song-title-here
   // Extracted: "Song Title Here"
   ```

2. **Artist Name Fallback**
   - Uses `artist1_name` or `artist2_name` if URL unavailable

3. **Track Name Direct**
   - Uses `track_name` if already provided

### Example Aggregation

**Input: 3 Battles**
```javascript
Battle 1: {
  artist1_name: "Track A",
  artist2_name: "Track B", 
  total_volume_a: 5,
  total_volume_b: 3,
  winner_artist_a: true
}

Battle 2: {
  artist1_name: "Track A",
  artist2_name: "Track C",
  total_volume_a: 4,
  total_volume_b: 6,
  winner_artist_a: false
}

Battle 3: {
  artist1_name: "Track B",
  artist2_name: "Track D",
  total_volume_a: 3,
  total_volume_b: 7,
  winner_artist_a: false
}
```

**Output: Song Leaderboard**
```javascript
[
  {
    track_name: "Track A",
    battles_participated: 2,
    wins: 1,
    losses: 1,
    win_rate: 50,
    total_volume_generated: 9,  // 5 + 4
    ...
  },
  {
    track_name: "Track B",
    battles_participated: 2,
    wins: 1,
    losses: 1,
    win_rate: 50,
    total_volume_generated: 6,  // 3 + 3
    ...
  },
  {
    track_name: "Track C",
    battles_participated: 1,
    wins: 1,
    losses: 0,
    win_rate: 100,
    total_volume_generated: 6,
    ...
  },
  {
    track_name: "Track D",
    battles_participated: 1,
    wins: 1,
    losses: 0,
    win_rate: 100,
    total_volume_generated: 7,
    ...
  }
]
```

## Leaderboard Display

### Columns Shown

1. **Rank** - Position based on total volume
2. **Track** - Song name and artwork
   - Shows track name from aggregation
   - Displays Audius artwork
   - Shows Audius handle if available
3. **Volume** - Total SOL generated
   - Sum across all battles
   - USD equivalent
4. **Results** - Win/loss record
   - Format: "XW - YL"
   - Win rate percentage
5. **Battles** - Number of battles participated
   - Total trades count
6. **Updated** - Most recent data update

### Sorting

Leaderboard is sorted by **total volume generated** (descending):
- Songs with highest total volume appear first
- Encourages participation in multiple battles
- Rewards consistent performance

## Data Sources

### Primary: Database View
- Tries `v_quick_battle_leaderboard_public` first
- Assumes view already aggregates by song
- Fast, pre-calculated

### Fallback: Battles Table
- Queries `battles` table directly
- Filters: `is_quick_battle = true`
- Performs aggregation in JavaScript
- Slower but always works

## Backward Compatibility

The implementation maintains compatibility with:

1. **Individual Battle Data**
   - If view returns battle-level data, mapping still works
   - Fallback chains handle missing aggregation

2. **Existing Column Names**
   - Checks multiple column name variants
   - Works with both old and new schemas

3. **Missing Volume Data**
   - Falls back to pool sizes
   - Shows zeros gracefully

## Benefits

### User Experience
- **Clear Song Performance**: See how each song performs overall
- **Easy Comparison**: Compare songs across multiple battles
- **Comprehensive Stats**: Total volume, win rate, participation

### Data Insights
- **Popular Tracks**: Highest volume shows most traded
- **Winning Songs**: Best win rates highlight favorites
- **Active Tracks**: Most battles show engagement

### Performance
- **Reduced Rows**: N battles → M songs (M < N)
- **Meaningful Data**: Aggregated stats more useful
- **Cleaner UI**: Less clutter, better UX

## Database View Recommendation

For optimal performance, create a materialized view that pre-aggregates:

```sql
CREATE MATERIALIZED VIEW v_quick_battle_leaderboard_public AS
WITH song_battles AS (
  -- Extract all songs and their battles
  SELECT 
    COALESCE(artist1_name, 'Unknown') as track_name,
    artist1_music_link as audius_profile_url,
    total_volume_a as volume,
    CASE 
      WHEN winner_decided AND winner_artist_a THEN 1 
      ELSE 0 
    END as won,
    CASE 
      WHEN winner_decided AND NOT winner_artist_a THEN 1 
      ELSE 0 
    END as lost,
    trade_count,
    unique_traders,
    created_at,
    last_scanned_at,
    image_url
  FROM battles
  WHERE is_quick_battle = true
  
  UNION ALL
  
  SELECT 
    COALESCE(artist2_name, 'Unknown') as track_name,
    artist2_music_link as audius_profile_url,
    total_volume_b as volume,
    CASE 
      WHEN winner_decided AND NOT winner_artist_a THEN 1 
      ELSE 0 
    END as won,
    CASE 
      WHEN winner_decided AND winner_artist_a THEN 1 
      ELSE 0 
    END as lost,
    trade_count,
    unique_traders,
    created_at,
    last_scanned_at,
    image_url
  FROM battles
  WHERE is_quick_battle = true
)
SELECT 
  track_name,
  audius_profile_url as audius_profile_pic,
  COUNT(*) as battles_participated,
  SUM(won) as wins,
  SUM(lost) as losses,
  CASE 
    WHEN COUNT(*) > 0 THEN (SUM(won)::float / COUNT(*)) * 100 
    ELSE 0 
  END as win_rate,
  SUM(volume) as total_volume_generated,
  SUM(trade_count) as total_trades,
  SUM(unique_traders) as unique_traders,
  MIN(created_at) as created_at,
  MAX(last_scanned_at) as updated_at,
  MAX(image_url) as image_url
FROM song_battles
GROUP BY track_name, audius_profile_url
ORDER BY total_volume_generated DESC;

-- Refresh periodically
CREATE INDEX idx_quick_battle_leaderboard ON v_quick_battle_leaderboard_public(total_volume_generated DESC);
```

## Testing Checklist

- [ ] Leaderboard shows unique songs (not duplicate battles)
- [ ] Volume values represent sums across battles
- [ ] Win rates calculated correctly
- [ ] Track names display properly
- [ ] Audius artwork shows correctly
- [ ] Sorting by volume works
- [ ] Search filters songs correctly
- [ ] No duplicate songs in list

## Troubleshooting

### Songs Not Aggregating

**Check:**
- Verify `aggregateQuickBattlesBySong()` is being called
- Look for console logs: "Aggregated into X unique songs"
- Ensure `is_quick_battle = true` for battles

**Solutions:**
- Check track name extraction logic
- Verify battles have valid artist names or music links
- Look for null/undefined track identifiers

### Incorrect Volume Totals

**Check:**
- Console logs show volume breakdown per battle
- Database has `total_volume_a/b` populated
- Fallback to pools working correctly

**Solutions:**
- Trigger blockchain fetch for battles without volume
- Verify `updateBattleDynamicStats()` saves correctly
- Check aggregation sum logic

### Missing Songs

**Check:**
- All Quick Battles have `is_quick_battle = true`
- Both tracks in battle being processed
- Track identification working for all battles

**Solutions:**
- Update old battles with `is_quick_battle` flag
- Improve track name extraction for edge cases
- Add logging to track extraction

## Summary

Song-level aggregation transforms the Quick Battle leaderboard from a battle list into a true song performance ranking:

✅ Each row = unique song
✅ Volume = sum across all battles
✅ Win rate = overall performance
✅ Battles = participation count
✅ Sorted by total volume

This provides much more meaningful insights into which songs are performing best across all Quick Battles!
