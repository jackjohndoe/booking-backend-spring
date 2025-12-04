package com.example.booking.controller;

import com.example.booking.dto.payment.PaymentRequest;
import com.example.booking.payment.PaymentProvider;
import com.example.booking.payment.dto.PaymentIntentRequest;
import com.example.booking.payment.dto.PaymentIntentResponse;
import com.example.booking.security.BookingUserDetails;
import com.example.booking.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@Tag(name = "Payments", description = "Payment processing endpoints for bookings")
public class PaymentController {

    private final PaymentService paymentService;
    private final PaymentProvider paymentProvider;

    public PaymentController(PaymentService paymentService, PaymentProvider paymentProvider) {
        this.paymentService = paymentService;
        this.paymentProvider = paymentProvider;
    }

    @Operation(summary = "Process booking payment", 
            description = "Processes payment for a booking. Supports both wallet and direct payment methods.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Payment processed successfully",
                    content = @Content(schema = @Schema(implementation = PaymentIntentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid booking or payment failed"),
            @ApiResponse(responseCode = "404", description = "Booking not found")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/booking")
    public ResponseEntity<PaymentIntentResponse> processBookingPayment(
            @Valid @RequestBody PaymentRequest request,
            @AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(paymentService.processBookingPayment(request, userDetails.getUser()));
    }

    @Operation(summary = "Refund a booking", 
            description = "Processes refund for a booking. Guest or host can request refund.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Refund processed successfully",
                    content = @Content(schema = @Schema(implementation = PaymentIntentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Unauthorized or refund failed"),
            @ApiResponse(responseCode = "404", description = "Booking not found")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/booking/{bookingId}/refund")
    public ResponseEntity<PaymentIntentResponse> refundBooking(
            @Parameter(description = "Booking ID") @PathVariable Long bookingId,
            @Parameter(description = "Refund reason") @RequestParam(name = "reason", required = false) String reason,
            @AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(paymentService.refundBooking(bookingId, reason, userDetails.getUser()));
    }

    @Operation(summary = "Initialize Paystack payment", 
            description = "Initializes a Paystack payment transaction. Returns authorization URL for card payments or account details for bank transfers.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Payment initialized successfully",
                    content = @Content(schema = @Schema(implementation = PaymentIntentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid payment request"),
            @ApiResponse(responseCode = "500", description = "Paystack not configured or payment initialization failed")
    })
    @PostMapping("/paystack/initialize")
    public ResponseEntity<?> initializePaystackPayment(@RequestBody Map<String, Object> request) {
        try {
            // Extract request parameters
            Object amountObj = request.get("amount");
            Object emailObj = request.get("email");
            String paymentMethod = (String) request.getOrDefault("paymentMethod", "card");
            String reference = (String) request.get("reference");
            @SuppressWarnings("unchecked")
            Map<String, Object> metadata = (Map<String, Object>) request.getOrDefault("metadata", Map.of());

            // Validate required fields
            if (amountObj == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Amount is required"));
            }
            if (emailObj == null || emailObj.toString().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
            }

            // Convert amount to BigDecimal
            BigDecimal amount;
            if (amountObj instanceof Number) {
                amount = BigDecimal.valueOf(((Number) amountObj).doubleValue());
            } else {
                try {
                    amount = new BigDecimal(amountObj.toString());
                } catch (NumberFormatException e) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Invalid amount format"));
                }
            }

            // Build payment intent request
            PaymentIntentRequest.Builder builder = PaymentIntentRequest.builder()
                    .amount(amount)
                    .currency("NGN")
                    .customerId(emailObj.toString())
                    .description("Payment via Paystack")
                    .captureImmediately(false);

            // Add metadata
            if (metadata != null && !metadata.isEmpty()) {
                StringBuilder metadataStr = new StringBuilder();
                metadata.forEach((key, value) -> {
                    if (metadataStr.length() > 0) metadataStr.append(",");
                    metadataStr.append(key).append("=").append(value);
                });
                builder.metadata(metadataStr.toString());
            }

            // Add booking ID if present
            if (metadata != null && metadata.containsKey("bookingId")) {
                builder.bookingId(metadata.get("bookingId").toString());
            }

            PaymentIntentRequest paymentRequest = builder.build();

            // Create payment intent via PaymentProvider
            PaymentIntentResponse response = paymentProvider.createPaymentIntent(paymentRequest);

            // Return response in format expected by frontend
            if ("bank_transfer".equals(paymentMethod)) {
                // For bank transfers, return account details
                return ResponseEntity.ok(Map.of(
                        "reference", response.getPaymentIntentId(),
                        "account_number", response.getClientSecret() != null ? response.getClientSecret() : "N/A",
                        "bank", "Paystack",
                        "account_name", "Paystack Virtual Account",
                        "amount", amount.multiply(BigDecimal.valueOf(100)).longValue(),
                        "email", emailObj.toString(),
                        "metadata", metadata != null ? metadata : Map.of(),
                        "paymentMethod", "bank_transfer"
                ));
            } else {
                // For card payments, return authorization URL
                return ResponseEntity.ok(Map.of(
                        "reference", response.getPaymentIntentId(),
                        "authorization_url", response.getClientSecret() != null ? response.getClientSecret() : "",
                        "access_code", response.getPaymentIntentId(),
                        "amount", amount.multiply(BigDecimal.valueOf(100)).longValue(),
                        "email", emailObj.toString(),
                        "metadata", metadata != null ? metadata : Map.of(),
                        "paymentMethod", paymentMethod
                ));
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", e.getMessage() != null ? e.getMessage() : "Payment initialization failed",
                    "message", e.getMessage() != null ? e.getMessage() : "An error occurred while initializing payment"
            ));
        }
    }

    @Operation(summary = "Verify Paystack payment", 
            description = "Verifies a Paystack payment transaction using the payment reference.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Payment verified successfully",
                    content = @Content(schema = @Schema(implementation = PaymentIntentResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid payment reference"),
            @ApiResponse(responseCode = "404", description = "Payment not found")
    })
    @GetMapping("/paystack/verify/{reference}")
    public ResponseEntity<?> verifyPaystackPayment(
            @Parameter(description = "Payment reference") @PathVariable String reference) {
        try {
            if (reference == null || reference.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Payment reference is required"));
            }

            // Verify payment via PaymentProvider
            PaymentIntentResponse response = paymentProvider.confirmPaymentIntent(reference);

            // Return response in format expected by frontend
            return ResponseEntity.ok(Map.of(
                    "status", response.getStatus() != null ? response.getStatus() : "unknown",
                    "reference", reference,
                    "amount", response.getAmount() != null ? response.getAmount() : 0,
                    "currency", response.getCurrency() != null ? response.getCurrency() : "NGN",
                    "paid_at", response.getCreatedAt() != null ? response.getCreatedAt().toString() : "",
                    "gateway_response", response.getStatus() != null ? response.getStatus() : "unknown"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", e.getMessage() != null ? e.getMessage() : "Payment verification failed",
                    "message", e.getMessage() != null ? e.getMessage() : "An error occurred while verifying payment"
            ));
        }
    }
}
