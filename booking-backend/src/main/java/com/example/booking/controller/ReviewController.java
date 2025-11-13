package com.example.booking.controller;

import com.example.booking.dto.common.PageResponse;
import com.example.booking.dto.review.ReviewRequest;
import com.example.booking.dto.review.ReviewResponse;
import com.example.booking.security.BookingUserDetails;
import com.example.booking.service.ReviewService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/listings/{listingId}/reviews")
public class ReviewController {

    private final ReviewService reviewService;

    public ReviewController(ReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @PostMapping
    public ResponseEntity<ReviewResponse> createReview(@PathVariable Long listingId,
                                                       @Valid @RequestBody ReviewRequest request,
                                                       @AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(reviewService.createReview(listingId, request, userDetails.getUser()));
    }

    @PutMapping("/{reviewId}")
    public ResponseEntity<ReviewResponse> updateReview(@PathVariable Long listingId,
                                                       @PathVariable Long reviewId,
                                                       @Valid @RequestBody ReviewRequest request,
                                                       @AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(reviewService.updateReview(reviewId, request, userDetails.getUser()));
    }

    @DeleteMapping("/{reviewId}")
    public ResponseEntity<Void> deleteReview(@PathVariable Long listingId,
                                             @PathVariable Long reviewId,
                                             @AuthenticationPrincipal BookingUserDetails userDetails) {
        reviewService.deleteReview(reviewId, userDetails.getUser());
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<PageResponse<ReviewResponse>> getReviews(@PathVariable Long listingId,
                                                                   @RequestParam(name = "page", defaultValue = "0") int page,
                                                                   @RequestParam(name = "size", defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(PageResponse.from(reviewService.getReviewsForListing(listingId, pageable)));
    }
}
