package com.example.booking.dto.user;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class UserProfileResponse {
    Long id;
    String name;
    String email;
    String phone;
    String avatarUrl;
    String bio;
    String location;
    String role;
}
