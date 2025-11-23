package com.example.booking.dto.wallet;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Value
@Builder
public class WalletResponse {
    Long id;
    Long userId;
    BigDecimal balance;
    String currency;
    String status;
    OffsetDateTime createdAt;
}
