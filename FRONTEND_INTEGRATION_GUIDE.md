# Frontend Integration Guide

This document provides everything your frontend team needs to integrate with the Booking API.

## 🚀 Quick Start

### API Base URL
```
http://localhost:8080/api
```

### Interactive API Documentation
**Swagger UI:** http://localhost:8080/swagger-ui.html

Use Swagger UI to:
- Explore all available endpoints
- See request/response schemas
- Test API calls directly from the browser
- Copy example requests for your code

## 📋 Available Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user (requires authentication)

### Listings
- `GET /api/listings` - Get all listings
- `GET /api/listings/{id}` - Get listing by ID
- `POST /api/listings` - Create listing (requires authentication)
- `PUT /api/listings/{id}` - Update listing (requires authentication)
- `DELETE /api/listings/{id}` - Delete listing (requires authentication)

### Bookings
- `GET /api/bookings` - Get user's bookings (requires authentication)
- `POST /api/bookings` - Create a booking (requires authentication)
- `GET /api/bookings/{id}` - Get booking by ID (requires authentication)
- `PUT /api/bookings/{id}` - Update booking (requires authentication)

### Reviews
- `GET /api/listings/{listingId}/reviews` - Get reviews for a listing
- `POST /api/listings/{listingId}/reviews` - Create a review (requires authentication)

### Payments
- `POST /api/payments/intent` - Create payment intent (requires authentication)
- `POST /api/payments/confirm` - Confirm payment (requires authentication)
- `POST /api/payments/refund` - Refund payment (requires authentication)

### Files
- `GET /api/files/{filename}` - Get file
- `POST /api/files/upload` - Upload file (requires authentication)

### Health Check
- `GET /api/health` - Check if API is running

## 🔐 Authentication

### 1. Register a User
```javascript
const response = await fetch('http://localhost:8080/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    firstName: 'John',
    lastName: 'Doe'
  })
});

const data = await response.json();
```

### 2. Login
```javascript
const response = await fetch('http://localhost:8080/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { token } = await response.json();
// Store token in localStorage or state
localStorage.setItem('token', token);
```

### 3. Make Authenticated Requests
```javascript
const token = localStorage.getItem('token');

const response = await fetch('http://localhost:8080/api/auth/me', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
});

const user = await response.json();
```

## 🌐 CORS Configuration

The backend is configured to accept requests from:
- `http://localhost:3000` (React default)
- `http://localhost:5173` (Vite default)
- `http://localhost:4200` (Angular default)

If your frontend runs on a different port, contact the backend team to add it.

## 📝 Example: Complete Authentication Flow

```javascript
// 1. Register
async function register(email, password, firstName, lastName) {
  const response = await fetch('http://localhost:8080/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, firstName, lastName })
  });
  return await response.json();
}

// 2. Login
async function login(email, password) {
  const response = await fetch('http://localhost:8080/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
  }
  return data;
}

// 3. Get Current User
async function getCurrentUser() {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:8080/api/auth/me', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return await response.json();
}

// 4. Create a Listing (example authenticated request)
async function createListing(listingData) {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:8080/api/listings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(listingData)
  });
  return await response.json();
}
```

## 🔄 Error Handling

The API returns standard HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

Example error response:
```json
{
  "error": "Validation failed",
  "message": "Email is required",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 📤 File Upload Example

```javascript
async function uploadFile(file) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('http://localhost:8080/api/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
      // Don't set Content-Type, browser will set it with boundary
    },
    body: formData
  });

  return await response.json();
}
```

## ⚠️ Important Notes

1. **JWT Token Expiration**: Tokens expire after 1 hour. Implement token refresh logic.

2. **CORS**: If you get CORS errors, verify your frontend URL is in the allowed origins list.

3. **Payment Provider**: Currently using `local` provider (simulated payments). Real payments will be enabled later.

4. **Base URL**: For production, the base URL will change. Use environment variables in your frontend:
   ```javascript
   const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';
   ```

## 🧪 Testing

1. **Health Check**: Visit http://localhost:8080/api/health to verify the API is running
2. **Swagger UI**: Use http://localhost:8080/swagger-ui.html to test endpoints
3. **Postman/Insomnia**: Import the OpenAPI spec from http://localhost:8080/api-docs

## 📞 Support

- **API Documentation**: http://localhost:8080/swagger-ui.html
- **OpenAPI Spec**: http://localhost:8080/api-docs
- **Health Check**: http://localhost:8080/api/health

For issues or questions, contact the backend team.

