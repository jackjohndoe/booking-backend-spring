# Booking Platform Backend API

A comprehensive Spring Boot 3.3 REST API for an apartment booking platform with wallet, payment processing, and admin management features.

## Features

### Core Features
- ✅ User authentication and authorization (JWT-based)
- ✅ Property listing management with search and filtering
- ✅ Booking system with availability checking
- ✅ Review and rating system
- ✅ User favorites management
- ✅ Wallet system with escrow and payouts
- ✅ Payment processing (provider-agnostic)
- ✅ Image storage for listings and avatars
- ✅ Admin role with full platform management
- ✅ Complete audit logging for admin actions

### User Roles

#### GUEST
- Browse and search listings
- Create bookings
- Write reviews (after booking)
- Manage favorites
- Use wallet for payments
- Manage profile

#### HOST
- All GUEST capabilities
- Create and manage listings
- Upload listing photos
- Complete bookings (release escrow)

#### ADMIN
- All HOST capabilities
- **Bypass ownership checks** - Manage any listing, booking, or review
- **Full platform oversight** - Cancel any booking, delete any review
- **Complete audit trail** - All actions logged with IP and timestamps
- Platform moderation and support capabilities

## Technology Stack

- **Framework**: Spring Boot 3.3
- **Language**: Java 17
- **Build Tool**: Maven
- **Database**: PostgreSQL
- **Security**: Spring Security with JWT
- **Documentation**: Swagger/OpenAPI 3.0
- **Validation**: Jakarta Validation
- **Testing**: JUnit 5, Mockito

## Getting Started

### Prerequisites

- Java 17 or higher
- Maven 3.6+
- PostgreSQL 12+
- (Optional) Docker for local PostgreSQL

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd booking-backend
```

2. **Configure Database**

Update `src/main/resources/application.properties`:
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/booking_db
spring.datasource.username=your_username
spring.datasource.password=your_password
```

3. **Run the application**
```bash
mvn spring-boot:run
```

The API will be available at `http://localhost:8080`

### Database Setup

The application uses JPA with `ddl-auto=update`, so tables are created automatically on first run.

## API Documentation

### Swagger UI

Access interactive API documentation at:
```
http://localhost:8080/swagger-ui.html
```

### OpenAPI Spec

Download the OpenAPI specification:
```
http://localhost:8080/api-docs
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token

### Listings
- `GET /api/listings` - Search and filter listings (public)
- `GET /api/listings/{id}` - Get listing details (public)
- `GET /api/listings/vocab` - Get amenities/policies (public)
- `POST /api/listings` - Create listing (HOST/ADMIN)
- `PUT /api/listings/{id}` - Update listing (HOST/ADMIN or owner)
- `DELETE /api/listings/{id}` - Delete listing (HOST/ADMIN or owner)
- `POST /api/listings/{id}/photos` - Add photos (HOST/ADMIN or owner)
- `DELETE /api/listings/{id}/photos/{photoId}` - Delete photo (HOST/ADMIN or owner)

### Bookings
- `POST /api/bookings` - Create booking (authenticated)
- `GET /api/bookings` - Get user bookings (authenticated)
- `GET /api/bookings/{id}` - Get booking details
- `DELETE /api/bookings/{id}` - Cancel booking (owner or ADMIN)
- `POST /api/bookings/{id}/complete` - Complete booking (host or ADMIN)

### Reviews
- `GET /api/listings/{listingId}/reviews` - Get reviews (public)
- `POST /api/listings/{listingId}/reviews` - Create review (authenticated, must have booked)
- `PUT /api/listings/{listingId}/reviews/{reviewId}` - Update review (owner or ADMIN)
- `DELETE /api/listings/{listingId}/reviews/{reviewId}` - Delete review (owner, host, or ADMIN)

### User Profile
- `GET /api/users/me` - Get profile (authenticated)
- `PUT /api/users/me` - Update profile (authenticated)
- `POST /api/users/me/avatar` - Upload avatar (authenticated)

### Favorites
- `GET /api/favorites` - Get favorites (authenticated)
- `POST /api/favorites/{listingId}` - Add favorite (authenticated)
- `DELETE /api/favorites/{listingId}` - Remove favorite (authenticated)

### Wallet
- `GET /api/wallet` - Get wallet (authenticated)
- `POST /api/wallet/deposit` - Deposit funds (authenticated)
- `POST /api/wallet/withdraw` - Withdraw funds (authenticated)
- `GET /api/wallet/transactions` - Get transaction history (authenticated)

### Payments
- `POST /api/payments/booking` - Process booking payment (authenticated)
- `POST /api/payments/booking/{id}/refund` - Refund booking (owner or ADMIN)

## Admin Capabilities

### What ADMIN Can Do

1. **Listing Management**
   - Create, update, delete ANY listing (bypasses ownership)
   - Add/remove photos from ANY listing
   - All actions are logged in audit trail

2. **Booking Management**
   - View, cancel, or complete ANY booking
   - Process refunds for any booking
   - All actions are logged

3. **Review Management**
   - Update or delete ANY review (for moderation)
   - All actions are logged

### Audit Logging

All admin actions are automatically logged with:
- Admin user who performed action
- Action type (LISTING_DELETE, BOOKING_CANCEL, etc.)
- Resource details (ID, type)
- IP address and user agent
- Timestamp

Query audit logs from `audit_logs` table or implement admin dashboard endpoints.

## Payment Providers

The system uses a provider-agnostic payment abstraction. Currently implemented:

- **Local Payment Provider** (default) - For development/testing
- **Stripe Payment Provider** (template) - Ready for Stripe integration

See `PAYMENT_PROVIDER_GUIDE.md` for integration details.

## Configuration

### Application Properties

Key configuration in `application.properties`:

```properties
# Database
spring.datasource.url=jdbc:postgresql://localhost:5432/booking_db
spring.datasource.username=${DB_USERNAME:postgres}
spring.datasource.password=${DB_PASSWORD:password}

# JWT
spring.security.jwt.secret=${JWT_SECRET:your-secret-key}
spring.security.jwt.expiration=${JWT_EXPIRATION:3600000}

# Payment Provider
payment.provider=${PAYMENT_PROVIDER:local}

# Storage
storage.local-base-path=${STORAGE_BASE_PATH:uploads}
storage.public-url=${STORAGE_PUBLIC_URL:http://localhost:8080/api/files}
```

## Testing

### Run All Tests
```bash
mvn test
```

### Run Specific Test
```bash
mvn test -Dtest=WalletServiceImplTest
```

## Project Structure

```
src/main/java/com/example/booking/
├── config/          # Configuration classes
├── controller/      # REST controllers
├── dto/            # Data Transfer Objects
├── entity/         # JPA entities
├── exception/       # Custom exceptions
├── payment/         # Payment provider abstraction
├── repository/      # JPA repositories
├── security/        # Security configuration
├── service/         # Business logic services
├── specification/   # JPA specifications
├── util/            # Utility classes
└── BookingApplication.java
```

## Security

- JWT-based stateless authentication
- Role-based access control (GUEST, HOST, ADMIN)
- Password encryption with BCrypt
- CORS configuration
- Input validation
- SQL injection protection (JPA)
- XSS protection

## Documentation Files

- `README.md` - This file
- `SWAGGER_GUIDE.md` - Swagger/OpenAPI usage guide
- `WALLET_SYSTEM_SUMMARY.md` - Wallet system documentation
- `PAYMENT_PROVIDER_GUIDE.md` - Payment provider integration guide
- `ADMIN_IMPLEMENTATION_SUMMARY.md` - Admin role implementation details
- `ADMIN_RECOMMENDATIONS.md` - Admin role recommendations

## Contributing

1. Follow Java coding standards
2. Write unit tests for new features
3. Update documentation
4. Ensure all tests pass

## License

[Your License Here]

## Support

For issues and questions, please contact [your-email@example.com]
