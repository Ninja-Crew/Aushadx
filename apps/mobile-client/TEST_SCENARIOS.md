# Mobile Client Test Scenarios

## Execution Summary

- Date: 2026-04-19
- Command: `npm test`
- Result: Passed (Unit, Component, and Integration suites passed)

## Unit Scenarios

### `tests/unit/api.test.js`

1. Validate placeholder unit test successfully passes, establishing the correct framework and path aliases for unit testing.

## Component Scenarios

### `tests/component/App.component.test.js`

1. Validates that the root `<App />` component successfully renders without crashing.
2. Validates that context providers, `expo-font`, and `expo-splash-screen` can be safely mocked and mounted.

## Integration Scenarios

### `tests/integration/googleMaps.integration.test.js`

1. Uses `jest.fn` to mock the global `fetch` API.
2. Intercepts outgoing requests to the Google Maps Places API (`/maps/api/place/nearbysearch/json`).
3. Validates that the request properly injects Android security headers (`X-Android-Package`, `X-Android-Cert`).
4. Validates that the mock response is successfully parsed and extracts the mapped hospital details.
