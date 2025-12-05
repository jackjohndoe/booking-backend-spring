package com.example.booking.payment.impl;

import com.example.booking.payment.PaymentProvider;
import com.example.booking.payment.dto.PaymentIntentRequest;
import com.example.booking.payment.dto.PaymentIntentResponse;
import com.example.booking.payment.dto.PayoutRequest;
import com.example.booking.payment.dto.PayoutResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Placeholder payment provider for development/testing.
 * Replace this with actual Stripe/PayPal/etc implementation.
 */
@Component
@ConditionalOnProperty(name = "payment.provider", havingValue = "local", matchIfMissing = true)
public class LocalPaymentProvider implements PaymentProvider {

    @Override
    public PaymentIntentResponse createPaymentIntent(PaymentIntentRequest request) {
        String paymentId = "pi_" + UUID.randomUUID().toString().replace("-", "");
        return PaymentIntentResponse.builder()
                .paymentIntentId(paymentId)
                .status("requires_payment_method")
                .amount(request.getAmount())
                .currency(request.getCurrency())
                .clientSecret(paymentId + "_secret")
                .createdAt(OffsetDateTime.now())
                .build();
    }

    @Override
    public PaymentIntentResponse confirmPaymentIntent(String paymentIntentId) {
        return PaymentIntentResponse.builder()
                .paymentIntentId(paymentIntentId)
                .status("succeeded")
                .createdAt(OffsetDateTime.now())
                .build();
    }

    @Override
    public PaymentIntentResponse refundPayment(String paymentId, String reason) {
        return PaymentIntentResponse.builder()
                .paymentIntentId(paymentId)
                .status("refunded")
                .createdAt(OffsetDateTime.now())
                .build();
    }

    @Override
    public PayoutResponse createPayout(PayoutRequest request) {
        String payoutId = "po_" + UUID.randomUUID().toString().replace("-", "");
        return PayoutResponse.builder()
                .payoutId(payoutId)
                .status("pending")
                .amount(request.getAmount())
                .currency(request.getCurrency())
                .createdAt(OffsetDateTime.now())
                .estimatedArrival(OffsetDateTime.now().plusDays(2))
                .build();
    }

    @Override
    public PaymentIntentResponse getPaymentIntentStatus(String paymentIntentId) {
        return PaymentIntentResponse.builder()
                .paymentIntentId(paymentIntentId)
                .status("succeeded")
                .createdAt(OffsetDateTime.now())
                .build();
    }

    @Override
    public PayoutResponse getPayoutStatus(String payoutId) {
        return PayoutResponse.builder()
                .payoutId(payoutId)
                .status("paid")
                .createdAt(OffsetDateTime.now())
                .estimatedArrival(OffsetDateTime.now())
                .build();
    }
}
