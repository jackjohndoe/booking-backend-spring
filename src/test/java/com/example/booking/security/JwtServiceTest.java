package com.example.booking.security;

import com.example.booking.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private final String secret = Base64.getEncoder().encodeToString("super-secret-key-value-which-is-long".getBytes());
    private final long expiration = 3_600_000L;
    private final JwtService jwtService = new JwtService(secret, expiration);

    @Test
    @DisplayName("generateToken creates token that can be validated")
    void generateAndValidateToken() {
        User user = User.builder()
                .id(1L)
                .email("test@example.com")
                .role(User.Role.GUEST)
                .build();

        String token = jwtService.generateToken(user);

        assertThat(token).isNotBlank();
        assertThat(jwtService.extractUsername(token)).isEqualTo(user.getEmail());
        assertThat(jwtService.isTokenValid(token, user)).isTrue();
    }
}
