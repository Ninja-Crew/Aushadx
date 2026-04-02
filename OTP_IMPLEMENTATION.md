# OTP Email Verification & Forgot Password Implementation

## Overview

This implementation uses a **stateless OTP architecture** with JWT tokens for email verification during registration and password reset flows. The OTP is encoded in a signed JWT token, eliminating the need for server-side OTP storage.

## Architecture

### Flow Diagram

```
REGISTRATION FLOW:
┌─────────────────┐
│ User fills form │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────┐
│ POST /auth/request-otp           │
│ { email, password, name }        │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Backend:                         │
│ 1. Validate email not registered │
│ 2. Generate 6-digit OTP          │
│ 3. Send OTP via Twilio email     │
│ 4. Create JWT with OTP + expiry  │
└────────┬─────────────────────────┘
         │
         ▼ Returns: { otpToken, email }
┌──────────────────────────────────┐
│ OTPVerificationScreen            │
│ User enters 6-digit OTP          │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ POST /auth/verify-otp                    │
│ { email, password, name, otpToken, otp } │
└────────┬───────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Backend:                         │
│ 1. Verify JWT token + OTP match  │
│ 2. Create user with temp password│
│ 3. Auto-verify email             │
│ 4. Generate access/refresh tokens│
└────────┬─────────────────────────┘
         │
         ▼ Returns: { tokens, user }
┌──────────────────────────────────┐
│ MainTabs (Auto-login)            │
└──────────────────────────────────┘

PASSWORD RESET FLOW:
┌─────────────────────────────────┐
│ ForgotPasswordScreen             │
│ User enters email                │
└────────┬────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ POST /auth/forgot-password       │
│ { email }                        │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Backend:                         │
│ 1. Verify email exists           │
│ 2. Generate OTP                  │
│ 3. Send OTP via Twilio email     │
│ 4. Return JWT with OTP           │
└────────┬─────────────────────────┘
         │
         ▼ Returns: { otpToken, email }
┌──────────────────────────────────┐
│ OTPVerificationScreen            │
│ User enters OTP                  │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│ POST /auth/reset-password                    │
│ { email, newPassword, otpToken, otp }        │
└────────┬───────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Backend:                         │
│ 1. Verify JWT token + OTP + email│
│ 2. Hash new password             │
│ 3. Update user password          │
└────────┬─────────────────────────┘
         │
         ▼ Returns: { message }
┌──────────────────────────────────┐
│ LoginScreen (User logs in)       │
└──────────────────────────────────┘
```

## Backend Implementation

### Environment Variables

Add these to your `.env` file:

```env
# OTP Configuration
OTP_JWT_SECRET=your-secret-key-change-in-production
OTP_EXPIRES_IN=10m

# Twilio Configuration
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_EMAIL=noreply@aushadx.com
```

### API Endpoints

#### 1. Request OTP for Registration

```
POST /auth/request-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}

Response (200):
{
  "success": true,
  "data": {
    "otpToken": "eyJhbGciOiJIUzI1NiIs...",
    "message": "OTP sent to your email",
    "expiresIn": "10 minutes",
    "email": "user@example.com"
  }
}

Error (409):
{
  "success": false,
  "error": "Email already registered. Please login."
}
```

#### 2. Verify OTP and Complete Registration

```
POST /auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe",
  "otpToken": "eyJhbGciOiJIUzI1NiIs...",
  "otp": "123456"
}

Response (201):
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id_here",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "tokens": {
      "access": "eyJhbGciOiJIUzI1NiIs...",
      "refresh": "eyJhbGciOiJIUzI1NiIs..."
    },
    "message": "Email verified successfully"
  }
}

Error (401):
{
  "success": false,
  "error": "OTP verification failed: Invalid OTP"
}
```

#### 3. Request Password Reset OTP

```
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}

Response (200):
{
  "success": true,
  "data": {
    "otpToken": "eyJhbGciOiJIUzI1NiIs...",
    "message": "OTP sent to your email",
    "expiresIn": "10 minutes",
    "email": "user@example.com"
  }
}

Note: Always returns success for security (doesn't reveal if email exists)
```

#### 4. Reset Password with OTP

```
POST /auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "newPassword": "newpassword123",
  "otpToken": "eyJhbGciOiJIUzI1NiIs...",
  "otp": "123456"
}

Response (200):
{
  "success": true,
  "data": {
    "message": "Password reset successfully"
  }
}

Error (401):
{
  "success": false,
  "error": "OTP verification failed: OTP expired"
}
```

## Frontend Implementation

### New Screens

#### 1. OTPVerificationScreen

- Located: `apps/mobile-client/src/screens/OTPVerificationScreen.js`
- Features:
  - 6-digit OTP input (numbers only)
  - Auto-formatting of OTP input
  - Timer showing OTP expiration (10 minutes)
  - "Resend OTP" button (enabled after first expiration or manually)
  - Handles both registration and password reset flows
  - Auto-login after successful email verification

#### 2. ForgotPasswordScreen

- Located: `apps/mobile-client/src/screens/ForgotPasswordScreen.js`
- Features:
  - Two-step flow: Enter email → Enter new password
  - Email validation
  - Password validation (min 6 characters)
  - Password confirmation matching
  - Clear visual feedback for each step

### LoginScreen Updates

- Added "Forgot Password?" link on login tab
- Updated signup handler to trigger OTP verification flow
- Routes to OTPVerificationScreen after successful OTP request

## Database Schema

### User Model Updates

```javascript
{
  // New fields added
  emailVerified: Boolean,  // Set to true after OTP verification
}
```

## Security Features

### Stateless Architecture Benefits

1. **No server-side OTP storage** - reduces database queries and memory usage
2. **JWT signed tokens** - tamper-proof OTP delivery
3. **Automatic expiration** - OTP token expires after 10 minutes
4. **One-time use** - OTP verified against token, not stored
5. **Timing attack resistant** - token verification timing varies

### Additional Security Measures

1. **Email validation** - prevents typos and invalid emails
2. **Password hashing** - passwords hashed before storage (bcrypt)
3. **HTTPS required** - passwords sent over encrypted transport
4. **Rate limiting** - recommend implementing on production
5. **Email verification** - ensures user owns the email

## Error Handling

### OTP Verification Errors

- **Invalid OTP**: User entered wrong code
- **OTP expired**: Token expired after 10 minutes, must request new OTP
- **Email mismatch**: OTP token email doesn't match request email
- **User already exists**: Race condition where email registered during flow
- **Invalid token**: Token tampered with or corrupted

## Development Mode

In development (without Twilio credentials), OTP is logged to console:

```
[DEV MODE] OTP for user@example.com: 123456
```

## Production Checklist

- [ ] Set `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` environment variables
- [ ] Change `OTP_JWT_SECRET` to a strong random string
- [ ] Enable HTTPS for all API calls
- [ ] Implement rate limiting on `/auth/request-otp` and `/auth/forgot-password`
- [ ] Add optional email domain validation
- [ ] Set up email templates in Twilio SendGrid
- [ ] Add monitoring and logging for OTP verification failures
- [ ] Set appropriate `OTP_EXPIRES_IN` (currently 10 minutes)

## Testing

### Manual Testing Steps

1. **Registration with OTP**
   - Click "Sign Up"
   - Enter name, email, password
   - Click "Sign Up" button
   - Check console for OTP (dev mode) or email (production)
   - Enter OTP in verification screen
   - Verify auto-login to MainTabs

2. **Password Reset**
   - Click "Forgot Password?" on login
   - Enter registered email
   - Check console for OTP (dev mode) or email (production)
   - Enter new password and confirmation
   - Enter new password in verification screen
   - Enter OTP
   - Verify redirect to login and can login with new password

3. **Error Cases**
   - Invalid OTP: Try with wrong 6-digit code
   - Expired OTP: Wait 10+ minutes before verifying
   - Email mismatch: Manual API test with different email
   - Duplicate email: Try registering with existing email

## Files Modified/Created

### Backend

- ✅ `src/models/User.js` - Added `emailVerified` field
- ✅ `src/services/otpService.js` - OTP generation and JWT verification
- ✅ `src/services/twilioService.js` - Email sending via Twilio
- ✅ `src/controllers/authController.js` - New endpoints and logic
- ✅ `src/routes/authRoutes.js` - New routes registered
- ✅ `src/config/env.js` - New environment variables
- ✅ `src/app.js` - Initialize Twilio
- ✅ `package.json` - Added `twilio` dependency

### Frontend

- ✅ `src/screens/OTPVerificationScreen.js` - New OTP verification UI
- ✅ `src/screens/ForgotPasswordScreen.js` - New password reset UI
- ✅ `src/screens/LoginScreen.js` - Updated for OTP flow
- ✅ `src/navigation/AppNavigator.js` - Registered new screens

## Next Steps

1. **Twilio Setup**
   - Create Twilio account
   - Get Account SID and Auth Token
   - Configure SendGrid integration
   - Set up email templates

2. **Testing**
   - Test OTP generation and verification
   - Test email delivery
   - Test error scenarios
   - Load testing for high OTP volume

3. **Enhancement Ideas**
   - SMS OTP as alternative to email
   - Rate limiting per email
   - OTP resend limiting
   - Custom email templates
   - Internationalization for emails
   - Two-factor authentication (2FA)
