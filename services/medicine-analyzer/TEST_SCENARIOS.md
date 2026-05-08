# Medicine Analyzer Test Scenarios

## Execution Summary

- Date: 2026-04-24
- Command: `npm test`
- Result: Passed (Unit, Component, and Integration suites passed)

## Mock Separation

Shared mock modules are separated under:

- `test/mocks/fixtures.js`
- `test/mocks/services.js`
- `test/mocks/env.js`
- `test/mocks/providerFixtures.js`

### Key Fixtures

| Fixture | Purpose |
|---|---|
| `analyzeInput` | Standard single-medicine text-only request |
| `multimodalInput` | Request with both `text` and `image` (base64) fields |
| `multiMedicineExtraction` | Stage 1 extraction response with 4 medicines for batching tests |
| `successfulExtraction` | Single-medicine Stage 1 extraction result |
| `successfulAnalysis` | Single-medicine Stage 2 analysis result including `extracted_schedule` |
| `profileResponse` | Mocked profile-manager HTTP response |

---

## Unit Scenarios

### `test/unit/llmClient.test.js`

1. Gemini provider parses structured JSON response.
2. Gemini provider fails after retry budget when text is missing.
3. OpenAI provider parses structured JSON response.
4. OpenAI provider fails after retry budget when text is missing.
5. `llmClient.callStructured` delegates to selected provider.
6. `llmClient.callStructured` passes `options` (including `image`) through to the provider.
7. `llmClient.callGeminiStructured` remains backward-compatible alias.

### `test/unit/ragClient.test.js`

1. Pinecone integrated embedding search request format is correct.
2. Search results are mapped to normalized `{text, score}` array.
3. Search returns empty array on upstream error.

---

## Component Scenarios

### `test/component/analyze.test.js`

1. Valid analyze request returns `200` with analysis payload.
2. Missing `medicine_data` returns `400`.
3. Non-medicine label classification returns `422`.
4. LLM failure returns `500`.
5. Analysis still succeeds when profile service response is non-OK.
6. Analysis still succeeds when RAG retrieval fails.
7. **[NEW]** Multimodal request with `image` field is accepted and `image` is forwarded to the LLM provider as an inline option on Stage 1 extraction call.
8. **[NEW]** Multi-medicine response (4 medicines) is correctly batched — LLM is called exactly 5 times (1 extraction + 4 individual analyses) and all 4 analyses are returned in the response.

---

## Integration Scenarios

### `test/integration/integration.test.js`

1. Initializes dummy HTTP server for Profile Manager to simulate cross-service HTTP routing.
2. Tests `GET /health` returns `200`.
3. Validates full integration boundary of `POST /api/analyze/:user_id` hitting the real Express app routing, verifying token/header requirements, and returning expected LLM payload (mocked LLM layer).

---

## Pipeline Architecture

The analysis pipeline now operates in two stages:

### Stage 1 — Medicine Extraction
- Input: `{ text, image }` from the mobile client
- The LLM is called with both OCR text and the raw prescription image (`image` as base64 inline data)
- Prompt instructs the LLM to detect medicines from image context, catching handwritten names missed by OCR
- Output: `{ medicines: [{ medicine_name, context_text }] }`
- Log: `Stage 1 Extracted: N medicines found.`

### Stage 2 — Individual Medicine Analysis (Batched)
- RAG context is fetched for all medicines in parallel (`Promise.all`)
- LLM analysis calls are executed in batches of `BATCH_SIZE = 3` to avoid API rate limits
- Each medicine is analysed individually with its RAG context and the original image
- Output schema includes a new `extracted_schedule` object for each medicine

### `extracted_schedule` Schema

| Field | Type | Description |
|---|---|---|
| `dosage` | `string \| null` | Amount per dose (e.g. `"500mg"`, `"1 tablet"`) |
| `frequency` | `enum \| null` | One of: `ONCE`, `DAILY`, `X_TIMES_DAILY`, `EVERY_X_HOURS`, `EVERY_X_MINUTES`, `SPECIFIC_WEEK_DAYS`, `SPECIFIC_DAYS_OF_MONTH`, `UNKNOWN` |
| `frequencyValue` | `number \| null` | The X in frequency (e.g. `6` for every 6 hours) |
| `duration` | `enum \| null` | One of: `SINGLE_DAY`, `FOR_X_DAYS`, `FOR_X_WEEKS`, `FOR_X_MONTHS`, `UNTIL_DATE`, `CONTINUOUS`, `UNKNOWN` |
| `durationValue` | `number \| null` | The X in duration (e.g. `5` for 5 days) |

These fields map 1:1 to the `medicine-scheduler` Reminder model and are used to pre-fill the AddEditReminderScreen form on the mobile client.
