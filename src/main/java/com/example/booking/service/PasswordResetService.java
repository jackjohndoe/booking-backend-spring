package com.example.booking.service;

public interface PasswordResetService {
    void requestPasswordReset(String email);
    boolean validateToken(String token);
    void resetPassword(String token, String newPassword);
}

