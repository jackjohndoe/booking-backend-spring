package com.example.booking.service.impl;

import com.example.booking.dto.review.ReviewRequest;
import com.example.booking.dto.review.ReviewResponse;
import com.example.booking.entity.Listing;
import com.example.booking.entity.Review;
import com.example.booking.entity.User;
import com.example.booking.exception.BadRequestException;
import com.example.booking.exception.ResourceNotFoundException;
import com.example.booking.repository.BookingRepository;
import com.example.booking.repository.ListingRepository;
import com.example.booking.repository.ReviewRepository;
import com.example.booking.service.ReviewService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ReviewServiceImpl implements ReviewService {

    private final ReviewRepository reviewRepository;
    private final ListingRepository listingRepository;
    private final BookingRepository bookingRepository;

    public ReviewServiceImpl(ReviewRepository reviewRepository,
                             ListingRepository listingRepository,
                             BookingRepository bookingRepository) {
        this.reviewRepository = reviewRepository;
        this.listingRepository = listingRepository;
        this.bookingRepository = bookingRepository;
    }

    @Override
    public ReviewResponse createReview(Long listingId, ReviewRequest request, User user) {
        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + listingId));

        if (!bookingRepository.existsByListingIdAndUserId(listingId, user.getId())) {
            throw new BadRequestException("You can only review listings you have booked");
        }

        reviewRepository.findByListingIdAndUserId(listingId, user.getId())
                .ifPresent(review -> { throw new BadRequestException("You have already reviewed this listing"); });

        Review review = Review.builder()
                .listing(listing)
                .user(user)
                .rating(request.getRating())
                .comment(request.getComment())
                .build();

        Review saved = reviewRepository.save(review);
        updateListingAggregates(listing);
        return toResponse(saved);
    }

    @Override
    public ReviewResponse updateReview(Long reviewId, ReviewRequest request, User user) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found with id: " + reviewId));

        if (!review.getUser().getId().equals(user.getId())) {
            throw new BadRequestException("You can only update your own review");
        }

        review.setRating(request.getRating());
        review.setComment(request.getComment());

        Review saved = reviewRepository.save(review);
        updateListingAggregates(review.getListing());
        return toResponse(saved);
    }

    @Override
    public void deleteReview(Long reviewId, User user) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found with id: " + reviewId));

        if (!review.getUser().getId().equals(user.getId()) &&
                (review.getListing().getHost() == null || !review.getListing().getHost().getId().equals(user.getId()))) {
            throw new BadRequestException("You are not allowed to delete this review");
        }

        Listing listing = review.getListing();
        reviewRepository.delete(review);
        updateListingAggregates(listing);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ReviewResponse> getReviewsForListing(Long listingId, Pageable pageable) {
        return reviewRepository.findByListingId(listingId, pageable).map(this::toResponse);
    }

    private void updateListingAggregates(Listing listing) {
        Double average = reviewRepository.calculateAverageRating(listing.getId());
        long count = reviewRepository.countByListingId(listing.getId());
        listing.setAverageRating(average == null ? 0.0 : Math.round(average * 10.0) / 10.0);
        listing.setReviewCount((int) count);
        listingRepository.save(listing);
    }

    private ReviewResponse toResponse(Review review) {
        return ReviewResponse.builder()
                .id(review.getId())
                .listingId(review.getListing().getId())
                .userId(review.getUser().getId())
                .userName(review.getUser().getName())
                .rating(review.getRating())
                .comment(review.getComment())
                .createdAt(review.getCreatedAt())
                .updatedAt(review.getUpdatedAt())
                .build();
    }
}
