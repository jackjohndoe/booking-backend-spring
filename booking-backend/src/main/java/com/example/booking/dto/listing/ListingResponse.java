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

    // Accessor methods (for @Value compatibility)
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

    // Getter methods (for test compatibility)
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public BigDecimal getPrice() { return price; }
    public String getLocation() { return location; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public Long getHostId() { return hostId; }
    public String getHostName() { return hostName; }
    public Set<String> getAmenities() { return amenities; }
    public Set<String> getPolicies() { return policies; }
    public Double getAverageRating() { return averageRating; }
    public Integer getReviewCount() { return reviewCount; }
    public Set<String> getPhotos() { return photos; }
    public boolean isFavorite() { return favorite; }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private Long id;
        private String title;
        private String description;
        private BigDecimal price;
        private String location;
        private OffsetDateTime createdAt;
        private Long hostId;
        private String hostName;
        private Set<String> amenities;
        private Set<String> policies;
        private Double averageRating;
        private Integer reviewCount;
        private Set<String> photos;
        private boolean favorite;

        public Builder id(Long id) {
            this.id = id;
            return this;
        }

        public Builder title(String title) {
            this.title = title;
            return this;
        }

        public Builder description(String description) {
            this.description = description;
            return this;
        }

        public Builder price(BigDecimal price) {
            this.price = price;
            return this;
        }

        public Builder location(String location) {
            this.location = location;
            return this;
        }

        public Builder createdAt(OffsetDateTime createdAt) {
            this.createdAt = createdAt;
            return this;
        }

        public Builder hostId(Long hostId) {
            this.hostId = hostId;
            return this;
        }

        public Builder hostName(String hostName) {
            this.hostName = hostName;
            return this;
        }

        public Builder amenities(Set<String> amenities) {
            this.amenities = amenities;
            return this;
        }

        public Builder policies(Set<String> policies) {
            this.policies = policies;
            return this;
        }

        public Builder averageRating(Double averageRating) {
            this.averageRating = averageRating;
            return this;
        }

        public Builder reviewCount(Integer reviewCount) {
            this.reviewCount = reviewCount;
            return this;
        }

        public Builder photos(Set<String> photos) {
            this.photos = photos;
            return this;
        }

        public Builder favorite(boolean favorite) {
            this.favorite = favorite;
            return this;
        }

        public ListingResponse build() {
            return new ListingResponse(id, title, description, price, location, createdAt, hostId, hostName,
                    amenities, policies, averageRating, reviewCount, photos, favorite);
        }
    }
}
