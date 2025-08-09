# Streaming Semantics

Goals
- No premature/duplicate AI bubbles
- Tool calls first; AI content only after tools complete
- Stable ordering and updates

Rules implemented in useMultiChat
- AI with tool_calls → record toolCallMessageIndex; block plain AI until toolsCompleted is true.
- Tool results (type: tool) insert after tool-call AI and before final AI.
- Mapping by tool_call_id to combine results under the card.
- Update by id when possible. If final AI (no tool_calls) shares id with prior AI tool-call, do not replace; insert after tool block.
- Filter out standalone tool messages in Chat; pass toolResultsById to MessageBubble.

Auto-scroll
- Only when near bottom. Instant during streaming; smooth afterward (reduces jitter).
