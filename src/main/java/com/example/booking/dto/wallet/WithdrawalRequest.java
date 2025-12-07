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
    
    @Schema(description = "Bank code for Flutterwave transfer (e.g., 044 for Access Bank)", example = "044")
    private String accountBank;
    
    @Schema(description = "Bank account number for withdrawal", example = "1234567890")
    private String accountNumber;
    
    @Schema(description = "Beneficiary name (account holder name)", example = "John Doe")
    private String beneficiaryName;
    
    @Schema(description = "Optional description for the withdrawal", example = "Withdrawal to bank account")
    private String description;

    // Manual getters (Lombok not working in Docker build)
    public String getAccountBank() {
        return accountBank;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public String getBeneficiaryName() {
        return beneficiaryName;
    }
}
