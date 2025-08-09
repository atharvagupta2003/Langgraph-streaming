#!/usr/bin/env node

import { 
  makeClient, 
  createAssistant, 
  createThread, 
  streamRunWithGraph, 
  cancelRun 
} from '../src/langgraphClient.ts';

async function smokeTest() {
  const NEXT_PUBLIC_LANGGRAPH_URL = process.env.NEXT_PUBLIC_LANGGRAPH_URL || 'http://localhost:2024';
  const NEXT_PUBLIC_GRAPH_ID = process.env.NEXT_PUBLIC_GRAPH_ID || 'agent';
  const LG_API_KEY = process.env.LG_API_KEY;

  console.log('🚀 Starting LangGraph SDK smoke test...');
  console.log(`📡 API URL: ${NEXT_PUBLIC_LANGGRAPH_URL}`);
  console.log(`🤖 Graph ID: ${NEXT_PUBLIC_GRAPH_ID}`);

  try {
    // 1. Create client
    console.log('\n📦 Creating client...');
    const client = makeClient({ apiUrl: NEXT_PUBLIC_LANGGRAPH_URL, apiKey: LG_API_KEY });

    // 2. Create assistant for testing
    console.log('🔍 Creating assistant for graph...');
    const assistantId = await createAssistant(client, { graphId: NEXT_PUBLIC_GRAPH_ID });
    console.log(`✅ Assistant created: ${assistantId}`);

    // 3. Create thread
    console.log('🧵 Creating thread...');
    const threadId = await createThread(client);
    console.log(`✅ Thread created: ${threadId}`);

    // 4. Test basic streaming
    console.log('\n💬 Testing basic streaming...');
    const input = { 
      messages: [{ type: "human", content: "Say hi and then fetch current time." }] 
    };

    console.log('📡 Starting stream...');
    for await (const part of streamRunWithGraph(client, { threadId, graphId: NEXT_PUBLIC_GRAPH_ID, input, streamMode: "messages" })) {
      if (part.event === "metadata") console.log("📄 meta:", part.data);
      if (part.event === "messages") console.log("💬 msg:", JSON.stringify(part.data));
      if (part.event === "updates") console.log("🔄 upd:", JSON.stringify(part.data));
      if (part.event === "events") console.log("⚡ evt:", JSON.stringify(part.data));
    }

    // 5. Test tool calls
    console.log('\n🔧 Testing tool calls...');
    const toolInput = { 
      messages: [{ type: "human", content: "What's the current time? Use your tools." }] 
    };

    console.log('📡 Starting tool call stream...');
    for await (const part of streamRunWithGraph(client, { threadId, graphId: NEXT_PUBLIC_GRAPH_ID, input: toolInput, streamMode: "messages" })) {
      if (part.event === "updates") {
        console.log("🔄 Tool update:", JSON.stringify(part.data));
        
        // Look for tool calls and results
        if (typeof part.data === 'object' && part.data) {
          for (const [nodeName, update] of Object.entries(part.data)) {
            if (update && typeof update === 'object' && 'messages' in update) {
              const messages = update.messages;
              if (Array.isArray(messages)) {
                for (const msg of messages) {
                  if (msg.type === 'ai' && Array.isArray(msg.tool_calls)) {
                    console.log('🚀 Tool call detected:', msg.tool_calls);
                  }
                  if (msg.type === 'tool') {
                    console.log('📦 Tool result:', msg.content);
                  }
                }
              }
            }
          }
        }
      }
    }

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    try {
      await client.assistants.delete(assistantId);
      await client.threads.delete(threadId);
      console.log('✅ Cleanup completed');
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError.message);
    }

    console.log('\n✅ Smoke test completed successfully!');

  } catch (error) {
    console.error('❌ Smoke test failed:', error);
    process.exit(1);
  }
}

smokeTest();