# Visitor Tracking Feature - Deployment Guide

## What Changed
The visitor tracking and analytics feature has been added to the backend. The following new endpoints are now available:

1. `POST /api/track-visitor` - Tracks visitor data (IP, location, device, browser)
2. `GET /api/admin/visitors/stats` - Returns visitor statistics for admin dashboard
3. `GET /api/admin/visitors/recent` - Returns paginated list of recent visitors

The database schema has also been updated to include a new `visitor_logs` table.

---

## Current Status

### ✅ Code Status
- All code changes have been committed and pushed to GitHub
- Frontend is updated and deployed at https://kessetest.com
- Backend code is updated in the repository

### ⚠️ Deployment Status
- **Frontend**: Already deployed and working
- **Backend**: Needs to be redeployed to activate new visitor tracking endpoints

### Current Errors in Console
```
404 error: /api/track-visitor endpoint not found
```
This is expected because the backend hasn't been redeployed yet with the new code.

---

## How to Deploy

### Option 1: Redeploy via Dokploy Dashboard (Recommended)

1. **Login to Dokploy**
   - Go to your Dokploy dashboard
   - Find your backend application: **usrcaembassyorg-backend**

2. **Trigger Redeploy**
   - Click on the backend application
   - Look for "Redeploy", "Restart", or "Rebuild" button
   - Click it to redeploy with the latest code from GitHub

3. **Wait for Deployment**
   - Watch the build logs
   - Wait for "Server listening on port 4000" message
   - Look for "Database initialized successfully!" message

4. **Verify New Table Created**
   The deployment should automatically create the `visitor_logs` table when the server starts.

### Option 2: Manual Database Update (If Auto-creation Fails)

If the `visitor_logs` table doesn't get created automatically:

1. **Access MySQL Console**
   - In Dokploy, go to your MySQL service
   - Open phpMyAdmin or MySQL console

2. **Run This SQL**
   ```sql
   USE zirhmute_embassy;

   CREATE TABLE IF NOT EXISTS visitor_logs (
     id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
     ip_address VARCHAR(45) NOT NULL,
     country VARCHAR(100),
     city VARCHAR(100),
     region VARCHAR(100),
     user_agent TEXT,
     device_type VARCHAR(50),
     browser VARCHAR(50),
     os VARCHAR(50),
     page_url VARCHAR(500),
     referrer VARCHAR(500),
     session_id VARCHAR(100),
     visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_ip (ip_address),
     INDEX idx_visited (visited_at),
     INDEX idx_session (session_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
   ```

3. **Verify Table Created**
   ```sql
   SHOW TABLES LIKE 'visitor_logs';
   DESC visitor_logs;
   ```

---

## Testing After Deployment

### 1. Test Backend Health
```
https://backend.kessetest.com/api/health
```
**Expected Response:**
```json
{"status":"ok"}
```

### 2. Test Frontend Homepage
- Visit: https://kessetest.com
- Open browser console (F12)
- Look for visitor tracking
- Should NOT see 404 errors anymore

### 3. Test Admin Dashboard
- Login as admin
- Navigate to: https://kessetest.com/admin/visitors
- Should see visitor analytics dashboard with:
  - Total visitors count
  - Unique visitors count
  - Device type breakdown
  - Top countries
  - Browser statistics
  - Recent visitors table

### 4. Verify Data is Being Tracked
After visiting a few pages:
```sql
SELECT COUNT(*) FROM visitor_logs;
SELECT * FROM visitor_logs ORDER BY visited_at DESC LIMIT 10;
```

---

## Rate Limiting Configuration

The new deployment includes improved rate limiting:

- **General API**: 300 requests per 15 minutes (increased from 100)
- **Visitor Tracking**: 10 requests per minute per IP (dedicated limiter)
- **Auth Endpoints**: 5 attempts per 15 minutes (unchanged)

These limits should handle normal traffic without issues.

---

## Troubleshooting

### Issue: Still seeing 404 errors after redeploy

**Solution:**
1. Check deployment logs for errors
2. Verify the git commit is up to date:
   ```bash
   git log --oneline -5
   ```
   Should show: "Add comprehensive visitor tracking and analytics system"

3. Force rebuild in Dokploy (not just restart)

### Issue: 500 errors instead of 404

**Solution:**
This means the endpoint exists but there's a database error.
- Check if `visitor_logs` table exists
- Run manual SQL creation from Option 2 above

### Issue: "visitor_logs doesn't exist" error

**Solution:**
1. Backend started before table was created
2. Run manual SQL creation (see Option 2)
3. Restart backend after table creation

### Issue: Geolocation not working (all countries show NULL)

**Expected Behavior:**
- The ipapi.co free API may have rate limits
- NULL country is normal for local IPs (127.0.0.1, localhost)
- NULL country is normal if API rate limit is exceeded

**Not Critical:** The feature works fine without geolocation data.

---

## Environment Variables (No Changes Needed)

The visitor tracking feature uses existing environment variables:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - Already configured
- `NODE_ENV=production` - Enables rate limiting

**No new environment variables needed!**

---

## What You'll See After Deployment

### Admin Dashboard - New "Visitors" Section
- Accessible at `/admin/visitors`
- Shows real-time visitor analytics
- Auto-refreshes every 2 minutes

### Statistics Displayed:
- **Total Visitors**: All-time visitor count
- **Unique Visitors**: Count by unique IP addresses
- **Today's Visitors**: Last 24 hours
- **Device Breakdown**: Desktop vs Mobile vs Tablet
- **Top 10 Countries**: Most visitors by location
- **Browser Stats**: Chrome, Safari, Firefox, etc.
- **Recent Visitors Table**: Last 50 visitors with full details

---

## Quick Deployment Checklist

- [ ] Login to Dokploy dashboard
- [ ] Navigate to backend application
- [ ] Click "Redeploy" or "Rebuild"
- [ ] Wait for build to complete
- [ ] Check logs for "Database initialized successfully!"
- [ ] Test backend health endpoint
- [ ] Visit frontend homepage (check console for errors)
- [ ] Login as admin and visit `/admin/visitors`
- [ ] Verify visitor data is being collected

---

**Backend URL:** https://backend.kessetest.com
**Frontend URL:** https://kessetest.com
**Admin Visitors Page:** https://kessetest.com/admin/visitors

**Deployment Time:** ~3-5 minutes
**Downtime:** ~30 seconds during restart
