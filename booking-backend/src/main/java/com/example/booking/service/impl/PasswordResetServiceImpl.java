package com.example.booking.service.impl;

import com.example.booking.entity.PasswordResetToken;
import com.example.booking.entity.User;
import com.example.booking.exception.BadRequestException;
import com.example.booking.exception.ResourceNotFoundException;
import com.example.booking.repository.PasswordResetTokenRepository;
import com.example.booking.repository.UserRepository;
import com.example.booking.service.EmailService;
import com.example.booking.service.PasswordResetService;
import com.example.booking.util.TokenGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class PasswordResetServiceImpl implements PasswordResetService {

    private static final int TOKEN_EXPIRY_MINUTES = 15;
    private static final int RATE_LIMIT_REQUESTS = 3;
    private static final int RATE_LIMIT_WINDOW_HOURS = 1;

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final EmailService emailService;
    private final PasswordEncoder passwordEncoder;
    private final CacheManager cacheManager;

    @Override
    @Transactional
    public void requestPasswordReset(String email) {
        // Rate limiting check
        checkRateLimit(email);

        // Check if email exists (but don't reveal result for security)
        User user = userRepository.findByEmail(email.toLowerCase().trim())
                .orElse(null);

        // Always return success message regardless of email existence (security best practice)
        if (user == null) {
            log.info("Password reset requested for non-existent email: {}", email);
            // Still increment rate limit counter
            incrementRateLimit(email);
            return; // Silent success - don't reveal email doesn't exist
        }

        // Invalidate all previous tokens for this user
        tokenRepository.markAllAsUsedByUser(user);

        // Generate secure token
        String rawToken = TokenGenerator.generateToken();
        String hashedToken = passwordEncoder.encode(rawToken);

        // Create token entity
        PasswordResetToken token = PasswordResetToken.builder()
                .token(hashedToken)
                .user(user)
                .expiryDate(OffsetDateTime.now().plusMinutes(TOKEN_EXPIRY_MINUTES))
                .used(false)
                .createdAt(OffsetDateTime.now())
                .build();

        tokenRepository.save(token);

        // Send email with raw token (not hashed)
        try {
            emailService.sendPasswordResetEmail(user.getEmail(), rawToken);
            log.info("Password reset email sent successfully to user: {}", user.getEmail());
        } catch (Exception e) {
            log.error("Failed to send password reset email to: {}. Error: {}", user.getEmail(), e.getMessage(), e);
            // Don't throw - still return success to user (security best practice)
            // The token is still created and valid, user just won't receive email
        }

        // Increment rate limit counter
        incrementRateLimit(email);
    }

    @Override
    public boolean validateToken(String token) {
        if (token == null || token.trim().isEmpty()) {
            return false;
        }

        // Hash the incoming token to compare with stored hashed tokens
        // We need to check all tokens since we can't directly compare
        List<PasswordResetToken> tokens = tokenRepository.findAll();

        for (PasswordResetToken storedToken : tokens) {
            if (passwordEncoder.matches(token, storedToken.getToken())) {
                return storedToken.isValid();
            }
        }

        return false;
    }

    @Override
    @Transactional
    public void resetPassword(String token, String newPassword) {
        if (token == null || token.trim().isEmpty()) {
            throw new BadRequestException("Reset token is required");
        }

        // Find the token by comparing hashed values
        PasswordResetToken resetToken = null;
        List<PasswordResetToken> tokens = tokenRepository.findAll();

        for (PasswordResetToken storedToken : tokens) {
            if (passwordEncoder.matches(token, storedToken.getToken())) {
                resetToken = storedToken;
                break;
            }
        }

        if (resetToken == null) {
            throw new BadRequestException("Invalid or expired reset token");
        }

        // Validate token
        if (resetToken.getUsed()) {
            throw new BadRequestException("This reset token has already been used");
        }

        if (resetToken.isExpired()) {
            throw new BadRequestException("This reset token has expired. Please request a new one.");
        }

        // Get user
        User user = resetToken.getUser();
        if (user == null) {
            throw new ResourceNotFoundException("User associated with this token not found");
        }

        // Hash and update password
        String hashedPassword = passwordEncoder.encode(newPassword);
        user.setPassword(hashedPassword);
        userRepository.save(user);

        // Mark token as used
        resetToken.setUsed(true);
        tokenRepository.save(resetToken);

        // Delete all tokens for this user (cleanup)
        tokenRepository.deleteByUser(user);

        // Clear rate limit cache for this user
        clearRateLimit(user.getEmail());

        log.info("Password reset successfully completed for user: {}", user.getEmail());
    }

    private void checkRateLimit(String email) {
        Cache cache = cacheManager.getCache("passwordResetRequests");
        if (cache == null) {
            return;
        }

        String cacheKey = email.toLowerCase().trim();
        @SuppressWarnings("unchecked")
        List<Long> requestTimes = cache.get(cacheKey, List.class);

        if (requestTimes != null) {
            long now = System.currentTimeMillis();
            long windowStart = now - TimeUnit.HOURS.toMillis(RATE_LIMIT_WINDOW_HOURS);

            // Remove old requests outside the window
            requestTimes.removeIf(time -> time < windowStart);

            if (requestTimes.size() >= RATE_LIMIT_REQUESTS) {
                long oldestRequest = requestTimes.get(0);
                long waitTimeMinutes = TimeUnit.MILLISECONDS.toMinutes(
                        (oldestRequest + TimeUnit.HOURS.toMillis(RATE_LIMIT_WINDOW_HOURS)) - now
                ) + 1;
                throw new BadRequestException(
                        String.format("Too many password reset requests. Please wait %d minute(s) before trying again.", 
                                waitTimeMinutes)
                );
            }
        }
    }

    private void incrementRateLimit(String email) {
        Cache cache = cacheManager.getCache("passwordResetRequests");
        if (cache == null) {
            return;
        }

        String cacheKey = email.toLowerCase().trim();
        @SuppressWarnings("unchecked")
        List<Long> requestTimes = cache.get(cacheKey, List.class);

        if (requestTimes == null) {
            requestTimes = new java.util.ArrayList<>();
        }

        requestTimes.add(System.currentTimeMillis());
        cache.put(cacheKey, requestTimes);
    }

    private void clearRateLimit(String email) {
        Cache cache = cacheManager.getCache("passwordResetRequests");
        if (cache == null) {
            return;
        }

        cache.evict(email.toLowerCase().trim());
    }
}

