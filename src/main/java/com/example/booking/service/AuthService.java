package com.example.booking.service;

import com.example.booking.dto.auth.AuthResponse;
import com.example.booking.dto.auth.LoginRequest;
import com.example.booking.dto.auth.RegisterRequest;

public interface AuthService {
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
}
