package com.example.booking.service;

public interface EmailService {
    void sendPasswordResetEmail(String toEmail, String resetToken);
}

