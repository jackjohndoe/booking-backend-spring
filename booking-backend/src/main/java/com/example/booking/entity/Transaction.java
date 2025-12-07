package com.example.booking.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "transactions")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wallet_id")
    private Wallet wallet;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "booking_id")
    private Booking booking;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    @Builder.Default
    private String currency = "USD";

    @Column(length = 500)
    private String description;

    @Column(name = "external_payment_id")
    private String externalPaymentId;

    @Column(name = "external_payout_id")
    private String externalPayoutId;

    @Column(name = "flutterwave_tx_ref")
    private String flutterwaveTxRef;

    @Column(name = "flutterwave_flw_ref")
    private String flutterwaveFlwRef;

    @Column(name = "flutterwave_status")
    private String flutterwaveStatus;

    @Column(name = "flutterwave_transfer_id")
    private String flutterwaveTransferId;

    private String reference;
    private String metadata;

    private OffsetDateTime createdAt;
    private OffsetDateTime processedAt;

    public enum Type {
        DEPOSIT,              // User adds money to wallet
        WITHDRAWAL,           // User withdraws from wallet
        BOOKING_PAYMENT,       // Payment for a booking
        BOOKING_REFUND,        // Refund for cancelled booking
        ESCROW_HOLD,           // Funds held in escrow
        ESCROW_RELEASE,        // Funds released from escrow to host
        HOST_PAYOUT,           // Host withdraws earnings
        ADMIN_ADJUSTMENT,      // Manual admin adjustment
        PLATFORM_FEE           // Platform commission
    }

    public enum Status {
        PENDING,
        PROCESSING,
        COMPLETED,
        FAILED,
        CANCELLED,
        REFUNDED
    }

    @PrePersist
    public void onCreate() {
        this.createdAt = OffsetDateTime.now();
    }

    // Manual setters for Flutterwave fields (Lombok not working in Docker build)
    public void setFlutterwaveFlwRef(String flutterwaveFlwRef) {
        this.flutterwaveFlwRef = flutterwaveFlwRef;
    }

    public void setFlutterwaveStatus(String flutterwaveStatus) {
        this.flutterwaveStatus = flutterwaveStatus;
    }

    public void setFlutterwaveTransferId(String flutterwaveTransferId) {
        this.flutterwaveTransferId = flutterwaveTransferId;
    }
}
