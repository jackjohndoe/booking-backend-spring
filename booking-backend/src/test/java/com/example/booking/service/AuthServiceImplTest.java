package com.example.booking.service;

import com.example.booking.dto.auth.AuthResponse;
import com.example.booking.dto.auth.LoginRequest;
import com.example.booking.dto.auth.RegisterRequest;
import com.example.booking.entity.User;
import com.example.booking.exception.BadRequestException;
import com.example.booking.repository.UserRepository;
import com.example.booking.security.JwtService;
import com.example.booking.service.impl.AuthServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    private UserService userService;

    @Mock
    private UserRepository userRepository;

    @Mock
    private JwtService jwtService;

    @Mock
    private AuthenticationManager authenticationManager;

    @InjectMocks
    private AuthServiceImpl authService;

    private RegisterRequest registerRequest;
    private LoginRequest loginRequest;
    private User user;

    @BeforeEach
    void setUp() {
        registerRequest = new RegisterRequest();
        registerRequest.setName("Ada Lovelace");
        registerRequest.setEmail("ada@example.com");
        registerRequest.setPhone("+12345678");
        registerRequest.setPassword("secret123");
        registerRequest.setRole("HOST");

        loginRequest = new LoginRequest();
        loginRequest.setEmail("ada@example.com");
        loginRequest.setPassword("secret123");

        user = User.builder()
                .id(42L)
                .email(registerRequest.getEmail())
                .role(User.Role.HOST)
                .build();
    }

    @Test
    @DisplayName("register returns JWT for newly created user")
    void register_success() {
        when(userService.registerUser(registerRequest)).thenReturn(user);
        when(jwtService.generateToken(user)).thenReturn("token");

        AuthResponse response = authService.register(registerRequest);

        verify(userService).registerUser(registerRequest);
        assertThat(response.getUserId()).isEqualTo(user.getId());
        assertThat(response.getToken()).isEqualTo("token");
    }

    @Test
    @DisplayName("login authenticates credentials then returns token")
    void login_success() {
        when(authenticationManager.authenticate(any())).thenReturn(new UsernamePasswordAuthenticationToken("key", "value"));
        when(userRepository.findByEmail(loginRequest.getEmail())).thenReturn(Optional.of(user));
        when(jwtService.generateToken(user)).thenReturn("token");

        AuthResponse response = authService.login(loginRequest);

        verify(authenticationManager).authenticate(any(UsernamePasswordAuthenticationToken.class));
        verify(jwtService).generateToken(user);
        assertThat(response.getRole()).isEqualTo(user.getRole().name());
    }

    @Test
    @DisplayName("login throws BadRequestException on authentication failure")
    void login_badCredentials() {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad creds"));

        assertThatThrownBy(() -> authService.login(loginRequest))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Invalid credentials");
    }

    @Test
    @DisplayName("login throws when user record not found")
    void login_userNotFound() {
        when(authenticationManager.authenticate(any())).thenReturn(new UsernamePasswordAuthenticationToken("key", "value"));
        when(userRepository.findByEmail(loginRequest.getEmail())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.login(loginRequest))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("User not found");
    }
}
