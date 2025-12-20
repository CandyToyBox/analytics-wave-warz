# Supabase Configuration Checklist

This document contains configuration changes that must be made in the Supabase Dashboard (not in application code).

## 1. Auth Server Connection Pool Optimization

**Issue**: Auth server is capped at a fixed maximum of 10 database connections, which prevents scaling with instance size.

**Impact**: As you scale up instance size, Auth throughput won't improve due to the fixed connection cap.

**Recommended Solution**: Switch to percentage-based connection allocation.

### How to Apply (via Supabase Dashboard)

1. **Log in to Supabase Dashboard**
   - Navigate to your project: https://supabase.com/dashboard/project/[project-id]

2. **Open Auth Settings**
   - Go to: **Authentication** → **Settings** → **Advanced** (or **Performance**)
   - Look for "Connection Pool" or "Database Connections" settings

3. **Change Connection Strategy**
   - **Current Setting**: Fixed number (10 connections)
   - **New Setting**: Percentage-based (5-10% of available connections)
   
   **Recommended Values**:
   - **Conservative Start**: 5% of max_connections
   - **Moderate**: 7-8% of max_connections  
   - **High Traffic**: 10% of max_connections

4. **Calculate Appropriate Percentage**
   
   Example for different instance sizes:
   ```
   Small Instance (max_connections = 100):
   - 5% = 5 connections
   - 10% = 10 connections
   
   Medium Instance (max_connections = 200):
   - 5% = 10 connections
   - 10% = 20 connections
   
   Large Instance (max_connections = 400):
   - 5% = 20 connections
   - 10% = 40 connections
   ```

5. **Verify Total Allocation**
   
   Ensure sum of all service connections stays below max_connections:
   ```
   Auth:          5-10%
   API/PostgREST: 20-30%
   Realtime:      5-10%
   Edge Functions: 5-10%
   Supabase JS:   10-20%
   Background:    5-10%
   Maintenance:   10% (reserved)
   ─────────────────────
   Total:         ~60-90% (safe range)
   ```

6. **Save and Apply**
   - Click **Save** or **Update**
   - May require restart/redeploy (follow dashboard prompts)

### Validation After Change

1. **Monitor Auth Performance**
   ```sql
   -- Check current Auth connection usage
   SELECT 
     COUNT(*) as active_connections,
     application_name
   FROM pg_stat_activity
   WHERE application_name LIKE '%auth%'
   GROUP BY application_name;
   ```

2. **Monitor Total Connections**
   ```sql
   -- Check total connection usage vs limit
   SELECT 
     COUNT(*) as current_connections,
     setting::int as max_connections,
     ROUND((COUNT(*)::float / setting::int) * 100, 2) as percent_used
   FROM pg_stat_activity, pg_settings
   WHERE pg_settings.name = 'max_connections'
   GROUP BY setting;
   ```

3. **Check for Connection Errors**
   - Monitor Supabase logs for connection timeout errors
   - Check Auth request latency in dashboard metrics
   - Watch for "too many connections" errors

### Expected Benefits

- ✅ **Better Scaling**: Auth connections scale with instance size
- ✅ **Improved Throughput**: More connections available under load
- ✅ **Lower Latency**: Reduced connection wait times
- ✅ **Future-Proof**: Automatic adjustment when instance size changes

### Rollback

If issues occur, revert to fixed allocation:
- Set Auth connections back to: **10** (fixed)
- Monitor for 24-48 hours
- Re-attempt with lower percentage (e.g., 5%)

### Monitoring After Change

Track these metrics for 1-2 weeks:

1. **Auth Performance**
   - Request latency (should decrease)
   - Error rate (should stay low)
   - Throughput (should increase during peaks)

2. **Database Connections**
   - Total connections vs max (should stay below 80%)
   - Auth connection count (should scale with load)
   - Connection wait events (should decrease)

3. **Set Alerts**
   - Alert when total connections > 80% of max
   - Alert on Auth connection timeout errors
   - Alert when Auth latency > baseline + 2σ

## 2. Database Index Optimization

**Status**: SQL migration file created (see `migrations/001_optimize_battles_indexes.sql`)

**Action Required**: Execute the migration via Supabase Dashboard SQL Editor

**See**: `migrations/README.md` for detailed instructions

## 3. Webhook Configuration (Already Set Up)

**Status**: Application code deployed (this PR)

**Verification**:
- Webhook URL: `https://analytics-wave-warz.vercel.app/api/webhooks/battles`
- Events: `INSERT` and `UPDATE` (on `battles` table)
- Should see dramatically reduced webhook call frequency after deployment

---

## Summary of Manual Steps Required

### Immediate (After Deploying This PR)

1. ✅ Deploy application code (automatic via PR merge)
2. ⏳ **Execute database index migration** (manual, ~2 minutes)
   - Via Supabase Dashboard → SQL Editor
   - Run `migrations/001_optimize_battles_indexes.sql`
   - Verify with validation queries

### Within 1 Week

3. ⏳ **Configure Auth connection pool** (manual, ~5 minutes)
   - Via Supabase Dashboard → Auth → Settings → Advanced
   - Change from fixed 10 to 5-10% percentage-based
   - Monitor for 1-2 weeks

### Ongoing

4. ⏳ **Monitor metrics** (continuous)
   - Webhook call frequency (should be ~2 per battle)
   - Database index usage (dropped indexes should stay at 0 scans)
   - Auth connections and performance (should scale better)
   - Set up alerts as recommended above

---

## Questions or Issues?

If you encounter problems with any of these configurations:

1. **Database Migration Issues**: Check `migrations/README.md` for rollback instructions
2. **Auth Connection Issues**: Start with conservative 5% and increase gradually
3. **Webhook Issues**: Check Vercel logs for webhook responses
4. **Index Issues**: Can rollback via SQL commands in migration file

For Supabase-specific configuration help, consult:
- Supabase Documentation: https://supabase.com/docs
- Supabase Support: https://supabase.com/support
