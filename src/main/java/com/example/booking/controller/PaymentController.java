package com.example.booking.controller;

import com.example.booking.dto.payment.PaymentRequest;
import com.example.booking.entity.User;
import com.example.booking.payment.FlutterwaveService;
import com.example.booking.payment.PaymentProvider;
import com.example.booking.payment.dto.PaymentIntentRequest;
import com.example.booking.payment.dto.PaymentIntentResponse;
import com.example.booking.repository.UserRepository;
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
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@Tag(name = "Payments", description = "Payment processing endpoints for bookings")
public class PaymentController {

    private final PaymentService paymentService;
    private final PaymentProvider paymentProvider;
    private final FlutterwaveService flutterwaveService;
    private final UserRepository userRepository;
    private final com.example.booking.service.WalletService walletService;

    public PaymentController(PaymentService paymentService, PaymentProvider paymentProvider, 
                            FlutterwaveService flutterwaveService, UserRepository userRepository,
                            com.example.booking.service.WalletService walletService) {
        this.paymentService = paymentService;
        this.paymentProvider = paymentProvider;
        this.flutterwaveService = flutterwaveService;
        this.userRepository = userRepository;
        this.walletService = walletService;
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

    @Operation(summary = "Create Flutterwave virtual account", 
            description = "Creates a unique virtual account number for bank transfer payments via Flutterwave.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Virtual account created successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid request parameters"),
            @ApiResponse(responseCode = "500", description = "Flutterwave not configured or virtual account creation failed")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/flutterwave/create-virtual-account")
    public ResponseEntity<?> createFlutterwaveVirtualAccount(
            @RequestBody Map<String, Object> request,
            @AuthenticationPrincipal BookingUserDetails userDetails) {
        try {
            // Extract request parameters
            Object amountObj = request.get("amount");
            Object emailObj = request.get("email");
            Object nameObj = request.get("name");
            Object txRefObj = request.get("tx_ref");

            // Validate required fields
            if (amountObj == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Amount is required"));
            }
            if (emailObj == null || emailObj.toString().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Email is required"));
            }
            if (nameObj == null || nameObj.toString().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Name is required"));
            }
            if (txRefObj == null || txRefObj.toString().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Transaction reference (tx_ref) is required"));
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

            if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Amount must be greater than zero"));
            }

            // Flutterwave v3 API limit: 500,000 NGN per virtual account
            BigDecimal flutterwaveMaxAmount = new BigDecimal("500000");
            if (amount.compareTo(flutterwaveMaxAmount) > 0) {
                return ResponseEntity.badRequest().body(Map.of(
                    "error", "Amount exceeds Flutterwave limit",
                    "message", "Virtual account creation is limited to ₦500,000 per transaction. Please use card payment for larger amounts or split into multiple transactions.",
                    "maxAmount", "500000"
                ));
            }

            // Create virtual account via FlutterwaveService
            FlutterwaveService.VirtualAccountResponse virtualAccount = flutterwaveService.createVirtualAccount(
                    emailObj.toString(),
                    amount,
                    nameObj.toString(),
                    txRefObj.toString()
            );

            // Return response in format expected by frontend
            return ResponseEntity.ok(Map.of(
                    "account_number", virtualAccount.getAccountNumber() != null ? virtualAccount.getAccountNumber() : "",
                    "account_name", virtualAccount.getAccountName() != null ? virtualAccount.getAccountName() : "",
                    "bank_name", virtualAccount.getBankName() != null ? virtualAccount.getBankName() : "",
                    "tx_ref", virtualAccount.getTxRef() != null ? virtualAccount.getTxRef() : txRefObj.toString()
            ));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Flutterwave not configured",
                    "message", e.getMessage() != null ? e.getMessage() : "Please configure FLUTTERWAVE_SECRET_KEY in Railway environment variables"
            ));
        } catch (Exception e) {
            // Extract root cause message
            String errorMessage = e.getMessage();
            Throwable cause = e.getCause();
            while (cause != null && cause.getMessage() != null) {
                errorMessage = cause.getMessage();
                cause = cause.getCause();
            }
            
            // Clean up error message (remove duplicate prefixes)
            if (errorMessage != null && errorMessage.startsWith("Flutterwave virtual account creation failed: ")) {
                errorMessage = errorMessage.substring("Flutterwave virtual account creation failed: ".length());
            }
            
            // Log full error for debugging
            System.err.println("ERROR in createVirtualAccount: " + e.getClass().getName());
            System.err.println("ERROR Message: " + e.getMessage());
            if (e.getCause() != null) {
                System.err.println("ERROR Cause: " + e.getCause().getMessage());
            }
            e.printStackTrace();
            
            return ResponseEntity.status(500).body(Map.of(
                    "error", errorMessage != null && !errorMessage.trim().isEmpty() ? errorMessage : "Virtual account creation failed",
                    "message", errorMessage != null && !errorMessage.trim().isEmpty() ? errorMessage : "An error occurred while creating virtual account. Check backend logs for details."
            ));
        }
    }


    @Operation(summary = "Flutterwave webhook", 
            description = "Receives webhook events from Flutterwave for payment verification.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Webhook processed successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid webhook payload or verification failed")
    })
    @PostMapping("/flutterwave/webhook")
    public ResponseEntity<?> handleFlutterwaveWebhook(
            @RequestBody Map<String, Object> webhookPayload,
            @RequestHeader HttpHeaders headers) {
        try {
            // Process webhook via FlutterwaveService with hash verification
            FlutterwaveService.WebhookResult result = flutterwaveService.handleWebhook(webhookPayload, headers);
            
            // Extract event type from webhook payload
            String event = (String) webhookPayload.get("event");
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) webhookPayload.get("data");
            
            // Extract customer email from webhook payload
            String customerEmail = null;
            if (data != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> customer = (Map<String, Object>) data.get("customer");
                if (customer != null) {
                    customerEmail = (String) customer.get("email");
                }
                // Fallback: try to get email directly from data
                if (customerEmail == null) {
                    customerEmail = (String) data.get("customer_email");
                }
            }
            
            // Process wallet updates for charge.completed and transfer.completed events
            if (result.getTxRef() != null && result.getAmount() != null && result.getStatus() != null) {
                if ("charge.completed".equals(event) || "transfer.completed".equals(event)) {
                    try {
                        walletService.processFlutterwaveWebhook(
                                event,
                                result.getTxRef(),
                                result.getFlwRef(),
                                result.getAmount(),
                                result.getStatus(),
                                customerEmail
                        );
                    } catch (Exception walletError) {
                        // Log error but don't fail webhook - Flutterwave needs 200 response
                        System.err.println("Error processing wallet webhook: " + walletError.getMessage());
                        walletError.printStackTrace();
                    }
                }
            }
            
            if (result.isSuccess()) {
                Map<String, Object> response = new java.util.HashMap<>();
                response.put("status", "success");
                response.put("message", result.getMessage() != null ? result.getMessage() : "Webhook processed successfully");
                if (result.getTxRef() != null) {
                    response.put("tx_ref", result.getTxRef());
                }
                if (result.getFlwRef() != null) {
                    response.put("flw_ref", result.getFlwRef());
                }
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.badRequest().body(Map.of(
                        "status", "failed",
                        "message", result.getMessage() != null ? result.getMessage() : "Webhook processing failed"
                ));
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                    "error", e.getMessage() != null ? e.getMessage() : "Webhook processing failed",
                    "message", e.getMessage() != null ? e.getMessage() : "An error occurred while processing webhook"
            ));
        }
    }
}
