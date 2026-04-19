# Medicine Analyzer Test Scenarios

## Execution Summary

- Date: 2026-04-19
- Command: `npm test`
- Result: Passed (Unit, Component, and Integration suites passed)

## Mock Separation

Shared mock modules are separated under:

- `test/mocks/fixtures.js`
- `test/mocks/services.js`
- `test/mocks/env.js`
- `test/mocks/providerFixtures.js`

## Unit Scenarios

### `test/unit/llmClient.test.js`

1. Gemini provider parses structured JSON response.
2. Gemini provider fails after retry budget when text is missing.
3. OpenAI provider parses structured JSON response.
4. OpenAI provider fails after retry budget when text is missing.
5. `llmClient.callStructured` delegates to selected provider.
6. `llmClient.callGeminiStructured` remains backward-compatible alias.

### `test/unit/ragClient.test.js`

1. Pinecone integrated embedding search request format is correct.
2. Search results are mapped to normalized `{text, score}` array.
3. Search returns empty array on upstream error.

## Component Scenarios

### `test/component/analyze.test.js`

1. Valid analyze request returns `200` with analysis payload.
2. Missing `medicine_data` returns `400`.
3. Non-medicine label classification returns `422`.
4. LLM failure returns `500`.
5. Analysis still succeeds when profile service response is non-OK.
6. Analysis still succeeds when RAG retrieval fails.

## Integration Scenarios

### `test/integration/integration.test.js`

1. Initializes dummy HTTP server for Profile Manager to simulate cross-service HTTP routing.
2. Tests `GET /health` returns `200`.
3. Validates full integration boundary of `POST /api/analyze/:user_id` hitting the real Express app routing, verifying token/header requirements, and returning expected LLM payload (mocked LLM layer).
