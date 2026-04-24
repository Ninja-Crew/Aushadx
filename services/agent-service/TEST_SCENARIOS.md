# Agent Service Test Scenarios

## Execution Summary

- Date: 2026-04-19
- Command: `pytest`
- Result: Passed (Unit, Component, and Integration tests passed)

## Mock Separation

Shared test fixtures and helper configuration are separated under:

- `tests/mocks/fixtures.py`

## Unit Scenarios

### `tests/unit/test_graph.py`

1. `test_graph_module_exports_compiled_graph` ensures graph compiles.
2. `test_supervisor_routes_to_worker` ensures supervisor correctly issues `route_to_worker` tool calls.
3. `test_supervisor_answers_directly` ensures supervisor directly answers general questions without issuing tool calls.
4. `test_supervisor_router_routes_to_tools` validates routing to `tools` node when supervisor issues a tool call.
5. `test_router_after_tool_routes_to_worker` validates extraction of worker name from routing tool calls and proper handoff.
6. `test_agent_node_factory` ensures worker agents correctly return their responses tagged with their sender ID.
7. `test_agent_router_routes_to_tools_on_tool_calls` validates routing to `tools` node when worker returns tool calls.
8. `test_agent_router_routes_to_supervisor_when_done` validates routing back to `supervisor` when worker finishes its task.

### `tests/unit/test_tools.py`

1. Fetch upcoming reminders success path.
2. Fetch upcoming reminders error path.
3. Fetch pending/missed reminders success path.
4. Analyze medicine success path.
5. Analyze medicine upstream failure path.
6. Check medicine taken when reminder exists.
7. Check medicine taken when reminder does not exist.
8. Check schedule complications success path.
9. Schedule reminder success with timezone conversion to UTC payload.
10. Schedule reminder input validation failure for invalid `startDate`.
11. Update reminder success path with existing reminder merge.
12. Update reminder error when reminder ID is not found.
13. Generate medical summary success path.
14. Generate medical summary partial-failure path.
15. Current datetime reflects client timezone offset.

## Component Scenarios

### `tests/component/test_api.py`

1. `GET /health` returns service health payload.
2. WebSocket connection without user identity is rejected.
3. `GET /chats/{user_id}` returns user chat list.
4. `GET /chats/{chat_id}/messages/{user_id}` returns `404` when chat missing.
5. Messages endpoint formats only human/AI messages and excludes tool messages.
6. `DELETE /chats/{chat_id}/{user_id}` succeeds when chat exists.
7. Delete chat returns `404` when chat does not exist.
8. `PUT /chats/{chat_id}/{user_id}` updates title on success.
9. Update chat title returns `404` when chat not found.

## Integration Scenarios

### `tests/integration/test_integration.py`

1. Validates that the FastAPI application successfully boots and responds to HTTP requests without missing module failures or routing issues.
