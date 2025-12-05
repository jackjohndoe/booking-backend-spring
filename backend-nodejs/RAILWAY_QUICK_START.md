# Railway Quick Start Guide

## 🚀 Deploy in 5 Minutes

### Step 1: Create Railway Project
1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Select `backend-nodejs` as the root directory (or configure it)

### Step 2: Add Database
1. In Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway auto-configures everything ✅

### Step 3: Set Environment Variables
Go to **Backend Service** → **Settings** → **Variables**:

**Required:**
```bash
JWT_SECRET=aQWnqxOFMerVsdaWO53yt1FbOcY4jlj7ZynZ304S0D4=
FLUTTERWAVE_SECRET_KEY=36LcFItmQiME9FQSAsz7Q8di1CD4u4Pi
FLUTTERWAVE_PUBLIC_KEY=c66f5395-8fba-40f7-bb92-4f7c617e75fa
NODE_ENV=production
```

**After getting your Railway domain, add:**
```bash
FLUTTERWAVE_CALLBACK_URL=https://your-app-name.up.railway.app/api/payments/flutterwave/callback
```

**Note:** Railway automatically provides:
- `PORT` (don't set manually)
- `DATABASE_URL` (when database is connected)

### Step 4: Deploy
Railway auto-deploys on push, or:
1. Go to **Deployments**
2. Click **"Redeploy"**

### Step 5: Verify
Visit: `https://your-app.up.railway.app/health`

Should return:
```json
{"status":"ok","message":"Backend is running","database":"connected"}
```

## ✅ That's it! Your backend is live!

## Common Issues

**Database not connecting?**
- Check database service is running
- Verify `DATABASE_URL` is set (Railway auto-provides)

**Build fails?**
- Check Railway logs
- Verify `package.json` is valid
- Ensure Node.js version is compatible

**CORS errors?**
- Set `CORS_ORIGIN=*` in environment variables

For detailed guide, see `RAILWAY_DEPLOYMENT.md`

