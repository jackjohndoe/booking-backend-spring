# Debugging 401 Unauthorized Error

## Current Issue
Getting `401 Unauthorized: [no body]` when trying to create a Flutterwave virtual account.

## Enhanced Debugging Added

1. **Token Validation**: Added checks to ensure token exists and is valid format
2. **Response Handling**: Improved empty response body handling
3. **Detailed Logging**: Added comprehensive logging to track token presence and format

## Steps to Debug

### 1. Open Browser Console (F12)
When you try to create a virtual account, look for these logs:

**Success indicators:**
- `✅ Token found for virtual account creation: ...`
- `✅ Token length: XXX`
- `✅ Payment request with token: ...`
- `✅ Authorization header: Bearer ...`

**Failure indicators:**
- `❌ Payment endpoint requires authentication but no token found`
- `❌ User data exists but no token found in AsyncStorage`
- `❌ Token is not a valid string`

### 2. Clear Browser Data and Re-authenticate

1. **Sign Out Completely**:
   - Go to Profile screen
   - Tap "Sign Out"
   - Confirm logout

2. **Clear Browser Cache** (optional but recommended):
   - Press `Ctrl + Shift + Delete`
   - Select "Cached images and files"
   - Clear data

3. **Sign In Again**:
   - Use your credentials
   - Check console for successful login message
   - Verify token is stored: `✅ Backend authentication successful`

### 3. Check Token Storage

In browser console, run:
```javascript
// Check if token exists
localStorage.getItem('user').then(data => {
  if (data) {
    const user = JSON.parse(data);
    console.log('Token exists:', !!user.token);
    console.log('AccessToken exists:', !!user.accessToken);
    console.log('Email:', user.email);
  }
});
```

### 4. Test Virtual Account Creation

1. Navigate to booking flow
2. Select "Pay with Transfer"
3. Watch console for detailed logs
4. Check for error messages with token information

## Common Causes

### Token Not Being Sent
- **Symptom**: `❌ Payment endpoint requires authentication but no token found`
- **Fix**: Sign out and sign in again

### Token Invalid/Expired
- **Symptom**: `401 Unauthorized` with token present
- **Fix**: Sign out and sign in again to get fresh token

### Token Format Wrong
- **Symptom**: `❌ Token is not a valid string`
- **Fix**: Clear AsyncStorage and sign in again

### Backend Not Receiving Token
- **Symptom**: 401 with empty body
- **Check**: Verify Authorization header in Network tab (F12 → Network → Request Headers)

## Network Tab Inspection

1. Open DevTools → Network tab
2. Try to create virtual account
3. Find the request to `/api/payments/flutterwave/create-virtual-account`
4. Check **Request Headers**:
   - Should have: `Authorization: Bearer <token>`
   - Token should be a long string starting with `eyJ...`
5. Check **Response**:
   - Status: 401
   - Response body: Should have JSON error message, not empty

## Backend Logs (Railway)

Check Railway backend logs for:
- `JWT validation failed`
- `Invalid token`
- `Token expired`
- `Authentication failed`

## If Issue Persists

If you still get 401 after signing out/in:

1. **Check Backend Logs**: Look for JWT validation errors
2. **Verify JWT Secret**: Ensure `JWT_SECRET` is set in Railway
3. **Check Token Expiration**: Tokens might be expiring too quickly
4. **Network Issues**: Verify backend is accessible from browser

## Next Steps After Fixing

Once authentication works:
1. Virtual account should be created successfully
2. Real bank details will be displayed
3. Payment can be processed via Flutterwave

