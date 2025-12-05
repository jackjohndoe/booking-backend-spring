# Swagger/OpenAPI Documentation Guide

## Overview

The Booking API is fully documented using Swagger/OpenAPI 3.0. All endpoints are documented with descriptions, request/response schemas, and authentication requirements.

## Accessing Swagger UI

Once the application is running, access the Swagger UI at:

```
http://localhost:8080/swagger-ui.html
```

## API Documentation JSON

The OpenAPI specification is available at:

```
http://localhost:8080/api-docs
```

## Features

### 1. **Interactive API Testing**
- Test all endpoints directly from the browser
- View request/response examples
- See validation rules and constraints

### 2. **Authentication**
- JWT Bearer token authentication is configured
- Click "Authorize" button in Swagger UI
- Enter: `Bearer <your-jwt-token>`
- Token will be included in all authenticated requests

### 3. **Organized by Tags**
Endpoints are grouped by functionality:
- **Authentication** - User registration and login
- **Listings** - Property listing management
- **Bookings** - Booking management
- **Reviews** - Review and rating endpoints
- **User Profile** - User profile management
- **Favorites** - Favorite listings management
- **Wallet** - Wallet and transaction management
- **Payments** - Payment processing endpoints

### 4. **Request/Response Schemas**
- All DTOs are documented with field descriptions
- Validation constraints are visible
- Example values provided where applicable

### 5. **Error Responses**
- Common error responses documented (400, 401, 404, etc.)
- Error message formats explained

## Using Swagger UI

### Testing an Endpoint

1. **Find the endpoint** in the appropriate tag section
2. **Click "Try it out"** button
3. **Fill in parameters** (path variables, query params, request body)
4. **Click "Execute"**
5. **View response** with status code, headers, and body

### Authenticated Endpoints

For endpoints marked with 🔒 (lock icon):

1. **Get a JWT token** by calling `/api/auth/login` or `/api/auth/register`
2. **Click "Authorize"** button at top of page
3. **Enter token** in format: `Bearer <token>`
4. **Click "Authorize"** then "Close"
5. **All authenticated requests** will now include the token

### Example: Testing Login

1. Navigate to **Authentication** tag
2. Click on **POST /api/auth/login**
3. Click **"Try it out"**
4. Enter request body:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
5. Click **"Execute"**
6. Copy the `token` from response
7. Use this token for authenticated endpoints

## API Endpoints Summary

### Public Endpoints (No Authentication)
- `GET /api/listings` - Search listings
- `GET /api/listings/{id}` - Get listing details
- `GET /api/listings/vocab` - Get amenities/policies
- `GET /api/listings/{listingId}/reviews` - Get reviews
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login user

### Authenticated Endpoints (Require JWT)
- All other endpoints require authentication
- Include `Authorization: Bearer <token>` header

### Role-Based Access

Endpoints have different access levels:

- **Public**: No authentication required
- **Authenticated**: Any logged-in user (GUEST, HOST, ADMIN)
- **HOST/ADMIN**: Only HOST or ADMIN roles
- **Owner or ADMIN**: Resource owner OR ADMIN can access

**ADMIN Role:**
- ADMIN can bypass ownership checks
- ADMIN can manage any listing, booking, or review
- All ADMIN actions are logged in audit trail
- See `ADMIN_IMPLEMENTATION_SUMMARY.md` for details

## Configuration

Swagger is configured in:
- `OpenApiConfig.java` - Main configuration
- `application.properties` - UI paths and settings

### Customization

To customize Swagger documentation:

1. **Update API Info**: Edit `OpenApiConfig.java`
   - Title, description, version
   - Contact information
   - License

2. **Add More Details**: Add annotations to controllers
   - `@Operation` - Method descriptions
   - `@ApiResponse` - Response documentation
   - `@Parameter` - Parameter descriptions

3. **Document DTOs**: Add `@Schema` annotations to DTO classes
   - Field descriptions
   - Example values
   - Validation constraints

## Exporting Documentation

### Export OpenAPI Spec

```bash
curl http://localhost:8080/api-docs > openapi.json
```

### Generate Client SDKs

Use the OpenAPI spec to generate client SDKs:
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Swagger Codegen](https://swagger.io/tools/swagger-codegen/)

## Troubleshooting

### Swagger UI Not Loading
- Check application is running on port 8080
- Verify `/swagger-ui.html` path in browser
- Check console for errors

### Authentication Not Working
- Ensure token format: `Bearer <token>` (with space)
- Token should be from `/api/auth/login` response
- Check token hasn't expired

### Missing Endpoints
- Verify controller has `@RestController` annotation
- Check `@RequestMapping` path is correct
- Ensure no security filters blocking Swagger paths

## Best Practices

1. **Always test in Swagger UI first** before frontend integration
2. **Use the "Authorize" feature** for authenticated endpoints
3. **Check response schemas** to understand data structures
4. **Review error responses** to handle edge cases
5. **Export OpenAPI spec** for API contract documentation
