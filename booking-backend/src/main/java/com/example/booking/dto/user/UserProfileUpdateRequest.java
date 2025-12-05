package com.example.booking.dto.user;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(description = "Request to update user profile")
public class UserProfileUpdateRequest {
    @NotBlank
    @Schema(description = "User's full name", example = "John Doe")
    private String name;
    
    @Schema(description = "User's phone number", example = "+2348012345678")
    private String phone;
    
    @Schema(description = "User's bio/description", example = "Travel enthusiast and apartment host")
    private String bio;
    
    @Schema(description = "User's location", example = "New York, NY")
    private String location;
}
