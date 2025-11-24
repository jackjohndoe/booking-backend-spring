package com.example.booking.dto.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(description = "User login request")
public class LoginRequest {
    @Email
    @NotBlank
    @Schema(description = "User's email address", example = "john.doe@example.com")
    private String email;

    @NotBlank
    @Schema(description = "User's password", example = "securePassword123")
    private String password;
}
