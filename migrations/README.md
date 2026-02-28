# Database Migrations

This directory contains SQL migration scripts for the WaveWarz Analytics database.

## Migration 005: Comprehensive Schema Refactoring ⭐ NEW

**File**: `005_refactor_schema_comprehensive.sql`

**Documentation**: `005_MIGRATION_GUIDE.md` (detailed guide)

**Purpose**: Comprehensive schema refactoring to improve data integrity, performance, and maintainability.

### What This Migration Does

1. **Adds CHECK constraints** for data validation across all tables
   - Ensures numeric fields are non-negative (volumes, pools, counts)
   - Validates win rates are between 0-100%
   - Prevents invalid data at database level

2. **Creates performance indexes** for common query patterns
   - Artist wallet lookups
   - Battle type filtering (quick/community/test)
   - Winner queries
   - Leaderboard sorting

3. **Implements auto-updating triggers**
   - Automatically updates artist_leaderboard when battles complete
   - Calculates win rates and averages in real-time
   - Excludes test battles

### Key Benefits

✅ **Better data integrity** - Database-level validation prevents bugs
✅ **Faster queries** - Optimized indexes for all common patterns  
✅ **Real-time leaderboards** - Automatic updates via triggers
✅ **Production-safe** - Non-destructive, uses CONCURRENTLY
✅ **No code changes needed** - Fully backwards compatible

### How to Apply

See [005_MIGRATION_GUIDE.md](./005_MIGRATION_GUIDE.md) for detailed instructions, validation steps, and troubleshooting.

Quick start:
```sql
-- Via Supabase Dashboard SQL Editor
-- Copy and run: 005_refactor_schema_comprehensive.sql
```

---

## Migration 001: Optimize Battles Indexes

**File**: `001_optimize_battles_indexes.sql`

**Purpose**: Remove unused and redundant indexes on the `battles` table to reduce write overhead and storage costs.

### What This Migration Does

1. **Drops unused composite index** `idx_battles_status_created`
   - Usage: 0 scans in production
   - Reason: Redundant with existing single-column indexes
   - Impact: Reduces write overhead on every battle insert/update

2. **Drops redundant index** `idx_battles_battle_id`
   - Usage: 780,559 scans (but duplicates unique constraint)
   - Reason: `battles_battle_id_key` unique constraint already provides the same functionality
   - Impact: Reduces write overhead without affecting query performance

3. **Creates partial index** `idx_battles_active_recent` (Optional)
   - Purpose: Optimizes queries for active, non-test battles
   - Smaller and more selective than full-table indexes
   - Impact: Faster queries for common "active battles" pattern

### How to Apply This Migration

#### Option 1: Via Supabase Dashboard (Recommended)

1. Log in to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `001_optimize_battles_indexes.sql`
4. Paste into the SQL editor
5. Click **Run** to execute

#### Option 2: Via Supabase CLI

```bash
# If you have Supabase CLI installed
supabase db push 001_optimize_battles_indexes.sql
```

#### Option 3: Via psql

```bash
# Connect to your database
psql "postgresql://[user]:[password]@[host]:5432/[database]"

# Run the migration
\i migrations/001_optimize_battles_indexes.sql
```

### Validation After Migration

Run these queries to verify the migration was successful:

```sql
-- 1. Check that old indexes are gone
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'battles' 
  AND indexname IN ('idx_battles_status_created', 'idx_battles_battle_id');
-- Expected: 0 rows

-- 2. Check that new partial index was created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'battles' 
  AND indexname = 'idx_battles_active_recent';
-- Expected: 1 row showing the partial index definition

-- 3. Monitor index usage over time
SELECT indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE tablename = 'battles'
ORDER BY idx_scan DESC;
```

### Rollback

If you need to rollback this migration, run:

```sql
-- Restore dropped indexes
CREATE INDEX CONCURRENTLY idx_battles_status_created 
  ON public.battles (status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_battles_battle_id 
  ON public.battles (battle_id);

-- Remove new partial index
DROP INDEX CONCURRENTLY IF EXISTS public.idx_battles_active_recent;
```

### Impact on Application Code

✅ **No application code changes required**

The application queries are unaffected because:
- Battle lookups by `battle_id` use the unique constraint index
- Queries filtering by `status` use the existing `idx_battles_status` index
- Queries ordering by `created_at` use the existing `idx_battles_created_at` index
- The new partial index improves performance for active battle queries

### Expected Benefits

- **Reduced write overhead**: ~2 fewer index updates per battle insert/update
- **Reduced storage**: Smaller database size, faster backups
- **Improved query performance**: Partial index is smaller and more selective for hot queries
- **No downtime**: All operations use `CONCURRENTLY` to avoid table locks

## Future Migrations

Add new migration files with incrementing numbers:
- `002_description.sql`
- `003_description.sql`
- etc.

Document each migration in this README.
