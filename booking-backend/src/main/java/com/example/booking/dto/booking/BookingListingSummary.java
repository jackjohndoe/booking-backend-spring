package com.example.booking.dto.booking;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class BookingListingSummary {
    Long id;
    String title;
    String location;
    BigDecimal price;
    Double averageRating;
    Integer reviewCount;
}
