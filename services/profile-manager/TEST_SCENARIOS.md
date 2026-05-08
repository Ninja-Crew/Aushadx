# Profile Manager Test Scenarios

This document lists the test scenarios implemented and executed for `services/profile-manager`.

## Test Execution Summary

- Date: 2026-04-19
- Command: `npm test`
- Result: 10/10 test suites passed, 61/61 tests passed

## Mock Separation

All reusable mock data and mock builders are separated from test scripts under:

- `tests/mocks/http.js`
- `tests/mocks/fixtures.js`
- `tests/mocks/services.js`
- `tests/mocks/query.js`

Tests import these helpers instead of defining repeated inline mock scaffolding.

## Unit Test Scenarios

### `tests/unit/authController.unit.test.js`

1. `signup` returns 400 when required fields are missing.
2. `signup` returns 201 with user and tokens for valid input.
3. `signup` returns 409 when user already exists.
4. `login` returns 400 when credentials are missing.
5. `login` returns 401 when authentication fails.
6. `login` returns 200 with tokens for valid credentials.
7. `refresh` returns 400 when refresh token is missing.
8. `refresh` returns 404 when refresh token user is not found.
9. `refresh` returns 200 with new tokens when valid.
10. `verify` returns 403 for URL/user mismatch.
11. `requestOTP` returns 409 for already registered email.
12. `requestOTP` returns 200 and OTP token when email is available.
13. `verifyOTP` returns 400 for email mismatch.
14. `verifyOTP` returns 201 and tokens after successful verification.
15. `forgotPassword` returns 404 for unknown email.
16. `verifyResetOTP` returns 200 with reset session token.
17. `resetPassword` returns 200 and updates password on valid session.

### `tests/unit/profileController.unit.test.js`

1. `getProfile` returns 404 when profile is not found.
2. `getProfile` returns 200 with profile payload.
3. `getMedicalInfo` returns medical information.
4. `updateProfile` forwards update payload and returns updated profile.
5. `deleteProfile` returns `{ deleted: true }`.
6. `updateFcmToken` returns 400 when token is missing.
7. `updateFcmToken` adds token by default.
8. `updateFcmToken` removes token when action is `remove`.

### `tests/unit/authService.unit.test.js`

1. `registerUser` throws when user already exists.
2. `registerUser` hashes password and creates user with medical defaults.
3. `authenticateUser` returns null when user is not found.
4. `authenticateUser` returns null when password mismatch.
5. `authenticateUser` returns user on valid password.
6. `createTokensForUser` signs both access and refresh tokens with expected payload.

### `tests/unit/profileService.unit.test.js`

1. `getProfile` requests safe projection fields.
2. `getMedicalInfo` queries with medical projection.
3. `updateProfile` filters out disallowed fields.
4. `deleteProfile` continues deletion even if scheduler cleanup fails.
5. `addFcmToken` removes token from other users then adds to current user.
6. `removeFcmToken` removes token from user.

### `tests/unit/authMiddleware.unit.test.js`

1. Accepts and trusts gateway user headers.
2. Returns 401 when Authorization header is missing.
3. Verifies bearer token and calls `next()`.
4. Returns 401 and logs error for invalid token.

### `tests/unit/otpService.unit.test.js`

1. `generateOTP` returns a 6-digit numeric string.
2. `createOTPToken` signs with configured secret and expiry.
3. `verifyOTPToken` returns valid result for matching OTP.
4. `verifyOTPToken` returns invalid for OTP mismatch.
5. `verifyOTPToken` reports expired token.
6. `verifyOTPToken` reports invalid token and logs error.

## Integration Test Scenarios

### `tests/integration/auth.routes.integration.test.js`

1. `POST /auth/signup` returns 201 for valid signup payload.
2. `POST /auth/login` returns 401 for invalid credentials.
3. `POST /auth/refresh` returns 200 with rotated tokens.
4. `POST /auth/request-otp` returns 200 and OTP token.
5. `POST /auth/verify-reset-otp` returns 200 and reset session token.

### `tests/integration/profile.routes.integration.test.js`

1. `GET /profile/:user_id` returns user profile.
2. `GET /profile/medical-info/:user_id` returns medical info payload.
3. `PUT /profile/:user_id` updates and returns profile.
4. `PATCH /profile/fcm-token/:user_id` removes token when requested.
5. `DELETE /profile/:user_id` returns successful deletion response.

## Component Test Scenarios

### `tests/component/auth.middleware.component.test.js`

1. Protected endpoint authenticates via gateway headers.
2. Protected endpoint authenticates via bearer token fallback.
3. Protected endpoint returns 401 when token is invalid.

### `tests/component/wellKnown.component.test.js`

1. `GET /.well-known/jwks.json` serves JWKS payload.

## Notes

- During test implementation, a defect was fixed in `src/controllers/authController.js` where signup validation used unintended assignment expressions and returned 500 instead of 400.
- `tests/auth.test.js`, `tests/profile.test.js`, and `tests/utils.test.js` placeholder tests were removed and replaced with comprehensive suites.
