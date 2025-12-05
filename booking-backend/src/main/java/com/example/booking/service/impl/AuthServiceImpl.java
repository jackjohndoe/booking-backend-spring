package com.example.booking.service.impl;

import com.example.booking.dto.auth.AuthResponse;
import com.example.booking.dto.auth.LoginRequest;
import com.example.booking.dto.auth.RegisterRequest;
import com.example.booking.entity.User;
import com.example.booking.exception.BadRequestException;
import com.example.booking.repository.UserRepository;
import com.example.booking.security.JwtService;
import com.example.booking.service.AuthService;
import com.example.booking.service.UserService;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;

@Service
public class AuthServiceImpl implements AuthService {

    private final UserService userService;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    public AuthServiceImpl(UserService userService,
                           UserRepository userRepository,
                           JwtService jwtService,
                           AuthenticationManager authenticationManager) {
        this.userService = userService;
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.authenticationManager = authenticationManager;
    }

    @Override
    public AuthResponse register(RegisterRequest request) {
        User user = userService.registerUser(request);
        String token = jwtService.generateToken(user);
        return AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );
        } catch (AuthenticationException ex) {
            throw new BadRequestException("Invalid email or password. Please check your credentials and try again. " +
                    "If you've forgotten your password, please use the password reset feature.");
        }

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadRequestException("User account not found with email: " + request.getEmail() + 
                        ". Please verify the email address or register a new account."));

        String token = jwtService.generateToken(user);
        return AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }
}
