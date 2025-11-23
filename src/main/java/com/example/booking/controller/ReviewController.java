package com.example.booking.controller;

import com.example.booking.dto.common.PageResponse;
import com.example.booking.dto.review.ReviewRequest;
import com.example.booking.dto.review.ReviewResponse;
import com.example.booking.security.BookingUserDetails;
import com.example.booking.service.ReviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/listings/{listingId}/reviews")
@Tag(name = "Reviews", description = "Listing review and rating endpoints")
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @Operation(summary = "Create a review", description = "Creates a review for a listing. User must have booked the listing.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Review created successfully",
                    content = @Content(schema = @Schema(implementation = ReviewResponse.class))),
            @ApiResponse(responseCode = "400", description = "User hasn't booked this listing or review already exists"),
            @ApiResponse(responseCode = "404", description = "Listing not found")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping
    public ResponseEntity<ReviewResponse> createReview(
            @Parameter(description = "Listing ID") @PathVariable Long listingId,
            @Valid @RequestBody ReviewRequest request,
            @AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(reviewService.createReview(listingId, request, userDetails.getUser()));
    }

    @Operation(summary = "Update a review", description = "Updates an existing review. Review author or ADMIN can update.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Review updated successfully",
                    content = @Content(schema = @Schema(implementation = ReviewResponse.class))),
            @ApiResponse(responseCode = "400", description = "Unauthorized"),
            @ApiResponse(responseCode = "404", description = "Review not found")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PutMapping("/{reviewId}")
    public ResponseEntity<ReviewResponse> updateReview(
            @Parameter(description = "Listing ID") @PathVariable Long listingId,
            @Parameter(description = "Review ID") @PathVariable Long reviewId,
            @Valid @RequestBody ReviewRequest request,
            @AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(reviewService.updateReview(reviewId, request, userDetails.getUser()));
    }

    @Operation(summary = "Delete a review", description = "Deletes a review. Review author, listing host, or ADMIN can delete.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Review deleted successfully"),
            @ApiResponse(responseCode = "400", description = "Unauthorized"),
            @ApiResponse(responseCode = "404", description = "Review not found")
    })
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{reviewId}")
    public ResponseEntity<Void> deleteReview(
            @Parameter(description = "Listing ID") @PathVariable Long listingId,
            @Parameter(description = "Review ID") @PathVariable Long reviewId,
            @AuthenticationPrincipal BookingUserDetails userDetails) {
        reviewService.deleteReview(reviewId, userDetails.getUser());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Get reviews for a listing", description = "Retrieves paginated reviews for a listing. Public endpoint.")
    @ApiResponse(responseCode = "200", description = "Reviews retrieved successfully",
            content = @Content(schema = @Schema(implementation = PageResponse.class)))
    @GetMapping
    public ResponseEntity<PageResponse<ReviewResponse>> getReviews(
            @Parameter(description = "Listing ID") @PathVariable Long listingId,
            @Parameter(description = "Page number (0-indexed)") @RequestParam(name = "page", defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(name = "size", defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(PageResponse.from(reviewService.getReviewsForListing(listingId, pageable)));
    }
}
