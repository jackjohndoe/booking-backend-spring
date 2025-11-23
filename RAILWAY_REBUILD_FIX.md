# Fix "No Main Manifest Attribute" Error on Railway

If you're still getting this error after the fix, Railway might be using a cached build. Here's how to force a clean rebuild:

## Solution: Force Clean Rebuild on Railway

### Step 1: Clear Railway Build Cache

1. **Railway Dashboard** → Your Backend Service
2. Go to **Settings** → **Deploy**
3. Look for **"Clear Build Cache"** or **"Rebuild"** option
4. Click it to force a fresh build

### Step 2: Trigger New Deployment

**Option A: Push Empty Commit**
```bash
git commit --allow-empty -m "Force Railway rebuild"
git push origin main
```

**Option B: Manual Redeploy**
1. Railway Dashboard → **Deployments** tab
2. Click **"Redeploy"** on the latest deployment
3. Make sure **"Clear Cache"** is enabled (if option exists)

### Step 3: Verify Build Logs

1. Railway → **Deployments** → Latest deployment
2. Check build logs for:
   - ✅ `[INFO] BUILD SUCCESS`
   - ✅ `[INFO] Building jar: /app/target/booking-0.0.1-SNAPSHOT.jar`
   - ✅ No errors about manifest

### Step 4: Check JAR in Container

If still failing, the JAR might not be executable. Verify in Railway logs that the Spring Boot plugin ran the `repackage` goal.

---

## Alternative: Verify Locally First

Test the build locally to ensure it works:

```bash
cd booking-backend
mvn clean package -DskipTests
java -jar target/booking-0.0.1-SNAPSHOT.jar --version
```

If this works locally, Railway should work too after a clean rebuild.

---

## If Still Not Working

Check Railway build logs for:
- Is Maven running `mvn clean package`?
- Is the Spring Boot plugin executing?
- Is the JAR file being created?

The fix is in place - Railway just needs to rebuild with the updated pom.xml!

