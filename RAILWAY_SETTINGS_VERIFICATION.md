# Railway Settings Verification & Fix Guide

## ✅ Code Fixes Completed

1. ✅ Fixed Java version in `pom.xml` (17 → 21)
2. ✅ Fixed `railway.json` dockerfilePath (`booking-backend/Dockerfile` → `Dockerfile`)
3. ✅ Changes committed and pushed to GitHub

## 🔍 Critical Railway Settings to Verify

You MUST verify these settings in Railway Dashboard:

### Step 1: Go to Railway Settings

1. Open: https://railway.com/project/e3419661-3d1b-43c3-84b3-c0d13ea0484a/service/d2bffe41-d9ef-4ebd-b49e-3e42714e9993/settings
2. Click on **"Deploy"** tab/section

### Step 2: Verify Root Directory

**CRITICAL**: The **Root Directory** field must be set correctly:

- **If your repository root contains `booking-backend/` folder:**
  - Set Root Directory to: `booking-backend`
  
- **If your repository root IS the booking-backend code (no subfolder):**
  - Set Root Directory to: `.` (or leave blank)

**How to check:**
- Look at your git repository structure
- If you see `booking-backend/pom.xml` in the repo root, use: `booking-backend`
- If you see `pom.xml` directly in the repo root, use: `.` (blank)

### Step 3: Verify Builder

- **Builder** should be: `DOCKERFILE`
- NOT: `NIXPACKS` or `NODEJS`

### Step 4: Verify Dockerfile Path

- **Dockerfile Path** should be: `Dockerfile`
- This is correct when Root Directory is set properly

### Step 5: Verify Start Command (Optional)

- Can be empty (Railway will use Dockerfile CMD)
- OR set to: `java -jar booking-0.0.1-SNAPSHOT.jar --spring.profiles.active=staging`

## 📋 Complete Verification Checklist

- [ ] Root Directory is set correctly (see Step 2)
- [ ] Builder is set to `DOCKERFILE`
- [ ] Dockerfile Path is `Dockerfile`
- [ ] Start Command is either empty or the java command above
- [ ] Service has been redeployed after making changes

## 🔧 How to Fix Settings

1. Go to Railway Dashboard → booking-backend service → Settings → Deploy tab
2. Update Root Directory (if needed)
3. Update Builder to `DOCKERFILE` (if needed)
4. Update Dockerfile Path to `Dockerfile` (if needed)
5. Click **Save** or the settings auto-save
6. Go to Deployments tab and click **Redeploy**

## 🐛 Common Issues

### Issue: Build fails with "Dockerfile not found"
**Solution**: Check Root Directory setting - it's likely wrong

### Issue: Build fails with "pom.xml not found"
**Solution**: Root Directory is incorrect - Railway can't find the pom.xml

### Issue: Build uses Node.js instead of Docker
**Solution**: Builder is set to NIXPACKS - change to DOCKERFILE

### Issue: Maven build fails
**Possible causes:**
- Root Directory is wrong, so files aren't being copied correctly
- Maven dependencies issue (check build logs)
- Network timeout during dependency download

## 🚀 After Fixing Settings

1. Redeploy the service
2. Monitor the build logs
3. Look for "BUILD SUCCESS" in Maven output
4. Verify the application starts successfully

## 📝 Current Repository Structure

Based on git remote `booking-backend-spring.git`, the repository likely has:
- `pom.xml` at root
- `Dockerfile` at root
- `src/` directory at root

**Therefore, Root Directory should probably be:** `.` (blank/root)

But verify this in your Railway settings!





