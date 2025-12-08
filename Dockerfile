# Multi-stage build for Spring Boot application
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy pom.xml and source code
COPY pom.xml .
COPY src ./src

# Build the application (Maven will download dependencies automatically)
RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Copy the built JAR (keep original name for Railway compatibility)
COPY --from=build /app/target/booking-0.0.1-SNAPSHOT.jar booking-0.0.1-SNAPSHOT.jar

# Expose port
EXPOSE 8080

# Run the application
# Railway will use this CMD, or you can override with startCommand
# Trigger redeploy: wallet transaction fixes - 2025-01-08
CMD ["java", "-jar", "booking-0.0.1-SNAPSHOT.jar", "--spring.profiles.active=staging"]

