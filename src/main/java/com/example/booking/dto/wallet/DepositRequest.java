package com.example.booking.dto.wallet;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Schema(description = "Request to deposit funds into wallet")
public class DepositRequest {
    @NotNull
    @DecimalMin(value = "0.01", message = "Amount must be at least 0.01")
    @Schema(description = "Amount to deposit (minimum 0.01)", example = "100.00")
    private BigDecimal amount;
    
    @Schema(description = "Payment method ID (optional)", example = "pm_1234567890")
    private String paymentMethodId;
    
    @Schema(description = "Optional description for the deposit", example = "Wallet top-up")
    private String description;
}
