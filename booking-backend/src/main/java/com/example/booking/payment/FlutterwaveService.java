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

    private static final String FLUTTERWAVE_API_BASE_URL = "https://api.flutterwave.com/v4";
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
        // Try property values first, then fallback to direct environment variable reading
        String envClientId = System.getenv("FLUTTERWAVE_CLIENT_ID");
        String envClientSecret = System.getenv("FLUTTERWAVE_CLIENT_SECRET");
        String envEncryptionKey = System.getenv("FLUTTERWAVE_ENCRYPTION_KEY");
        
        // Use environment variable if property is empty, otherwise use property value
        // Trim all values to remove any whitespace
        String rawClientId = (clientId != null && !clientId.trim().isEmpty()) ? clientId.trim() : 
                       (envClientId != null && !envClientId.trim().isEmpty() ? envClientId.trim() : null);
        String rawClientSecret = (clientSecret != null && !clientSecret.trim().isEmpty()) ? clientSecret.trim() : 
                           (envClientSecret != null && !envClientSecret.trim().isEmpty() ? envClientSecret.trim() : null);
        String rawEncryptionKey = (encryptionKey != null && !encryptionKey.trim().isEmpty()) ? encryptionKey.trim() : 
                            (envEncryptionKey != null && !envEncryptionKey.trim().isEmpty() ? envEncryptionKey.trim() : null);
        
        // Validate and normalize client ID format
        this.clientId = normalizeClientId(rawClientId);
        this.clientSecret = rawClientSecret;
        this.encryptionKey = rawEncryptionKey;
        
        this.restTemplate = createRestTemplate();
    }
    
    /**
     * Normalize and validate Flutterwave OAuth 2.0 Client ID.
     * OAuth 2.0 Client IDs should be UUID format (e.g., "c66f5395-8fba-40f7-bb92-4f7c617e75fa").
     * Legacy API keys (e.g., "FLWPUBK-xxx") are NOT valid for OAuth 2.0.
     * 
     * @param clientId Raw client ID from configuration
     * @return Normalized client ID, or null if invalid
     */
    private String normalizeClientId(String clientId) {
        if (clientId == null || clientId.trim().isEmpty()) {
            return null;
        }
        
        String trimmed = clientId.trim();
        
        // Check if it's a legacy API key format (FLWPUBK-xxx or FLWSECK-xxx)
        if (trimmed.startsWith("FLWPUBK-") || trimmed.startsWith("FLWSECK-")) {
            log.error("❌ INVALID CLIENT ID FORMAT: Legacy API key detected: '{}'", 
                    trimmed.length() > 20 ? trimmed.substring(0, 20) + "..." : trimmed);
            log.error("   OAuth 2.0 requires a UUID-format Client ID, not legacy API keys.");
            log.error("   To get OAuth 2.0 credentials:");
            log.error("   1. Go to Flutterwave Dashboard → Settings → API Keys");
            log.error("   2. Look for 'Client ID' and 'Client Secret' (OAuth 2.0 section)");
            log.error("   3. Client ID should be UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
            log.error("   4. Do NOT use Public Key (FLWPUBK-xxx) or Secret Key (FLWSECK-xxx)");
            return null; // Return null to indicate invalid format
        }
        
        // Validate UUID format (basic check: should have 5 segments separated by hyphens)
        // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 characters total)
        if (trimmed.length() == 36 && trimmed.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")) {
            log.info("✅ Valid OAuth 2.0 Client ID format detected (UUID)");
            return trimmed;
        }
        
        // If it doesn't match UUID format but also isn't legacy key, log warning but allow it
        // (some environments might have different formats)
        log.warn("⚠️ Client ID format is not standard UUID: '{}' (length: {})", 
                trimmed.length() > 30 ? trimmed.substring(0, 30) + "..." : trimmed, 
                trimmed.length());
        log.warn("   Expected UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
        log.warn("   If authentication fails, verify you're using OAuth 2.0 Client ID from Flutterwave dashboard");
        
        return trimmed; // Return as-is, but log warning
    }

    @PostConstruct
    public void validateConfiguration() {
        // Check both property and environment variable sources
        String envClientId = System.getenv("FLUTTERWAVE_CLIENT_ID");
        String envClientSecret = System.getenv("FLUTTERWAVE_CLIENT_SECRET");
        String envEncryptionKey = System.getenv("FLUTTERWAVE_ENCRYPTION_KEY");
        
        log.info("Flutterwave Configuration Check:");
        log.info("  Property client-id: {}", (clientId != null && !clientId.trim().isEmpty()) ? "SET (length: " + clientId.length() + ")" : "NOT SET");
        log.info("  Property client-secret: {}", (clientSecret != null && !clientSecret.trim().isEmpty()) ? "SET (length: " + clientSecret.length() + ")" : "NOT SET");
        log.info("  Property encryption-key: {}", (encryptionKey != null && !encryptionKey.trim().isEmpty()) ? "SET (length: " + encryptionKey.length() + ")" : "NOT SET");
        log.info("  Env FLUTTERWAVE_CLIENT_ID: {}", (envClientId != null && !envClientId.trim().isEmpty()) ? "SET (length: " + envClientId.length() + ")" : "NOT SET");
        log.info("  Env FLUTTERWAVE_CLIENT_SECRET: {}", (envClientSecret != null && !envClientSecret.trim().isEmpty()) ? "SET (length: " + envClientSecret.length() + ")" : "NOT SET");
        log.info("  Env FLUTTERWAVE_ENCRYPTION_KEY: {}", (envEncryptionKey != null && !envEncryptionKey.trim().isEmpty()) ? "SET (length: " + envEncryptionKey.length() + ")" : "NOT SET");
        
        // Validate client ID format
        if (clientId != null && !clientId.trim().isEmpty()) {
            String preview = clientId.length() > 20 ? clientId.substring(0, 20) + "..." : clientId;
            log.info("  Client ID preview: {}", preview);
            
            // Check format
            if (clientId.startsWith("FLWPUBK-") || clientId.startsWith("FLWSECK-")) {
                log.error("❌ INVALID CLIENT ID: Legacy API key format detected!");
                log.error("   OAuth 2.0 requires UUID-format Client ID from Flutterwave dashboard.");
                log.error("   Current value appears to be: {}", preview);
            } else if (clientId.length() == 36 && clientId.matches("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")) {
                log.info("  ✅ Client ID format: Valid UUID (OAuth 2.0 compatible)");
            } else {
                log.warn("  ⚠️ Client ID format: Non-standard (length: {}, expected UUID format)", clientId.length());
            }
        }
        
        if (clientId == null || clientId.trim().isEmpty()) {
            log.warn("Flutterwave client ID is not configured. Virtual account creation will fail.");
            log.warn("  Please set FLUTTERWAVE_CLIENT_ID environment variable in Railway.");
            log.warn("  IMPORTANT: Use OAuth 2.0 Client ID (UUID format), NOT legacy API keys!");
        }
        if (clientSecret == null || clientSecret.trim().isEmpty()) {
            log.warn("Flutterwave client secret is not configured. Virtual account creation will fail.");
            log.warn("  Please set FLUTTERWAVE_CLIENT_SECRET environment variable in Railway.");
            log.warn("  IMPORTANT: Use OAuth 2.0 Client Secret, NOT legacy Secret Key!");
        }
        if (clientId != null && !clientId.trim().isEmpty() && 
            clientSecret != null && !clientSecret.trim().isEmpty()) {
            log.info("✅ FlutterwaveService initialized successfully with credentials");
        } else {
            log.error("❌ FlutterwaveService initialized but credentials are missing or invalid!");
            log.error("  Set these in Railway Variables:");
            log.error("    FLUTTERWAVE_CLIENT_ID (OAuth 2.0 UUID format, NOT FLWPUBK-xxx)");
            log.error("    FLUTTERWAVE_CLIENT_SECRET (OAuth 2.0 secret, NOT FLWSECK-xxx)");
            log.error("    FLUTTERWAVE_ENCRYPTION_KEY");
            log.error("  Get OAuth 2.0 credentials from: Flutterwave Dashboard → Settings → API Keys");
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

        // Validate credentials before making request
        if (clientId == null || clientId.trim().isEmpty()) {
            String errorMsg = "Flutterwave OAuth 2.0 Client ID is not configured. " +
                    "Please set FLUTTERWAVE_CLIENT_ID environment variable with a UUID-format Client ID from Flutterwave dashboard.";
            log.error("❌ {}", errorMsg);
            throw new IllegalStateException(errorMsg);
        }
        
        if (clientSecret == null || clientSecret.trim().isEmpty()) {
            String errorMsg = "Flutterwave OAuth 2.0 Client Secret is not configured. " +
                    "Please set FLUTTERWAVE_CLIENT_SECRET environment variable from Flutterwave dashboard.";
            log.error("❌ {}", errorMsg);
            throw new IllegalStateException(errorMsg);
        }
        
        // Check if client ID is in legacy format (should have been caught in normalizeClientId, but double-check)
        if (clientId.startsWith("FLWPUBK-") || clientId.startsWith("FLWSECK-")) {
            String errorMsg = "Invalid Client ID format: Legacy API key detected. " +
                    "OAuth 2.0 requires UUID-format Client ID. " +
                    "Get OAuth 2.0 credentials from Flutterwave Dashboard → Settings → API Keys. " +
                    "Do NOT use Public Key (FLWPUBK-xxx) or Secret Key (FLWSECK-xxx).";
            log.error("❌ {}", errorMsg);
            throw new IllegalStateException(errorMsg);
        }
        
        log.info("Requesting new OAuth 2.0 access token from Flutterwave");
        log.info("OAuth endpoint: {}", OAUTH_TOKEN_URL);
        log.info("Client ID present: {}", clientId != null && !clientId.trim().isEmpty());
        log.info("Client ID length: {}", clientId != null ? clientId.length() : 0);
        log.info("Client ID preview: {}", clientId != null && clientId.length() > 10 ? clientId.substring(0, 10) + "..." : "N/A");
        log.info("Client ID format: {}", (clientId != null && clientId.length() == 36) ? "UUID (valid)" : "Non-standard");
        log.info("Client Secret present: {}", clientSecret != null && !clientSecret.trim().isEmpty());
        log.info("Client Secret length: {}", clientSecret != null ? clientSecret.length() : 0);
        
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            
            // OAuth 2.0 token request uses form data (properly encoded)
            // Ensure client ID and secret are trimmed (should already be done, but double-check)
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("grant_type", "client_credentials");
            formData.add("client_id", clientId.trim());
            formData.add("client_secret", clientSecret.trim());
            
            HttpEntity<MultiValueMap<String, String>> entity = new HttpEntity<>(formData, headers);
            log.info("Sending OAuth token request to Flutterwave...");
            ResponseEntity<OAuthTokenResponse> response = restTemplate.exchange(
                    OAUTH_TOKEN_URL,
                    HttpMethod.POST,
                    entity,
                    OAuthTokenResponse.class
            );

            log.info("OAuth token request completed. HTTP Status: {}", response.getStatusCode());
            OAuthTokenResponse tokenResponse = response.getBody();
            if (tokenResponse != null && tokenResponse.getAccessToken() != null) {
                accessToken = tokenResponse.getAccessToken();
                // Set expiration time (subtract 5 minutes for safety buffer)
                int expiresIn = tokenResponse.getExpiresIn() != null ? tokenResponse.getExpiresIn() : 3600;
                tokenExpiresAt = LocalDateTime.now().plusSeconds(expiresIn - 300); // 5 min buffer
                log.info("✅ OAuth token obtained successfully. Length: {}, Expires at: {}", 
                        accessToken.length(), tokenExpiresAt);
                return accessToken;
            } else {
                log.error("❌ Failed to obtain OAuth token: Invalid response - tokenResponse is null or has no access_token");
                if (tokenResponse != null) {
                    log.error("OAuth token response details: tokenType={}, expiresIn={}", 
                            tokenResponse.getTokenType(), tokenResponse.getExpiresIn());
                }
                throw new RuntimeException("Failed to obtain Flutterwave OAuth token: Invalid response - no access_token in response");
            }
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            String responseBody = e.getResponseBodyAsString();
            int statusCode = e.getStatusCode().value();
            log.error("❌ Flutterwave OAuth token error: HTTP {} - Response: '{}'", 
                    statusCode, responseBody != null ? responseBody : "[empty]");
            
            // Provide detailed error message based on status code
            String detailedError;
            if (statusCode == 401) {
                String clientIdPreview = clientId != null && clientId.length() > 20 ? 
                    clientId.substring(0, 20) + "..." : (clientId != null ? clientId : "null");
                
                detailedError = "Flutterwave OAuth 2.0 authentication failed (401 Unauthorized).\n\n" +
                    "TROUBLESHOOTING STEPS:\n" +
                    "1. Verify Client ID format:\n" +
                    "   - Current Client ID preview: " + clientIdPreview + "\n" +
                    "   - OAuth 2.0 requires UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\n" +
                    "   - ❌ DO NOT use legacy keys: FLWPUBK-xxx or FLWSECK-xxx\n" +
                    "   - ✅ Get OAuth 2.0 credentials from: Dashboard → Settings → API Keys\n\n" +
                    "2. Verify credentials are correct:\n" +
                    "   - FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET must match\n" +
                    "   - Credentials must be for the correct environment (test vs live)\n" +
                    "   - Ensure no extra spaces or special characters in Railway variables\n\n" +
                    "3. Verify OAuth 2.0 is enabled:\n" +
                    "   - Your Flutterwave account must support OAuth 2.0 (v4 API)\n" +
                    "   - Legacy API keys (v3) will NOT work with OAuth 2.0\n\n" +
                    "Flutterwave Response: " + (responseBody != null && !responseBody.trim().isEmpty() ? 
                        responseBody : "No response body - check Flutterwave dashboard for account status");
            } else {
                detailedError = "Flutterwave OAuth error (HTTP " + statusCode + "): " + 
                    (responseBody != null ? responseBody : "Empty response");
            }
            
            log.error("OAuth token request failed. {}", detailedError);
            throw new RuntimeException(detailedError, e);
        } catch (RestClientException e) {
            log.error("❌ Network error obtaining OAuth token: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to obtain Flutterwave OAuth token: Network error - " + 
                    e.getMessage(), e);
        }
    }

    /**
     * Test OAuth authentication by attempting to get an access token.
     * This is used for diagnostic purposes.
     * 
     * @return true if OAuth authentication succeeds, false otherwise
     */
    public boolean testOAuthAuthentication() {
        try {
            String token = getAccessToken();
            return token != null && !token.trim().isEmpty();
        } catch (Exception e) {
            log.error("OAuth authentication test failed: {}", e.getMessage());
            return false;
        }
    }

    private HttpHeaders createAuthenticatedHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(getAccessToken());
        return headers;
    }

    /**
     * Create a static (permanent) virtual account number for a customer.
     * Static accounts are reusable and ideal for wallet funding.
     * 
     * @param email Customer email
     * @param name Customer full name
     * @param txRef Unique transaction reference
     * @param bvn Optional BVN for NGN accounts (recommended for static accounts)
     * @return VirtualAccountResponse with account details
     */
    public VirtualAccountResponse createStaticVirtualAccount(String email, String name, String txRef, String bvn) {
        log.debug("Creating static virtual account for: email={}, txRef={}", email, txRef);
        
        if (clientId == null || clientId.trim().isEmpty() || 
            clientSecret == null || clientSecret.trim().isEmpty()) {
            throw new IllegalStateException(
                "Flutterwave credentials not configured. Please set FLUTTERWAVE_CLIENT_ID and FLUTTERWAVE_CLIENT_SECRET environment variables."
            );
        }
        
        try {
            Map<String, Object> params = new HashMap<>();
            params.put("email", email);
            params.put("is_permanent", true); // Static account flag
            params.put("currency", "NGN");
            params.put("tx_ref", txRef);
            
            // Add firstname and lastname
            if (name != null && !name.trim().isEmpty()) {
                params.put("firstname", extractFirstName(name));
                String lastName = extractLastName(name);
                if (!lastName.isEmpty()) {
                    params.put("lastname", lastName);
                }
            }
            
            // Add BVN if provided (recommended for NGN static accounts)
            if (bvn != null && !bvn.trim().isEmpty()) {
                params.put("bvn", bvn);
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
                log.info("Static virtual account created successfully: accountNumber={}, bankName={}, txRef={}", 
                        data.getAccountNumber(), data.getBankName(), txRef);
                
                String accountName = data.getAccountName() != null ? data.getAccountName() : 
                    (name != null && !name.trim().isEmpty() ? name : "Nigerian Apartments Leasing Ltd");
                
                return VirtualAccountResponse.builder()
                        .accountNumber(data.getAccountNumber())
                        .accountName(accountName)
                        .bankName(data.getBankName())
                        .txRef(txRef)
                        .flwRef(data.getFlwRef())
                        .build();
            } else {
                String errorMsg = flutterwaveResponse != null ? flutterwaveResponse.getMessage() : "Unknown error from Flutterwave";
                String status = flutterwaveResponse != null ? flutterwaveResponse.getStatus() : "null";
                log.error("Flutterwave static virtual account creation failed. Status: {}, Message: {}", status, errorMsg);
                
                if (errorMsg == null || errorMsg.trim().isEmpty()) {
                    errorMsg = "Flutterwave API returned status: " + status + ". Check Flutterwave dashboard for details.";
                }
                throw new RuntimeException(errorMsg);
            }
        } catch (HttpClientErrorException | HttpServerErrorException e) {
            String responseBody = e.getResponseBodyAsString();
            int statusCode = e.getStatusCode().value();
            log.error("Flutterwave API error creating static virtual account: HTTP {} - Response body: '{}'", 
                    statusCode, responseBody != null ? responseBody : "[empty]");
            
            if (statusCode == 401) {
                log.error("Flutterwave returned 401 Unauthorized. Detailed diagnosis:");
                log.error("  1. OAuth endpoint: {}", OAUTH_TOKEN_URL);
                log.error("  2. Client ID configured: {} (length: {})", 
                    clientId != null && !clientId.trim().isEmpty(), 
                    clientId != null ? clientId.length() : 0);
                log.error("  3. Client Secret configured: {} (length: {})", 
                    clientSecret != null && !clientSecret.trim().isEmpty(),
                    clientSecret != null ? clientSecret.length() : 0);
                log.error("  4. Possible causes:");
                log.error("     - Client ID/Secret are incorrect or invalid");
                log.error("     - Credentials are for wrong environment (test vs live)");
                log.error("     - Credentials are legacy API keys (not OAuth 2.0)");
                log.error("     - Credentials have extra spaces or special characters");
                log.error("     - Flutterwave account doesn't have OAuth 2.0 enabled");
                log.error("  5. Response body: {}", responseBody != null ? responseBody : "[empty]");
            }
            
            String errorMessage = "Flutterwave API returned error";
            if (responseBody != null && !responseBody.trim().isEmpty()) {
                try {
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
                    errorMessage = responseBody.length() > 200 ? responseBody.substring(0, 200) : responseBody;
                }
            }
            
            throw new RuntimeException(errorMessage, e);
        } catch (RestClientException e) {
            log.error("Network error creating static virtual account", e);
            throw new RuntimeException("Network error connecting to Flutterwave: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error creating static virtual account", e);
            throw new RuntimeException("Unexpected error: " + e.getMessage(), e);
        }
    }

    /**
     * Create a dynamic (temporary) virtual account number for a customer.
     * Dynamic accounts are for one-time transactions and expire after use.
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
                log.error("  1. OAuth token is invalid or expired");
                log.error("  2. OAuth token was not obtained successfully");
                log.error("  3. Token format is incorrect");
                log.error("  4. Client ID/Secret are incorrect");
                // Check if we have a token
                if (accessToken != null) {
                    log.error("  Current access token exists (length: {})", accessToken.length());
                } else {
                    log.error("  WARNING: No access token cached - OAuth may have failed silently");
                }
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

