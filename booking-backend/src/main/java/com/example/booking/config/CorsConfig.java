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
 */
@Configuration
public class CorsConfig {

    @Value("${cors.allowed-origins:*}")
    private String allowedOrigins;

    @Bean
    public CorsFilter corsFilter() {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        CorsConfiguration config = new CorsConfiguration();
        
        // For React Native and cloud deployment, allow all origins
        // In production, you can restrict this to specific domains
        if ("*".equals(allowedOrigins) || allowedOrigins == null || allowedOrigins.trim().isEmpty()) {
            config.addAllowedOriginPattern("*"); // Allow all origins (for React Native)
        } else {
            // Parse allowed origins from comma-separated string
            List<String> origins = Arrays.asList(allowedOrigins.split(","));
            config.setAllowedOrigins(origins.stream()
                    .map(String::trim)
                    .toList());
        }
        
        // Allow common HTTP methods
        config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        
        // Allow common headers
        config.setAllowedHeaders(Arrays.asList("*"));
        
        // Allow credentials (cookies, authorization headers)
        config.setAllowCredentials(true);
        
        // Cache preflight requests for 1 hour
        config.setMaxAge(3600L);
        
        // Apply CORS configuration to all endpoints
        source.registerCorsConfiguration("/**", config);
        
        return new CorsFilter(source);
    }
}

