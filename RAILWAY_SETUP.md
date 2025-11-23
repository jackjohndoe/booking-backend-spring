# Railway Setup Guide - Database & Environment Variables

Your backend is deployed! Now let's set up the database and environment variables.

## Step 1: Add PostgreSQL Database

### In Railway Dashboard:

1. **Go to your project** → Click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically create a PostgreSQL database
4. **Note the database name** (usually `railway` or `postgres`)

### Railway automatically provides these:
- Database URL
- Username
- Password
- Host
- Port

---

## Step 2: Connect Database to Your Backend

### Option A: Automatic Connection (Recommended)

1. In your **backend service**, go to **Settings** → **Variables**
2. Railway should automatically add database variables if you connected them
3. Look for variables like:
   - `DATABASE_URL`
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`

### Option B: Manual Connection

If not automatically connected:

1. **Backend service** → **Settings** → **Variables**
2. Add these variables (get values from database service):

```bash
DB_URL=jdbc:postgresql://<host>:<port>/<database>
DB_USERNAME=<username>
DB_PASSWORD=<password>
```

**To get these values:**
- Go to your **PostgreSQL service** → **Variables** tab
- Copy the connection details

---

## Step 3: Set Required Environment Variables

Go to your **backend service** → **Variables** tab and add:

### Required Variables

```bash
# Application Profile
SPRING_PROFILES_ACTIVE=staging

# Database (if not auto-provided by Railway)
DB_URL=${DATABASE_URL}  # Or use the full JDBC URL
DB_USERNAME=${PGUSER}
DB_PASSWORD=${PGPASSWORD}

# Security - IMPORTANT: Generate a strong secret
JWT_SECRET=<generate-a-strong-random-secret>
JWT_EXPIRATION=3600000

# CORS - Allow all for React Native
CORS_ALLOWED_ORIGINS=*

# Payment Provider
PAYMENT_PROVIDER=local

# Storage
STORAGE_BASE_PATH=/tmp/uploads
STORAGE_PUBLIC_URL=https://your-app-name.up.railway.app/api/files
```

### Generate JWT Secret

You can generate a strong secret using:

```bash
# On Mac/Linux
openssl rand -base64 32

# Or use an online generator
# Or use: python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## Step 4: Update STORAGE_PUBLIC_URL

Replace `your-app-name` with your actual Railway domain:

1. Go to **Settings** → **Domains**
2. Copy your Railway domain (e.g., `booking-production.up.railway.app`)
3. Set `STORAGE_PUBLIC_URL` to:
   ```
   https://your-actual-domain.up.railway.app/api/files
   ```

---

## Step 5: Verify Database Connection

### Check if Database Variables are Auto-Connected

Railway should automatically provide these if database is connected:
- `DATABASE_URL` - Full connection string
- `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

### If Using Auto-Provided Variables

You might need to convert `DATABASE_URL` to JDBC format. Add this variable:

```bash
DB_URL=${DATABASE_URL}
```

Or if Railway provides `DATABASE_URL` in PostgreSQL format, you might need:

```bash
# If DATABASE_URL is: postgresql://user:pass@host:port/dbname
# Convert to JDBC format:
DB_URL=jdbc:postgresql://${PGHOST}:${PGPORT}/${PGDATABASE}
DB_USERNAME=${PGUSER}
DB_PASSWORD=${PGPASSWORD}
```

---

## Step 6: Redeploy

After setting all variables:

1. Go to **Deployments** tab
2. Click **"Redeploy"** on the latest deployment
3. Or push a new commit to trigger auto-deploy

---

## Step 7: Verify Everything Works

### Check Health Endpoint

Visit: `https://your-app.up.railway.app/api/health`

Should return: `{"status":"UP"}`

### Check Swagger UI

Visit: `https://your-app.up.railway.app/swagger-ui.html`

Should show the API documentation.

### Check Logs

1. Go to **Deployments** → Latest deployment
2. Click **"View Logs"**
3. Look for:
   - ✅ "Started BookingApplication"
   - ✅ Database connection success
   - ❌ No errors

---

## Quick Setup Checklist

- [ ] PostgreSQL database added
- [ ] Database connected to backend service
- [ ] `SPRING_PROFILES_ACTIVE=staging` set
- [ ] Database variables configured (`DB_URL`, `DB_USERNAME`, `DB_PASSWORD`)
- [ ] `JWT_SECRET` generated and set (strong random value)
- [ ] `JWT_EXPIRATION=3600000` set
- [ ] `CORS_ALLOWED_ORIGINS=*` set
- [ ] `PAYMENT_PROVIDER=local` set
- [ ] `STORAGE_PUBLIC_URL` set to your Railway domain
- [ ] `STORAGE_BASE_PATH=/tmp/uploads` set
- [ ] Service redeployed
- [ ] Health endpoint works
- [ ] Swagger UI accessible

---

## Common Issues

### Database Connection Error

**Error**: "Connection refused" or "Database not found"

**Solution**:
1. Verify database service is running
2. Check `DB_URL` format: `jdbc:postgresql://host:port/database`
3. Verify credentials match database service
4. Check if database variables are properly connected

### JWT Secret Error

**Error**: "JWT secret is not configured"

**Solution**:
1. Make sure `JWT_SECRET` is set
2. Use a strong random value (at least 32 characters)
3. Redeploy after setting

### CORS Errors

**Error**: Frontend can't connect

**Solution**:
1. Verify `CORS_ALLOWED_ORIGINS=*` is set
2. For production, you can restrict to specific domains:
   ```
   CORS_ALLOWED_ORIGINS=https://your-frontend.com,https://app.yourdomain.com
   ```

---

## Environment Variables Reference

### Required

| Variable | Example Value | Description |
|----------|---------------|-------------|
| `SPRING_PROFILES_ACTIVE` | `staging` | Application profile |
| `DB_URL` | `jdbc:postgresql://...` | Database connection URL |
| `DB_USERNAME` | `postgres` | Database username |
| `DB_PASSWORD` | `***` | Database password |
| `JWT_SECRET` | `your-secret-key` | JWT signing secret |

### Optional (with defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_EXPIRATION` | `3600000` | Token expiration (ms) |
| `CORS_ALLOWED_ORIGINS` | `*` | Allowed CORS origins |
| `PAYMENT_PROVIDER` | `local` | Payment provider |
| `STORAGE_BASE_PATH` | `/tmp/uploads` | File storage path |
| `STORAGE_PUBLIC_URL` | - | Public file URL |

---

## Next Steps

Once everything is set up:

1. ✅ Test the API endpoints via Swagger UI
2. ✅ Share the API URL with your frontend team
3. ✅ Test authentication (register/login)
4. ✅ Monitor logs for any issues
5. ✅ Set up custom domain (optional)

Your backend is now ready for your React Native frontend team! 🚀

