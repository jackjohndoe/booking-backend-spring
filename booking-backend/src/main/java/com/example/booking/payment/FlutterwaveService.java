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
import java.util.HashMap;
import java.util.Map;

/**
 * Flutterwave service for creating virtual accounts using v3 API.
 * 
 * To use this:
 * 1. Set environment variables:
 *    FLUTTERWAVE_SECRET_KEY=rIAaYtIj3VBXAbzDaeolkRsgovxAdwQs
 *    FLUTTERWAVE_ENCRYPTION_KEY=4pqUb2fI/opqWq3OJ5T02INaXi+nnw1SFwEom4cBfIo=
 * 
 * Note: Flutterwave v3 API only supports dynamic (temporary) virtual accounts.
 * Static/permanent accounts require v4 API with OAuth 2.0.
 * 
 * Flutterwave API Documentation: https://developer.flutterwave.com/docs
 */
@Slf4j
@Service
public class FlutterwaveService {

    private static final String FLUTTERWAVE_API_BASE_URL = "https://api.flutterwave.com/v3";
    private static final String VIRTUAL_ACCOUNT_URL = FLUTTERWAVE_API_BASE_URL + "/virtual-account-numbers";
    private static final String WEBHOOK_SECRET_HASH_HEADER = "verif-hash"; // Flutterwave webhook verification header
    private static final int CONNECT_TIMEOUT_MS = 10000; // 10 seconds
    private static final int READ_TIMEOUT_MS = 30000; // 30 seconds
    
    private final RestTemplate restTemplate;
    private final String secretKey;
    private final String encryptionKey;

    public FlutterwaveService(
            @Value("${flutterwave.secret-key:}") String secretKey,
            @Value("${flutterwave.encryption-key:}") String encryptionKey) {
        // Try property values first, then fallback to direct environment variable reading
        String envSecretKey = System.getenv("FLUTTERWAVE_SECRET_KEY");
        String envEncryptionKey = System.getenv("FLUTTERWAVE_ENCRYPTION_KEY");
        
        // Use environment variable if property is empty, otherwise use property value
        // Trim all values to remove any whitespace
        this.secretKey = (secretKey != null && !secretKey.trim().isEmpty()) ? secretKey.trim() : 
                       (envSecretKey != null && !envSecretKey.trim().isEmpty() ? envSecretKey.trim() : null);
        this.encryptionKey = (encryptionKey != null && !encryptionKey.trim().isEmpty()) ? encryptionKey.trim() : 
                            (envEncryptionKey != null && !envEncryptionKey.trim().isEmpty() ? envEncryptionKey.trim() : null);
        
        this.restTemplate = createRestTemplate();
    }
    

    @PostConstruct
    public void validateConfiguration() {
        // Check both property and environment variable sources
        String envSecretKey = System.getenv("FLUTTERWAVE_SECRET_KEY");
        String envEncryptionKey = System.getenv("FLUTTERWAVE_ENCRYPTION_KEY");
        
        log.info("Flutterwave Configuration Check (v3 API):");
        log.info("  Property secret-key: {}", (secretKey != null && !secretKey.trim().isEmpty()) ? "SET (length: " + secretKey.length() + ")" : "NOT SET");
        log.info("  Property encryption-key: {}", (encryptionKey != null && !encryptionKey.trim().isEmpty()) ? "SET (length: " + encryptionKey.length() + ")" : "NOT SET");
        log.info("  Env FLUTTERWAVE_SECRET_KEY: {}", (envSecretKey != null && !envSecretKey.trim().isEmpty()) ? "SET (length: " + envSecretKey.length() + ")" : "NOT SET");
        log.info("  Env FLUTTERWAVE_ENCRYPTION_KEY: {}", (envEncryptionKey != null && !envEncryptionKey.trim().isEmpty()) ? "SET (length: " + envEncryptionKey.length() + ")" : "NOT SET");
        
        if (secretKey == null || secretKey.trim().isEmpty()) {
            log.warn("Flutterwave secret key is not configured. Virtual account creation will fail.");
            log.warn("  Please set FLUTTERWAVE_SECRET_KEY environment variable in Railway.");
        }
        if (encryptionKey == null || encryptionKey.trim().isEmpty()) {
            log.warn("Flutterwave encryption key is not configured. Webhook verification will be disabled.");
            log.warn("  Please set FLUTTERWAVE_ENCRYPTION_KEY environment variable in Railway.");
        }
        if (secretKey != null && !secretKey.trim().isEmpty()) {
            log.info("✅ FlutterwaveService initialized successfully with v3 API credentials");
        } else {
            log.error("❌ FlutterwaveService initialized but credentials are missing!");
            log.error("  Set these in Railway Variables:");
            log.error("    FLUTTERWAVE_SECRET_KEY (Secret Key from Flutterwave dashboard)");
            log.error("    FLUTTERWAVE_ENCRYPTION_KEY (Encryption Key from Flutterwave dashboard)");
        }
    }

    private RestTemplate createRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(CONNECT_TIMEOUT_MS);
        factory.setReadTimeout(READ_TIMEOUT_MS);
        return new RestTemplate(factory);
    }

    private HttpHeaders createAuthenticatedHeaders() {
        if (secretKey == null || secretKey.trim().isEmpty()) {
            throw new IllegalStateException(
                "Flutterwave secret key is not configured. Please set FLUTTERWAVE_SECRET_KEY environment variable."
            );
        }
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + secretKey.trim());
        return headers;
    }


    /**
     * Create a dynamic (temporary) virtual account number for a customer.
     * Dynamic accounts are for one-time transactions and expire after use.
     * Note: Flutterwave v3 API only supports dynamic accounts (not static/permanent).
     * 
     * @param email Customer email
     * @param amount Expected payment amount (in NGN)
     * @param name Customer full name
     * @param txRef Unique transaction reference
     * @return VirtualAccountResponse with account details
     */
    public VirtualAccountResponse createVirtualAccount(String email, BigDecimal amount, String name, String txRef) {
        log.debug("Creating virtual account for: email={}, amount={}, txRef={}", email, amount, txRef);
        
        if (secretKey == null || secretKey.trim().isEmpty()) {
            throw new IllegalStateException(
                "Flutterwave secret key is not configured. Please set FLUTTERWAVE_SECRET_KEY environment variable."
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
                
                // Always use company name for virtual accounts (not user's name)
                // This ensures consistent branding and prevents confusion
                String accountName = "Nigerian Apartments Leasing Ltd";
                
                return VirtualAccountResponse.builder()
                        .accountNumber(data.getAccountNumber())
                        .accountName(accountName)
                        .bankName(data.getBankName())
                        .txRef(txRef)
                        .build();
            } else {
                String errorMsg = flutterwaveResponse != null ? flutterwaveResponse.getMessage() : "Unknown error from Flutterwave";
                String status = flutterwaveResponse != null ? flutterwaveResponse.getStatus() : "null";
                log.error("Flutterwave virtual account creation failed. Status: {}, Message: {}", status, errorMsg);
                
                // If no message, provide default based on status
                if (errorMsg == null || errorMsg.trim().isEmpty()) {
                    errorMsg = "Flutterwave API returned status: " + status + ". Check Flutterwave dashboard for details.";
                }
                throw new RuntimeException(errorMsg);
            }
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            String responseBody = e.getResponseBodyAsString();
            int statusCode = e.getStatusCode().value();
            log.error("Flutterwave API error creating virtual account: HTTP {} - Response body: '{}'", 
                    statusCode, responseBody != null ? responseBody : "[empty]");
            
            // Log additional details for 401 errors
            if (statusCode == 401) {
                log.error("Flutterwave returned 401 Unauthorized. Possible causes:");
                log.error("  1. Secret key is incorrect or invalid");
                log.error("  2. Secret key is for wrong environment (test vs live)");
                log.error("  3. Secret key has extra spaces or special characters");
                log.error("  4. Flutterwave account is not active");
            }
            
            // Try to extract error message from Flutterwave response
            String errorMessage = "Flutterwave API returned error";
            if (responseBody != null && !responseBody.trim().isEmpty()) {
                try {
                    // Try to parse as JSON to extract message
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    @SuppressWarnings("unchecked")
                    java.util.Map<String, Object> errorData = mapper.readValue(responseBody, java.util.Map.class);
                    if (errorData != null) {
                        String msg = (String) errorData.get("message");
                        if (msg != null && !msg.trim().isEmpty()) {
                            errorMessage = msg;
                        }
                    }
                } catch (Exception parseException) {
                    // If parsing fails, use the raw response
                    errorMessage = responseBody.length() > 200 ? responseBody.substring(0, 200) : responseBody;
                }
            }
            
            throw new RuntimeException(errorMessage, e);
        } catch (RestClientException e) {
            log.error("Network error creating virtual account", e);
            throw new RuntimeException("Network error connecting to Flutterwave: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error creating virtual account", e);
            throw new RuntimeException("Unexpected error: " + e.getMessage(), e);
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
        private String flwRef; // Flutterwave reference for transaction matching
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

