package com.example.booking.entity;

import com.example.booking.model.Amenity;
import com.example.booking.model.Policy;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "listings")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Listing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    private String title;

    @Column(length = 2000)
    private String description;

    @NotNull
    private BigDecimal price;

    @NotBlank
    private String location;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "host_id")
    private User host;

    private OffsetDateTime createdAt;

    @ElementCollection(targetClass = Amenity.class)
    @CollectionTable(name = "listing_amenities", joinColumns = @JoinColumn(name = "listing_id"))
    @Column(name = "amenity")
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Set<Amenity> amenities = new HashSet<>();

    @ElementCollection(targetClass = Policy.class)
    @CollectionTable(name = "listing_policies", joinColumns = @JoinColumn(name = "listing_id"))
    @Column(name = "policy")
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Set<Policy> policies = new HashSet<>();

    @OneToMany(mappedBy = "listing", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<Review> reviews = new HashSet<>();

    @Column(nullable = false)
    @Builder.Default
    private Double averageRating = 0.0;

    @Column(nullable = false)
    @Builder.Default
    private Integer reviewCount = 0;

    @OneToMany(mappedBy = "listing", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<Booking> bookings = new HashSet<>();

    @PrePersist
    public void prePersist() {
        this.createdAt = OffsetDateTime.now();
    }
}
