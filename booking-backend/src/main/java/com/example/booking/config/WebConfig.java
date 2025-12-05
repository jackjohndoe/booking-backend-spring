package com.example.booking.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web Configuration for Spring Boot
 * This fixes the "No static resource api/apartments" error by properly configuring
 * static resources and ensuring API routes are handled by controllers, not static handlers.
 * 
 * This configuration works alongside CorsConfig.java which handles CORS settings.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    /**
     * Configure static resource handlers
     * This ensures static resources don't intercept API routes like /api/listings, /api/apartments, etc.
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
}

