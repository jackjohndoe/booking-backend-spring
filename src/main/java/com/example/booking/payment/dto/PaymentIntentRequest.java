package com.example.booking.payment.dto;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class PaymentIntentRequest {
    BigDecimal amount;
    String currency;
    String customerId;
    String description;
    String bookingId;
    boolean captureImmediately;
    String metadata;
}
