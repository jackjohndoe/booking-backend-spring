package com.example.booking.controller;

import com.example.booking.dto.payment.PaymentRequest;
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

@RestController
@RequestMapping("/api/payments")
@Tag(name = "Payments", description = "Payment processing endpoints for bookings")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
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
            @Parameter(description = "Refund reason") @RequestParam(required = false) String reason,
            @AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(paymentService.refundBooking(bookingId, reason, userDetails.getUser()));
    }
}
