package com.example.booking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;

@Entity
@Table(name = "audit_logs", indexes = {
        @Index(name = "idx_audit_user", columnList = "user_id"),
        @Index(name = "idx_audit_action", columnList = "action"),
        @Index(name = "idx_audit_created", columnList = "created_at")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 50)
    private String action; // e.g., "LISTING_DELETE", "BOOKING_CANCEL", "REVIEW_DELETE"

    @Column(length = 100)
    private String resourceType; // e.g., "Listing", "Booking", "Review"

    private Long resourceId;

    @Column(length = 500)
    private String description;

    @Column(length = 45)
    private String ipAddress;

    @Column(length = 500)
    private String userAgent;

    private OffsetDateTime createdAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = OffsetDateTime.now();
    }
}
