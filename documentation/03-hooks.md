# Hooks

## UI/hooks/useMultiChat.ts
Central state machine for multi-session chat and streaming.

ChatSession (selected fields)
- id, title, createdAt
- messages: Message[] (human | ai | tool)
- assistant, thread (Platform objects)
- isLoading, error
- toolCallMessageIndex: last AI that emitted tool_calls
- streamingMessageIndex: current AI streaming bubble (no tool_calls)
- toolsCompleted: gate for AI content after tools
- seenToolResults: de-dup set
- pendingToolCallIds: tool_call ids to block pause mid-tools
- currentRunId: for pause/interrupt
- pausedCheckpoint: resume point for next send

APIs
- createNewChat, switchToChat, deleteChat
- sendMessage — starts runs.stream; merging rules applied
- stopCurrentStream — aborts iterator
- pauseCurrentRun — interrupt + fetch checkpoint; disabled during tool calls
- editAndForkMessage — command.update values.messages to fork, then send edited human message

Lifecycle
- Persists minimal chat list to localStorage (lg_chats_v1)
- Hydrates on mount; lazily restores messages on chat activation using LangGraph SDK `threads.getState(thread_id)` to read the latest state/messages only
- Can be extended to browse historical checkpoints using `threads/{thread_id}/history`

## UI/hooks/useGraphStream.ts
Legacy/alternate stream helper; primary app uses useMultiChat.
