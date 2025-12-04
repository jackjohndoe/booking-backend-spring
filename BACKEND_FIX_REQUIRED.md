# Backend Fix Required - Spring Boot Routing Issue

## 🔴 Critical Issue

The Spring Boot backend on Railway is returning:
```
"details": "No static resource api/apartments."
"error": "Internal Server Error"
```

## Root Cause

The backend is treating `/api/apartments` as a static resource request instead of an API endpoint. This is a **Spring Boot configuration issue** that needs to be fixed in the backend code.

## What Needs to be Fixed (Backend Side)

### 1. Check Controller Configuration

Ensure there's a `@RestController` or `@Controller` with `@RequestMapping("/api/apartments")`:

```java
@RestController
@RequestMapping("/api/apartments")
public class ApartmentController {
    @GetMapping
    public ResponseEntity<List<Apartment>> getAllApartments() {
        // ... implementation
    }
    
    @GetMapping("/my-listings")
    public ResponseEntity<List<Apartment>> getMyListings() {
        // ... implementation
    }
}
```

### 2. Fix Static Resource Configuration

In `application.properties` or `application.yml`, ensure static resources don't intercept `/api/**` paths:

**Option 1: Disable static resource mapping for API paths**
```properties
spring.web.resources.add-mappings=false
```

**Option 2: Configure static path pattern to exclude API routes**
```properties
spring.mvc.static-path-pattern=/static/**
```

**Option 3: Configure WebMvcConfigurer (Java Config)**
```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/static/**")
                .addResourceLocations("classpath:/static/");
    }
    
    @Override
    public void configureDefaultServletHandling(DefaultServletHandlerConfigurer configurer) {
        // Don't use default servlet for API routes
    }
}
```

### 3. Verify Controller Package Scanning

Ensure the controller is in a package that's scanned by Spring Boot:
- Controller should be in the same package or sub-package as the main `@SpringBootApplication` class
- Or explicitly configure component scanning:
  ```java
  @SpringBootApplication
  @ComponentScan(basePackages = {"com.yourpackage.controllers"})
  public class Application {
      // ...
  }
  ```

### 4. Check Request Mapping Order

Ensure API controllers are registered before static resource handlers. This is usually automatic, but verify:
- Controllers should be in `@Controller` or `@RestController` annotated classes
- Static resources should be in `/static/`, `/public/`, `/resources/`, or `/META-INF/resources/`

## Affected Endpoints

- ❌ `GET /api/apartments` - Returns 500: "No static resource api/apartments"
- ❌ `GET /api/apartments/my-listings` - Returns 500: "No static resource api/apartments/my-listings"

## Working Endpoints

- ✅ `GET /api/health` - Returns 200 OK
- ✅ `POST /api/auth/register` - Returns 200 OK
- ✅ `POST /api/auth/login` - Returns 200/400 (working)
- ✅ `GET /api/favorites` - Returns 200 OK

## Frontend Status

✅ **Frontend is correctly configured:**
- All API endpoints are properly defined in `src/config/api.js`
- Error handling shows the actual backend error message
- The app gracefully falls back to local storage when API fails
- Error logging shows detailed backend error information

## How to Fix (Backend Developer)

1. **Access Railway Backend Repository/Code**
   - The backend code needs to be updated on Railway
   - Check if you have access to the backend repository

2. **Update Spring Boot Configuration**
   - Add one of the static resource configurations above
   - Ensure controllers are properly annotated and scanned

3. **Redeploy to Railway**
   - After fixing, redeploy the backend
   - Test the endpoints directly:
     ```bash
     curl -X GET "https://booking-backend-staging.up.railway.app/api/apartments" \
       -H "Authorization: Bearer YOUR_TOKEN" \
       -H "Content-Type: application/json"
     ```

4. **Verify Fix**
   - The endpoint should return 200 OK with apartment data
   - Or return 401/403 if authentication is required (not 500)

## Current Error Message in Frontend

The frontend now displays:
```
Backend routing error: No static resource api/apartments. The backend may not have the /api/apartments endpoint configured. Please check Railway backend configuration.
```

This provides clear information about what's wrong on the backend.

## Next Steps

1. **Backend Developer**: Fix the Spring Boot routing configuration as described above
2. **After Fix**: Test the endpoints to ensure they return proper responses
3. **Frontend**: Will automatically work once backend is fixed (no frontend changes needed)

## Testing After Fix

Once the backend is fixed, test with:
```bash
# Get auth token
curl -X POST "https://booking-backend-staging.up.railway.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Test apartments endpoint (replace TOKEN with actual token)
curl -X GET "https://booking-backend-staging.up.railway.app/api/apartments" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

Expected: Should return 200 OK with apartment data, not 500 error.

