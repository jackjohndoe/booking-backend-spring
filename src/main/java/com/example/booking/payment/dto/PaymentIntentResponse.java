package com.example.booking.payment.dto;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Value
@Builder
public class PaymentIntentResponse {
    String paymentIntentId;
    String status;
    BigDecimal amount;
    String currency;
    String clientSecret;
    OffsetDateTime createdAt;
    String failureReason;
}
