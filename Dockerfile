# Dockerfile for Spring Boot backend
# This file is located in the root for Google Cloud Build compatibility
# It builds the application from the booking-backend directory

# Multi-stage build for Spring Boot application
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy pom.xml and source code from booking-backend directory
COPY booking-backend/pom.xml ./pom.xml
COPY booking-backend/src ./src

# Build the application (Maven will download dependencies automatically)
RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copy the built JAR
COPY --from=build /app/target/booking-0.0.1-SNAPSHOT.jar booking-0.0.1-SNAPSHOT.jar

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

# Run the application
CMD ["java", "-jar", "booking-0.0.1-SNAPSHOT.jar", "--spring.profiles.active=staging"]
