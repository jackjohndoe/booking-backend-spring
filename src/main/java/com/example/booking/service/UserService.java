package com.example.booking.service;

import com.example.booking.dto.auth.RegisterRequest;
import com.example.booking.entity.User;

public interface UserService {
    User registerUser(RegisterRequest registerRequest);
    User findByEmail(String email);
}
