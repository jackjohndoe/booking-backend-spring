package com.example.booking.dto.payment;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PaymentRequest {
    @NotNull
    private Long bookingId;
    
    private boolean useWallet = false;
    
    private String paymentMethodId;
}
