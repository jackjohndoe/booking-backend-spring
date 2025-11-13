package com.example.booking.dto.auth;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AuthResponse {
    String token;
    Long userId;
    String email;
    String role;
}
