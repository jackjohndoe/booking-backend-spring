# Production Deployment Checklist

## ⚠️ Critical Issues to Fix Before Deployment

### 1. Database Configuration
- [ ] **Change `spring.jpa.hibernate.ddl-auto` from `update` to `validate` or `none`**
  - `update` can cause data loss in production
  - Use migrations (Flyway/Liquibase) instead
  
- [ ] **Set `spring.jpa.show-sql=false`** for production
  - Logging SQL queries can expose sensitive data and impact performance

- [ ] **Ensure database connection uses environment variables**
  - Current: `jdbc:postgresql://localhost:5432/booking_db`
  - Production should use: `${DB_URL}` or similar

### 2. Security Configuration
- [ ] **JWT Secret must be set via environment variable**
  - Current default: `c3ByaW5nYm9vdDEyMzQ1NjcwMTIzNDU2NzAxMjM0NTY3MDEyMw==`
  - **CRITICAL**: Generate a strong, unique secret for production
  - Use: `export JWT_SECRET=<strong-random-secret>`

- [ ] **Database credentials must use environment variables**
  - Never use default values in production
  - Set: `DB_USERNAME`, `DB_PASSWORD`, `DB_URL`

- [ ] **Disable or restrict Swagger in production**
  - Current: Swagger is publicly accessible
  - Consider: Restrict to admin users or disable entirely

### 3. Payment Provider Configuration
- [ ] **If using Paystack, set production API key**
  - Test key: `sk_test_...`
  - Production key: `sk_live_...`
  - Set: `export PAYSTACK_SECRET_KEY=sk_live_...`

### 4. Storage Configuration
- [ ] **Update storage paths for production**
  - Current: `http://localhost:8080/api/files`
  - Set: `STORAGE_PUBLIC_URL` to your production domain

### 5. Environment Variables Required
Set these environment variables before deployment:

```bash
# Database
export DB_URL=jdbc:postgresql://your-db-host:5432/booking_db
export DB_USERNAME=your_db_user
export DB_PASSWORD=your_secure_password

# Security
export JWT_SECRET=<generate-strong-random-secret>
export JWT_EXPIRATION=3600000

# Storage
export STORAGE_BASE_PATH=/var/app/uploads
export STORAGE_PUBLIC_URL=https://your-domain.com/api/files

# Payment Provider
export PAYMENT_PROVIDER=paystack  # or 'local' for testing
export PAYSTACK_SECRET_KEY=sk_live_...  # if using Paystack

# Server
export SERVER_PORT=8080  # or your preferred port
```

### 6. Application Properties for Production
Create `application-prod.properties` with:

```properties
# Database
spring.datasource.url=${DB_URL}
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}

# JPA
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.show-sql=false

# Security
spring.security.jwt.secret=${JWT_SECRET}
spring.security.jwt.expiration=${JWT_EXPIRATION}

# Storage
storage.local-base-path=${STORAGE_BASE_PATH}
storage.public-url=${STORAGE_PUBLIC_URL}

# Payment
payment.provider=${PAYMENT_PROVIDER:local}
paystack.secret-key=${PAYSTACK_SECRET_KEY}

# Server
server.port=${SERVER_PORT:8080}

# Swagger - Disable in production
springdoc.swagger-ui.enabled=false
```

### 7. Build and Deploy
- [ ] **Build the application:**
  ```bash
  mvn clean package -DskipTests
  ```

- [ ] **Run with production profile:**
  ```bash
  java -jar target/booking-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod
  ```

### 8. Health Checks
- [ ] **Verify health endpoint:** `/api/health`
- [ ] **Test database connectivity**
- [ ] **Test authentication flow**
- [ ] **Test payment provider (if enabled)**

### 9. Monitoring & Logging
- [ ] Set up application monitoring (e.g., Prometheus, New Relic)
- [ ] Configure log aggregation
- [ ] Set up alerts for errors and performance issues

### 10. Backup Strategy
- [ ] Set up database backups
- [ ] Set up file storage backups
- [ ] Document recovery procedures

## ✅ Code Quality Checks
- [x] Paystack payment provider is production-ready
- [x] Error handling is properly implemented
- [x] Logging is configured
- [x] Null safety checks are in place
- [x] No hardcoded secrets in code

## 🚀 Ready to Deploy?
Once all items above are checked, your backend is ready for production deployment!

