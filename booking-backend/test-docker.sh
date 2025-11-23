#!/bin/bash

echo "🐳 Testing Docker Build for Booking Backend"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "📦 Building Docker image..."
docker build -t booking-backend:latest .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo ""
echo "✅ Docker image built successfully!"
echo ""
echo "📋 Image details:"
docker images booking-backend:latest

echo ""
echo "🧪 To test running the container:"
echo ""
echo "Option 1: Using Docker Compose (includes PostgreSQL):"
echo "  docker-compose up"
echo ""
echo "Option 2: Run manually (requires local PostgreSQL):"
echo "  docker run -d \\"
echo "    --name booking-backend-test \\"
echo "    -p 8080:8080 \\"
echo "    -e SPRING_PROFILES_ACTIVE=staging \\"
echo "    -e DB_URL=jdbc:postgresql://host.docker.internal:5432/booking_db \\"
echo "    -e DB_USERNAME=root \\"
echo "    -e DB_PASSWORD=your_password \\"
echo "    -e JWT_SECRET=test-secret-key \\"
echo "    -e CORS_ALLOWED_ORIGINS=* \\"
echo "    -e PAYMENT_PROVIDER=local \\"
echo "    booking-backend:latest"
echo ""
echo "Then test: curl http://localhost:8080/api/health"
echo ""
echo "📖 See TEST_DOCKER_LOCALLY.md for full instructions"

