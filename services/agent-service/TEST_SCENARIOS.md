# Agent Service — Test Scenarios

This document describes the full automated test coverage for the AushadX Agent Service.
All tests are executed with `pytest` and require no live infrastructure — all external
services (MongoDB, Gemini LLM, downstream micro-services) are stubbed out.

**Run the full suite:**
```bash
pytest tests/ -v
```

**Result: 65 passed**

---

## Test Architecture

| Layer | Directory | Stubs required |
|---|---|---|
| Unit | `tests/unit/` | None (pure logic) or `requests_mock` |
| Component | `tests/component/` | `agent.graph`, `database` module stubs |
| Integration | `tests/integration/` | Same as component |

Shared fixtures live in `tests/mocks/fixtures.py`:
- `config(user_id, timezone, tz_offset)` — builds a LangGraph `RunnableConfig` dict.
- `profile_payload()` — hardcoded medical profile response from the Profile Manager.

---

## 1. Unit Tests

### `tests/unit/test_graph.py` — LangGraph Agent Graph

| # | Test | Description |
|---|---|---|
| 1 | `test_graph_module_exports_compiled_graph` | `graph.py` compiles successfully and exposes the `graph` instance backed by the MongoDB checkpointer. |
| 2 | `test_call_model_returns_single_ai_message` | `call_model()` invokes the LLM and wraps the response as a single `AIMessage` in the state. |
| 3 | `test_call_model_prepends_system_prompt` | `call_model()` always prepends `SYSTEM_PROMPT` as the first message before invoking the LLM. |
| 4 | `test_tools_condition_routes_to_tools` | `tools_condition` returns `"tools"` when the latest AI message contains `tool_calls` — triggering autonomous tool execution. |
| 5 | `test_tools_condition_routes_to_end` | `tools_condition` returns `"__end__"` when the AI issues a plain conversational response with no tool calls. |
| 6 | `test_graph_multi_agent_switching` | Simulates the full multi-agent switching cycle: LLM dispatches a tool call → `ToolNode` executes → control returns to agent → agent produces the final response. Verifies the 4-message state sequence: `HumanMessage → AIMessage(tool_call) → ToolMessage → AIMessage(final)`. |

---

### `tests/unit/test_tools.py` — Agent Tools

#### Time Utilities

| # | Test | Description |
|---|---|---|
| 7 | `test_parse_time_str_24h` | Parses 24-hour `"14:30"` correctly into `(14, 30)`. |
| 8 | `test_parse_time_str_12h_pm` | Converts `"2:00 PM"` → `(14, 0)`. |
| 9 | `test_parse_time_str_12h_am` | Converts `"12:00 AM"` (midnight) → `(0, 0)`. |
| 10 | `test_parse_time_str_noon` | Converts `"12:00 PM"` (noon) → `(12, 0)`. |
| 11 | `test_parse_time_str_with_seconds` | Strips seconds component and parses `"09:30:00"` → `(9, 30)`. |
| 12 | `test_parse_time_str_invalid` | Raises `ValueError` for an unparseable time string. |

#### Timezone Resolution

| # | Test | Description |
|---|---|---|
| 13 | `test_get_client_tz_uses_numeric_offset` | JS offset `-330` is negated to `+05:30` (IST), the most reliable resolution path. |
| 14 | `test_get_client_tz_falls_back_to_iana` | Without a numeric offset, falls back to IANA string parsing (e.g. `"America/New_York"`). |
| 15 | `test_get_client_tz_falls_back_to_utc` | Invalid IANA strings return `timezone.utc` as a safe default. |

#### `get_upcoming_reminders`

| # | Test | Description |
|---|---|---|
| 16 | `test_get_upcoming_reminders_success` | Returns the parsed JSON list when the scheduler returns 200. |
| 17 | `test_get_upcoming_reminders_failure` | Returns `{"error": ...}` on a 500 from the scheduler. |
| 18 | `test_get_upcoming_reminders_uses_user_id` | Uses `user_id` from `configurable`, not `thread_id`, when building the scheduler URL. |

#### `get_pending_or_missed_reminders`

| # | Test | Description |
|---|---|---|
| 19 | `test_get_pending_or_missed_reminders_success` | Returns the list of missed/pending reminders on success. |
| 20 | `test_get_pending_or_missed_reminders_failure` | Returns `[{"error": ...}]` on a 503. |

#### `analyze_medicine`

| # | Test | Description |
|---|---|---|
| 21 | `test_analyze_medicine_success` | POSTs `{"medicine_data": {"text": name}}` and returns the parsed analysis response. |
| 22 | `test_analyze_medicine_failure` | Returns `{"error": ...}` on a 503 from the analyzer service. |

#### `check_medicine_taken`

| # | Test | Description |
|---|---|---|
| 23 | `test_check_medicine_taken_found` | Returns `status: "pending_or_missed"` when the medicine appears in missed reminders. |
| 24 | `test_check_medicine_taken_not_found` | Returns `status: "taken_or_not_scheduled"` when not in the missed list. |
| 25 | `test_check_medicine_taken_case_insensitive` | Matching is case-insensitive (`"ASPIRIN"` matches `"aspirin"`). |
| 26 | `test_check_medicine_taken_propagates_api_error` | Returns `{"error": ...}` when the missed reminders API call fails. |

#### `check_schedule_complications`

| # | Test | Description |
|---|---|---|
| 27 | `test_check_schedule_complications_success` | Returns `active_reminders` + `instruction` on success. |
| 28 | `test_check_schedule_complications_failure` | Returns `{"error": ...}` on a 503 from the scheduler. |

#### `schedule_reminder`

| # | Test | Description |
|---|---|---|
| 29 | `test_schedule_reminder_success_with_timezone_conversion` | Converts `09:00 IST` → `03:30 UTC` in `specificTimes`; `startDate` is stored in UTC with `+00:00`. |
| 30 | `test_schedule_reminder_invalid_start_date` | Returns `{"error": "Invalid startDate format. Must be ISO-8601."}` for unparseable dates. |
| 31 | `test_schedule_reminder_once_includes_required_fields` | `ONCE` frequency sends correct `frequency`/`duration` enum values in payload. |
| 32 | `test_schedule_reminder_multiple_times_converted` | Multiple `specificTimes` are each individually UTC-converted (`08:00 IST → 02:30`, `20:00 IST → 14:30`). |
| 33 | `test_schedule_reminder_network_failure` | Returns `{"error": ...}` when the scheduler POST returns 500. |

#### `update_reminder`

| # | Test | Description |
|---|---|---|
| 34 | `test_update_reminder_success` | Fetches the existing reminder, converts new times to UTC, and sends a correct PUT payload. |
| 35 | `test_update_reminder_not_found` | Returns error when no reminder matches the given `reminderId`. |
| 36 | `test_update_reminder_preserves_existing_times_when_not_changed` | If `specificTimes` is omitted, the existing UTC times are passed through untouched. |
| 37 | `test_update_reminder_merges_existing_fields` | Unspecified fields (e.g. `dosage`) are merged from the existing reminder document. |
| 38 | `test_update_reminder_paginated_response_format` | Handles paginated `{"reminders": [...]}` response format from the scheduler. |
| 39 | `test_update_reminder_network_failure` | Returns `{"error": ...}` when the PUT request fails with 500. |

#### `generate_medical_summary`

| # | Test | Description |
|---|---|---|
| 40 | `test_generate_medical_summary_success` | Aggregates `medical_info` (from Profile Manager) and `medications` (from scheduler) plus `instruction`. |
| 41 | `test_generate_medical_summary_partial_failure` | Returns `medical_info_error` and `medications_error` keys when both upstream services fail. |
| 42 | `test_generate_medical_summary_profile_non_success_body` | When profile responds with `success: false`, the raw body is still stored in `medical_info`. |

#### `get_current_datetime`

| # | Test | Description |
|---|---|---|
| 43 | `test_get_current_datetime_uses_client_timezone` | Returns an ISO-8601 string with `+05:30` offset for IST client config. |
| 44 | `test_get_current_datetime_utc_fallback` | Returns UTC time when no timezone config is present. |
| 45 | `test_get_current_datetime_returns_iso_format` | Output is always a valid, parseable ISO-8601 datetime string. |

---

## 2. Component Tests

### `tests/component/test_api.py` — FastAPI HTTP Endpoints

The `agent.graph` and `database` modules are replaced with in-memory stubs so
no real MongoDB or LLM calls are made.

#### Health

| # | Test | Description |
|---|---|---|
| 46 | `test_health_check` | `GET /health` returns `{"status": "ok", "service": "agent-service"}`. |

#### WebSocket Authentication

| # | Test | Description |
|---|---|---|
| 47 | `test_websocket_rejects_without_user_id` | `WS /ws` without `x-user-id` header or `?token=` query param is closed with code 1008. |
| 48 | `test_websocket_accepts_with_user_id_header` | `WS /ws` with a valid `x-user-id` header completes the handshake successfully. |

#### Chat Listing

| # | Test | Description |
|---|---|---|
| 49 | `test_fetch_user_chats_success` | `GET /chats/{user_id}` returns the list provided by `get_user_chats`. |
| 50 | `test_fetch_user_chats_empty` | Returns an empty array when the user has no chats. |

#### Chat Messages

| # | Test | Description |
|---|---|---|
| 51 | `test_fetch_chat_messages_not_found` | `GET /chats/{chat_id}/messages/{user_id}` returns 404 when chat doesn't exist. |
| 52 | `test_fetch_chat_messages_formats_only_human_ai` | `ToolMessage` entries are excluded; only `HumanMessage` and `AIMessage` are serialized. |
| 53 | `test_fetch_chat_messages_skips_empty_ai_tool_call` | `AIMessage` with empty string content (tool dispatch) is omitted from the response. |
| 54 | `test_fetch_chat_messages_handles_list_content` | `AIMessage` with list-of-text content (multimodal) is correctly joined into a single string. |

#### Delete Chat

| # | Test | Description |
|---|---|---|
| 55 | `test_delete_chat_success` | `DELETE /chats/{chat_id}/{user_id}` returns `{"status": "success"}` on successful deletion. |
| 56 | `test_delete_chat_not_found` | Returns 404 when the chat doesn't exist. |
| 57 | `test_delete_chat_uses_correct_ids` | Both `chat_id` and `user_id` path parameters are forwarded correctly to `delete_chat`. |

#### Update Chat Title

| # | Test | Description |
|---|---|---|
| 58 | `test_update_chat_title_success` | `PUT /chats/{chat_id}/{user_id}` with `{"title": "..."}` updates title and returns 200. |
| 59 | `test_update_chat_title_not_found` | Returns 404 when the target chat doesn't exist. |
| 60 | `test_update_chat_title_requires_title_field` | Request body without `title` field returns 422 Unprocessable Entity. |

---

## 3. Integration Tests

### `tests/integration/test_integration.py` — Full Application Boot & Flows

| # | Test | Description |
|---|---|---|
| 61 | `test_app_boots_and_responds` | The FastAPI application boots without errors and responds to `GET /health`. |
| 62 | `test_openapi_schema_available` | The OpenAPI schema at `/openapi.json` is accessible and contains all expected routes. |
| 63 | `test_cors_headers_present` | CORS middleware is wired correctly and doesn't crash on preflight requests. |
| 64 | `test_full_chat_management_flow` | End-to-end test: empty chat list → 404 for unknown chat → create chat → update title → delete chat → confirm empty list. |
| 65 | `test_websocket_auth_guard_integration` | WebSocket connection without identity is rejected at the application layer (code 1008). |

---

*All tests use hardcoded fixture data and `requests_mock` for HTTP stubs. No live services required.*
