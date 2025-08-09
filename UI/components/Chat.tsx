'use client';

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Message, ToolEvent, ThreadMetadata } from "@/lib/types";
import MessageBubble from "./MessageBubble";
import ToolActivity from "./ToolActivity";
import { useGraphStream } from "@/hooks/useGraphStream";
import type { Config } from '@langchain/langgraph-sdk';

interface ChatProps {
  apiUrl: string;
  graphId: string;
  config?: Config;
}

export default function Chat({ apiUrl, graphId, config }: ChatProps) {
  const [input, setInput] = useState("");
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [metadata, setMetadata] = useState<ThreadMetadata>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleUpdateEvent = (evt: any) => {
    if (typeof evt === 'object' && evt) {
      for (const [nodeName, update] of Object.entries(evt)) {
        if (update && typeof update === 'object' && 'messages' in update) {
          const messages = (update as any).messages;
          if (Array.isArray(messages)) {
            for (const msg of messages) {
              if (msg.type === 'ai' && Array.isArray(msg.tool_calls)) {
                for (const toolCall of msg.tool_calls) {
                  setToolEvents(prev => [...prev, {
                    id: `${Date.now()}-${toolCall.id}`,
                    kind: "call",
                    name: toolCall.name,
                    node: nodeName,
                    args: toolCall.args,
                    when: Date.now()
                  }]);
                }
              }
              if (msg.type === 'tool') {
                setToolEvents(prev => [...prev, {
                  id: `${Date.now()}-${msg.name || 'tool'}`,
                  kind: "result",
                  name: msg.name,
                  node: nodeName,
                  result: msg.content,
                  when: Date.now()
                }]);
              }
            }
          }
        }
      }
    }
  };

  const handleMetaEvent = (evt: any) => {
    setMetadata(evt);
  };

  const handleCustomEvent = (evt: any) => {
    console.log('Custom event:', evt);
  };

  const thread = useGraphStream({
    apiUrl,
    graphId,
    config,
    onUpdateEvent: handleUpdateEvent,
    onMetadataEvent: handleMetaEvent,
    onCustomEvent: handleCustomEvent,
    onError: (e) => console.error('Stream error:', e),
  });

  const handleSubmit = () => {
    if (!input.trim()) return;
    
    const userMessage = { type: "human" as const, content: input.trim() };
    
    thread.submit({ messages: [userMessage] });
    
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleStop = () => {
    thread.stop();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.messages, thread.isLoading]);

  const messages = thread.messages || [];

  return (
    <div className="h-screen flex flex-col max-w-7xl mx-auto">
      {/* Error Display */}
      {thread.error && (
        <div className="bg-red-50 border border-red-200 px-4 py-3 mx-6 mt-4 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Stream Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{thread.error.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">LangGraph Streaming Chat</h1>
            {metadata.thread_id && (
              <p className="text-sm text-gray-500">
                Thread: {metadata.thread_id.slice(-8)} 
                {metadata.run_id && ` | Run: ${metadata.run_id.slice(-8)}`}
              </p>
            )}
          </div>
          {thread.isLoading && (
            <button
              onClick={handleStop}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Messages panel */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <p>Start a conversation with your assistant!</p>
                <p className="text-sm mt-1">Try asking it to use tools or perform tasks</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <MessageBubble
                    key={index}
                    role={message.type === 'human' ? 'human' : 'ai'}
                    content={message.content}
                    streaming={thread.isLoading && message.type === 'ai' && index === messages.length - 1}
                  />
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 border-t border-gray-200 px-6 py-4">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                className="flex-1 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                disabled={thread.isLoading}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || thread.isLoading}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Tool Activity panel */}
        <div className="w-1/3 border-l border-gray-200 bg-gray-50">
          <div className="h-full overflow-y-auto px-6 py-4">
            <ToolActivity events={toolEvents} />
          </div>
        </div>
      </div>
    </div>
  );
}