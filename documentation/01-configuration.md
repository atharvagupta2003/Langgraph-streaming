# Configuration

Environment variables (client-side)

- NEXT_PUBLIC_LANGGRAPH_URL: Base URL for LangGraph Platform API (e.g., http://localhost:2024)
- NEXT_PUBLIC_GRAPH_ID: Graph ID to use (e.g., open_deep_research)
- Optional model config keys used by page.tsx:
  - NEXT_PUBLIC_MODEL_NAME
  - NEXT_PUBLIC_CODE_SUGGESTIONS_MODEL
  - NEXT_PUBLIC_CODE_SUMMARY_MODEL
  - NEXT_PUBLIC_LOCALIZATION_MODEL
  - NEXT_PUBLIC_PULL_REQUEST_REVIEW_MODEL
  - NEXT_PUBLIC_TEST_FRAMEWORK

Notes

- Put variables in UI/.env.local and restart the dev server.
- If you switch graphs/servers, clear local storage key lg_chats_v1 to avoid restoring threads from an incompatible server.

Files

- UI/app/page.tsx: Reads env, mounts Chat with apiUrl, graphId, and a config passed to SDK.
