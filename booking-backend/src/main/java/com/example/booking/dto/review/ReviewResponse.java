package com.example.booking.dto.review;

import lombok.Builder;
import lombok.Value;

import java.time.OffsetDateTime;

@Value
@Builder
public class ReviewResponse {
    Long id;
    Long listingId;
    Long userId;
    String userName;
    int rating;
    String comment;
    OffsetDateTime createdAt;
    OffsetDateTime updatedAt;
}
