package com.example.booking.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Configuration for rate limiting using in-memory cache.
 * Stores request timestamps per email address to enforce rate limits.
 */
@Configuration
@EnableCaching
public class RateLimitConfig {

    @Bean
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager("passwordResetRequests");
    }
}

