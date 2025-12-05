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
import com.example.booking.service.AuditService;
import com.example.booking.service.ReviewService;
import com.example.booking.util.SecurityUtils;
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
    private final AuditService auditService;

    public ReviewServiceImpl(ReviewRepository reviewRepository,
                             ListingRepository listingRepository,
                             BookingRepository bookingRepository,
                             AuditService auditService) {
        this.reviewRepository = reviewRepository;
        this.listingRepository = listingRepository;
        this.bookingRepository = bookingRepository;
        this.auditService = auditService;
    }

    @Override
    public ReviewResponse createReview(Long listingId, ReviewRequest request, User user) {
        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with ID: " + listingId + 
                        ". The listing may have been deleted or the ID may be incorrect."));

        if (!bookingRepository.existsByListingIdAndUserId(listingId, user.getId())) {
            throw new BadRequestException("You can only review listings that you have booked. " +
                    "Please complete a booking for this listing before submitting a review.");
        }

        reviewRepository.findByListingIdAndUserId(listingId, user.getId())
                .ifPresent(review -> { throw new BadRequestException("You have already submitted a review for this listing. " +
                        "You can update your existing review instead of creating a new one."); });

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
                .orElseThrow(() -> new ResourceNotFoundException("Review not found with ID: " + reviewId + 
                        ". The review may have been deleted or the ID may be incorrect."));

        boolean isAdminAction = SecurityUtils.isAdmin(user) && !review.getUser().getId().equals(user.getId());

        if (!isAdminAction && !review.getUser().getId().equals(user.getId())) {
            throw new BadRequestException("You can only update your own reviews. " +
                    "Only the review author or an administrator can modify a review.");
        }

        review.setRating(request.getRating());
        review.setComment(request.getComment());

        Review saved = reviewRepository.save(review);
        updateListingAggregates(review.getListing());
        
        if (isAdminAction) {
            auditService.logAdminAction(user, "REVIEW_UPDATE", "Review", reviewId, 
                    String.format("Admin updated review #%d (author: %d, listing: %d)", reviewId, 
                            review.getUser().getId(), review.getListing().getId()));
        }
        
        return toResponse(saved);
    }

    @Override
    public void deleteReview(Long reviewId, User user) {
        Review review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResourceNotFoundException("Review not found with ID: " + reviewId + 
                        ". The review may have been deleted or the ID may be incorrect."));

        boolean isAdminAction = SecurityUtils.isAdmin(user) && 
                !review.getUser().getId().equals(user.getId()) &&
                (review.getListing().getHost() == null || !review.getListing().getHost().getId().equals(user.getId()));

        if (!isAdminAction && !review.getUser().getId().equals(user.getId()) &&
                (review.getListing().getHost() == null || !review.getListing().getHost().getId().equals(user.getId()))) {
            throw new BadRequestException("You do not have permission to delete this review. " +
                    "Only the review author, the listing host, or an administrator can delete reviews.");
        }

        Listing listing = review.getListing();
        Long authorId = review.getUser().getId();
        Long listingId = listing.getId();
        
        reviewRepository.delete(review);
        updateListingAggregates(listing);
        
        if (isAdminAction) {
            auditService.logAdminAction(user, "REVIEW_DELETE", "Review", reviewId, 
                    String.format("Admin deleted review #%d (author: %d, listing: %d)", reviewId, authorId, listingId));
        }
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
