package com.example.booking.service;

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
import com.example.booking.service.impl.ReviewServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewServiceImplTest {

    @Mock
    private ReviewRepository reviewRepository;

    @Mock
    private ListingRepository listingRepository;

    @Mock
    private BookingRepository bookingRepository;

    @InjectMocks
    private ReviewServiceImpl reviewService;

    private User guest;
    private User host;
    private Listing listing;
    private ReviewRequest request;

    @BeforeEach
    void setUp() {
        guest = User.builder().id(1L).name("Guest").role(User.Role.GUEST).build();
        host = User.builder().id(2L).name("Host").role(User.Role.HOST).build();
        listing = Listing.builder().id(100L).host(host).build();

        request = new ReviewRequest();
        request.setRating(5);
        request.setComment("Wonderful stay!");
    }

    @Test
    @DisplayName("createReview saves review and updates aggregates")
    void createReview_success() {
        when(listingRepository.findById(listing.getId())).thenReturn(Optional.of(listing));
        when(bookingRepository.existsByListingIdAndUserId(listing.getId(), guest.getId())).thenReturn(true);
        when(reviewRepository.findByListingIdAndUserId(listing.getId(), guest.getId())).thenReturn(Optional.empty());
        when(reviewRepository.save(any(Review.class))).thenAnswer(invocation -> {
            Review review = invocation.getArgument(0);
            review.setId(50L);
            review.setListing(listing);
            review.setUser(guest);
            return review;
        });
        when(reviewRepository.calculateAverageRating(listing.getId())).thenReturn(5.0);
        when(reviewRepository.countByListingId(listing.getId())).thenReturn(1L);

        ReviewResponse response = reviewService.createReview(listing.getId(), request, guest);

        assertThat(response.getRating()).isEqualTo(5);
        assertThat(listing.getAverageRating()).isEqualTo(5.0);
        assertThat(listing.getReviewCount()).isEqualTo(1);
        verify(listingRepository).save(listing);
    }

    @Test
    @DisplayName("createReview forbids users without bookings")
    void createReview_withoutBooking() {
        when(listingRepository.findById(listing.getId())).thenReturn(Optional.of(listing));
        when(bookingRepository.existsByListingIdAndUserId(listing.getId(), guest.getId())).thenReturn(false);

        assertThatThrownBy(() -> reviewService.createReview(listing.getId(), request, guest))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("booked");
    }

    @Test
    @DisplayName("updateReview allows owners to edit their review")
    void updateReview_success() {
        Review existing = Review.builder().id(10L).listing(listing).user(guest).rating(3).comment("Ok").build();
        when(reviewRepository.findById(existing.getId())).thenReturn(Optional.of(existing));
        when(reviewRepository.save(existing)).thenReturn(existing);
        when(reviewRepository.calculateAverageRating(listing.getId())).thenReturn(4.0);
        when(reviewRepository.countByListingId(listing.getId())).thenReturn(1L);

        ReviewResponse response = reviewService.updateReview(existing.getId(), request, guest);

        assertThat(existing.getRating()).isEqualTo(5);
        assertThat(response.getComment()).isEqualTo("Wonderful stay!");
        verify(listingRepository).save(listing);
    }

    @Test
    @DisplayName("deleteReview allows host to remove it")
    void deleteReview_hostCanDelete() {
        Review review = Review.builder().id(30L).listing(listing).user(guest).rating(4).comment("Nice").build();
        when(reviewRepository.findById(review.getId())).thenReturn(Optional.of(review));
        when(reviewRepository.calculateAverageRating(listing.getId())).thenReturn(0.0);
        when(reviewRepository.countByListingId(listing.getId())).thenReturn(0L);

        reviewService.deleteReview(review.getId(), host);

        verify(reviewRepository).delete(review);
        verify(listingRepository).save(listing);
    }

    @Test
    @DisplayName("getReviewsForListing returns paged responses")
    void getReviews_success() {
        Review review = Review.builder().id(40L).listing(listing).user(guest).rating(5).comment("Great").build();
        Page<Review> page = new PageImpl<>(List.of(review));
        when(reviewRepository.findByListingId(eq(listing.getId()), any(Pageable.class))).thenReturn(page);

        Page<ReviewResponse> result = reviewService.getReviewsForListing(listing.getId(), PageRequest.of(0, 5));

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getRating()).isEqualTo(5);
    }

    @Test
    @DisplayName("updateReview throws when review not found")
    void updateReview_notFound() {
        when(reviewRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reviewService.updateReview(999L, request, guest))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("deleteReview forbids other guests")
    void deleteReview_unauthorized() {
        Review review = Review.builder().id(31L).listing(listing).user(guest).rating(4).comment("Nice").build();
        User stranger = User.builder().id(999L).role(User.Role.GUEST).build();
        when(reviewRepository.findById(review.getId())).thenReturn(Optional.of(review));

        assertThatThrownBy(() -> reviewService.deleteReview(review.getId(), stranger))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("not allowed");
    }
}
