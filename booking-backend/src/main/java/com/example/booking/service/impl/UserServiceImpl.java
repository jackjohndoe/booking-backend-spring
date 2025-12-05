package com.example.booking.service.impl;

import com.example.booking.dto.auth.RegisterRequest;
import com.example.booking.dto.user.UserProfileResponse;
import com.example.booking.dto.user.UserProfileUpdateRequest;
import com.example.booking.entity.User;
import com.example.booking.exception.BadRequestException;
import com.example.booking.exception.ResourceNotFoundException;
import com.example.booking.repository.UserRepository;
import com.example.booking.service.StorageService;
import com.example.booking.service.UserService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final StorageService storageService;

    public UserServiceImpl(UserRepository userRepository, PasswordEncoder passwordEncoder, StorageService storageService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.storageService = storageService;
    }

    @Override
    public User registerUser(RegisterRequest registerRequest) {
        if (userRepository.existsByEmail(registerRequest.getEmail())) {
            throw new BadRequestException("An account with the email address '" + registerRequest.getEmail() + 
                    "' already exists. Please use a different email address or try logging in instead.");
        }

        User.Role role;
        try {
            role = User.Role.valueOf(registerRequest.getRole().toUpperCase());
        } catch (IllegalArgumentException | NullPointerException ex) {
            throw new BadRequestException("Invalid role specified: '" + registerRequest.getRole() + 
                    "'. Allowed values are: GUEST (for booking listings), HOST (for creating and managing listings), or ADMIN (for administrative access).");
        }

        User user = User.builder()
                .name(registerRequest.getName())
                .email(registerRequest.getEmail())
                .phone(registerRequest.getPhone())
                .password(passwordEncoder.encode(registerRequest.getPassword()))
                .role(role)
                .build();

        return userRepository.save(user);
    }

    @Override
    public User findByEmail(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new BadRequestException("User account not found with email: " + email + 
                        ". Please verify the email address is correct."));
    }

    @Override
    public UserProfileResponse getProfile(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User profile not found with ID: " + userId + 
                        ". The user may have been deleted or the ID may be incorrect."));
        return toProfileResponse(user);
    }

    @Override
    public UserProfileResponse updateProfile(Long userId, UserProfileUpdateRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User profile not found with ID: " + userId + 
                        ". The user may have been deleted or the ID may be incorrect."));

        user.setName(request.getName());
        user.setPhone(request.getPhone());
        user.setBio(request.getBio());
        user.setLocation(request.getLocation());

        return toProfileResponse(userRepository.save(user));
    }

    @Override
    public UserProfileResponse updateAvatar(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Avatar file is required. Please provide a valid image file (JPG, PNG, etc.) to update your profile picture.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User profile not found with ID: " + userId + 
                        ". The user may have been deleted or the ID may be incorrect."));

        String path = storageService.store(file, "avatars/" + userId);
        user.setAvatarUrl(storageService.resolveUrl(path));

        return toProfileResponse(userRepository.save(user));
    }

    private UserProfileResponse toProfileResponse(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .avatarUrl(user.getAvatarUrl())
                .bio(user.getBio())
                .location(user.getLocation())
                .role(user.getRole().name())
                .build();
    }
}
