# Railway Deployment - Final Fix Required

## 🔍 Root Cause Identified

Railway is looking for `Dockerfile` at repository root, but the file is at `booking-backend/Dockerfile`.

## ✅ Fixes Applied in Code

1. ✅ Updated `railway.json` with `rootDirectory: "booking-backend"`
2. ✅ Set `dockerfilePath: "Dockerfile"` (relative to rootDirectory)
3. ✅ Reverted Dockerfile COPY paths to work with booking-backend context
4. ✅ Fixed Java version to 21

## ⚠️ CRITICAL: Railway UI Settings Must Be Updated

Railway's UI settings may override `railway.json`. You MUST manually verify/update these in Railway Dashboard:

### Step 1: Go to Railway Settings

1. Open: https://railway.com/project/e3419661-3d1b-43c3-84b3-c0d13ea0484a/service/d2bffe41-d9ef-4ebd-b49e-3e42714e9993/settings
2. Click on **"Deploy"** tab/section (scroll down if needed)

### Step 2: Update Root Directory

**CRITICAL**: Find the **"Root Directory"** field and set it to:
```
booking-backend
```

### Step 3: Update Dockerfile Path

Set **"Dockerfile Path"** to:
```
Dockerfile
```
(Without the booking-backend/ prefix, since Root Directory is now booking-backend)

### Step 4: Verify Builder

Ensure **"Builder"** is set to:
```
DOCKERFILE
```
(Not NIXPACKS or NODEJS)

### Step 5: Save and Redeploy

1. Click **Save** (settings auto-save in Railway)
2. Go to **Deployments** tab
3. Click **"Redeploy"** on the latest deployment
4. Or Railway may auto-redeploy after detecting settings changes

## 📋 Alternative: If Railway Doesn't Support rootDirectory in JSON

If Railway doesn't read `rootDirectory` from railway.json (some versions don't), you MUST set it in the UI as described above.

## 🎯 Expected Result After Fix

Once Root Directory is set correctly in Railway UI:
- ✅ Railway will find Dockerfile at `booking-backend/Dockerfile`
- ✅ Build context will be `booking-backend/`
- ✅ Dockerfile COPY commands will work
- ✅ Maven build will succeed
- ✅ Application will deploy successfully

## 🚨 If Still Failing

If you still get "Dockerfile does not exist" after setting Root Directory in UI:
1. Double-check Root Directory spelling: `booking-backend` (exact match, case-sensitive)
2. Verify the Dockerfile exists in git: `git ls-files | grep Dockerfile`
3. Check Railway logs for more specific error messages
4. Try redeploying after saving settings

