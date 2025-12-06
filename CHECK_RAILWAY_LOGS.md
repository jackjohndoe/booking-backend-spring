# How to Check Railway Backend Logs for Flutterwave Errors

## What to Look For

### 1. FlutterwaveService Initialization
Look for logs like:
```
FlutterwaveService initialized successfully
```
or
```
Flutterwave client ID or client secret not configured
```

### 2. OAuth Token Request Errors
Look for logs containing:
```
Flutterwave OAuth API error
Failed to get Flutterwave OAuth token
OAuth token request failed
```

### 3. Virtual Account Creation Errors
Look for logs containing:
```
Creating virtual account
Virtual account created successfully
Flutterwave virtual account creation failed
Flutterwave API error creating virtual account
```

### 4. Missing Configuration Warnings
Look for:
```
Flutterwave credentials not configured
Flutterwave client ID or client secret not configured
Flutterwave encryption key not configured
```

### 5. 500 Errors
Look for stack traces or errors when the `/api/payments/flutterwave/create-virtual-account` endpoint is called.

## Steps to Find Errors

1. **Go to Railway Dashboard**
   - Open your backend service
   - Click on "Logs" tab
   - Look for recent errors

2. **Filter Logs**
   - Search for: `Flutterwave`
   - Search for: `500`
   - Search for: `ERROR`
   - Search for: `virtual-account`

3. **Check Environment Variables**
   - Go to "Variables" tab
   - Verify these exist:
     - `FLUTTERWAVE_CLIENT_ID`
     - `FLUTTERWAVE_CLIENT_SECRET`
     - `FLUTTERWAVE_ENCRYPTION_KEY`

## Common Issues

### Issue 1: Missing Environment Variables
**Symptoms**: Logs show "Flutterwave credentials not configured"

**Solution**: Add the three environment variables to Railway

### Issue 2: Invalid Credentials
**Symptoms**: Logs show "OAuth token request failed" or "401 Unauthorized" from Flutterwave API

**Solution**: Verify the credentials are correct in Railway

### Issue 3: Network Error
**Symptoms**: Logs show "Network error getting Flutterwave OAuth token"

**Solution**: Check Railway's network connectivity to Flutterwave API

## Next Steps

1. Try the payment flow again in the app
2. Immediately check Railway logs for new errors
3. Share any error logs you find (especially stack traces)

