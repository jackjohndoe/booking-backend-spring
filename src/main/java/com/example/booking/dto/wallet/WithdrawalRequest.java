package com.example.booking.dto.wallet;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Schema(description = "Request to withdraw funds from wallet")
public class WithdrawalRequest {
    @NotNull
    @DecimalMin(value = "0.01", message = "Amount must be at least 0.01")
    @Schema(description = "Amount to withdraw (minimum 0.01)", example = "50.00")
    private BigDecimal amount;
    
    @Schema(description = "Destination account ID for withdrawal", example = "RCP_1234567890")
    private String destinationAccountId;
    
    @Schema(description = "Optional description for the withdrawal", example = "Withdrawal to bank account")
    private String description;
}
