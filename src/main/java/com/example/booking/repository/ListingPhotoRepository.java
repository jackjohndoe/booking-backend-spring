package com.example.booking.repository;

import com.example.booking.entity.ListingPhoto;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ListingPhotoRepository extends JpaRepository<ListingPhoto, Long> {
    Optional<ListingPhoto> findByIdAndListingId(Long id, Long listingId);
}
