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

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private BigDecimal amount;
        private String currency;
        private String customerId;
        private String description;
        private String bookingId;
        private boolean captureImmediately;
        private String metadata;

        public Builder amount(BigDecimal amount) {
            this.amount = amount;
            return this;
        }

        public Builder currency(String currency) {
            this.currency = currency;
            return this;
        }

        public Builder customerId(String customerId) {
            this.customerId = customerId;
            return this;
        }

        public Builder description(String description) {
            this.description = description;
            return this;
        }

        public Builder bookingId(String bookingId) {
            this.bookingId = bookingId;
            return this;
        }

        public Builder captureImmediately(boolean captureImmediately) {
            this.captureImmediately = captureImmediately;
            return this;
        }

        public Builder metadata(String metadata) {
            this.metadata = metadata;
            return this;
        }

        public PaymentIntentRequest build() {
            return new PaymentIntentRequest(amount, currency, customerId, description, bookingId, captureImmediately, metadata);
        }
    }
}
