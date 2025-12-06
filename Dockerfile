# Multi-stage build for Spring Boot application
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app

# Copy pom.xml and download dependencies
COPY booking-backend/pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build
COPY booking-backend/src ./src
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
CMD ["java", "-jar", "booking-0.0.1-SNAPSHOT.jar", "--spring.profiles.active=staging"]

