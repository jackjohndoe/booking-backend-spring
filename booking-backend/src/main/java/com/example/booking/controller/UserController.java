package com.example.booking.controller;

import com.example.booking.dto.user.UserProfileResponse;
import com.example.booking.dto.user.UserProfileUpdateRequest;
import com.example.booking.security.BookingUserDetails;
import com.example.booking.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "User Profile", description = "User profile management endpoints")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @Operation(summary = "Get user profile", description = "Retrieves the authenticated user's profile")
    @ApiResponse(responseCode = "200", description = "Profile retrieved successfully",
            content = @Content(schema = @Schema(implementation = UserProfileResponse.class)))
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping
    public ResponseEntity<UserProfileResponse> getProfile(@AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(userService.getProfile(userDetails.getUser().getId()));
    }

    @Operation(summary = "Update user profile", description = "Updates the authenticated user's profile information")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Profile updated successfully",
                    content = @Content(schema = @Schema(implementation = UserProfileResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid input")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping
    public ResponseEntity<UserProfileResponse> updateProfile(@AuthenticationPrincipal BookingUserDetails userDetails,
                                                             @Valid @RequestBody UserProfileUpdateRequest request) {
        return ResponseEntity.ok(userService.updateProfile(userDetails.getUser().getId(), request));
    }

    @Operation(summary = "Update user avatar", description = "Uploads a new avatar image for the authenticated user")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Avatar updated successfully",
                    content = @Content(schema = @Schema(implementation = UserProfileResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid file")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/avatar")
    public ResponseEntity<UserProfileResponse> updateAvatar(@AuthenticationPrincipal BookingUserDetails userDetails,
                                                            @RequestParam(name = "file") MultipartFile file) {
        return ResponseEntity.ok(userService.updateAvatar(userDetails.getUser().getId(), file));
    }
}
