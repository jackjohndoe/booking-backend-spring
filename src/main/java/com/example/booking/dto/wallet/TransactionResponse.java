package com.example.booking.dto.wallet;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Value
@Builder
public class TransactionResponse {
    Long id;
    Long walletId;
    Long userId;
    Long bookingId;
    String type;
    String status;
    BigDecimal amount;
    String currency;
    String description;
    String reference;
    OffsetDateTime createdAt;
    OffsetDateTime processedAt;
}
