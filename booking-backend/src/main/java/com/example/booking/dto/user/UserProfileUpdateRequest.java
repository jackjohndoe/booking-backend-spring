package com.example.booking.dto.user;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UserProfileUpdateRequest {
    @NotBlank
    private String name;
    private String phone;
    private String bio;
    private String location;
}
