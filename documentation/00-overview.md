# LangGraph Streaming UI – Overview

This UI is a graph-agnostic, real-time chat interface for LangGraph. It supports multi-chat sessions, live streaming of assistant messages, unified tool call/result visualization, pause/resume with checkpoints, and edit-and-fork of earlier human messages in the same thread.

Key capabilities
- Multi-chat sessions with client-side persistence and lazy history restore from the platform
- Correct streaming semantics: tool calls block AI content until tools resolve; no duplicate/overwrites
- Unified ToolCallCard combining tool args + results with progress indicator
- Pause run (checkpoint) and resume on next input; pause is blocked during active tool calls
- Edit a previous human message and fork from that point in the same thread using command.update
- Liquid glass aesthetic, auto-hiding top bar, smooth scrolling with Lenis, responsive layout
- Markdown rendering with clickable links

Top-level structure
- `UI/app/` – Next.js app entry, layout, global styles
- `UI/components/` – Visual components (Chat, Sidebar, MessageBubble, ToolCallCard, LenisProvider)
- `UI/hooks/` – State and streaming management (`useMultiChat`)
- `UI/src/langgraphClient.ts` – Thin wrapper around LangGraph SDK + helpers
- `UI/lib/types.ts` – Shared types for messages, metadata

How data flows
1) User submits input in `Chat` → `useMultiChat.sendMessage` starts a run via SDK `runs.stream(...)`.
2) Stream events update the active chat’s message list with strict in-place merging rules.
3) Tool calls (ai.tool_calls) show as cards; tool results (type: tool) map into those cards by `tool_call_id`.
4) Pause can interrupt the run (checkpoint preserved). Next send resumes from `pausedCheckpoint`.
5) Edit-and-fork replaces state up to an index using `command.update` and sends edited human input.


Session restart behavior
- On reload, the app rehydrates the chat list (IDs, titles, assistant/thread IDs) from localStorage (`lg_chats_v1`).
- When a chat is activated, it lazily restores the latest messages using LangGraph SDK `threads.getState(thread_id)`.
- If you change servers/graphs, clear `lg_chats_v1` to avoid restoring incompatible thread references.


