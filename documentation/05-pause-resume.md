# Pause / Resume with Checkpoints

Why
- Allow stopping a run and resuming later without losing state.

Implementation
- Button: During streaming, the send button becomes a spinner; hover → red; click pauses.
- Guard: Disabled when pendingToolCallIds.size > 0.
- pauseCurrentRun:
  - interruptRun(threadId, runId) — cancel with action=interrupt, wait=true
  - getThreadState(threadId) — save pausedCheckpoint
  - abort iterator; clear currentRunId
- Resume on next send: include { checkpoint: pausedCheckpoint } in runs.stream options.

Files
- UI/src/langgraphClient.ts — interruptRun helper; SDK wrappers
- UI/hooks/useMultiChat.ts — pause logic + resume
