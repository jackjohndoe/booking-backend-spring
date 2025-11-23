# Cloud Deployment Guide

Deploy your backend to the cloud so your React Native frontend team can access it online.

## 🚀 Recommended Platforms

### Option 1: Railway (Easiest - Recommended) ⭐
- **Free tier**: $5/month credit
- **Auto-deploy**: From GitHub
- **Database**: Included PostgreSQL
- **Setup time**: 5 minutes

### Option 2: Render
- **Free tier**: Available (with limitations)
- **Auto-deploy**: From GitHub
- **Database**: Separate PostgreSQL service
- **Setup time**: 10 minutes

### Option 3: Fly.io
- **Free tier**: Generous
- **Global deployment**
- **Setup time**: 15 minutes

---

## 🚂 Railway Deployment (Recommended)

### Step 1: Prepare Your Repository

1. **Push your code to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Prepare for Railway deployment"
   git push origin main
   ```

### Step 2: Deploy on Railway

1. **Sign up/Login**: Go to [railway.app](https://railway.app)
2. **New Project**: Click "New Project"
3. **Deploy from GitHub**: Select "Deploy from GitHub repo"
4. **Select Repository**: Choose your `booking` repository
5. **Select Root Directory**: Choose `booking-backend` folder

### Step 3: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically create the database

### Step 4: Configure Environment Variables

In Railway, go to your service → **Variables** tab, add:

```bash
# Database (Railway auto-provides these, but verify)
DATABASE_URL=<auto-provided-by-railway>
DB_URL=<auto-provided-by-railway>
DB_USERNAME=<auto-provided-by-railway>
DB_PASSWORD=<auto-provided-by-railway>

# Application
SPRING_PROFILES_ACTIVE=staging
SERVER_PORT=8080

# Security (IMPORTANT: Generate a strong secret)
JWT_SECRET=<generate-a-strong-random-secret-here>
JWT_EXPIRATION=3600000

# CORS - Allow all for React Native
CORS_ALLOWED_ORIGINS=*

# Storage
STORAGE_BASE_PATH=/tmp/uploads
STORAGE_PUBLIC_URL=https://your-app-name.up.railway.app/api/files

# Payment Provider
PAYMENT_PROVIDER=local
```

**Generate JWT Secret:**
```bash
# On Mac/Linux
openssl rand -base64 32

# Or use an online generator
```

### Step 5: Deploy

1. Railway will automatically detect your `pom.xml` and build
2. Wait for deployment to complete (2-5 minutes)
3. Your app will be available at: `https://your-app-name.up.railway.app`

### Step 6: Get Your API URL

1. Go to your service → **Settings** → **Domains**
2. Railway provides a default domain like: `your-app-name.up.railway.app`
3. Your API base URL will be: `https://your-app-name.up.railway.app/api`

### Step 7: Verify Deployment

Visit:
- **Health Check**: `https://your-app-name.up.railway.app/api/health`
- **Swagger UI**: `https://your-app-name.up.railway.app/swagger-ui.html`

---

## 🎨 Render Deployment

### Step 1: Prepare Repository

Same as Railway - push to GitHub.

### Step 2: Deploy on Render

1. **Sign up**: Go to [render.com](https://render.com)
2. **New Web Service**: Click "New +" → "Web Service"
3. **Connect GitHub**: Authorize and select your repository
4. **Configure**:
   - **Name**: `booking-backend`
   - **Root Directory**: `booking-backend`
   - **Environment**: `Java`
   - **Build Command**: `mvn clean package -DskipTests`
   - **Start Command**: `java -jar target/booking-0.0.1-SNAPSHOT.jar --spring.profiles.active=staging`

### Step 3: Add PostgreSQL Database

1. **New +** → **PostgreSQL**
2. Create database
3. Note the connection details

### Step 4: Configure Environment Variables

In Render dashboard → **Environment**:

```bash
SPRING_PROFILES_ACTIVE=staging
SERVER_PORT=10000
DB_URL=jdbc:postgresql://<render-db-host>:5432/<db-name>
DB_USERNAME=<render-db-user>
DB_PASSWORD=<render-db-password>
JWT_SECRET=<generate-strong-secret>
JWT_EXPIRATION=3600000
CORS_ALLOWED_ORIGINS=*
STORAGE_BASE_PATH=/tmp/uploads
STORAGE_PUBLIC_URL=https://your-app.onrender.com/api/files
PAYMENT_PROVIDER=local
```

### Step 5: Deploy

Click "Create Web Service" and wait for deployment.

---

## 🪂 Fly.io Deployment

### Step 1: Install Fly CLI

```bash
# macOS
brew install flyctl

# Or download from fly.io
```

### Step 2: Login

```bash
flyctl auth login
```

### Step 3: Initialize

```bash
cd booking-backend
flyctl launch
```

Follow the prompts. Fly.io will detect your Dockerfile.

### Step 4: Add PostgreSQL

```bash
flyctl postgres create
flyctl postgres attach <postgres-app-name>
```

### Step 5: Set Secrets

```bash
flyctl secrets set JWT_SECRET=<your-secret>
flyctl secrets set CORS_ALLOWED_ORIGINS=*
flyctl secrets set PAYMENT_PROVIDER=local
```

### Step 6: Deploy

```bash
flyctl deploy
```

---

## 📱 React Native Integration

Once deployed, share with your frontend team:

### API Base URL
```
https://your-app-name.up.railway.app/api
```

### Swagger Documentation
```
https://your-app-name.up.railway.app/swagger-ui.html
```

### Example API Call (React Native)

```javascript
// api.js
const API_BASE_URL = 'https://your-app-name.up.railway.app/api';

export const login = async (email, password) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  return await response.json();
};

export const getListings = async (token) => {
  const response = await fetch(`${API_BASE_URL}/listings`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return await response.json();
};
```

---

## ✅ Post-Deployment Checklist

- [ ] Backend is accessible via HTTPS
- [ ] Health check endpoint works
- [ ] Swagger UI is accessible
- [ ] Can register a user
- [ ] Can login and get JWT token
- [ ] Can make authenticated API calls
- [ ] CORS allows React Native requests
- [ ] Database is connected and working
- [ ] File uploads work (if applicable)

---

## 🔧 Troubleshooting

### Build Fails

**Issue**: Maven build fails
**Solution**: Check that Java 21 is available. Railway/Render should auto-detect.

### Database Connection Error

**Issue**: Can't connect to database
**Solution**: 
- Verify `DB_URL` environment variable
- Check database is running
- Verify credentials are correct

### CORS Errors

**Issue**: React Native app gets CORS errors
**Solution**: 
- Set `CORS_ALLOWED_ORIGINS=*` in environment variables
- Restart the service

### Port Issues

**Issue**: App won't start
**Solution**: 
- Railway: Uses port from `PORT` env var (auto-set)
- Render: Use port `10000`
- Fly.io: Uses port `8080` (default)

---

## 💰 Cost Comparison

| Platform | Free Tier | Paid Plans |
|----------|-----------|------------|
| Railway  | $5/month credit | $20/month |
| Render   | Free (with limits) | $7/month |
| Fly.io   | Generous free tier | Pay as you go |

---

## 🎯 Recommendation

**For your use case (React Native frontend integration):**

1. **Railway** - Best choice: Easy setup, includes database, good free tier
2. **Render** - Good alternative: Simple, reliable
3. **Fly.io** - Advanced: More control, global deployment

---

## 📞 Next Steps

1. Choose a platform (Railway recommended)
2. Follow the deployment steps above
3. Share the API URL with your frontend team
4. Test the integration
5. Monitor usage and scale if needed

Your backend will be accessible 24/7 for your React Native team! 🚀

