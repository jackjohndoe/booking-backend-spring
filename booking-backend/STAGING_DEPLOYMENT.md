# Staging Deployment Guide for Frontend Integration

This guide helps you deploy the backend for your frontend team to integrate and test.

## Quick Start

### 1. Set Environment Variables (Optional)

For a quick start, you can use the defaults. For better security, set these:

```bash
# Database (if not using defaults)
export DB_URL=jdbc:postgresql://localhost:5432/booking_db
export DB_USERNAME=root
export DB_PASSWORD=your_password

# JWT Secret (recommended to change from default)
export JWT_SECRET=your-staging-secret-key

# CORS - Add your frontend URLs
export CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://your-frontend-domain.com

# Storage URL (if deploying to a server)
export STORAGE_PUBLIC_URL=http://your-server:8080/api/files
```

### 2. Build the Application

```bash
cd booking-backend
mvn clean package -DskipTests
```

### 3. Run with Staging Profile

```bash
java -jar target/booking-0.0.1-SNAPSHOT.jar --spring.profiles.active=staging
```

Or if you want to run directly with Maven:

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=staging
```

### 4. Verify Deployment

- **Health Check:** http://localhost:8080/api/health
- **API Documentation:** http://localhost:8080/swagger-ui.html
- **API Docs JSON:** http://localhost:8080/api-docs

## Configuration Details

### Staging Profile Features

✅ **Swagger Enabled** - Frontend team can explore the API  
✅ **CORS Configured** - Allows requests from frontend origins  
✅ **SQL Logging** - Helpful for debugging  
✅ **Schema Auto-Update** - Database schema updates automatically  
✅ **Local Payment Provider** - Default (no real payments)  

### Default Settings

- **Port:** 8080
- **Database:** localhost:5432/booking_db (PostgreSQL)
- **Payment Provider:** `local` (simulated payments)
- **CORS Origins:** `http://localhost:3000`, `http://localhost:5173`, `http://localhost:4200`

### Changing Payment Provider

To test with Paystack (using test keys):

```bash
export PAYMENT_PROVIDER=paystack
export PAYSTACK_SECRET_KEY=sk_test_your_test_key_here
```

## Frontend Integration

### API Base URL

```
http://localhost:8080/api
```

### Authentication Endpoints

- **Register:** `POST /api/auth/register`
- **Login:** `POST /api/auth/login`
- **Get Current User:** `GET /api/auth/me` (requires JWT token)

### Using JWT Tokens

After login, include the token in requests:

```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

### CORS Configuration

The backend is configured to accept requests from:
- `http://localhost:3000` (React default)
- `http://localhost:5173` (Vite default)
- `http://localhost:4200` (Angular default)

To add more origins, set the environment variable:

```bash
export CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend.com
```

## Testing Checklist

- [ ] Backend starts successfully
- [ ] Health endpoint responds
- [ ] Swagger UI is accessible
- [ ] Can register a new user
- [ ] Can login and get JWT token
- [ ] Can make authenticated API calls
- [ ] CORS works from frontend
- [ ] File uploads work (if applicable)
- [ ] Payment flow works (if testing payments)

## Common Issues

### Port Already in Use

Change the port:
```bash
export SERVER_PORT=8081
```

### Database Connection Error

Make sure PostgreSQL is running:
```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT version();"
```

### CORS Errors

1. Check that your frontend URL is in `CORS_ALLOWED_ORIGINS`
2. Verify the frontend is making requests to the correct backend URL
3. Check browser console for specific CORS error messages

### JWT Token Issues

- Tokens expire after 1 hour (3600000ms) by default
- Make sure to include `Bearer ` prefix in Authorization header
- Check that token is being sent in the request headers

## Next Steps

Once frontend integration is complete:
1. Test all API endpoints
2. Verify payment flows (if applicable)
3. Test file uploads/downloads
4. Performance testing
5. Move to production deployment (see `DEPLOYMENT_CHECKLIST.md`)

## Support

For API documentation, visit: http://localhost:8080/swagger-ui.html

