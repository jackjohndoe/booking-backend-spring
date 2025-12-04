package com.yourpackage.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web Configuration for Spring Boot
 * This fixes the "No static resource api/apartments" error by properly configuring
 * static resources and ensuring API routes are handled by controllers, not static handlers.
 * 
 * Add this file to: src/main/java/com/yourpackage/config/WebConfig.java
 * Replace "com.yourpackage" with your actual package name
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    /**
     * Configure static resource handlers
     * This ensures static resources don't intercept API routes
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Only serve static resources from /static/** path
        // This prevents static resource handler from intercepting /api/** routes
        registry.addResourceHandler("/static/**")
                .addResourceLocations("classpath:/static/");
        
        // Optional: Serve other static resources if needed
        // registry.addResourceHandler("/public/**")
        //         .addResourceLocations("classpath:/public/");
    }

    /**
     * Configure CORS to allow frontend requests
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins("*") // In production, replace with specific origins
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                .allowedHeaders("*")
                .allowCredentials(false) // Set to true if using cookies/auth
                .maxAge(3600);
    }
}

