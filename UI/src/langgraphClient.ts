import { Client } from "@langchain/langgraph-sdk";

export interface ClientConfig {
  apiUrl: string;
  apiKey?: string;
}

export interface StreamRunOptions {
  threadId: string;
  graphId: string;
  input: any;
  streamMode?: string;
  streamSubgraphs?: boolean;
}

export interface CreateAssistantOptions {
  graphId: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface JoinStreamOptions {
  threadId: string;
  runId: string;
  streamMode?: string;
}

export interface CancelRunOptions {
  threadId: string;
  runId: string;
}

export interface ListRunsOptions {
  threadId: string;
  limit?: number;
}

export function makeClient(config: ClientConfig): Client {
  return new Client({ 
    apiUrl: config.apiUrl, 
    apiKey: config.apiKey 
  });
}

export async function createAssistant(client: Client, options: CreateAssistantOptions): Promise<string> {
  const { graphId, name, metadata } = options;
  const assistant = await client.assistants.create({
    graphId: graphId,
    name: name || `Assistant for ${graphId}`,
    metadata: metadata || {}
  });
  return assistant.assistant_id;
}

export async function createThread(client: Client, metadata?: Record<string, any>): Promise<string> {
  const thread = await client.threads.create({ metadata });
  return thread.thread_id;
}

export async function getThreadHistory(client: Client, threadId: string) {
  return await client.threads.getHistory(threadId);
}

export async function* streamRunWithGraph(client: Client, options: StreamRunOptions) {
  const {
    threadId,
    graphId,
    input,
    streamMode = "updates",
    streamSubgraphs = false
  } = options;

  // Create assistant for this run
  const assistantId = await createAssistant(client, { graphId });

  const iterator = client.runs.stream(threadId, assistantId, {
    input,
    streamMode: "messages",
  });

  for await (const part of iterator) {
    yield part;
  }
}

// Legacy function for backward compatibility
export async function* streamRun(client: Client, options: StreamRunOptions & { assistantId?: string }) {
  if (options.assistantId) {
    // Use existing assistant
    const iterator = client.runs.stream(options.threadId, options.assistantId, {
      input: options.input,
      streamMode: "messages",
    });

    for await (const part of iterator) {
      yield part;
    }
  } else {
    // Use graph-based approach
    const {
      threadId,
      graphId,
      input
    } = options;

    // Create assistant for this run
    const assistantId = await createAssistant(client, { graphId });

    const iterator = client.runs.stream(threadId, assistantId, {
      input,
      streamMode: "messages",
    });

    for await (const part of iterator) {
      yield part;
    }
  }
}

export async function* joinStream(client: Client, options: JoinStreamOptions) {
  const { threadId, runId } = options;
  
  const iterator = client.runs.joinStream(threadId, runId);

  for await (const part of iterator) {
    yield part;
  }
}

export async function cancelRun(client: Client, options: CancelRunOptions): Promise<void> {
  const { threadId, runId } = options;
  await client.runs.cancel(threadId, runId);
}

export async function listRuns(client: Client, options: ListRunsOptions) {
  const { threadId, limit = 20 } = options;
  return await client.runs.list(threadId, { limit });
}