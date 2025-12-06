# How to Check Token Authentication Issue

## The Problem
You're getting `401 Unauthorized: [no body]` when trying to create a virtual account. This means the backend is rejecting your authentication.

## Step 1: Open Browser Console
1. Press **F12** to open Developer Tools
2. Click on the **Console** tab
3. Clear the console (right-click → Clear console)

## Step 2: Try Payment Flow Again
1. Navigate to booking flow
2. Select "Pay with Transfer"
3. Watch the console logs

## Step 3: Look for These Logs (EXPAND THEM!)

### 🔍 Token Check Log
Look for: `🔍 Payment endpoint - Token check:`
- **Click to expand** the Object
- Check if `hasToken: true` or `hasToken: false`
- Check `tokenPreview` - should show the first 30 characters of your token
- Check `tokenLength` - should be a number > 0

**If `hasToken: false`**:
- Your token is missing!
- **Solution**: Sign out and sign in again

### 🔍 AsyncStorage Log
Look for: `🔍 AsyncStorage user data:`
- **Click to expand** the Object
- Check if `hasToken: true` or `hasAccessToken: true`
- Check `email` - should show your email

**If both are `false`**:
- Token not stored in AsyncStorage
- **Solution**: Sign out and sign in again

### 📤 Request Log
Look for: `📤 Making payment request:`
- **Click to expand** the Object
- Check `hasAuthHeader: true` or `false`
- Check `authHeaderPreview` - should start with "Bearer eyJ..."

**If `hasAuthHeader: false`**:
- Authorization header not being set
- **Solution**: Check token retrieval (see above)

### 📥 Response Log
Look for: `📥 Payment response received:`
- **Click to expand** the Object
- Check `status` - should show `401`
- Check `ok` - should be `false`

### ❌ Error Log
Look for: `❌ Payment endpoint error:`
- **Click to expand** the Object
- Check all fields:
  - `hasToken`: Should be `true`
  - `tokenPreview`: Should show token start
  - `status`: `401`
  - `errorMessage`: Should explain the issue

## Step 4: Most Common Issues

### Issue 1: Token Not Found
**Symptoms**:
- `hasToken: false` in logs
- `⚠️ No user data in AsyncStorage` warning

**Solution**:
1. Sign out from the app
2. Sign in again
3. Try payment flow again

### Issue 2: Token Expired
**Symptoms**:
- `hasToken: true` but still getting 401
- `errorMessage: "Your session has expired"`

**Solution**:
1. Sign out from the app
2. Sign in again to get fresh token
3. Try payment flow again

### Issue 3: Backend Not Receiving Token
**Symptoms**:
- `hasToken: true` in frontend
- `hasAuthHeader: false` in request log

**Solution**:
- This shouldn't happen with current code
- If it does, check browser console for errors

## Step 5: Network Tab Inspection

1. Open **Network** tab in DevTools (F12 → Network)
2. Try payment flow again
3. Find the request to `/api/payments/flutterwave/create-virtual-account`
4. Click on it
5. Check **Headers** tab:
   - **Request Headers** should have: `Authorization: Bearer <token>`
   - If missing, token is not being sent
6. Check **Response** tab:
   - Status: `401 Unauthorized`
   - Response body: Should show error message (or empty if "[no body]")

## Quick Fix Checklist

- [ ] Sign out from app
- [ ] Sign in again
- [ ] Try payment flow
- [ ] Check console logs (expand all Objects)
- [ ] Check Network tab for Authorization header
- [ ] Share console logs if still not working

## If Still Not Working

Share these details:
1. Screenshot of console logs (expanded)
2. Screenshot of Network tab request headers
3. The full error message

This will help identify the exact issue!

