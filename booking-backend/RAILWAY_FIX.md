# Railway Deployment Fix

If you're getting "Unable to access jarfile target/booking-0.0.1-SNAPSHOT.jar", follow these steps:

## Solution 1: Use Docker (Recommended) ✅

Railway works best with Docker. Use this method:

### Step 1: Configure Railway to Use Docker

1. In Railway dashboard, go to your service
2. Go to **Settings** → **Deploy**
3. Set **Root Directory** to: `booking-backend`
4. Set **Dockerfile Path** to: `booking-backend/Dockerfile`
5. Railway will automatically use the Dockerfile

### Step 2: Deploy

Railway will:
- Build the Docker image
- Run the container
- Everything will work automatically!

---

## Solution 2: Fix NIXPACKS Build

If you want to use NIXPACKS (auto-detection):

### Step 1: Verify Root Directory

1. In Railway dashboard → Your service → **Settings**
2. Make sure **Root Directory** is set to: `booking-backend`
3. If it's empty or set to `.`, change it to `booking-backend`

### Step 2: Set Build Command

1. Go to **Variables** tab
2. Add environment variable:
   - **Name**: `RAILWAY_BUILD_COMMAND`
   - **Value**: `mvn clean package -DskipTests`

### Step 3: Verify Start Command

1. Go to **Settings** → **Deploy**
2. Make sure **Start Command** is:
   ```
   java -jar target/booking-0.0.1-SNAPSHOT.jar --spring.profiles.active=staging
   ```

### Step 4: Redeploy

Click **Redeploy** in Railway dashboard.

---

## Solution 3: Manual Build Command

If the above doesn't work, try this:

### Update Start Command

In Railway → Settings → Deploy → Start Command, use:

```bash
cd booking-backend && mvn clean package -DskipTests && java -jar target/booking-0.0.1-SNAPSHOT.jar --spring.profiles.active=staging
```

**Note**: This is slower but ensures the build happens.

---

## Quick Checklist

- [ ] Root Directory is set to `booking-backend`
- [ ] Build command runs successfully (check Railway logs)
- [ ] JAR file exists after build (check logs for "BUILD SUCCESS")
- [ ] Start command points to correct JAR path
- [ ] Environment variables are set correctly

---

## Recommended: Use Docker

**Best approach**: Use Docker deployment on Railway:

1. Railway → Service → Settings → Deploy
2. Set **Dockerfile Path**: `booking-backend/Dockerfile`
3. Set **Root Directory**: `booking-backend`
4. Deploy

This is the most reliable method and matches your local Docker build that worked!

---

## Debug Steps

If still having issues:

1. **Check Build Logs**:
   - Railway → Deployments → Click latest deployment
   - Look for "BUILD SUCCESS" message
   - Check if JAR file is created

2. **Check File Structure**:
   - Railway should see: `booking-backend/pom.xml`
   - After build: `booking-backend/target/booking-0.0.1-SNAPSHOT.jar`

3. **Verify Java Version**:
   - Railway should auto-detect Java 21 from your pom.xml
   - Check logs for Java version

4. **Test Locally First**:
   ```bash
   cd booking-backend
   mvn clean package -DskipTests
   ls -la target/booking-0.0.1-SNAPSHOT.jar
   ```
   If this works locally, Railway should work too.

---

## Still Having Issues?

Try this alternative start command that builds and runs:

```bash
mvn clean package -DskipTests && java -jar target/booking-0.0.1-SNAPSHOT.jar --spring.profiles.active=staging
```

This ensures the build happens every time before starting.

