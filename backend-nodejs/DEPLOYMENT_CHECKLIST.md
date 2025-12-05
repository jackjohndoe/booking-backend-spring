# Railway Deployment Checklist

## ✅ Pre-Deployment (Completed)

- [x] `railway.json` created with NIXPACKS builder
- [x] `Procfile` created with start command
- [x] `.railwayignore` created to exclude unnecessary files
- [x] Database config updated for Railway PostgreSQL SSL
- [x] Server.js updated to detect Railway environment
- [x] PORT handling configured (Railway auto-provides)
- [x] Documentation created (RAILWAY_DEPLOYMENT.md, RAILWAY_QUICK_START.md)

## 📋 Deployment Steps

### Step 1: Commit and Push Files
```bash
cd backend-nodejs
git add railway.json Procfile .railwayignore
git add RAILWAY_DEPLOYMENT.md RAILWAY_QUICK_START.md DEPLOYMENT_CHECKLIST.md
git add server.js config/database.js
git commit -m "Add Railway deployment configuration"
git push
```

### Step 2: Create Railway Project
1. Go to https://railway.app
2. Sign in or create account
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Authorize Railway to access your GitHub
6. Select your repository
7. **Important:** Set root directory to `backend-nodejs` (or configure in Railway settings)

### Step 3: Add PostgreSQL Database
1. In Railway project dashboard, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically:
   - Create PostgreSQL database
   - Provide `DATABASE_URL` environment variable
   - Connect it to your backend service

### Step 4: Configure Environment Variables
Go to **Backend Service** → **Settings** → **Variables** and add:

#### Required Variables:
```bash
NODE_ENV=production
JWT_SECRET=aQWnqxOFMerVsdaWO53yt1FbOcY4jlj7ZynZ304S0D4=
FLUTTERWAVE_SECRET_KEY=36LcFItmQiME9FQSAsz7Q8di1CD4u4Pi
FLUTTERWAVE_PUBLIC_KEY=c66f5395-8fba-40f7-bb92-4f7c617e75fa
CORS_ORIGIN=*
```

#### Optional (but recommended):
```bash
JWT_EXPIRATION=86400000
RAILWAY_SYNC_DB=true  # Set to false after initial setup
```

**Note:** Railway automatically provides:
- `PORT` - Don't set manually
- `DATABASE_URL` - Auto-provided when database is connected

### Step 5: Deploy
Railway will automatically:
1. Detect Node.js from `package.json`
2. Run `npm install`
3. Run `npm start` (from Procfile)
4. Expose service on public URL

**Manual Deploy:**
- Go to **Deployments** tab
- Click **"Redeploy"** on latest deployment

### Step 6: Get Railway Domain
1. Go to **Settings** → **Domains**
2. Railway provides a default domain: `your-app-name.up.railway.app`
3. Copy this domain

### Step 7: Update Flutterwave Callback URL
1. Go back to **Settings** → **Variables**
2. Add/Update:
   ```bash
   FLUTTERWAVE_CALLBACK_URL=https://your-app-name.up.railway.app/api/payments/flutterwave/callback
   ```
3. Replace `your-app-name` with your actual Railway domain
4. Redeploy service

### Step 8: Verify Deployment

#### Health Check:
Visit: `https://your-app-name.up.railway.app/health`

Expected response:
```json
{
  "status": "ok",
  "message": "Backend is running",
  "database": "connected",
  "timestamp": "..."
}
```

#### Check Logs:
1. Go to **Deployments** → Latest deployment
2. Click **"View Logs"**
3. Look for:
   - ✅ "Server running on port 3000"
   - ✅ "Database connection established"
   - ✅ "Database synced"
   - ❌ No errors

### Step 9: Update Frontend API URL
Update `src/config/api.js` in your frontend:

```javascript
const getBaseURL = () => {
  if (__DEV__) {
    return 'http://localhost:3000'; // Local development
  }
  // Production: Use Railway URL
  return 'https://your-app-name.up.railway.app';
};
```

## 🔍 Troubleshooting

### Database Not Connecting
- **Check:** Database service is running in Railway
- **Check:** `DATABASE_URL` is set (Railway auto-provides)
- **Check:** Logs for connection errors
- **Fix:** Ensure database is connected to backend service

### Build Fails
- **Check:** Railway logs for specific error
- **Check:** `package.json` is valid
- **Check:** Node.js version compatibility
- **Fix:** Railway auto-detects Node.js version

### CORS Errors
- **Check:** `CORS_ORIGIN=*` is set
- **Check:** Frontend is using correct API URL
- **Fix:** Update CORS_ORIGIN if needed

### Port Issues
- **Note:** Railway automatically sets `PORT`
- **Note:** Server uses `process.env.PORT || 3000`
- **Fix:** No action needed, Railway handles this

## 📊 Post-Deployment

### Monitor
- Check Railway dashboard for:
  - Resource usage
  - Request logs
  - Error tracking
  - Deployment history

### Test Endpoints
- `/health` - Health check
- `/api/auth/register` - User registration
- `/api/auth/login` - User login
- `/api/payments/flutterwave/initialize` - Payment (requires auth)

### Custom Domain (Optional)
1. Go to **Settings** → **Domains**
2. Click **"Custom Domain"**
3. Add your domain
4. Configure DNS as instructed

## ✅ Deployment Complete!

Your backend is now live on Railway! 🚀

**Next Steps:**
1. Test all API endpoints
2. Update frontend to use Railway URL
3. Monitor logs for any issues
4. Set up custom domain (optional)

