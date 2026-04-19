# API Server Test Scenarios

## Execution Summary

- Date: 2026-04-19
- Command: `npm test`
- Result: Passed (Unit, Component, and Integration suites passed)

## Mock Separation

Shared mock modules are separated under:

- `test/mocks/auth.js`
- `test/mocks/proxy.js`
- `test/mocks/http.js`

## Unit Scenarios

### `test/unit/api.test.js`

1. `GET /health` returns gateway health payload.
2. `POST /auth/login` is publicly proxied.
3. Protected route rejects missing token (`401`).
4. Protected route rejects malformed bearer token (`401`).
5. Protected route rejects wrong token type (`401`, refresh token on access-only route).
6. `GET /profile` injects user ID and rewrites URL.
7. `GET /reminders` preserves query params while injecting user ID.
8. `GET /analyze` rewrites URL with authenticated subject.
9. `GET /chats` rewrites upstream URL with user scope.
10. `GET /chats/:chatId/messages` rewrites upstream URL with user scope.
11. `DELETE /chats/:chatId` rewrites upstream URL with user scope.

### `test/unit/verifyToken.test.js`

1. `verifyJWT` resolves valid access token payload.
2. `verifyJWT` rejects non-access token type.
3. Middleware returns `401` when auth header is missing.
4. Middleware attaches `req.user` and calls `next()` on success.
5. Middleware returns `401` when JWT verification fails.

## Component Scenarios

### `test/component/gateway.component.test.js`

1. Returns 200 for health check endpoint.
2. Routes public auth endpoints without blocking with a 401 locally.
3. Returns 401 for protected endpoints when accessing without a token.

## Integration Scenarios

### `test/integration/auth_integration.test.js`

1. Dynamically boots the express app with mock RSA keys.
2. Intercepts `jwks-rsa` key fetching requests using Jest mock.
3. Creates a dummy downstream HTTP profile server to accept proxied auth requests.
4. Validates that a correctly signed token successfully proxies through the gateway's auth check.

### `test/integration/integration.test.js`

1. Initializes dummy downstream HTTP servers for Profile Manager and Medicine Scheduler on local ports.
2. Mocks the JWKS `jwks-rsa` module configuration dynamically.
3. Successfully routes `POST /auth/signup` to the upstream mock.
4. Accesses protected `/profile/:user_id` route with token and confirms it successfully proxies.
5. Accesses protected `/reminders` route with token and confirms user injection occurs successfully.
