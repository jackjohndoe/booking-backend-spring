package com.example.booking.dto.listing;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Set;

@Data
public class ListingRequest {
    @NotBlank
    private String title;

    private String description;

    @NotNull
    private BigDecimal price;

    @NotBlank
    private String location;

    private Set<String> amenities;

    private Set<String> policies;
}
