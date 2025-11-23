# 🚀 Quick Cloud Deployment (5 Minutes)

Deploy your backend online so your React Native team can access it.

## ⚡ Fastest Option: Railway

### Step 1: Push to GitHub
```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app) and sign up
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Set **Root Directory** to: `booking-backend`
5. Railway will auto-detect and start building

### Step 3: Add Database

1. In Railway project, click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway automatically connects it

### Step 4: Set Environment Variables

Go to your service → **Variables** tab, add:

```bash
SPRING_PROFILES_ACTIVE=staging
JWT_SECRET=<generate-strong-secret>
CORS_ALLOWED_ORIGINS=*
PAYMENT_PROVIDER=local
```

**Generate JWT Secret:**
```bash
openssl rand -base64 32
```

### Step 5: Get Your URL

1. Go to **Settings** → **Domains**
2. Your API URL: `https://your-app.up.railway.app/api`
3. Share this with your frontend team!

---

## ✅ That's It!

Your backend is now live at: `https://your-app.up.railway.app`

**Test it:**
- Health: `https://your-app.up.railway.app/api/health`
- Swagger: `https://your-app.up.railway.app/swagger-ui.html`

**Share with frontend:**
- API Base URL: `https://your-app.up.railway.app/api`
- Swagger Docs: `https://your-app.up.railway.app/swagger-ui.html`

---

## 📖 Full Guide

For detailed instructions and other platforms, see: `CLOUD_DEPLOYMENT.md`

