# Railway Quick Setup - Database & Environment Variables

## 🗄️ Step 1: Add PostgreSQL Database

1. Railway Dashboard → Your Project → **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Done! Railway creates it automatically

---

## ⚙️ Step 2: Set Environment Variables

Go to **Backend Service** → **Variables** tab → Add these:

### Essential Variables

```bash
SPRING_PROFILES_ACTIVE=staging

# Database (Railway auto-provides these, but verify they're connected)
DB_URL=jdbc:postgresql://${PGHOST}:${PGPORT}/${PGDATABASE}
DB_USERNAME=${PGUSER}
DB_PASSWORD=${PGPASSWORD}

# Security (IMPORTANT: Generate a strong secret!)
JWT_SECRET=<generate-with: openssl rand -base64 32>

# CORS (for React Native)
CORS_ALLOWED_ORIGINS=*

# Payment
PAYMENT_PROVIDER=local

# Storage (replace with your Railway domain)
STORAGE_PUBLIC_URL=https://your-app-name.up.railway.app/api/files
```

### Generate JWT Secret

```bash
openssl rand -base64 32
```

Copy the output and use it as `JWT_SECRET`.

---

## ✅ Step 3: Verify Database Connection

Railway should auto-provide these variables when database is connected:
- `PGHOST`
- `PGPORT` 
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`

If you see these, your database is connected! ✅

---

## 🔄 Step 4: Redeploy

1. **Deployments** tab → Click **"Redeploy"**
2. Wait for deployment to complete
3. Check logs for: ✅ "Started BookingApplication"

---

## 🧪 Step 5: Test

- **Health**: `https://your-app.up.railway.app/api/health`
- **Swagger**: `https://your-app.up.railway.app/swagger-ui.html`

---

## 📋 Quick Checklist

- [ ] PostgreSQL database added
- [ ] `SPRING_PROFILES_ACTIVE=staging` set
- [ ] Database variables configured
- [ ] `JWT_SECRET` generated and set
- [ ] `CORS_ALLOWED_ORIGINS=*` set
- [ ] `STORAGE_PUBLIC_URL` set to your domain
- [ ] Redeployed
- [ ] Health endpoint works

---

## 🆘 Troubleshooting

### Database Not Connecting?

1. Check if database service is running
2. Verify `DB_URL` format: `jdbc:postgresql://host:port/database`
3. Check Railway logs for connection errors

### Still Having Issues?

See full guide: `RAILWAY_SETUP.md`

