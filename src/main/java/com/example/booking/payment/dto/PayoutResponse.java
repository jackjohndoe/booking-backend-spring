package com.example.booking.payment.dto;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Value
@Builder
public class PayoutResponse {
    String payoutId;
    String status;
    BigDecimal amount;
    String currency;
    OffsetDateTime createdAt;
    OffsetDateTime estimatedArrival;
    String failureReason;
}
