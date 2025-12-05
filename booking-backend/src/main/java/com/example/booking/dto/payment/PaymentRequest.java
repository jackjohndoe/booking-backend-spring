package com.example.booking.dto.payment;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
@Schema(description = "Request to process payment for a booking")
public class PaymentRequest {
    @NotNull
    @Schema(description = "ID of the booking to pay for", example = "1")
    private Long bookingId;
    
    @Schema(description = "Whether to use wallet balance for payment", example = "false")
    private boolean useWallet = false;
    
    @Schema(description = "Payment method ID (required if useWallet is false)", example = "pm_1234567890")
    private String paymentMethodId;
}
