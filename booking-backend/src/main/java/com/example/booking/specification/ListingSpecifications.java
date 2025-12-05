package com.example.booking.specification;

import com.example.booking.entity.Booking;
import com.example.booking.entity.Listing;
import com.example.booking.model.Amenity;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;

public final class ListingSpecifications {

    private ListingSpecifications() {
    }

    public static Specification<Listing> withFilters(String location,
                                                     BigDecimal minPrice,
                                                     BigDecimal maxPrice,
                                                     Set<Amenity> amenities,
                                                     LocalDate startDate,
                                                     LocalDate endDate) {
        Specification<Listing> spec = Specification.where(null);

        if (location != null && !location.isBlank()) {
            spec = spec.and((root, query, cb) ->
                    cb.like(cb.lower(root.get("location")), "%" + location.trim().toLowerCase() + "%"));
        }

        if (minPrice != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("price"), minPrice));
        }

        if (maxPrice != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("price"), maxPrice));
        }

        if (amenities != null && !amenities.isEmpty()) {
            for (Amenity amenity : amenities) {
                spec = spec.and((root, query, cb) -> {
                    query.distinct(true);
                    return cb.isMember(amenity, root.get("amenities"));
                });
            }
        }

        if (startDate != null && endDate != null) {
            spec = spec.and((root, query, cb) -> {
                Subquery<Long> subquery = query.subquery(Long.class);
                var bookingRoot = subquery.from(Booking.class);
                subquery.select(cb.literal(1L));
                subquery.where(
                        cb.equal(bookingRoot.get("listing"), root),
                        cb.lessThan(bookingRoot.get("startDate"), endDate),
                        cb.greaterThan(bookingRoot.get("endDate"), startDate)
                );
                return cb.not(cb.exists(subquery));
            });
        } else if (startDate != null) {
            spec = spec.and((root, query, cb) -> {
                Subquery<Long> subquery = query.subquery(Long.class);
                var bookingRoot = subquery.from(Booking.class);
                subquery.select(cb.literal(1L));
                subquery.where(
                        cb.equal(bookingRoot.get("listing"), root),
                        cb.greaterThan(bookingRoot.get("endDate"), startDate)
                );
                return cb.not(cb.exists(subquery));
            });
        } else if (endDate != null) {
            spec = spec.and((root, query, cb) -> {
                Subquery<Long> subquery = query.subquery(Long.class);
                var bookingRoot = subquery.from(Booking.class);
                subquery.select(cb.literal(1L));
                subquery.where(
                        cb.equal(bookingRoot.get("listing"), root),
                        cb.lessThan(bookingRoot.get("startDate"), endDate)
                );
                return cb.not(cb.exists(subquery));
            });
        }

        return spec;
    }
}
