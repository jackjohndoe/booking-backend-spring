package com.example.booking.dto.booking;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;

@Value
@Builder
public class BookingResponse {
    Long id;
    Long listingId;
    Long userId;
    LocalDate startDate;
    LocalDate endDate;
    BigDecimal totalPrice;
    String status;
    BookingListingSummary listing;
}
