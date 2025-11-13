package com.example.booking.dto.listing;

import org.springframework.format.annotation.DateTimeFormat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

public record ListingFilterRequest(
        String location,
        BigDecimal minPrice,
        BigDecimal maxPrice,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
        Set<String> amenities
) {
}
