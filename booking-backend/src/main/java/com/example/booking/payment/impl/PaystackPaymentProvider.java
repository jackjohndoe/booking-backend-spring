package com.example.booking.payment.impl;

import com.example.booking.payment.PaymentProvider;
import com.example.booking.payment.dto.PaymentIntentRequest;
import com.example.booking.payment.dto.PaymentIntentResponse;
import com.example.booking.payment.dto.PayoutRequest;
import com.example.booking.payment.dto.PayoutResponse;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import org.springframework.http.converter.HttpMessageNotReadableException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;

/**
 * Paystack payment provider implementation.
 * 
 * To use this:
 * 1. Set payment.provider=paystack in application.properties
 * 2. Add Paystack API key to application.properties:
 *    paystack.secret-key=${PAYSTACK_SECRET_KEY:sk_test_...}
 * 3. Set environment variable:
 *    export PAYSTACK_SECRET_KEY=sk_test_your_key_here
 * 
 * Paystack API Documentation: https://paystack.com/docs/api/
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "payment.provider", havingValue = "paystack")
public class PaystackPaymentProvider implements PaymentProvider {

    private static final String PAYSTACK_API_BASE_URL = "https://api.paystack.co";
    private static final int CONNECT_TIMEOUT_MS = 10000; // 10 seconds
    private static final int READ_TIMEOUT_MS = 30000; // 30 seconds
    
    private final RestTemplate restTemplate;
    private final String secretKey;

    public PaystackPaymentProvider(@Value("${paystack.secret-key:}") String secretKey) {
        this.secretKey = secretKey;
        this.restTemplate = createRestTemplate();
    }

    @PostConstruct
    public void validateConfiguration() {
        if (secretKey == null || secretKey.trim().isEmpty() || secretKey.equals("sk_test_...")) {
            throw new IllegalStateException(
                "Paystack secret key is not configured. Please set PAYSTACK_SECRET_KEY environment variable or paystack.secret-key property."
            );
        }
        log.info("PaystackPaymentProvider initialized successfully");
    }

    private RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        return new RestTemplate(factory);
    }

    private HttpHeaders createHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(secretKey);
        return headers;
    }

    private String extractErrorMessage(PaystackErrorResponse errorResponse) {
        if (errorResponse != null && errorResponse.getMessage() != null) {
            return errorResponse.getMessage();
        }
        return "Unknown error occurred";
    }

    @Override
    public PaymentIntentResponse createPaymentIntent(PaymentIntentRequest request) {
        log.debug("Creating payment intent for booking: {}", request.getBookingId());
        
        try {
            // Validate request
            if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Payment amount must be greater than zero");
            }
            if (request.getCustomerId() == null || request.getCustomerId().trim().isEmpty()) {
                throw new IllegalArgumentException("Customer ID (email) is required");
            }

            // Paystack uses "initialize" transaction endpoint
            Map<String, Object> params = new HashMap<>();
            // Convert amount to kobo (smallest currency unit) - Paystack uses amount in kobo
            params.put("amount", request.getAmount().multiply(new BigDecimal("100")).longValue());
            params.put("currency", request.getCurrency().toLowerCase());
            params.put("email", request.getCustomerId()); // Paystack uses email as customer identifier
            params.put("reference", "ref_" + System.currentTimeMillis() + "_" + request.getBookingId());
            
            Map<String, String> metadata = new HashMap<>();
            metadata.put("booking_id", request.getBookingId());
            if (request.getMetadata() != null) {
                metadata.put("custom_metadata", request.getMetadata());
            }
            params.put("metadata", metadata);
            
            if (request.getDescription() != null) {
                params.put("callback_url", ""); // You can set a callback URL here
            }

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(params, createHeaders());
            ResponseEntity<PaystackTransactionResponse> response = restTemplate.exchange(
                    PAYSTACK_API_BASE_URL + "/transaction/initialize",
                    HttpMethod.POST,
                    entity,
                    PaystackTransactionResponse.class
            );

            PaystackTransactionResponse paystackResponse = response.getBody();
            if (paystackResponse != null && paystackResponse.isStatus() && paystackResponse.getData() != null) {
                TransactionData data = paystackResponse.getData();
                log.info("Payment intent created successfully: reference={}, booking={}", 
                        data.getReference(), request.getBookingId());
                return PaymentIntentResponse.builder()
                        .paymentIntentId(data.getReference())
                        .status("requires_payment_method")
                        .amount(request.getAmount())
                        .currency(request.getCurrency())
                        .clientSecret(data.getAuthorizationUrl()) // Paystack uses authorization URL
                        .createdAt(OffsetDateTime.now())
                        .build();
            } else {
                String errorMsg = paystackResponse != null ? paystackResponse.getMessage() : "Unknown error";
                log.error("Paystack transaction initialization failed: {}", errorMsg);
                throw new RuntimeException("Paystack transaction initialization failed: " + errorMsg);
            }
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            log.error("Paystack API error creating payment intent: HTTP {} - {}", 
                    e.getStatusCode().value(), e.getResponseBodyAsString());
            try {
                PaystackErrorResponse errorResponse = e.getResponseBodyAs(PaystackErrorResponse.class);
                throw new RuntimeException("Paystack payment intent creation failed: " + 
                        extractErrorMessage(errorResponse), e);
            } catch (HttpMessageNotReadableException parseException) {
                // Only catch JSON parsing exceptions, let RuntimeExceptions propagate
                throw new RuntimeException("Paystack payment intent creation failed: " + 
                        e.getResponseBodyAsString(), e);
            }
        } catch (RestClientException e) {
            log.error("Network error creating payment intent", e);
            throw new RuntimeException("Paystack payment intent creation failed: Network error - " + 
                    e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error creating payment intent", e);
            throw new RuntimeException("Paystack payment intent creation failed: " + e.getMessage(), e);
        }
    }

    @Override
    public PaymentIntentResponse confirmPaymentIntent(String paymentIntentId) {
        log.debug("Confirming payment intent: {}", paymentIntentId);
        
        if (paymentIntentId == null || paymentIntentId.trim().isEmpty()) {
            throw new IllegalArgumentException("Payment intent ID is required");
        }

        try {
            // Verify transaction using reference
            HttpEntity<Void> entity = new HttpEntity<>(createHeaders());
            ResponseEntity<PaystackTransactionResponse> response = restTemplate.exchange(
                    PAYSTACK_API_BASE_URL + "/transaction/verify/" + paymentIntentId,
                    HttpMethod.GET,
                    entity,
                    PaystackTransactionResponse.class
            );

            PaystackTransactionResponse paystackResponse = response.getBody();
            if (paystackResponse != null && paystackResponse.isStatus() && paystackResponse.getData() != null) {
                TransactionData data = paystackResponse.getData();
                String status = mapPaystackStatus(data.getStatus());
                BigDecimal amount = BigDecimal.valueOf(data.getAmount()).divide(new BigDecimal("100"));
                
                log.info("Payment intent confirmed: reference={}, status={}", paymentIntentId, status);
                return PaymentIntentResponse.builder()
                        .paymentIntentId(data.getReference())
                        .status(status)
                        .amount(amount)
                        .currency(data.getCurrency() != null ? data.getCurrency().toUpperCase() : null)
                        .createdAt(OffsetDateTime.ofInstant(
                                java.time.Instant.ofEpochSecond(data.getCreatedAt()),
                                ZoneOffset.UTC))
                        .failureReason(data.getGatewayResponse() != null && !data.getGatewayResponse().equals("Successful") 
                                ? data.getGatewayResponse() : null)
                        .build();
            } else {
                String errorMsg = paystackResponse != null ? paystackResponse.getMessage() : "Unknown error";
                log.error("Paystack transaction verification failed: {}", errorMsg);
                throw new RuntimeException("Paystack transaction verification failed: " + errorMsg);
            }
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            log.error("Paystack API error confirming payment intent: HTTP {} - {}", 
                    e.getStatusCode().value(), e.getResponseBodyAsString());
            try {
                PaystackErrorResponse errorResponse = e.getResponseBodyAs(PaystackErrorResponse.class);
                throw new RuntimeException("Paystack payment confirmation failed: " + 
                        extractErrorMessage(errorResponse), e);
            } catch (HttpMessageNotReadableException parseException) {
                // Only catch JSON parsing exceptions, let RuntimeExceptions propagate
                throw new RuntimeException("Paystack payment confirmation failed: " + 
                        e.getResponseBodyAsString(), e);
            }
        } catch (RestClientException e) {
            log.error("Network error confirming payment intent", e);
            throw new RuntimeException("Paystack payment confirmation failed: Network error - " + 
                    e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error confirming payment intent", e);
            throw new RuntimeException("Paystack payment confirmation failed: " + e.getMessage(), e);
        }
    }

    @Override
    public PaymentIntentResponse refundPayment(String paymentId, String reason) {
        log.debug("Processing refund for payment: {}", paymentId);
        
        if (paymentId == null || paymentId.trim().isEmpty()) {
            throw new IllegalArgumentException("Payment ID is required");
        }

        try {
            Map<String, Object> params = new HashMap<>();
            params.put("transaction", paymentId);
            if (reason != null) {
                params.put("customer_note", reason);
            }

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(params, createHeaders());
            ResponseEntity<PaystackRefundResponse> response = restTemplate.exchange(
                    PAYSTACK_API_BASE_URL + "/refund",
                    HttpMethod.POST,
                    entity,
                    PaystackRefundResponse.class
            );

            PaystackRefundResponse paystackResponse = response.getBody();
            if (paystackResponse != null && paystackResponse.isStatus() && paystackResponse.getData() != null) {
                RefundData data = paystackResponse.getData();
                BigDecimal amount = BigDecimal.valueOf(data.getAmount()).divide(new BigDecimal("100"));
                
                log.info("Refund processed successfully: payment={}, amount={}", paymentId, amount);
                return PaymentIntentResponse.builder()
                        .paymentIntentId(paymentId)
                        .status("refunded")
                        .amount(amount)
                        .currency(data.getCurrency() != null ? data.getCurrency().toUpperCase() : null)
                        .createdAt(OffsetDateTime.ofInstant(
                                java.time.Instant.ofEpochSecond(data.getCreatedAt()),
                                ZoneOffset.UTC))
                        .build();
            } else {
                String errorMsg = paystackResponse != null ? paystackResponse.getMessage() : "Unknown error";
                log.error("Paystack refund failed: {}", errorMsg);
                throw new RuntimeException("Paystack refund failed: " + errorMsg);
            }
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            log.error("Paystack API error processing refund: HTTP {} - {}", 
                    e.getStatusCode().value(), e.getResponseBodyAsString());
            try {
                PaystackErrorResponse errorResponse = e.getResponseBodyAs(PaystackErrorResponse.class);
                throw new RuntimeException("Paystack refund failed: " + 
                        extractErrorMessage(errorResponse), e);
            } catch (HttpMessageNotReadableException parseException) {
                // Only catch JSON parsing exceptions, let RuntimeExceptions propagate
                throw new RuntimeException("Paystack refund failed: " + 
                        e.getResponseBodyAsString(), e);
            }
        } catch (RestClientException e) {
            log.error("Network error processing refund", e);
            throw new RuntimeException("Paystack refund failed: Network error - " + 
                    e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error processing refund", e);
            throw new RuntimeException("Paystack refund failed: " + e.getMessage(), e);
        }
    }

    @Override
    public PayoutResponse createPayout(PayoutRequest request) {
        log.debug("Creating payout: amount={}, currency={}", request.getAmount(), request.getCurrency());
        
        // Validate request
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Payout amount must be greater than zero");
        }
        if (request.getDestinationAccountId() == null || request.getDestinationAccountId().trim().isEmpty()) {
            throw new IllegalArgumentException("Destination account ID is required");
        }

        try {
            // Paystack uses Transfer Recipient and Transfer endpoints for payouts
            // Note: This is a simplified implementation. In production, you should:
            // 1. Store recipient codes to avoid recreating them
            // 2. Handle bank code properly (extract from destinationAccountId or pass separately)
            // 3. Support different account types (nuban, mobile_money, etc.)
            
            // For now, we'll assume destinationAccountId contains bank account info
            // In production, you might want to split this or use a separate field
            String bankCode = extractBankCode(request.getDestinationAccountId());
            String accountNumber = extractAccountNumber(request.getDestinationAccountId());
            
            if (bankCode == null || bankCode.isEmpty()) {
                throw new IllegalArgumentException("Bank code is required for payouts. " +
                        "Please provide bank code in the destinationAccountId format: 'bankCode:accountNumber' " +
                        "or update the implementation to accept bank code separately.");
            }

            // Create or get transfer recipient
            Map<String, Object> recipientParams = new HashMap<>();
            recipientParams.put("type", "nuban"); // Nigerian Bank Account
            recipientParams.put("name", accountNumber); // You may want to pass account holder name separately
            recipientParams.put("account_number", accountNumber);
            recipientParams.put("bank_code", bankCode);
            recipientParams.put("currency", request.getCurrency().toLowerCase());

            HttpEntity<Map<String, Object>> recipientEntity = new HttpEntity<>(recipientParams, createHeaders());
            ResponseEntity<PaystackTransferRecipientResponse> recipientResponse = restTemplate.exchange(
                    PAYSTACK_API_BASE_URL + "/transferrecipient",
                    HttpMethod.POST,
                    recipientEntity,
                    PaystackTransferRecipientResponse.class
            );

            String recipientCode = null;
            if (recipientResponse.getBody() != null && recipientResponse.getBody().isStatus() 
                    && recipientResponse.getBody().getData() != null) {
                recipientCode = recipientResponse.getBody().getData().getRecipientCode();
            }

            if (recipientCode == null) {
                String errorMsg = recipientResponse.getBody() != null ? 
                        recipientResponse.getBody().getMessage() : "Unknown error";
                log.error("Failed to create transfer recipient: {}", errorMsg);
                throw new RuntimeException("Failed to create transfer recipient: " + errorMsg);
            }

            // Create transfer
            Map<String, Object> transferParams = new HashMap<>();
            transferParams.put("source", "balance");
            transferParams.put("amount", request.getAmount().multiply(new BigDecimal("100")).longValue());
            transferParams.put("recipient", recipientCode);
            transferParams.put("reason", request.getDescription() != null ? request.getDescription() : "Payout");

            HttpEntity<Map<String, Object>> transferEntity = new HttpEntity<>(transferParams, createHeaders());
            ResponseEntity<PaystackTransferResponse> transferResponse = restTemplate.exchange(
                    PAYSTACK_API_BASE_URL + "/transfer",
                    HttpMethod.POST,
                    transferEntity,
                    PaystackTransferResponse.class
            );

            PaystackTransferResponse paystackResponse = transferResponse.getBody();
            if (paystackResponse != null && paystackResponse.isStatus() && paystackResponse.getData() != null) {
                TransferData data = paystackResponse.getData();
                BigDecimal amount = BigDecimal.valueOf(data.getAmount()).divide(new BigDecimal("100"));
                
                log.info("Payout created successfully: transferCode={}, amount={}", 
                        data.getTransferCode(), amount);
                return PayoutResponse.builder()
                        .payoutId(data.getTransferCode())
                        .status(mapPaystackTransferStatus(data.getStatus()))
                        .amount(amount)
                        .currency(data.getCurrency() != null ? data.getCurrency().toUpperCase() : null)
                        .createdAt(OffsetDateTime.ofInstant(
                                java.time.Instant.ofEpochSecond(data.getCreatedAt()),
                                ZoneOffset.UTC))
                        .estimatedArrival(OffsetDateTime.now().plusDays(1)) // Paystack typically processes within 24 hours
                        .failureReason(data.getReason() != null ? data.getReason() : null)
                        .build();
            } else {
                String errorMsg = paystackResponse != null ? paystackResponse.getMessage() : "Unknown error";
                log.error("Paystack payout creation failed: {}", errorMsg);
                throw new RuntimeException("Paystack payout creation failed: " + errorMsg);
            }
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            log.error("Paystack API error creating payout: HTTP {} - {}", 
                    e.getStatusCode().value(), e.getResponseBodyAsString());
            try {
                PaystackErrorResponse errorResponse = e.getResponseBodyAs(PaystackErrorResponse.class);
                throw new RuntimeException("Paystack payout creation failed: " + 
                        extractErrorMessage(errorResponse), e);
            } catch (HttpMessageNotReadableException parseException) {
                // Only catch JSON parsing exceptions, let RuntimeExceptions propagate
                throw new RuntimeException("Paystack payout creation failed: " + 
                        e.getResponseBodyAsString(), e);
            }
        } catch (RestClientException e) {
            log.error("Network error creating payout", e);
            throw new RuntimeException("Paystack payout creation failed: Network error - " + 
                    e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error creating payout", e);
            throw new RuntimeException("Paystack payout creation failed: " + e.getMessage(), e);
        }
    }

    @Override
    public PaymentIntentResponse getPaymentIntentStatus(String paymentIntentId) {
        return confirmPaymentIntent(paymentIntentId);
    }

    @Override
    public PayoutResponse getPayoutStatus(String payoutId) {
        log.debug("Getting payout status: {}", payoutId);
        
        if (payoutId == null || payoutId.trim().isEmpty()) {
            throw new IllegalArgumentException("Payout ID is required");
        }

        try {
            HttpEntity<Void> entity = new HttpEntity<>(createHeaders());
            ResponseEntity<PaystackTransferResponse> response = restTemplate.exchange(
                    PAYSTACK_API_BASE_URL + "/transfer/" + payoutId,
                    HttpMethod.GET,
                    entity,
                    PaystackTransferResponse.class
            );

            PaystackTransferResponse paystackResponse = response.getBody();
            if (paystackResponse != null && paystackResponse.isStatus() && paystackResponse.getData() != null) {
                TransferData data = paystackResponse.getData();
                BigDecimal amount = BigDecimal.valueOf(data.getAmount()).divide(new BigDecimal("100"));
                
                return PayoutResponse.builder()
                        .payoutId(data.getTransferCode())
                        .status(mapPaystackTransferStatus(data.getStatus()))
                        .amount(amount)
                        .currency(data.getCurrency() != null ? data.getCurrency().toUpperCase() : null)
                        .createdAt(OffsetDateTime.ofInstant(
                                java.time.Instant.ofEpochSecond(data.getCreatedAt()),
                                ZoneOffset.UTC))
                        .estimatedArrival(OffsetDateTime.now().plusDays(1))
                        .failureReason(data.getReason())
                        .build();
            } else {
                String errorMsg = paystackResponse != null ? paystackResponse.getMessage() : "Unknown error";
                log.error("Failed to retrieve payout status: {}", errorMsg);
                throw new RuntimeException("Failed to retrieve payout status: " + errorMsg);
            }
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            log.error("Paystack API error retrieving payout status: HTTP {} - {}", 
                    e.getStatusCode().value(), e.getResponseBodyAsString());
            try {
                PaystackErrorResponse errorResponse = e.getResponseBodyAs(PaystackErrorResponse.class);
                throw new RuntimeException("Failed to retrieve payout status: " + 
                        extractErrorMessage(errorResponse), e);
            } catch (HttpMessageNotReadableException parseException) {
                // Only catch JSON parsing exceptions, let RuntimeExceptions propagate
                throw new RuntimeException("Failed to retrieve payout status: " + 
                        e.getResponseBodyAsString(), e);
            }
        } catch (RestClientException e) {
            log.error("Network error retrieving payout status", e);
            throw new RuntimeException("Failed to retrieve payout status: Network error - " + 
                    e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error retrieving payout status", e);
            throw new RuntimeException("Failed to retrieve payout status: " + e.getMessage(), e);
        }
    }

    private String mapPaystackStatus(String paystackStatus) {
        if (paystackStatus == null) {
            return "unknown";
        }
        return switch (paystackStatus.toLowerCase()) {
            case "success" -> "succeeded";
            case "failed" -> "failed";
            case "pending" -> "pending";
            default -> paystackStatus;
        };
    }

    private String mapPaystackTransferStatus(String paystackStatus) {
        if (paystackStatus == null) {
            return "unknown";
        }
        return switch (paystackStatus.toLowerCase()) {
            case "success" -> "paid";
            case "failed" -> "failed";
            case "pending" -> "pending";
            case "processing" -> "pending";
            default -> paystackStatus;
        };
    }

    /**
     * Helper method to extract bank code from destinationAccountId.
     * Expected format: "bankCode:accountNumber" or just "accountNumber" (will return null)
     */
    private String extractBankCode(String destinationAccountId) {
        if (destinationAccountId == null) {
            return null;
        }
        int colonIndex = destinationAccountId.indexOf(':');
        if (colonIndex > 0) {
            return destinationAccountId.substring(0, colonIndex);
        }
        return null;
    }

    /**
     * Helper method to extract account number from destinationAccountId.
     * Expected format: "bankCode:accountNumber" or just "accountNumber"
     */
    private String extractAccountNumber(String destinationAccountId) {
        if (destinationAccountId == null) {
            return null;
        }
        int colonIndex = destinationAccountId.indexOf(':');
        if (colonIndex > 0) {
            return destinationAccountId.substring(colonIndex + 1);
        }
        return destinationAccountId;
    }

    // Paystack API Response DTOs
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class PaystackTransactionResponse {
        private boolean status;
        private String message;
        private TransactionData data;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class TransactionData {
        private String reference;
        private long amount;
        private String currency;
        private String status;
        private String gatewayResponse;
        private long createdAt;
        @JsonProperty("authorization_url")
        private String authorizationUrl;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class PaystackRefundResponse {
        private boolean status;
        private String message;
        private RefundData data;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class RefundData {
        private long amount;
        private String currency;
        private long createdAt;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class PaystackTransferRecipientResponse {
        private boolean status;
        private String message;
        private TransferRecipientData data;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class TransferRecipientData {
        @JsonProperty("recipient_code")
        private String recipientCode;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class PaystackTransferResponse {
        private boolean status;
        private String message;
        private TransferData data;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class TransferData {
        @JsonProperty("transfer_code")
        private String transferCode;
        private long amount;
        private String currency;
        private String status;
        private String reason;
        private long createdAt;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class PaystackErrorResponse {
        private boolean status;
        private String message;
    }
}
