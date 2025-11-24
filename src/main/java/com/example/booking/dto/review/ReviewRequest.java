package com.example.booking.dto.review;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
@Schema(description = "Request to create or update a review")
public class ReviewRequest {
    @Min(1)
    @Max(5)
    @Schema(description = "Rating from 1 to 5", example = "5", minimum = "1", maximum = "5")
    private int rating;

    @NotBlank
    @Schema(description = "Review comment", example = "Great place! Very clean and well-maintained. Would definitely stay again.")
    private String comment;
}
