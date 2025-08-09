export interface Message {
  type: "human" | "ai" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  name?: string;
  tool_call_id?: string;
  id?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  type?: string;
}

export interface ToolEvent {
  id: string;
  kind: "call" | "result";
  name?: string;
  node?: string;
  args?: any;
  result?: any;
  when: number;
}

export interface StreamPart {
  event: string;
  data: any;
}

export interface ThreadMetadata {
  thread_id?: string;
  run_id?: string;
}