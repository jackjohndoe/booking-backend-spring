# Test Docker Image Locally

This guide helps you build and test the Docker image before deploying to the cloud.

## Prerequisites

- Docker installed and running
- PostgreSQL database (local or remote)

## Step 1: Build the Docker Image

```bash
cd booking-backend
docker build -t booking-backend:latest .
```

This will:
- Build the Spring Boot application
- Create a Docker image named `booking-backend:latest`
- Take 3-5 minutes on first build (downloads dependencies)

## Step 2: Run the Container

### Option A: With Local PostgreSQL

```bash
docker run -d \
  --name booking-backend \
  -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=staging \
  -e DB_URL=jdbc:postgresql://host.docker.internal:5432/booking_db \
  -e DB_USERNAME=root \
  -e DB_PASSWORD=your_password \
  -e JWT_SECRET=test-secret-key-for-local-testing-123456789012345678901234567890 \
  -e CORS_ALLOWED_ORIGINS=* \
  -e PAYMENT_PROVIDER=local \
  booking-backend:latest
```

### Option B: With Docker Network (if PostgreSQL is in Docker)

```bash
# First, create a network
docker network create booking-network

# Run PostgreSQL (if not already running)
docker run -d \
  --name booking-postgres \
  --network booking-network \
  -e POSTGRES_DB=booking_db \
  -e POSTGRES_USER=root \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:14

# Run your backend
docker run -d \
  --name booking-backend \
  --network booking-network \
  -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=staging \
  -e DB_URL=jdbc:postgresql://booking-postgres:5432/booking_db \
  -e DB_USERNAME=root \
  -e DB_PASSWORD=password \
  -e JWT_SECRET=test-secret-key-for-local-testing-123456789012345678901234567890 \
  -e CORS_ALLOWED_ORIGINS=* \
  -e PAYMENT_PROVIDER=local \
  booking-backend:latest
```

### Option C: Using Docker Compose (Easiest)

See `docker-compose.yml` file for a complete setup.

## Step 3: Check Container Status

```bash
# Check if container is running
docker ps

# View logs
docker logs booking-backend

# Follow logs in real-time
docker logs -f booking-backend
```

## Step 4: Test the API

```bash
# Health check
curl http://localhost:8080/api/health

# Should return: {"status":"UP"}

# Swagger UI
open http://localhost:8080/swagger-ui.html
```

## Step 5: Stop and Clean Up

```bash
# Stop the container
docker stop booking-backend

# Remove the container
docker rm booking-backend

# Remove the image (optional)
docker rmi booking-backend:latest
```

## Troubleshooting

### Build Fails

**Issue**: Maven build fails
**Solution**: 
- Check internet connection (needs to download dependencies)
- Verify Java version compatibility
- Check Docker has enough resources (memory/CPU)

### Container Exits Immediately

**Issue**: Container starts then stops
**Solution**:
```bash
# Check logs for errors
docker logs booking-backend

# Common issues:
# - Database connection failed (check DB_URL)
# - Port already in use (change -p 8080:8081)
# - Missing environment variables
```

### Database Connection Error

**Issue**: Can't connect to database
**Solution**:
- For local PostgreSQL: Use `host.docker.internal` instead of `localhost`
- Verify database is running: `psql -U postgres -c "SELECT 1;"`
- Check credentials match

### Port Already in Use

**Issue**: Port 8080 is already in use
**Solution**:
```bash
# Use a different port
docker run -p 8081:8080 ...
# Then access at http://localhost:8081
```

## Quick Test Script

Save this as `test-docker.sh`:

```bash
#!/bin/bash

echo "Building Docker image..."
docker build -t booking-backend:latest .

echo "Starting container..."
docker run -d \
  --name booking-backend-test \
  -p 8080:8080 \
  -e SPRING_PROFILES_ACTIVE=staging \
  -e DB_URL=jdbc:postgresql://host.docker.internal:5432/booking_db \
  -e DB_USERNAME=root \
  -e DB_PASSWORD=password \
  -e JWT_SECRET=test-secret-key \
  -e CORS_ALLOWED_ORIGINS=* \
  -e PAYMENT_PROVIDER=local \
  booking-backend:latest

echo "Waiting for container to start..."
sleep 10

echo "Testing health endpoint..."
curl http://localhost:8080/api/health

echo ""
echo "Container is running!"
echo "View logs: docker logs -f booking-backend-test"
echo "Stop: docker stop booking-backend-test && docker rm booking-backend-test"
```

Make it executable:
```bash
chmod +x test-docker.sh
./test-docker.sh
```

