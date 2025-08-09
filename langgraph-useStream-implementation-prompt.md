Project Goal
Wire an existing LangGraph Server assistant into a modern Next.js chat UI without changing the agent. First, build a tiny SDK layer that can send messages and stream outputs (including tool calls). After manual validation, build the UI with streaming chat bubbles and a Tool Activity panel.

----------------------------------------
Phase 1 — LangGraph SDK helpers & manual streaming test (no UI)
----------------------------------------

Inputs (Environment)
NEXT_PUBLIC_LANGGRAPH_URL=http://localhost:2024        # LangGraph Server URL
LG_ASSISTANT_ID=<YOUR_ASSISTANT_ID>     # Deployed assistant ID
# If your server requires auth, you’ll receive LG_API_KEY later. Do not hardcode secrets.
agent is already running on local host 2024

Deliverables
- src/langgraphClient.ts — typed helpers around @langchain/langgraph-sdk
- scripts/smoke.mjs — a minimal Node script that:
  - creates a thread
  - streams a run (printing tokens and tool events)
  - optionally cancels a run mid-stream

Install
npm i @langchain/langgraph-sdk @langchain/core

Build these helper functions (src/langgraphClient.ts)
Use the official JS SDK. Keep everything agent-agnostic (forward input as-is).

1) makeClient(config)
   - new Client({ apiUrl: NEXT_PUBLIC_LANGGRAPH_URL, apiKey?: LG_API_KEY })

2) assertAssistantExists(client, assistantId)
   - client.assistants.search({ limit: 50 }) → throw if not found.

3) createThread(client, metadata?) → threadId
   - client.threads.create({ metadata })

4) getThreadHistory(client, threadId)
   - client.threads.get_history({ thread_id: threadId })

5) streamRun(client, { threadId, assistantId, input, streamMode="updates", streamSubgraphs=false })
   - Returns an async iterator from:
     client.runs.stream(threadId, assistantId, {
       input, stream_mode: streamMode, stream_subgraphs: streamSubgraphs
     })
   - Consumers `for await (const part of iterator)` and get chunks with part.event and part.data.

6) joinStream(client, { threadId, runId, streamMode="updates" })
   - client.runs.join_stream(threadId, runId, { stream_mode: streamMode })

7) cancelRun(client, { threadId, runId })
   - client.runs.cancel(threadId, runId)

8) (Optional) listRuns(client, { threadId, limit=20 })
   - client.runs.search({ thread_id: threadId, limit })

Tip on stream modes
- Use "updates" to see the full LLM → Tool → LLM progression (great for tool calls).
- "messages-tuple" is useful for token-level deltas if you ever need raw tokens.

Minimal manual test (scripts/smoke.mjs)
1. Build client with NEXT_PUBLIC_LANGGRAPH_URL (and LG_API_KEY if provided).
2. assertAssistantExists(LG_ASSISTANT_ID).
3. createThread() → threadId.
4. Start a run with:
   const input = { messages: [{ type: "human", content: "Say hi and then fetch current time." }] };
   for await (const part of streamRun(client, { threadId, assistantId: LG_ASSISTANT_ID, input })) {
     if (part.event === "metadata") console.log("meta:", part.data);
     if (part.event === "messages") console.log("msg:", JSON.stringify(part.data));
     if (part.event === "updates")  console.log("upd:", JSON.stringify(part.data));  // tool calls/results here
     if (part.event === "events")   console.log("evt:", JSON.stringify(part.data));
   }
5. Repeat with a prompt that calls a tool. Confirm you see:
   - AI message with tool_calls (tool START, includes name and args)
   - Tool message with type: "tool" (tool RESULT payload)
6. Try cancel: run a longer prompt, then call cancelRun after the first few chunks; confirm the iterator stops.

Manual Validation (Phase 1)
- Can create a thread and stream a run.
- See assistant text in stream logs.
- See tool start (tool_calls) and result (type: "tool") in update logs.
- Cancel stops the stream quickly.


----------------------------------------
Phase 2 — Next.js UI with useStream (modern components)
----------------------------------------

Goal
Use the SDK via the official React useStream hook to build a modern chat UI:
- Streaming assistant messages
- Tool Activity panel (tool start + result)
- Stop button during streaming
- Pretty, responsive design (Tailwind + optional shadcn/ui)
- No backend plumbing, no agent changes

Env (Next.js)
NEXT_PUBLIC_LANGGRAPH_URL=http://localhost:8123
NEXT_PUBLIC_ASSISTANT_ID=<YOUR_ASSISTANT_ID>

Install
npm i @langchain/langgraph-sdk @langchain/core
npm i tailwindcss clsx   # UI
# (optional) shadcn/ui for Cards/Badges/Buttons

File tree
/app
  /page.tsx
/components
  /Chat.tsx
  /MessageBubble.tsx
  /ToolActivity.tsx
  /ToolCallCard.tsx
/lib
  /types.ts
/styles
  /globals.css

Hook wiring (inside components/Chat.tsx)
const thread = useStream<{ messages: Message[] }>({
  apiUrl: process.env.NEXT_PUBLIC_LANGGRAPH_URL!,
  assistantId: process.env.NEXT_PUBLIC_ASSISTANT_ID!,
  messagesKey: "messages",        // use your agent’s messages key if different
  reconnectOnMount: true,         // smooth reloads
  onUpdateEvent: handleUpdateEvent,   // capture tool calls & results
  onMetadataEvent: handleMetaEvent,   // run_id / thread_id for header
  onCustomEvent: handleCustomEvent,   // stub for future progress bars
  onError: (e) => console.error(e),
});

Send exactly what your agent expects
thread.submit(
  { messages: [{ type: "human", content: userText }], ...extraConfigs },
  { streamResumable: true }   // allows join after reload if needed later
);

Stop current stream
thread.stop();

Tool Activity parsing (no agent edits)
- In handleUpdateEvent(evt):
  - Iterate Object.entries(evt); for each { nodeName: update }, scan update.messages.
  - If m.type === "ai" and Array.isArray(m.tool_calls) → ToolCall START (extract name/type and args).
  - If m.type === "tool" → ToolCall RESULT (extract name (if present) and content as result).
  - Push to toolEvents state array; render in <ToolActivity /> using <ToolCallCard />.

Components (brief)
- MessageBubble.tsx
  Props: { role: "human" | "ai"; content: string; streaming?: boolean }
  - Show a pulsing caret when streaming & role is “ai.”
  - Tailwind: rounded-2xl, soft shadow, readable line-height.

- ToolCallCard.tsx
  Props: { kind: "call" | "result"; name?: string; node?: string; args?: any; result?: any; when: number }
  - Header row: icon + tool name, small node badge, timestamp.
  - Body: collapsible Args (JSON pretty) for “call” and Result (JSON pretty/text) for “result.”
  - Long JSON should scroll horizontally, not break layout.

- ToolActivity.tsx
  - Receives events: ToolEvent[], renders list of ToolCallCard items newest-last.

- Header bar
  - Show short threadId & runId (from onMetadataEvent); Stop button only while thread.isLoading is true.

Minimal UI behaviors
- Enter to send; Shift+Enter newline.
- Disable Send on empty input.
- Auto-scroll to latest message/tool event.
- Responsive two-column layout; stack on mobile.

Manual Validation (Phase 2)
1) Stream: Type a message and send — assistant text streams into the last bubble with a blinking caret.
2) Stop: Click Stop mid-stream — tokens cease immediately.
3) Tool calls: Trigger a prompt that calls a tool — right panel shows a Call card (name+args) followed by a Result card (payload), in that order.
4) IDs: Header shows non-empty thread/run ids during a run.
5) Reload: Reload during a stream; if the server supports resumable streams, it reconnects (reconnectOnMount). If not, UI still loads recent messages cleanly.
6) Looks good: Cards have rounded corners, soft shadows, consistent spacing; long JSON scrolls nicely.

Notes / Limits
- Stop ≠ pause mid-token: stop() cancels the run. True pause→resume requires interrupts in the graph (future step).
- Keep SDK up to date to benefit from streaming/event fixes.
- Do not expose server secrets in the browser; add a proxy route later only if needed.
