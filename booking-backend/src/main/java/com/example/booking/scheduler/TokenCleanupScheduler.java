package com.example.booking.scheduler;

import com.example.booking.repository.PasswordResetTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Scheduled task to clean up expired password reset tokens.
 * Runs daily at 2 AM to remove tokens older than 24 hours.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TokenCleanupScheduler {

    private final PasswordResetTokenRepository tokenRepository;

    @Scheduled(cron = "0 0 2 * * ?") // Daily at 2 AM
    @Transactional
    public void cleanupExpiredTokens() {
        try {
            OffsetDateTime cutoffDate = OffsetDateTime.now().minusHours(24);
            int deletedCount = tokenRepository.findAll().stream()
                    .mapToInt(token -> {
                        if (token.getCreatedAt().isBefore(cutoffDate)) {
                            tokenRepository.delete(token);
                            return 1;
                        }
                        return 0;
                    })
                    .sum();

            if (deletedCount > 0) {
                log.info("Cleaned up {} expired password reset tokens", deletedCount);
            }
        } catch (Exception e) {
            log.error("Error during token cleanup", e);
        }
    }
}

