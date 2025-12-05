# Railway Deployment Troubleshooting Guide

## Common Errors and Fixes

### Error: "Build failed" or "npm install failed"

**Possible Causes:**
- Missing `package-lock.json`
- Node.js version mismatch
- Network issues during install

**Solutions:**
1. Ensure `package-lock.json` is committed to git
2. Verify Node.js version in `package.json` engines (>=18.0.0)
3. Check Railway logs for specific npm error

### Error: "Cannot find module" or "Module not found"

**Possible Causes:**
- Missing dependencies in `package.json`
- `node_modules` not installed properly

**Solutions:**
1. Run `npm install` locally to verify all dependencies
2. Check `package.json` has all required packages
3. Ensure `package-lock.json` is up to date

### Error: "Port already in use" or "EADDRINUSE"

**Possible Causes:**
- Server not binding to correct host
- PORT environment variable not set

**Solutions:**
1. Server should bind to `0.0.0.0` (already configured)
2. Railway automatically sets `PORT` - don't set manually
3. Check server.js uses `process.env.PORT || 3000`

### Error: "Database connection failed"

**Possible Causes:**
- `DATABASE_URL` not set
- SSL not enabled for Railway PostgreSQL
- Database service not connected

**Solutions:**
1. Ensure PostgreSQL service is added in Railway
2. Verify `DATABASE_URL` is auto-provided by Railway
3. Check database.js enables SSL for Railway (already configured)
4. Set `RAILWAY_SYNC_DB=true` for initial database setup

### Error: "Application failed to respond"

**Possible Causes:**
- Server not starting
- Health check endpoint not working
- Wrong start command

**Solutions:**
1. Check Railway logs for startup errors
2. Verify `/health` endpoint works
3. Ensure `npm start` command is correct (already configured)

### Error: "CORS error" from frontend

**Possible Causes:**
- CORS_ORIGIN not set correctly
- Frontend URL not in allowed origins

**Solutions:**
1. Set `CORS_ORIGIN=*` in Railway environment variables (allows all)
2. Or set specific origins: `CORS_ORIGIN=https://your-frontend.com`
3. Check server.js CORS configuration

## Railway-Specific Issues

### Issue: Build takes too long

**Solution:**
- Railway caches `node_modules` between builds
- First build will be slower
- Subsequent builds should be faster

### Issue: Environment variables not working

**Solution:**
1. Variables must be set in Railway dashboard
2. Redeploy after adding variables
3. Variable names are case-sensitive
4. Check variable names match exactly

### Issue: Database not auto-connecting

**Solution:**
1. Ensure PostgreSQL service is in same project
2. Railway should auto-provide `DATABASE_URL`
3. If not, manually connect services in Railway dashboard
4. Check service settings → Variables tab

## Quick Fixes

### Restart Service
1. Go to Railway dashboard
2. Click on your service
3. Click "Restart" button

### View Logs
1. Go to Railway dashboard
2. Click on your service
3. Click "View Logs" tab
4. Look for error messages

### Redeploy
1. Go to Railway dashboard
2. Click on "Deployments" tab
3. Click "Redeploy" on latest deployment
4. Or push a new commit to trigger auto-deploy

## Verification Checklist

After deployment, verify:

- [ ] Service is running (green status in Railway)
- [ ] Health endpoint works: `https://your-app.up.railway.app/health`
- [ ] Database is connected (check logs for "Database connection established")
- [ ] Environment variables are set
- [ ] CORS is configured
- [ ] Port is correct (Railway auto-sets)

## Getting Help

If issues persist:
1. Check Railway logs for specific errors
2. Verify all environment variables are set
3. Ensure database service is running
4. Check Railway status: https://status.railway.app

