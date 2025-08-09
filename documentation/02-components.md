# Components

## UI/components/Chat.tsx
- The main chat page shell. Renders:
  - Sidebar (ChatSidebar)
  - Header (auto-hiding, shows title and thread/run chips)
  - Messages area
  - Input area (textarea + send/pause)
- Binds to useMultiChat for state/stream actions.
- Smooth auto-scroll only when near bottom. Shows “Thinking” chip.

## UI/components/MessageBubble.tsx
- Renders human/AI messages with liquid-glass styles.
- AI with tool_calls renders ToolCallCard per call and stitches results by tool_call_id.
- Markdown via react-markdown + remark-gfm; links open in a new tab.
- Human messages support inline edit-and-fork.
- Collapses excessive whitespace; tighter spacing for blocks.

## UI/components/ToolCallCard.tsx
- Unified card for tool args/results (combined mode).
- Loading pulse until result arrives.
- Scrollable pre blocks with data-lenis-prevent.
- Tabs for Arguments/Result and copy buttons.

## UI/components/ChatSidebar.tsx
- Liquid-glass sidebar; collapse/expand; “+” new chat.
- Shows counts, recency, loading dots; delete on hover.

## UI/components/LenisProvider.tsx
- Initializes smooth scrolling (Lenis) with nested scroll allowed; respects data-lenis-prevent.

## UI/components/ToolActivity.tsx
- Helper visualization for tool statuses (optional/diagnostic).
