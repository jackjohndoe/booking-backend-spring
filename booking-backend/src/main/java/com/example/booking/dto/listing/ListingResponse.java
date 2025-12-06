package com.example.booking.dto.listing;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;

public class ListingResponse {
    private final Long id;
    private final String title;
    private final String description;
    private final BigDecimal price;
    private final String location;
    private final OffsetDateTime createdAt;
    private final Long hostId;
    private final String hostName;
    private final Set<String> amenities;
    private final Set<String> policies;
    private final Double averageRating;
    private final Integer reviewCount;
    private final Set<String> photos;
    private final boolean favorite;

    @lombok.Builder
    public ListingResponse(Long id, String title, String description, BigDecimal price, String location,
                          OffsetDateTime createdAt, Long hostId, String hostName, Set<String> amenities,
                          Set<String> policies, Double averageRating, Integer reviewCount, Set<String> photos,
                          boolean favorite) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.price = price;
        this.location = location;
        this.createdAt = createdAt;
        this.hostId = hostId;
        this.hostName = hostName;
        this.amenities = amenities;
        this.policies = policies;
        this.averageRating = averageRating;
        this.reviewCount = reviewCount;
        this.photos = photos;
        this.favorite = favorite;
    }

    public Long id() { return id; }
    public String title() { return title; }
    public String description() { return description; }
    public BigDecimal price() { return price; }
    public String location() { return location; }
    public OffsetDateTime createdAt() { return createdAt; }
    public Long hostId() { return hostId; }
    public String hostName() { return hostName; }
    public Set<String> amenities() { return amenities; }
    public Set<String> policies() { return policies; }
    public Double averageRating() { return averageRating; }
    public Integer reviewCount() { return reviewCount; }
    public Set<String> photos() { return photos; }
    public boolean favorite() { return favorite; }
}
