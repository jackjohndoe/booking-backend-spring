package com.example.booking.service;

import com.example.booking.dto.review.ReviewRequest;
import com.example.booking.dto.review.ReviewResponse;
import com.example.booking.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ReviewService {
    ReviewResponse createReview(Long listingId, ReviewRequest request, User user);
    ReviewResponse updateReview(Long reviewId, ReviewRequest request, User user);
    void deleteReview(Long reviewId, User user);
    Page<ReviewResponse> getReviewsForListing(Long listingId, Pageable pageable);
}
