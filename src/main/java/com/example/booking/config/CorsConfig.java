package com.example.booking.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

/**
 * CORS configuration for frontend integration.
 * Allows cross-origin requests from frontend applications.
 * 
 * This configuration explicitly allows:
 * - http://localhost:8081 (Expo web development)
 * - http://localhost:19006 (Expo web alternative port)
 * - http://localhost:3000 (Alternative dev port)
 * - All origins via pattern (for React Native mobile apps and production)
 */
@Configuration
public class CorsConfig {

    @Value("${cors.allowed-origins:*}")
    private String allowedOrigins;

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();
        
        // Explicitly allow common development origins
        List<String> defaultOrigins = Arrays.asList(
            "http://localhost:8081",      // Expo web default
            "http://localhost:19006",      // Expo web alternative
            "http://localhost:3000",       // Common dev port
            "http://127.0.0.1:8081",      // Localhost alternative
            "http://127.0.0.1:19006",     // Localhost alternative
            "http://127.0.0.1:3000"       // Localhost alternative
        );
        
        // For React Native and cloud deployment, allow all origins via pattern
        // In production, you can restrict this to specific domains via environment variable
        if ("*".equals(allowedOrigins) || allowedOrigins == null || allowedOrigins.trim().isEmpty()) {
            // Use pattern to allow all origins (works with credentials)
            config.addAllowedOriginPattern("*"); // Allow all origins (for React Native and production)
            // Also explicitly add development origins
            config.setAllowedOrigins(defaultOrigins);
        } else {
            // Parse allowed origins from comma-separated string
            List<String> origins = Arrays.asList(allowedOrigins.split(","));
            List<String> trimmedOrigins = origins.stream()
                    .map(String::trim)
                    .toList();
            // Combine with default development origins
            config.setAllowedOrigins(trimmedOrigins);
            // Also add default dev origins if not already present
            for (String defaultOrigin : defaultOrigins) {
                if (!trimmedOrigins.contains(defaultOrigin)) {
                    config.addAllowedOrigin(defaultOrigin);
                }
            }
        }
        
        // Allow common HTTP methods
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        
        // Allow all headers (needed for Authorization header)
        config.setAllowedHeaders(Arrays.asList("*"));
        
        // Allow credentials (cookies, authorization headers)
        // Note: When using credentials, you cannot use "*" for allowedOrigins
        // That's why we use addAllowedOriginPattern("*") or explicit origins
        config.setAllowCredentials(true);
        
        // Expose headers that frontend might need
        config.setExposedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Total-Count"));
        
        // Cache preflight requests for 1 hour
        config.setMaxAge(3600L);
        
        // Apply CORS configuration to all endpoints
        source.registerCorsConfiguration("/**", config);
        
        return new CorsFilter(source);
    }
}

