package com.example.booking.payment;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import jakarta.annotation.PostConstruct;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.Map;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

/**
 * Flutterwave service for creating virtual accounts and handling OAuth 2.0 authentication.
 * 
 * To use this:
 * 1. Set environment variables:
 *    FLUTTERWAVE_CLIENT_ID=c66f5395-8fba-40f7-bb92-4f7c617e75fa
 *    FLUTTERWAVE_CLIENT_SECRET=Pt2rMD9wmlJGSKblYmvwmCGjKwVA9DBl
 *    FLUTTERWAVE_ENCRYPTION_KEY=aYTrRdyPnPwMoYbHDg8Txg+ShX0s8ACTN3cGNEFbae4=
 * 
 * Flutterwave API Documentation: https://developer.flutterwave.com/docs
 */
@Slf4j
@Service
public class FlutterwaveService {

    private static final String FLUTTERWAVE_API_BASE_URL = "https://api.flutterwave.com/v3";
    private static final String OAUTH_TOKEN_URL = "https://idp.flutterwave.com/realms/flutterwave/protocol/openid-connect/token";
    private static final String VIRTUAL_ACCOUNT_URL = FLUTTERWAVE_API_BASE_URL + "/virtual-account-numbers";
    private static final String WEBHOOK_SECRET_HASH_HEADER = "verif-hash"; // Flutterwave webhook verification header
    private static final int CONNECT_TIMEOUT_MS = 10000; // 10 seconds
    private static final int READ_TIMEOUT_MS = 30000; // 30 seconds
    
    private final RestTemplate restTemplate;
    private final String clientId;
    private final String clientSecret;
    private final String encryptionKey;
    
    private String accessToken;
    private LocalDateTime tokenExpiresAt;

    public FlutterwaveService(
            @Value("${flutterwave.client-id:}") String clientId,
            @Value("${flutterwave.client-secret:}") String clientSecret,
            @Value("${flutterwave.encryption-key:}") String encryptionKey) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.encryptionKey = encryptionKey;
        this.restTemplate = createRestTemplate();
    }

    @PostConstruct
    public void validateConfiguration() {
        if (clientId == null || clientId.trim().isEmpty()) {
            log.warn("Flutterwave client ID is not configured. Virtual account creation will fail.");
        }
        if (clientSecret == null || clientSecret.trim().isEmpty()) {
            log.warn("Flutterwave client secret is not configured. Virtual account creation will fail.");
        }
        if (clientId != null && !clientId.trim().isEmpty() && 
            clientSecret != null && !clientSecret.trim().isEmpty()) {
            log.info("FlutterwaveService initialized successfully");
        }
    }

    private RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        return new RestTemplate(factory);
    }

    /**
     * Get OAuth 2.0 access token from Flutterwave.
     * Tokens are cached and refreshed automatically when expired.
     */
    private String getAccessToken() {
        // Check if we have a valid cached token
        if (accessToken != null && tokenExpiresAt != null && 
            LocalDateTime.now().isBefore(tokenExpiresAt.minusMinutes(5))) {
            return accessToken;
        }

        log.debug("Requesting new OAuth 2.0 access token from Flutterwave");
        
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            
            // OAuth 2.0 token request uses form data (properly encoded)
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("grant_type", "client_credentials");
            formData.add("client_id", clientId);
            formData.add("client_secret", clientSecret);
            
            HttpEntity<MultiValueMap<String, String>> entity = new HttpEntity<>(formData, headers);
            ResponseEntity<OAuthTokenResponse> response = restTemplate.exchange(
                    OAUTH_TOKEN_URL,
                    HttpMethod.POST,
                    entity,
                    OAuthTokenResponse.class
            );

            OAuthTokenResponse tokenResponse = response.getBody();
            if (tokenResponse != null && tokenResponse.getAccessToken() != null) {
                accessToken = tokenResponse.getAccessToken();
                // Set expiration time (subtract 5 minutes for safety buffer)
                int expiresIn = tokenResponse.getExpiresIn() != null ? tokenResponse.getExpiresIn() : 3600;
                tokenExpiresAt = LocalDateTime.now().plusSeconds(expiresIn - 300); // 5 min buffer
                log.debug("OAuth token obtained successfully, expires at: {}", tokenExpiresAt);
                return accessToken;
            } else {
                log.error("Failed to obtain OAuth token: Invalid response");
                throw new RuntimeException("Failed to obtain Flutterwave OAuth token: Invalid response");
            }
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            log.error("Flutterwave OAuth token error: HTTP {} - {}", 
                    e.getStatusCode().value(), e.getResponseBodyAsString());
            throw new RuntimeException("Failed to obtain Flutterwave OAuth token: " + 
                    e.getResponseBodyAsString(), e);
        } catch (RestClientException e) {
            log.error("Network error obtaining OAuth token", e);
            throw new RuntimeException("Failed to obtain Flutterwave OAuth token: Network error - " + 
                    e.getMessage(), e);
        }
    }

    private HttpHeaders createAuthenticatedHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(getAccessToken());
        return headers;
    }

    /**
     * Create a virtual account number for a customer.
     * 
     * @param email Customer email
     * @param amount Expected payment amount (in NGN)
     * @param name Customer full name
     * @param txRef Unique transaction reference
     * @return VirtualAccountResponse with account details
     */
    public VirtualAccountResponse createVirtualAccount(String email, BigDecimal amount, String name, String txRef) {
        log.debug("Creating virtual account for: email={}, amount={}, txRef={}", email, amount, txRef);
        
        if (clientId == null || clientId.trim().isEmpty() || 
            clientSecret == null || clientSecret.trim().isEmpty()) {
            throw new IllegalStateException(
                "Flutterwave credentials not configured. Please set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET environment variables."
            );
        }
        
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("email", email);
            params.put("amount", amount); // Amount in NGN
            params.put("currency", "NGN");
            params.put("tx_ref", txRef);
            // Optional: Add firstname and lastname if provided (Flutterwave may use these)
            if (name != null && !name.trim().isEmpty()) {
                params.put("firstname", extractFirstName(name));
                String lastName = extractLastName(name);
                if (!lastName.isEmpty()) {
                    params.put("lastname", lastName);
                }
            }
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(params, createAuthenticatedHeaders());
            ResponseEntity<FlutterwaveVirtualAccountResponse> response = restTemplate.exchange(
                    VIRTUAL_ACCOUNT_URL,
                    HttpMethod.POST,
                    entity,
                    FlutterwaveVirtualAccountResponse.class
            );

            FlutterwaveVirtualAccountResponse flutterwaveResponse = response.getBody();
            if (flutterwaveResponse != null && "success".equalsIgnoreCase(flutterwaveResponse.getStatus()) 
                    && flutterwaveResponse.getData() != null) {
                VirtualAccountData data = flutterwaveResponse.getData();
                log.info("Virtual account created successfully: accountNumber={}, bankName={}, txRef={}", 
                        data.getAccountNumber(), data.getBankName(), txRef);
                
                // Generate account name from customer name (Flutterwave may not return this)
                String accountName = data.getAccountName() != null ? data.getAccountName() : 
                    (name != null && !name.trim().isEmpty() ? name : "Nigerian Apartments Leasing Ltd");
                
                return VirtualAccountResponse.builder()
                        .accountNumber(data.getAccountNumber())
                        .accountName(accountName)
                        .bankName(data.getBankName())
                        .txRef(txRef)
                        .build();
            } else {
                String errorMsg = flutterwaveResponse != null ? flutterwaveResponse.getMessage() : "Unknown error";
                log.error("Flutterwave virtual account creation failed: {}", errorMsg);
                throw new RuntimeException("Flutterwave virtual account creation failed: " + errorMsg);
            }
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            log.error("Flutterwave API error creating virtual account: HTTP {} - {}", 
                    e.getStatusCode().value(), e.getResponseBodyAsString());
            throw new RuntimeException("Flutterwave virtual account creation failed: " + 
                    e.getResponseBodyAsString(), e);
        } catch (RestClientException e) {
            log.error("Network error creating virtual account", e);
            throw new RuntimeException("Flutterwave virtual account creation failed: Network error - " + 
                    e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error creating virtual account", e);
            throw new RuntimeException("Flutterwave virtual account creation failed: " + e.getMessage(), e);
        }
    }

    /**
     * Handle Flutterwave webhook event for payment verification.
     * 
     * @param webhookPayload Webhook payload from Flutterwave
     * @param headers HTTP headers containing the verification hash
     * @return WebhookResult with verification details
     */
    public WebhookResult handleWebhook(Map<String, Object> webhookPayload, HttpHeaders headers) {
        log.debug("Processing Flutterwave webhook");
        
        // Verify webhook hash for security
        String receivedHash = headers.getFirst(WEBHOOK_SECRET_HASH_HEADER);
        if (encryptionKey == null || encryptionKey.trim().isEmpty()) {
            log.warn("Flutterwave encryption key not configured. Skipping webhook hash verification.");
        } else if (receivedHash == null || receivedHash.trim().isEmpty()) {
            log.error("Webhook hash verification failed: Missing verif-hash header");
            return WebhookResult.builder()
                    .success(false)
                    .message("Webhook hash verification failed: Missing verification header")
                    .build();
        } else if (!receivedHash.equals(encryptionKey)) {
            log.error("Webhook hash verification failed. Received hash does not match encryption key.");
            return WebhookResult.builder()
                    .success(false)
                    .message("Webhook hash verification failed: Invalid hash")
                    .build();
        } else {
            log.debug("Webhook hash verification successful");
        }
        
        try {
            String event = (String) webhookPayload.get("event");
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) webhookPayload.get("data");
            
            if (data == null) {
                log.warn("Webhook data is null");
                return WebhookResult.builder()
                        .success(false)
                        .message("Webhook data is null")
                        .build();
            }
            
            if ("charge.completed".equals(event)) {
                // Payment was completed
                String txRef = (String) data.get("tx_ref");
                String status = (String) data.get("status");
                String flwRef = (String) data.get("flw_ref");
                Object amountObj = data.get("amount");
                BigDecimal amount = amountObj != null ? 
                    new BigDecimal(amountObj.toString()).divide(new BigDecimal("100")) : null;
                
                log.info("Payment completed via webhook: txRef={}, flwRef={}, status={}, amount={}", txRef, flwRef, status, amount);
                
                return WebhookResult.builder()
                        .success("successful".equalsIgnoreCase(status))
                        .txRef(txRef)
                        .flwRef(flwRef)
                        .amount(amount)
                        .status(status)
                        .message("Payment processed successfully")
                        .build();
            }
            
            log.debug("Webhook event type not handled: {}", event);
            return WebhookResult.builder()
                    .success(false)
                    .message("Event type not handled: " + event)
                    .build();
                    
        } catch (Exception e) {
            log.error("Error processing Flutterwave webhook", e);
            return WebhookResult.builder()
                    .success(false)
                    .message("Error processing webhook: " + e.getMessage())
                    .build();
        }
    }

    private String extractFirstName(String fullName) {
        if (fullName == null || fullName.trim().isEmpty()) {
            return "Customer";
        }
        String[] parts = fullName.trim().split("\\s+");
        return parts[0];
    }

    private String extractLastName(String fullName) {
        if (fullName == null || fullName.trim().isEmpty()) {
            return "Name";
        }
        String[] parts = fullName.trim().split("\\s+");
        if (parts.length > 1) {
            return parts[parts.length - 1];
        }
        return "";
    }

    // DTOs for Flutterwave API responses
    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class OAuthTokenResponse {
        @JsonProperty("access_token")
        private String accessToken;
        
        @JsonProperty("expires_in")
        private Integer expiresIn;
        
        @JsonProperty("token_type")
        private String tokenType;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class FlutterwaveVirtualAccountResponse {
        private String status;
        private String message;
        private VirtualAccountData data;
    }

    @Data
    @JsonIgnoreProperties(ignoreUnknown = true)
    static class VirtualAccountData {
        @JsonProperty("account_number")
        private String accountNumber;
        
        @JsonProperty("account_name")
        private String accountName;
        
        @JsonProperty("bank_name")
        private String bankName;
        
        @JsonProperty("tx_ref")
        private String txRef;
        
        @JsonProperty("flw_ref")
        private String flwRef;
    }

    // Response DTOs for service methods
    @lombok.Builder
    @Data
    public static class VirtualAccountResponse {
        private String accountNumber;
        private String accountName;
        private String bankName;
        private String txRef;
    }

    @lombok.Builder
    @Data
    public static class WebhookResult {
        private boolean success;
        private String txRef;
        private String flwRef; // Flutterwave reference for transaction matching
        private BigDecimal amount;
        private String status;
        private String message;
    }
}

