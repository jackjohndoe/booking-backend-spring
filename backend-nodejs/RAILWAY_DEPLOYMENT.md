# Railway Deployment Guide for Node.js Backend

This guide will help you deploy the Node.js backend to Railway.

## Prerequisites

1. Railway account (sign up at https://railway.app)
2. GitHub repository with your backend code
3. Railway CLI (optional, for easier management)

## Step 1: Create New Project on Railway

1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Select the `backend-nodejs` directory (or root if backend is at root)

## Step 2: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically create and configure PostgreSQL
4. Note: Railway automatically provides connection variables

## Step 3: Configure Environment Variables

Go to your **backend service** → **Settings** → **Variables** and add:

### Required Variables

```bash
# Node Environment
NODE_ENV=production

# Server Port (Railway provides this automatically, but you can set it)
PORT=3000

# Database Connection (Railway provides these automatically)
# If DATABASE_URL is provided, use it. Otherwise use individual variables:
DATABASE_URL=${DATABASE_URL}  # Railway auto-provides this when database is connected
# OR use individual variables:
# PGHOST=${PGHOST}
# PGPORT=${PGPORT}
# PGUSER=${PGUSER}
# PGPASSWORD=${PGPASSWORD}
# PGDATABASE=${PGDATABASE}

# JWT Configuration
JWT_SECRET=aQWnqxOFMerVsdaWO53yt1FbOcY4jlj7ZynZ304S0D4=
JWT_EXPIRATION=86400000

# CORS Configuration
CORS_ORIGIN=*

# Flutterwave Configuration
FLUTTERWAVE_SECRET_KEY=36LcFItmQiME9FQSAsz7Q8di1CD4u4Pi
FLUTTERWAVE_PUBLIC_KEY=c66f5395-8fba-40f7-bb92-4f7c617e75fa
FLUTTERWAVE_CALLBACK_URL=https://your-app-name.up.railway.app/api/payments/flutterwave/callback

# Paystack Configuration (if using)
PAYSTACK_SECRET_KEY=your-paystack-secret-key
PAYSTACK_PUBLIC_KEY=your-paystack-public-key
```

### Database Configuration

Railway automatically provides `DATABASE_URL` when you connect a PostgreSQL database. The backend will use this automatically.

If you need to use individual variables, update `backend-nodejs/config/database.js` to handle both formats.

## Step 4: Update Flutterwave Callback URL

1. Go to **Settings** → **Domains** in Railway
2. Copy your Railway domain (e.g., `booking-backend-staging.up.railway.app`)
3. Update `FLUTTERWAVE_CALLBACK_URL` to:
   ```
   https://your-actual-domain.up.railway.app/api/payments/flutterwave/callback
   ```

## Step 5: Deploy

Railway will automatically:
1. Detect Node.js from `package.json`
2. Run `npm install`
3. Run `npm start` (as defined in `package.json`)
4. Expose the service on a public URL

### Manual Deploy

If auto-deploy doesn't work:
1. Go to **Deployments** tab
2. Click **"Redeploy"**
3. Or push a new commit to trigger deployment

## Step 6: Verify Deployment

### Check Health Endpoint

Visit: `https://your-app.up.railway.app/health`

Should return:
```json
{
  "status": "ok",
  "message": "Backend is running",
  "database": "connected",
  "timestamp": "..."
}
```

### Check Logs

1. Go to **Deployments** → Latest deployment
2. Click **"View Logs"**
3. Look for:
   - ✅ "Server running on port 3000"
   - ✅ "Database connection established"
   - ✅ "Database synced"
   - ❌ No errors

## Step 7: Update Frontend API URL

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

## Common Issues & Fixes

### Issue: Database Connection Error

**Error**: "Connection refused" or "Database not found"

**Solution**:
1. Verify PostgreSQL service is running in Railway
2. Check that database is connected to backend service
3. Verify `DATABASE_URL` is set (Railway auto-provides this)
4. Check logs for connection errors

### Issue: Port Already in Use

**Error**: "Port 3000 already in use"

**Solution**:
- Railway automatically sets `PORT` environment variable
- The server uses `process.env.PORT || 3000` which handles this
- No action needed

### Issue: Build Fails

**Error**: "npm install failed" or "Build error"

**Solution**:
1. Check `package.json` is valid
2. Verify all dependencies are listed
3. Check Railway logs for specific error
4. Ensure Node.js version is compatible (Railway auto-detects)

### Issue: CORS Errors

**Error**: Frontend can't connect to API

**Solution**:
1. Verify `CORS_ORIGIN=*` is set (allows all origins)
2. For production, you can restrict:
   ```
   CORS_ORIGIN=https://your-frontend-domain.com,https://your-app.expo.dev
   ```
3. Check backend logs for CORS errors

### Issue: Environment Variables Not Working

**Error**: Variables not being read

**Solution**:
1. Verify variables are set in Railway dashboard
2. Redeploy after adding variables
3. Check variable names match exactly (case-sensitive)
4. Restart service after variable changes

## Railway-Specific Features

### Automatic HTTPS

Railway provides HTTPS automatically. Your app will be accessible at:
- `https://your-app-name.up.railway.app`

### Custom Domain

1. Go to **Settings** → **Domains**
2. Click **"Custom Domain"**
3. Add your domain
4. Follow DNS configuration instructions

### Monitoring

Railway provides:
- Real-time logs
- Deployment history
- Resource usage metrics
- Error tracking

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Node environment |
| `PORT` | No | `3000` | Server port (Railway auto-sets) |
| `DATABASE_URL` | Yes* | - | PostgreSQL connection string (Railway auto-provides) |
| `JWT_SECRET` | Yes | - | JWT signing secret |
| `JWT_EXPIRATION` | No | `86400000` | Token expiration (ms) |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origins |
| `FLUTTERWAVE_SECRET_KEY` | Yes | - | Flutterwave secret key |
| `FLUTTERWAVE_PUBLIC_KEY` | Yes | - | Flutterwave public key |
| `FLUTTERWAVE_CALLBACK_URL` | Yes | - | Flutterwave webhook URL |

*Required if using database features

## Quick Deployment Checklist

- [ ] Railway project created
- [ ] GitHub repository connected
- [ ] PostgreSQL database added
- [ ] Database connected to backend service
- [ ] Environment variables set:
  - [ ] `JWT_SECRET`
  - [ ] `FLUTTERWAVE_SECRET_KEY`
  - [ ] `FLUTTERWAVE_PUBLIC_KEY`
  - [ ] `FLUTTERWAVE_CALLBACK_URL` (with Railway domain)
- [ ] Service deployed successfully
- [ ] Health endpoint works (`/health`)
- [ ] Frontend API URL updated
- [ ] Tested authentication endpoints
- [ ] Tested payment endpoints

## Support

If you encounter issues:
1. Check Railway logs for errors
2. Verify all environment variables are set
3. Ensure database is connected
4. Check Railway status page: https://status.railway.app

Your backend is now deployed and ready! 🚀

