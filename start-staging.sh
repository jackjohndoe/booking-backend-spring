#!/bin/bash

# Quick Start Script for Staging Deployment
# This script builds and runs the backend for frontend integration testing

echo "🚀 Starting Booking Backend for Staging/Testing..."
echo ""

# Check if Maven is installed
if ! command -v mvn &> /dev/null; then
    echo "❌ Maven is not installed. Please install Maven first."
    exit 1
fi

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo "❌ Java is not installed. Please install Java 17 or higher."
    exit 1
fi

echo "📦 Building the application..."
mvn clean package -DskipTests

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi

echo ""
echo "✅ Build successful!"
echo ""
echo "🌐 Starting server with staging profile..."
echo "   - API will be available at: http://localhost:8080"
echo "   - Swagger UI: http://localhost:8080/swagger-ui.html"
echo "   - Health Check: http://localhost:8080/api/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

java -jar target/booking-0.0.1-SNAPSHOT.jar --spring.profiles.active=staging

