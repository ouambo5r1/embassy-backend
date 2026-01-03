# Database Tables Fix - IMPORTANT

## Issue Fixed

The backend was returning **500 Internal Server Error** for:
- `/api/marriage-applications/user/...`
- `/api/birth-certificate-applications/user/...`
- `/api/travel-pass-applications/user/...`

**Cause:** These database tables were missing from the initialization script.

## What Was Done

Updated [db.js](db.js) to include CREATE TABLE statements for:
- ✅ `birth_certificate_applications`
- ✅ `marriage_applications`
- ✅ `travel_pass_applications`

## What You Need to Do

The backend needs to be **restarted** for the new tables to be created.

### Option 1: Redeploy in Dokploy (Recommended)

1. **Go to Dokploy Dashboard**
2. **Select your backend application** (usrcaembassyorg-backend)
3. **Click "Redeploy" or "Restart"**
4. **Wait for deployment to complete**

The new database initialization will run on startup and create the missing tables.

### Option 2: Manually Create Tables (If you have database access)

If you have direct access to the MySQL database, you can create the tables manually using the SQL from `db/mysql/schema.sql`:

```sql
USE zirhmute_embassy;

-- Run the CREATE TABLE statements for:
-- - birth_certificate_applications
-- - marriage_applications
-- - travel_pass_applications
```

But **Option 1 is much easier** - just redeploy the backend!

## Verification

After redeploying, the backend will:
1. Connect to the database
2. Create all missing tables automatically
3. Start accepting requests for all application types

Test by visiting your frontend and checking if the 500 errors are gone.

## Current Status

- ✅ Code fix committed and pushed to GitHub
- ❌ Backend needs redeploy in Dokploy
- ❌ Database tables need to be created

Once you redeploy, all application types will work correctly!
