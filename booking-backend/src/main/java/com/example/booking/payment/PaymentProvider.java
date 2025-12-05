package com.example.booking.payment;

import com.example.booking.payment.dto.PaymentIntentRequest;
import com.example.booking.payment.dto.PaymentIntentResponse;
import com.example.booking.payment.dto.PayoutRequest;
import com.example.booking.payment.dto.PayoutResponse;

/**
 * Abstraction for payment processing providers (Stripe, PayPal, etc.)
 * Allows swapping payment providers without changing business logic.
 */
public interface PaymentProvider {
    
    /**
     * Create a payment intent for charging a customer
     */
    PaymentIntentResponse createPaymentIntent(PaymentIntentRequest request);
    
    /**
     * Confirm and process a payment intent
     */
    PaymentIntentResponse confirmPaymentIntent(String paymentIntentId);
    
    /**
     * Refund a payment
     */
    PaymentIntentResponse refundPayment(String paymentId, String reason);
    
    /**
     * Create a payout to a host's bank account
     */
    PayoutResponse createPayout(PayoutRequest request);
    
    /**
     * Get status of a payment intent
     */
    PaymentIntentResponse getPaymentIntentStatus(String paymentIntentId);
    
    /**
     * Get status of a payout
     */
    PayoutResponse getPayoutStatus(String payoutId);
}
