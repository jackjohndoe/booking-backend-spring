package com.example.booking.service;

import com.example.booking.dto.auth.RegisterRequest;
import com.example.booking.dto.user.UserProfileResponse;
import com.example.booking.dto.user.UserProfileUpdateRequest;
import com.example.booking.entity.User;
import org.springframework.web.multipart.MultipartFile;

public interface UserService {
    User registerUser(RegisterRequest registerRequest);
    User findByEmail(String email);
    UserProfileResponse getProfile(Long userId);
    UserProfileResponse updateProfile(Long userId, UserProfileUpdateRequest request);
    UserProfileResponse updateAvatar(Long userId, MultipartFile file);
}
