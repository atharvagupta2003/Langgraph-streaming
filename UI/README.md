# LangGraph Streaming UI

A modern Next.js chat interface for LangGraph agents with streaming support and tool activity monitoring.

## Features

- 🔄 Real-time streaming of assistant responses
- 🛠️ Tool call visualization with start/result tracking
- ⏹️ Stop button to cancel streams
- 📱 Responsive design with mobile support
- 🎨 Clean, modern UI with Tailwind CSS

## Setup

### Phase 1: SDK Testing

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

3. Test the SDK helpers:
```bash
NEXT_PUBLIC_LANGGRAPH_URL=http://localhost:2024 NEXT_PUBLIC_GRAPH_ID=agent node scripts/smoke.mjs
```

### Phase 2: UI Development

1. Start the development server:
```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000)

3. Configure environment variables in `.env.local`:
   - `NEXT_PUBLIC_LANGGRAPH_URL`: Your LangGraph server URL  
   - `NEXT_PUBLIC_GRAPH_ID`: Your graph name (e.g., "agent")

## Manual Validation

### Phase 1 Tests
- ✅ Can create a thread and stream a run
- ✅ See assistant text in stream logs
- ✅ See tool start (tool_calls) and result (type: "tool") in update logs
- ✅ Cancel stops the stream quickly

### Phase 2 Tests
- ✅ Stream: Assistant text streams with blinking caret
- ✅ Stop: Click Stop mid-stream stops tokens immediately
- ✅ Tool calls: Right panel shows Call card (name+args) then Result card (payload)
- ✅ IDs: Header shows thread/run IDs during runs
- ✅ Reload: Reconnects to streams if server supports resumable streams
- ✅ Looks good: Cards have rounded corners, soft shadows, consistent spacing

## Architecture

- `src/langgraphClient.ts`: Typed helpers around @langchain/langgraph-sdk
- `components/Chat.tsx`: Main chat interface with useStream hook
- `components/MessageBubble.tsx`: Individual message rendering
- `components/ToolActivity.tsx`: Tool call monitoring panel
- `components/ToolCallCard.tsx`: Individual tool call/result cards
- `lib/types.ts`: TypeScript type definitions

## Environment Variables

### Development (.env.local)
```
NEXT_PUBLIC_LANGGRAPH_URL=http://localhost:2024
NEXT_PUBLIC_GRAPH_ID=agent
```

### Testing (for smoke.mjs)
```
NEXT_PUBLIC_LANGGRAPH_URL=http://localhost:2024
NEXT_PUBLIC_GRAPH_ID=agent
LG_API_KEY=your-api-key-if-needed
```

## Key Changes from Original Spec

This implementation creates assistants dynamically for each run using your `graph_id`, following the pattern shown in your Python example:

1. **Dynamic Assistant Creation**: Instead of using a pre-existing `assistant_id`, the system creates a fresh assistant for each conversation using `client.assistants.create({ graph_id: "agent" })`

2. **Automatic Cleanup**: After each run completes, the assistant and thread are automatically deleted to prevent resource buildup

3. **Graph-based Configuration**: The UI now accepts `NEXT_PUBLIC_GRAPH_ID` instead of `NEXT_PUBLIC_ASSISTANT_ID`, matching your server's graph-based architecture

4. **Custom Hook**: Created `useGraphStream` hook that replaces the standard `useStream` to handle the dynamic assistant creation pattern