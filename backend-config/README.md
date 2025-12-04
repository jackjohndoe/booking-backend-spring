# Spring Boot Backend Configuration Files

These configuration files fix the "No static resource api/apartments" error by properly configuring Spring Boot to handle API routes correctly.

## Files Included

1. **application.properties** - Spring Boot configuration (Properties format)
2. **application.yml** - Spring Boot configuration (YAML format)
3. **WebConfig.java** - Web MVC configuration class
4. **ApartmentController.java** - Example controller implementation

## How to Use

### Step 1: Choose Configuration Format

Use **either** `application.properties` **OR** `application.yml`, not both.

- If your backend uses `.properties` files → Use `application.properties`
- If your backend uses `.yml` files → Use `application.yml`

### Step 2: Add Configuration File

1. Copy the chosen file to your backend repository:
   - `application.properties` → `src/main/resources/application.properties`
   - `application.yml` → `src/main/resources/application.yml`

2. **Important**: If you already have an `application.properties` or `application.yml` file, **merge** the static resource configuration into your existing file.

### Step 3: Add WebConfig.java

1. Copy `WebConfig.java` to your backend repository:
   - Location: `src/main/java/com/yourpackage/config/WebConfig.java`
   - Replace `com.yourpackage` with your actual package name

2. Ensure the package matches your project structure.

### Step 4: Verify Controller

1. Ensure you have an `ApartmentController` (or similar) with:
   ```java
   @RestController
   @RequestMapping("/api/apartments")
   public class ApartmentController {
       // ...
   }
   ```

2. If you don't have one, use `ApartmentController.java` as a template.

3. **Critical**: Ensure the controller is in a package that's scanned by Spring Boot:
   - Same package as your `@SpringBootApplication` class
   - Or a sub-package of it
   - Or explicitly configured with `@ComponentScan`

### Step 5: Update Package Names

Replace all instances of `com.yourpackage` with your actual package name in:
- `WebConfig.java`
- `ApartmentController.java`

### Step 6: Deploy to Railway

1. Commit the changes to your backend repository
2. Push to Railway (or trigger Railway deployment)
3. Railway will automatically rebuild and redeploy

### Step 7: Test

After deployment, test the endpoint:

```bash
# Get auth token first
curl -X POST "https://booking-backend-staging.up.railway.app/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"yourpassword"}'

# Test apartments endpoint (replace TOKEN with actual token)
curl -X GET "https://booking-backend-staging.up.railway.app/api/apartments" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

Expected: Should return 200 OK (not 500 error).

## Key Configuration Changes

### Static Resource Configuration

The fix is in this line:
```properties
spring.web.resources.add-mappings=false
```

Or in YAML:
```yaml
spring:
  web:
    resources:
      add-mappings: false
```

This prevents Spring Boot from trying to serve `/api/apartments` as a static file.

### WebConfig.java

The `WebConfig` class ensures:
- Static resources are only served from `/static/**` path
- API routes (`/api/**`) are handled by controllers, not static handlers
- CORS is properly configured for frontend requests

## Troubleshooting

### Still Getting 500 Error?

1. **Check Controller Package**: Ensure controller is in a scanned package
2. **Check @RestController Annotation**: Must have `@RestController` or `@Controller`
3. **Check @RequestMapping**: Must have `@RequestMapping("/api/apartments")`
4. **Check Railway Logs**: Look for startup errors or missing dependencies

### Controller Not Found?

1. Verify package scanning:
   ```java
   @SpringBootApplication
   @ComponentScan(basePackages = {"com.yourpackage"})
   public class Application {
       // ...
   }
   ```

2. Check if controller is in the same package as `@SpringBootApplication`

### CORS Errors?

The `WebConfig.java` includes CORS configuration. If you still get CORS errors:
1. Check that `WebConfig` is being loaded (check startup logs)
2. Verify `addCorsMappings` is being called
3. In production, replace `allowedOrigins("*")` with specific frontend URL

## Next Steps

After fixing the backend:
1. Test all endpoints to ensure they work
2. Update frontend if needed (should work automatically)
3. Monitor Railway logs for any errors

## Support

If issues persist:
1. Check Railway deployment logs
2. Verify all files are in correct locations
3. Ensure package names match your project structure
4. Check Spring Boot startup logs for errors

