# Next Steps: Making Backend Available for Frontend Team

Follow these steps to get your backend running and ready for frontend integration.

## Step 1: Verify Prerequisites ✅

### Check Database
Make sure PostgreSQL is installed and running:

```bash
# Check if PostgreSQL is running
psql --version

# If not installed, install it:
# macOS: brew install postgresql@14
# Ubuntu: sudo apt-get install postgresql
```

### Check Java
```bash
java -version
# Should be Java 17 or higher
```

### Check Maven
```bash
mvn -version
```

## Step 2: Set Up Database (If Not Already Done) 🗄️

```bash
# Create database (if it doesn't exist)
createdb booking_db

# Or using psql:
psql -U postgres
CREATE DATABASE booking_db;
\q
```

## Step 3: Start the Backend Server 🚀

### Option A: Quick Start (Recommended)
```bash
cd booking-backend
./start-staging.sh
```

### Option B: Manual Start
```bash
cd booking-backend

# Build the application
mvn clean package -DskipTests

# Run with staging profile
java -jar target/booking-0.0.1-SNAPSHOT.jar --spring.profiles.active=staging
```

### Option C: Development Mode (with hot reload)
```bash
cd booking-backend
mvn spring-boot:run -Dspring-boot.run.profiles=staging
```

## Step 4: Verify Backend is Running ✅

Open your browser and check:

1. **Health Check**: http://localhost:8080/api/health
   - Should return: `{"status":"UP"}`

2. **Swagger UI**: http://localhost:8080/swagger-ui.html
   - Should show the API documentation interface

3. **API Docs JSON**: http://localhost:8080/api-docs
   - Should return OpenAPI JSON specification

## Step 5: Test Basic Functionality 🧪

### Test Registration
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

### Test Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

You should receive a JWT token in the response.

## Step 6: Share Information with Frontend Team 📧

Send your frontend team:

1. **API Base URL**: `http://localhost:8080/api`
2. **Swagger Documentation**: `http://localhost:8080/swagger-ui.html`
3. **Integration Guide**: Share `FRONTEND_INTEGRATION_GUIDE.md`
4. **CORS Origins**: Let them know which frontend URLs are allowed:
   - `http://localhost:3000` (React)
   - `http://localhost:5173` (Vite)
   - `http://localhost:4200` (Angular)

### If Frontend Runs on Different Port/Domain

If your frontend team needs a different origin, update CORS:

```bash
export CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.com
```

Then restart the backend.

## Step 7: Configure for Remote Access (If Needed) 🌐

If your frontend team is on a different machine:

### Option A: Same Network
1. Find your local IP address:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Or
   ipconfig getifaddr en0
   ```

2. Update CORS to allow your IP:
   ```bash
   export CORS_ALLOWED_ORIGINS=http://YOUR_IP:3000,http://localhost:3000
   ```

3. Start backend with:
   ```bash
   java -jar target/booking-0.0.1-SNAPSHOT.jar --spring.profiles.active=staging --server.address=0.0.0.0
   ```

4. Share the IP-based URL: `http://YOUR_IP:8080/api`

### Option B: Deploy to Cloud (Recommended for Team)
Deploy to a staging server (Heroku, Railway, Render, etc.) so everyone can access it.

## Step 8: Monitor and Debug 🔍

### Check Logs
The backend will log:
- API requests
- SQL queries (in staging mode)
- Errors and exceptions

### Common Issues

**Port Already in Use:**
```bash
# Change port
export SERVER_PORT=8081
# Then restart
```

**Database Connection Error:**
```bash
# Check PostgreSQL is running
pg_isready

# Check connection
psql -U postgres -d booking_db -c "SELECT 1;"
```

**CORS Errors:**
- Verify frontend URL is in `CORS_ALLOWED_ORIGINS`
- Check browser console for specific error
- Ensure backend is running

## Step 9: Keep Backend Running 🏃

### Option A: Run in Terminal
Keep the terminal window open while frontend team is testing.

### Option B: Run in Background
```bash
nohup java -jar target/booking-0.0.1-SNAPSHOT.jar --spring.profiles.active=staging > backend.log 2>&1 &
```

### Option C: Use Screen/Tmux
```bash
# Using screen
screen -S backend
./start-staging.sh
# Press Ctrl+A then D to detach
# Reattach with: screen -r backend

# Using tmux
tmux new -s backend
./start-staging.sh
# Press Ctrl+B then D to detach
# Reattach with: tmux attach -t backend
```

## Step 10: Production Checklist (Later) 📋

Once frontend integration is complete:
- Review `DEPLOYMENT_CHECKLIST.md`
- Set up production environment
- Configure production database
- Set up monitoring and logging
- Deploy to production server

## ✅ Quick Checklist

- [ ] PostgreSQL is running
- [ ] Database `booking_db` exists
- [ ] Backend builds successfully
- [ ] Backend starts on port 8080
- [ ] Health check responds
- [ ] Swagger UI is accessible
- [ ] Can register a user
- [ ] Can login and get token
- [ ] CORS is configured for frontend URLs
- [ ] Frontend team has API documentation
- [ ] Frontend team has base URL

## 🎉 You're Ready!

Once all steps are complete, your backend is ready for frontend integration. The frontend team can:
- Access Swagger UI to explore the API
- Use the integration guide to implement features
- Test authentication and API calls
- Build the frontend application

