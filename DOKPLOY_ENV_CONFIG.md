# Dokploy Environment Variables Configuration

## Critical: Database Connection Error Fix

Your deployment logs show:
```
DB init error: Error: connect ECONNREFUSED 127.0.0.1:3306
```

This means the backend is using default values (localhost) instead of your Dokploy MySQL service. You MUST configure these environment variables in Dokploy.

## Step-by-Step: Configure Environment Variables in Dokploy

1. **Go to your Dokploy dashboard**
2. **Select your backend application** (embassy-backend)
3. **Click on "Environment Variables" or "Settings" tab**
4. **Add the following environment variables** (click "Add Variable" for each):

---

### Required Environment Variables

#### 1. Database Configuration (CRITICAL - Must Match Your MySQL Service)

```
DB_HOST=usrcaembassyorg-zirhmuteembassy-pvq7ig
```
*(This is your MySQL service internal hostname)*

```
DB_USER=root
```

```
DB_PASSWORD=Admin
```

```
DB_NAME=zirhmute_embassy
```

```
DB_PORT=3306
```

#### 2. Server Configuration

```
PORT=4000
```

```
FRONTEND_URL=https://kessetest.com
```

```
NODE_ENV=production
```

#### 3. JWT Configuration (CRITICAL - Generate Secure Secret)

**First, generate a secure JWT secret:**
Open your terminal and run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Then add it as:**
```
JWT_SECRET=<paste-the-generated-secret-here>
```

Example (DO NOT use this exact value - generate your own):
```
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

```
JWT_EXPIRES_IN=7d
```

#### 4. Email Configuration (Optional but Recommended)

```
SENDGRID_API_KEY=<your-sendgrid-api-key>
```
*(Get this from your SendGrid account: https://app.sendgrid.com/settings/api_keys)*

```
CONTACT_TO=ouambo5r@yahoo.fr
```

```
CONTACT_FROM=no-reply@usrcaembassy.org
```

---

## Quick Copy-Paste Format for Dokploy

If Dokploy supports bulk environment variable input, use this format:

```env
DB_HOST=usrcaembassyorg-zirhmuteembassy-pvq7ig
DB_USER=root
DB_PASSWORD=Admin
DB_NAME=zirhmute_embassy
DB_PORT=3306
PORT=4000
FRONTEND_URL=https://kessetest.com
NODE_ENV=production
JWT_SECRET=GENERATE_YOUR_OWN_SECRET_HERE
JWT_EXPIRES_IN=7d
SENDGRID_API_KEY=your-sendgrid-api-key-here
CONTACT_TO=ouambo5r@yahoo.fr
CONTACT_FROM=no-reply@usrcaembassy.org
```

---

## After Adding Environment Variables

1. **Save the configuration**
2. **Redeploy the application** (click "Redeploy" or "Restart")
3. **Check deployment logs** - you should see:
   ```
   Server listening on port 4000
   Database initialized successfully!
   ```

4. **Test the backend** by visiting:
   ```
   https://your-backend-url/api/health
   ```

   You should get a response like:
   ```json
   {"success":true,"message":"Server is running"}
   ```

---

## Troubleshooting

### If you still see "ECONNREFUSED 127.0.0.1:3306"
- The environment variables are not being applied
- Make sure you saved the configuration and redeployed
- Try deleting and recreating the environment variables

### If you see "Access denied for user"
- Check DB_PASSWORD is exactly: `Admin`
- Check DB_USER is exactly: `root`
- Verify the MySQL service is running in Dokploy

### If you see "Unknown database"
- The database `zirhmute_embassy` needs to exist
- Check your MySQL service in Dokploy
- The backend will try to create it automatically if the user has permissions

---

## Security Notes

⚠️ **IMPORTANT**:
- Never commit the actual JWT_SECRET to GitHub
- Keep the .env.example file with placeholder values only
- Configure real secrets only in Dokploy's environment variables
- Use a strong, randomly generated JWT_SECRET (minimum 32 characters)

---

## Current Status

✅ Backend code is correct and deployed to GitHub
✅ package.json has correct dependencies
✅ Database schema is ready
❌ Environment variables need to be configured in Dokploy
❌ JWT_SECRET needs to be generated and added

Once you add these environment variables and redeploy, the "Bad Gateway" error should be resolved!
