# Railway Docker Deployment Fix

If you're getting "Unable to access jarfile" error with Docker on Railway, follow these steps:

## ✅ Solution: Update Railway Settings

### Step 1: Remove Start Command Override

Railway might be overriding the Dockerfile's CMD. Do this:

1. **Go to Railway Dashboard** → Your Service
2. **Settings** → **Deploy** tab
3. **Clear/Remove the Start Command** field (leave it empty)
4. Railway will use the Dockerfile's CMD instead

### Step 2: Verify Dockerfile Path

1. **Settings** → **Deploy**
2. Make sure **Dockerfile Path** is set to:
   - `Dockerfile` (if root directory is `booking-backend`)
   - OR `booking-backend/Dockerfile` (if root is `.`)

### Step 3: Verify Root Directory

1. **Settings** → **Deploy**
2. **Root Directory** should be: `booking-backend`

### Step 4: Redeploy

Click **Redeploy** in Railway dashboard.

---

## Alternative: Use Start Command (If Needed)

If Railway still requires a start command, use this:

1. **Settings** → **Deploy** → **Start Command**
2. Set to:
   ```
   java -jar booking-0.0.1-SNAPSHOT.jar --spring.profiles.active=staging
   ```
   (Note: No `target/` prefix - the JAR is in the root of the container)

---

## Verify Docker Build

Check Railway build logs to ensure:

1. ✅ Docker build completes successfully
2. ✅ JAR file is copied correctly
3. ✅ No errors during build

Look for these in the logs:
```
[INFO] BUILD SUCCESS
COPY --from=build /app/target/booking-0.0.1-SNAPSHOT.jar booking-0.0.1-SNAPSHOT.jar
```

---

## Quick Checklist

- [ ] Root Directory: `booking-backend`
- [ ] Dockerfile Path: `Dockerfile` or `booking-backend/Dockerfile`
- [ ] Start Command: Either empty OR `java -jar booking-0.0.1-SNAPSHOT.jar --spring.profiles.active=staging`
- [ ] Builder: Set to `DOCKERFILE` (not NIXPACKS)
- [ ] Redeployed after changes

---

## Still Not Working?

### Option 1: Check Build Logs

1. Railway → Deployments → Latest deployment
2. Check if Docker build succeeded
3. Look for errors in the build process

### Option 2: Test Dockerfile Locally

```bash
cd booking-backend
docker build -t test-booking .
docker run -p 8080:8080 test-booking
```

If this works locally, Railway should work too.

### Option 3: Use Railway's Dockerfile Detection

1. Remove `railway.json` temporarily
2. Railway should auto-detect the Dockerfile
3. Deploy and see if it works

---

## Updated Files

I've updated:
- ✅ `Dockerfile` - Changed JAR name to match Railway expectations
- ✅ `railway.json` - Updated for Docker builder

The key change: The JAR is now named `booking-0.0.1-SNAPSHOT.jar` (not `app.jar`) to match what Railway expects.

