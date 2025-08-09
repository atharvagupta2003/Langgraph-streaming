# Edit and Fork (Same Thread)

Goal
- Edit an earlier human message and continue from that point in the same thread.

How
- UI: Edit button on human messages opens inline editor.
- Forking: baseMessages = messages.slice(0, index) (drop tool). Update UI to base + edited.
- Start stream with { command: { update: { values: { messages: baseMessages } } } } to set server state.
- Send edited human message as input.

Notes
- Tool call merging rules remain in effect.
- Pause remains blocked during tool calls.

Files
- MessageBubble.tsx — inline edit UI
- useMultiChat.ts — editAndForkMessage orchestration
