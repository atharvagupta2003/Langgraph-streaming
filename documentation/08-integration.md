# Integration and Graph Agnosticism

Graph-agnostic
- UI reads NEXT_PUBLIC_LANGGRAPH_URL and NEXT_PUBLIC_GRAPH_ID and creates an assistant for that graph.
- Streams with modes ["messages", "updates"].
- Tool calls/results handled generically via ai.tool_calls and tool messages.

Switching graphs
- Update UI/.env.local and restart dev server.
- Clear localStorage key lg_chats_v1 when changing servers/graphs.

Platform API
- runs.stream(threadId, assistantId, { input, streamMode, ... })
- runs.cancel(threadId, runId, { action: 'interrupt', wait: true })
- threads.getState(threadId)
- assistants/threads create/delete (chat lifecycle)

Server expectations
- Tool messages must follow ai.tool_calls with matching tool_call_id.
- command.update.values.messages supported for state rewrites (forking).
