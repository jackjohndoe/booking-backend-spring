package com.example.booking.controller;

import com.example.booking.dto.user.UserProfileResponse;
import com.example.booking.dto.user.UserProfileUpdateRequest;
import com.example.booking.security.BookingUserDetails;
import com.example.booking.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/users/me")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<UserProfileResponse> getProfile(@AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(userService.getProfile(userDetails.getUser().getId()));
    }

    @PutMapping
    public ResponseEntity<UserProfileResponse> updateProfile(@AuthenticationPrincipal BookingUserDetails userDetails,
                                                             @Valid @RequestBody UserProfileUpdateRequest request) {
        return ResponseEntity.ok(userService.updateProfile(userDetails.getUser().getId(), request));
    }

    @PostMapping("/avatar")
    public ResponseEntity<UserProfileResponse> updateAvatar(@AuthenticationPrincipal BookingUserDetails userDetails,
                                                            @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(userService.updateAvatar(userDetails.getUser().getId(), file));
    }
}
