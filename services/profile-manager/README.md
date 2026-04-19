# Profile Manager

Microservice responsible for user profiles, authentication, and JWT lifecycle.

## Setup

1. Copy `.env.example` to `.env`. Ensure MongoDB is running.
2. Run `npm install`
3. Run `npm start`

## Docker

```bash
docker build -t profile-manager .
docker run -p 3001:3001 profile-manager
```

## Testing

Run all tests:

```bash
npm test
```

Test suites are organized by type:

- `tests/unit` for unit tests
- `tests/integration` for route and request flow integration tests
- `tests/component` for component-level behavior tests
- `tests/mocks` for shared, reusable mock builders and fixtures

Detailed executed scenarios are documented in `TEST_SCENARIOS.md`.
