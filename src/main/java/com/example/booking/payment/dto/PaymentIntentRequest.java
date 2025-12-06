package com.example.booking.payment.dto;

import java.math.BigDecimal;

public class PaymentIntentRequest {
    private final BigDecimal amount;
    private final String currency;
    private final String customerId;
    private final String description;
    private final String bookingId;
    private final boolean captureImmediately;
    private final String metadata;

    @lombok.Builder
    public PaymentIntentRequest(BigDecimal amount, String currency, String customerId, String description,
                               String bookingId, boolean captureImmediately, String metadata) {
        this.amount = amount;
        this.currency = currency;
        this.customerId = customerId;
        this.description = description;
        this.bookingId = bookingId;
        this.captureImmediately = captureImmediately;
        this.metadata = metadata;
    }

    public BigDecimal getAmount() { return amount; }
    public String getCurrency() { return currency; }
    public String getCustomerId() { return customerId; }
    public String getDescription() { return description; }
    public String getBookingId() { return bookingId; }
    public boolean isCaptureImmediately() { return captureImmediately; }
    public String getMetadata() { return metadata; }
}
