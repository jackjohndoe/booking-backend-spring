package com.example.booking.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RegisterRequest {
    @NotBlank
    private String name;

    @Email
    @NotBlank
    private String email;

//    @NotBlank
    private String phone;

    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;

    @NotBlank
    private String role;
}
