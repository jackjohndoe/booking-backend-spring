package com.example.booking.repository;

import com.example.booking.entity.Favorite;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Set;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {
    boolean existsByUserIdAndListingId(Long userId, Long listingId);
    void deleteByUserIdAndListingId(Long userId, Long listingId);
    Page<Favorite> findByUserId(Long userId, Pageable pageable);

    @Query("SELECT f.listing.id FROM Favorite f WHERE f.user.id = :userId")
    Set<Long> findListingIdsByUserId(@Param("userId") Long userId);
}
