package com.example.booking.util;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * Utility class for generating secure random tokens for password reset.
 * Tokens are generated using SecureRandom and encoded in Base64 URL-safe format.
 * Never log tokens - they are sensitive security credentials.
 */
public class TokenGenerator {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32; // 32 bytes = 256 bits

    /**
     * Generates a secure random token suitable for password reset.
     * The token is 32 bytes (256 bits) of cryptographically secure random data,
     * encoded in Base64 URL-safe format.
     *
     * @return A secure random token string
     */
    public static String generateToken() {
        byte[] tokenBytes = new byte[TOKEN_BYTES];
        SECURE_RANDOM.nextBytes(tokenBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
    }

    /**
     * Generates a token with custom length (minimum 32 bytes recommended).
     *
     * @param bytes Number of bytes for the token (minimum 32 recommended)
     * @return A secure random token string
     */
    public static String generateToken(int bytes) {
        if (bytes < 32) {
            throw new IllegalArgumentException("Token length must be at least 32 bytes for security");
        }
        byte[] tokenBytes = new byte[bytes];
        SECURE_RANDOM.nextBytes(tokenBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
    }
}

