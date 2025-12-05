package com.example.booking.dto.listing;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;

@Value
@Builder
public class ListingResponse {
    Long id;
    String title;
    String description;
    BigDecimal price;
    String location;
    OffsetDateTime createdAt;
    Long hostId;
    String hostName;
    Set<String> amenities;
    Set<String> policies;
    Double averageRating;
    Integer reviewCount;
    Set<String> photos;
    boolean favorite;
}
