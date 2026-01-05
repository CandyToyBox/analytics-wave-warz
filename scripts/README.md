# WaveWarz Scripts

This directory contains utility scripts for managing the WaveWarz analytics platform.

## Blockchain Backfill Script

### Overview

The `backfill-from-blockchain.ts` script scans the Solana blockchain for all WaveWarz battle accounts and inserts missing battles into the database. This is useful when:

- Webhook events were missed (e.g., due to downtime)
- Historical battles need to be added to the database
- Database was reset and needs to be repopulated

### Prerequisites

1. **Environment Variables**: Ensure you have the required Supabase credentials configured in your `.env` file:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
# Optional: Override the default Helius API key
VITE_HELIUS_API_KEY=your-helius-api-key
```

2. **Dependencies**: Install required packages:

```bash
npm install
```

### Usage

Run the backfill script:

```bash
npm run backfill
```

Or in watch mode for development:

```bash
npm run backfill:dev
```

### What It Does

1. **Scans Blockchain**: Fetches all program accounts from the WaveWarz program (`9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo`)
2. **Extracts Battle IDs**: Decodes battle IDs from account data (offset 8-15, u64 little-endian)
3. **Compares with Database**: Identifies battles that exist on-chain but not in the database
4. **Inserts Placeholders**: Creates minimal battle records with status "PENDING"
5. **Rate Limiting**: Waits 100ms between insertions to avoid overwhelming the database

### Output

The script provides detailed console output:

```
============================================
🚀 WAVEWARZ BLOCKCHAIN BACKFILL
============================================
📅 Started: 2026-01-05T18:30:00.000Z

🔍 Scanning Solana blockchain for all WaveWarz battle accounts...
📍 Program ID: 9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo

📊 Found 250 program accounts

✅ Extracted 248 valid battle accounts

🔍 Fetching existing battles from database...
📊 Found 4 battles in database

============================================
📊 SUMMARY
============================================
   On-chain battles:      248
   In database:           4
   Missing from DB:       244
============================================

📝 Inserting 244 missing battles...

   Progress: 10/244 | Inserted: 10 | Failed: 0
   Progress: 20/244 | Inserted: 20 | Failed: 0
   ...
   Progress: 244/244 | Inserted: 244 | Failed: 0

============================================
✅ BACKFILL COMPLETE
============================================
   Successfully inserted:   244
   Already existed:         0
   Failed:                  0
📅 Completed: 2026-01-05T18:35:00.000Z
============================================
```

### Next Steps

After the backfill completes, run the admin scan endpoint to populate full battle details:

```bash
curl -X POST "https://analytics-wave-warz.vercel.app/api/admin/scan-battles?limit=200&forceRefresh=true" \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```

This will:
- Fetch complete battle data from the blockchain
- Populate artist names, wallets, music links
- Calculate trading volumes and statistics
- Determine battle winners
- Update Quick Battle flags

### Technical Details

#### Battle Account Structure

The script decodes battle accounts using the following structure:
- **Offset 0-7**: Discriminator (8 bytes)
- **Offset 8-15**: battle_id as u64 little-endian

#### Placeholder Data

Inserted battles use placeholder values that are clearly marked:
- `artist1_name`: `[Pending Scan] Battle {battleId} Artist A`
- `artist2_name`: `[Pending Scan] Battle {battleId} Artist B`
- `artist1_wallet`: `null` (will be populated by scanner)
- `artist2_wallet`: `null` (will be populated by scanner)
- `battle_duration`: `0` (will be determined from on-chain data)
- `is_quick_battle`: `null` (will be determined by scanner)
- `status`: `PENDING`

#### Error Handling

The script handles:
- **Duplicate battles**: Skips battles that already exist (using unique constraint on `battle_id`)
- **Invalid accounts**: Ignores program accounts that don't match the battle account format
- **Database errors**: Logs failures and continues processing remaining battles

### Troubleshooting

#### "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY"

Ensure your `.env` file is properly configured with Supabase credentials.

#### "Failed to fetch program accounts from blockchain"

This usually indicates:
- Network connectivity issues
- Invalid Helius API key
- RPC endpoint is down

Verify your network connection and Helius API key.

#### "Failed to insert battle X"

Check the database logs for the specific error. Common causes:
- Missing required columns in the database schema
- Constraint violations
- Permission issues (ensure the Supabase key has INSERT permissions)

### Advanced Usage

#### Custom RPC Endpoint

Override the Helius API key via environment variable:

```bash
VITE_HELIUS_API_KEY=your-custom-key npm run backfill
```

#### Programmatic Usage

Import and use the backfill function in your own scripts:

```typescript
import { backfillMissingBattles } from './scripts/backfill-from-blockchain';

const stats = await backfillMissingBattles();
console.log(`Inserted ${stats.inserted} battles`);
```

### Maintenance

- **Regular backfills**: Run weekly to catch any missed webhook events
- **Monitor failures**: Check the `failed` count in the output
- **Database cleanup**: Remove test/invalid battles before running production backfills
