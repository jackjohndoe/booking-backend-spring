package com.example.booking.payment.dto;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class PayoutRequest {
    BigDecimal amount;
    String currency;
    String destinationAccountId;
    String description;
    String metadata;
}
