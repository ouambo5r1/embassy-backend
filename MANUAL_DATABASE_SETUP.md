# Manual Database Setup - Visitor Tracking

## Quick Setup Guide

Follow these steps to manually add the visitor tracking table to your database.

---

## Step 1: Access Your Database

### Option A: Using phpMyAdmin in Dokploy

1. Go to your Dokploy dashboard
2. Find your MySQL service: **usrcaembassyorg-zirhmuteembassy-pvq7ig**
3. Look for "phpMyAdmin" or "Database Console" button
4. Click to open phpMyAdmin

### Option B: Using MySQL Console

If you have direct MySQL access, connect with:
```bash
mysql -h usrcaembassyorg-zirhmuteembassy-pvq7ig -u root -p
# Password: Admin
```

---

## Step 2: Select Your Database

In phpMyAdmin:
1. On the left sidebar, click on **zirhmute_embassy**
2. Click the "SQL" tab at the top

OR in MySQL console:
```sql
USE zirhmute_embassy;
```

---

## Step 3: Run the SQL Script

Copy and paste this ENTIRE script into the SQL query box:

```sql
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

Click **"Go"** or **"Execute"** button.

---

## Step 4: Verify Table Creation

Run this query to check if the table exists:

```sql
SHOW TABLES LIKE 'visitor_logs';
```

**Expected Result:** Should show 1 row with "visitor_logs"

Then check the table structure:

```sql
DESC visitor_logs;
```

**Expected Result:** Should show 13 columns:
- id
- ip_address
- country
- city
- region
- user_agent
- device_type
- browser
- os
- page_url
- referrer
- session_id
- visited_at

---

## Step 5: Redeploy Backend

After creating the table:

1. Go back to Dokploy dashboard
2. Find your backend application
3. Click **"Redeploy"** or **"Restart"**
4. Wait for deployment to complete

---

## Step 6: Test the Feature

### Test 1: Visit Your Website
1. Go to https://kessetest.com
2. Open browser console (F12)
3. Should NOT see any 404 errors for `/api/track-visitor`

### Test 2: Check Database
Run this query to see if visitors are being tracked:

```sql
SELECT COUNT(*) as total_visitors FROM visitor_logs;
```

Should return a number > 0 after visiting the website.

### Test 3: View Recent Visitors
```sql
SELECT
  ip_address,
  country,
  city,
  device_type,
  browser,
  visited_at
FROM visitor_logs
ORDER BY visited_at DESC
LIMIT 10;
```

Should show your recent visits.

### Test 4: Admin Dashboard
1. Login as admin at https://kessetest.com/signin
2. Navigate to https://kessetest.com/admin/visitors
3. Should see visitor analytics dashboard with statistics

---

## Troubleshooting

### Issue: "Table 'visitor_logs' already exists"
**Solution:** This is fine! The table was created. Continue to Step 5.

### Issue: "Access denied" error
**Solution:**
- Make sure you're using the correct database credentials
- Username: `root`
- Password: `Admin`
- Database: `zirhmute_embassy`

### Issue: Still getting 404 errors after creating table
**Solution:**
1. Make sure you redeployed the backend (Step 5)
2. Check backend logs for any errors
3. Verify the backend is pulling the latest code from GitHub

### Issue: Table created but no data being collected
**Solution:**
1. Check if backend is running: https://backend.kessetest.com/api/health
2. Make sure CORS is configured correctly for your frontend domain
3. Check backend logs for any tracking errors

---

## Verify Everything Works

Run this comprehensive query to see full visitor details:

```sql
SELECT
  id,
  ip_address,
  CONCAT(city, ', ', country) as location,
  device_type,
  browser,
  os,
  page_url,
  DATE_FORMAT(visited_at, '%Y-%m-%d %H:%i:%s') as visit_time
FROM visitor_logs
ORDER BY visited_at DESC
LIMIT 20;
```

If you see data here, everything is working! 🎉

---

## Quick Reference

**Database Name:** zirhmute_embassy
**Table Name:** visitor_logs
**MySQL Host:** usrcaembassyorg-zirhmuteembassy-pvq7ig
**Username:** root
**Password:** Admin

**Frontend URL:** https://kessetest.com
**Backend URL:** https://backend.kessetest.com
**Admin Visitors Page:** https://kessetest.com/admin/visitors

---

## What Gets Tracked

For each visitor, the system tracks:
- ✅ IP Address
- ✅ Country, City, Region (via ipapi.co)
- ✅ Device Type (Desktop/Mobile/Tablet)
- ✅ Browser (Chrome, Safari, Firefox, Edge, IE)
- ✅ Operating System (Windows, macOS, Linux, Android, iOS)
- ✅ Page URL visited
- ✅ Referrer (where they came from)
- ✅ Session ID (unique per visitor session)
- ✅ Visit timestamp

All tracking is automatic and happens in the background!
