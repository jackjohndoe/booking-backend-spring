# Payment Provider Integration Guide

This guide explains how to integrate different payment providers into the booking system.

## Architecture

The system uses a **Payment Provider abstraction** pattern that allows you to swap payment processors without changing business logic.

### Core Interface

All payment providers implement the `PaymentProvider` interface:

```java
public interface PaymentProvider {
    PaymentIntentResponse createPaymentIntent(PaymentIntentRequest request);
    PaymentIntentResponse confirmPaymentIntent(String paymentIntentId);
    PaymentIntentResponse refundPayment(String paymentId, String reason);
    PayoutResponse createPayout(PayoutRequest request);
    PaymentIntentResponse getPaymentIntentStatus(String paymentIntentId);
    PayoutResponse getPayoutStatus(String payoutId);
}
```

## Available Providers

### 1. Local Payment Provider (Default)

**Status:** ✅ Fully implemented  
**Use case:** Development and testing

**Configuration:**
```properties
payment.provider=local
```

No additional setup required. This provider simulates payment processing without real transactions.

### 2. Stripe Payment Provider

**Status:** 📝 Template provided (requires Stripe SDK)  
**Use case:** Production payments

**Setup Steps:**

1. **Add Stripe dependency to `pom.xml`:**
```xml
<dependency>
    <groupId>com.stripe</groupId>
    <artifactId>stripe-java</artifactId>
    <version>24.0.0</version>
</dependency>
```

2. **Add Stripe API key to `application.properties`:**
```properties
payment.provider=stripe
stripe.secret-key=${STRIPE_SECRET_KEY:sk_test_...}
```

3. **Uncomment and implement Stripe API calls in `StripePaymentProvider.java`**

4. **Set environment variable:**
```bash
export STRIPE_SECRET_KEY=sk_test_your_key_here
```

### 3. Paystack Payment Provider

**Status:** ✅ Fully implemented  
**Use case:** Production payments (especially for African markets)

**Setup Steps:**

1. **No additional dependencies required** - Uses Spring's built-in RestTemplate for HTTP calls

2. **Add Paystack API key to `application.properties`:**
```properties
payment.provider=paystack
paystack.secret-key=${PAYSTACK_SECRET_KEY:sk_test_...}
```

3. **Get your Paystack API keys:**
   - Sign up at [Paystack](https://paystack.com/)
   - Navigate to Settings > API Keys & Webhooks in your dashboard
   - Copy your Secret Key (starts with `sk_test_` for test mode or `sk_live_` for live mode)

4. **Set environment variable:**
```bash
export PAYSTACK_SECRET_KEY=sk_test_your_key_here
```

5. **For payouts (transfers):** Paystack requires bank account details. Make sure to provide proper bank codes when creating payouts.

**Note:** Paystack uses REST APIs, so no SDK dependency is needed. The implementation uses Spring's RestTemplate which is already included in `spring-boot-starter-web`.

### 4. PayPal Payment Provider (Example)

To add PayPal support:

1. **Create `PayPalPaymentProvider.java` implementing `PaymentProvider`**
2. **Add PayPal SDK dependency**
3. **Configure in `application.properties`:**
```properties
payment.provider=paypal
paypal.client-id=${PAYPAL_CLIENT_ID}
paypal.client-secret=${PAYPAL_CLIENT_SECRET}
```

## How Provider Selection Works

Spring Boot automatically selects the correct provider based on the `payment.provider` property:

- `@ConditionalOnProperty(name = "payment.provider", havingValue = "local")` → LocalPaymentProvider
- `@ConditionalOnProperty(name = "payment.provider", havingValue = "stripe")` → StripePaymentProvider
- `@ConditionalOnProperty(name = "payment.provider", havingValue = "paystack")` → PaystackPaymentProvider

Only **one provider** is active at a time.

## Implementation Checklist

When creating a new payment provider:

- [ ] Create class implementing `PaymentProvider` interface
- [ ] Add `@Component` annotation
- [ ] Add `@ConditionalOnProperty` with unique value
- [ ] Implement all 6 interface methods
- [ ] Add provider-specific configuration properties
- [ ] Add provider SDK dependency to `pom.xml`
- [ ] Handle provider-specific exceptions
- [ ] Write unit tests
- [ ] Update this guide

## Testing

All payment providers are tested through the `PaymentService` interface. The business logic remains unchanged regardless of provider.

## Migration Between Providers

To switch providers:

1. Update `payment.provider` in `application.properties`
2. Add provider-specific configuration
3. Restart application
4. No code changes required!

## Security Notes

- Never commit API keys to version control
- Use environment variables for secrets
- Store keys in secure configuration management
- Enable provider webhook verification for production
