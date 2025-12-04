# Backend Fix Required - Spring Boot Routing Issue

## 🔴 Critical Issue

The Spring Boot backend on Railway is returning:
```
"details": "No static resource api/apartments."
"error": "Internal Server Error"
```

## Root Cause

The backend is treating `/api/apartments` (or `/api/listings`) as a static resource request instead of an API endpoint. This is a **Spring Boot configuration issue** that needs to be fixed in the backend code.

## What Has Been Fixed

### 1. WebConfig.java Added

A new `WebConfig.java` has been added to `src/main/java/com/example/booking/config/WebConfig.java` that:
- Configures static resources to only serve from `/static/**` path
- Prevents static resource handlers from intercepting `/api/**` routes
- Works alongside the existing `CorsConfig.java` for CORS handling

### 2. application.properties Updated

The `application.properties` file has been updated with:
```properties
spring.web.resources.add-mappings=false
```

This prevents Spring Boot from trying to serve `/api/**` routes as static files.

## Frontend Endpoint Mapping

**Important Note**: The backend uses `/api/listings` endpoints, not `/api/apartments`. 

The frontend should be updated to use:
- `/api/listings` instead of `/api/apartments`
- `/api/listings/my-listings` instead of `/api/apartments/my-listings`

Or, if you want to maintain backward compatibility, you can add an alias controller that maps `/api/apartments` to `/api/listings`.

## Testing After Fix

Once deployed to Railway, test with:

```bash
# Get auth token
curl -X POST "https://booking-backend-staging.up.railway.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Test listings endpoint (replace TOKEN with actual token)
curl -X GET "https://booking-backend-staging.up.railway.app/api/listings" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

Expected: Should return 200 OK with listing data, not 500 error.

## Deployment Steps

1. Commit these changes to the repository
2. Push to Railway (or trigger Railway deployment)
3. Railway will automatically rebuild and redeploy
4. Test the endpoints to verify the fix

## Additional Notes

- The `CorsConfig.java` already handles CORS properly, so no changes needed there
- The `ListingController.java` already exists and handles `/api/listings` endpoints
- The static resource fix ensures API routes are handled by controllers, not static handlers

