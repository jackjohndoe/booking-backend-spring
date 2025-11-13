package com.example.booking.repository;

import com.example.booking.entity.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ReviewRepository extends JpaRepository<Review, Long> {
    Page<Review> findByListingId(Long listingId, Pageable pageable);
    Optional<Review> findByListingIdAndUserId(Long listingId, Long userId);

    @Query("SELECT AVG(r.rating) FROM Review r WHERE r.listing.id = :listingId")
    Double calculateAverageRating(@Param("listingId") Long listingId);

    long countByListingId(Long listingId);
}
