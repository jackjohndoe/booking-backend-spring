package com.example.booking.repository;

import com.example.booking.entity.Booking;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    @Query("SELECT b FROM Booking b WHERE b.listing.id = :listingId AND b.startDate < :endDate AND b.endDate > :startDate")
    List<Booking> findOverlappingBookings(@Param("listingId") Long listingId,
                                          @Param("startDate") LocalDate startDate,
                                          @Param("endDate") LocalDate endDate);

    Page<Booking> findByUserId(Long userId, Pageable pageable);

    boolean existsByListingIdAndUserId(Long listingId, Long userId);

    Page<Booking> findByUserIdAndEndDateBefore(Long userId, LocalDate date, Pageable pageable);

    Page<Booking> findByUserIdAndStartDateAfter(Long userId, LocalDate date, Pageable pageable);

    Page<Booking> findByUserIdAndStartDateLessThanEqualAndEndDateGreaterThanEqual(Long userId, LocalDate start, LocalDate end, Pageable pageable);
}
