package com.example.booking.dto.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
@Schema(description = "User registration request")
public class RegisterRequest {
    @NotBlank
    @Schema(description = "User's full name", example = "John Doe")
    private String name;

    @Email
    @NotBlank
    @Schema(description = "User's email address", example = "john.doe@example.com")
    private String email;

//    @NotBlank
    @Schema(description = "User's phone number", example = "+2348012345678")
    private String phone;

    @Size(min = 6, message = "Password must be at least 6 characters")
    @Schema(description = "User's password (minimum 6 characters)", example = "securePassword123")
    private String password;

    @NotBlank
    @Schema(description = "User role. Allowed values: GUEST, HOST", 
            example = "GUEST", 
            allowableValues = {"GUEST", "HOST"})
    private String role;
}
