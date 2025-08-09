# File-by-File Guide

## UI/app/
- layout.tsx — Root layout; mounts LenisProvider; global background.
- page.tsx — Reads env, assembles config, mounts Chat with apiUrl and graphId.
- globals.css — Global styles and utilities (glass, background, no-scrollbar).

## UI/components/
- Chat.tsx — Container with sidebar, header, messages area, input; auto-scroll; sticky header; scroll-to-bottom; responsive widths; pause button logic.
- ChatSidebar.tsx — Session list; collapse/expand; new chat (+); delete; loading dots; collapsed mode indicators.
- MessageBubble.tsx — Renders messages; edit-and-fork for human; markdown rendering; ToolCallCards for ai.tool_calls; spacing normalization.
- ToolCallCard.tsx — Tool call/result combined card; status styles; tabs; copy; scrollable blocks.
- LenisProvider.tsx — Smooth scrolling init with nested scroll allowed and prevent function.
- ToolActivity.tsx — Auxiliary tool status UI.

## UI/hooks/
- useMultiChat.ts — Multi-session state + streaming; persistence; restore; strict merge logic; pause/resume with checkpoints; edit-and-fork.
- useGraphStream.ts — Legacy/alternate streaming helper.

## UI/src/
- langgraphClient.ts — SDK wrappers: makeClient, createAssistant/thread, stream helpers, getThreadState, interruptRun.

## UI/lib/
- types.ts — Message and metadata type definitions.

## Root
- documentation/ — This documentation suite.
- langgraph-platform.yaml — Platform OpenAPI reference (endpoints/semantics).
- langgraph-example/ — Example Python graph project (for local testing).
