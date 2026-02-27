# Dokploy Setup - Step by Step Guide

## Current Issue
**Backend URL:** https://usrcaembassyorg-backend-lj9ktg-ae1efa-72-62-164-26.traefik.me/
**Status:** Bad Gateway (502 error)
**Cause:** Backend cannot connect to database - environment variables not configured

## Deployment Logs Show:
```
DB init error: Error: connect ECONNREFUSED 127.0.0.1:3306
```
This means it's trying to connect to localhost instead of your MySQL service.

---

## STEP 1: Access Environment Variables in Dokploy

1. Login to your Dokploy dashboard
2. Find your backend application: **usrcaembassyorg-backend** (or similar name)
3. Click on the application to open its details
4. Look for one of these tabs/sections:
   - **Environment** or **Environment Variables**
   - **Settings** → **Environment Variables**
   - **Configuration** → **Environment**

---

## STEP 2: Add Environment Variables

In the environment variables section, add each of these variables one by one:

### Database Configuration (CRITICAL)
```
Variable Name: DB_HOST
Value: usrcaembassyorg-zirhmuteembassy-pvq7ig
```

```
Variable Name: DB_USER
Value: root
```

```
Variable Name: DB_PASSWORD
Value: Admin
```

```
Variable Name: DB_NAME
Value: zirhmute_embassy
```

```
Variable Name: DB_PORT
Value: 3306
```

### Server Configuration
```
Variable Name: PORT
Value: 4000
```

```
Variable Name: FRONTEND_URL
Value: https://usrcaembassy.org
```

```
Variable Name: NODE_ENV
Value: production
```

### JWT Configuration

**FIRST - Generate a secure secret:**
On your computer, open terminal/command prompt and run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (it will be a long random string like: `a1b2c3d4e5f6a7b8c9d0e1f2...`)

**THEN - Add it to Dokploy:**
```
Variable Name: JWT_SECRET
Value: <paste the generated secret here>
```

```
Variable Name: JWT_EXPIRES_IN
Value: 7d
```

### Email Configuration (Hostinger SMTP)
```
Variable Name: SMTP_HOST
Value: smtp.hostinger.com
```

```
Variable Name: SMTP_PORT
Value: 465
```

```
Variable Name: SMTP_USER
Value: info@mailkessedesk.com
```

```
Variable Name: SMTP_PASS
Value: Sherley2016@
```

```
Variable Name: CONTACT_TO
Value: jovite@usrcaembassy.org
```

```
Variable Name: CONTACT_FROM
Value: info@mailkessedesk.com
```

---

## STEP 3: Save and Redeploy

1. **Save** the environment variables (look for a "Save" or "Update" button)
2. **Redeploy** the application:
   - Look for "Redeploy", "Restart", or "Rebuild" button
   - Click it to restart the backend with new environment variables

---

## STEP 4: Check Deployment Logs

After redeploying, check the logs. You should see:

### ✅ SUCCESS - Look for these lines:
```
Server listening on port 4000
Database initialized successfully!
```

### ❌ FAILURE - If you still see this:
```
DB init error: Error: connect ECONNREFUSED 127.0.0.1:3306
```
**Problem:** Environment variables were not applied
**Solution:**
- Make sure you clicked "Save" after adding variables
- Try removing and re-adding the variables
- Make sure there are no extra spaces in the variable names or values

---

## STEP 5: Test the Backend

Once deployment succeeds, test these URLs:

### Health Check:
```
https://usrcaembassyorg-backend-lj9ktg-ae1efa-72-62-164-26.traefik.me/api/health
```
**Expected Response:**
```json
{"success":true,"message":"Server is running"}
```

### Root URL:
```
https://usrcaembassyorg-backend-lj9ktg-ae1efa-72-62-164-26.traefik.me/
```
**Expected:** Should NOT show "Bad Gateway" anymore (might show "Cannot GET /" which is fine)

---

## Quick Copy-Paste for Dokploy

If Dokploy allows bulk import of environment variables, use this format:

```env
DB_HOST=usrcaembassyorg-zirhmuteembassy-pvq7ig
DB_USER=root
DB_PASSWORD=Admin
DB_NAME=zirhmute_embassy
DB_PORT=3306
PORT=4000
FRONTEND_URL=https://usrcaembassy.org
NODE_ENV=production
JWT_SECRET=GENERATE_AND_REPLACE_THIS_WITH_SECURE_RANDOM_STRING
JWT_EXPIRES_IN=7d
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=info@mailkessedesk.com
SMTP_PASS=Sherley2016@
CONTACT_TO=jovite@usrcaembassy.org
CONTACT_FROM=info@mailkessedesk.com
```

**IMPORTANT:** Replace `JWT_SECRET` value with the output from:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Troubleshooting

### Issue: Still getting "Bad Gateway" after adding variables

**Check:**
1. Did you click "Save" after adding variables?
2. Did you click "Redeploy" or "Restart"?
3. Are the variable names exactly as shown (no typos, no extra spaces)?
4. Check the deployment logs for error messages

### Issue: "Access denied for user 'root'@'...' to database"

**Check:**
- DB_PASSWORD is exactly: `Admin` (capital A)
- DB_USER is exactly: `root`
- Your MySQL service is running in Dokploy

### Issue: "Unknown database 'zirhmute_embassy'"

**Solution:**
The database should be created automatically. If not:
1. Go to your MySQL service in Dokploy
2. Access phpMyAdmin or MySQL console
3. Create the database: `CREATE DATABASE zirhmute_embassy;`

---

## Next Steps After Backend Works

Once the backend is running successfully:

1. ✅ Test signup/login from frontend
2. ✅ Test submitting an application
3. ✅ Add SendGrid API key for email notifications
4. ✅ Test admin functions

---

**Your Backend URL:** https://usrcaembassyorg-backend-lj9ktg-ae1efa-72-62-164-26.traefik.me/
**Your Frontend URL:** https://usrcaembassy.org/
**Database Host:** usrcaembassyorg-zirhmuteembassy-pvq7ig

The environment variables listed above will allow your backend to connect to the database and accept requests from your frontend!
