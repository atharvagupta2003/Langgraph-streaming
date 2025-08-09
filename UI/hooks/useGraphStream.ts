'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { makeClient } from '@/src/langgraphClient';
import { Message, ThreadMetadata } from '@/lib/types';
import type { Config } from '@langchain/langgraph-sdk';

interface UseGraphStreamOptions {
  apiUrl: string;
  graphId: string;
  config?: Config;
  onMetadataEvent?: (event: ThreadMetadata) => void;
  onError?: (error: Error) => void;
}

interface UseGraphStreamReturn {
  messages: Message[];
  isLoading: boolean;
  submit: (input: { messages: Message[] }) => void;
  stop: () => void;
  endConversation: () => Promise<void>;
  error: Error | null;
}

export function useGraphStream(options: UseGraphStreamOptions): UseGraphStreamReturn {
  const {
    apiUrl,
    graphId,
    config,
    onMetadataEvent,
    onError
  } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const seenToolResults = useRef<Set<string>>(new Set());
  const conversationContext = useRef<{
    assistant: any;
    thread: any;
    isInitialized: boolean;
  }>({
    assistant: null,
    thread: null,
    isInitialized: false
  });
  const currentConversationState = useRef<{
    toolCallMessage: Message | null;
    toolCallMessageIndex: number | null;
    streamingMessageIndex: number | null;
    toolsCompleted: boolean;
  }>({
    toolCallMessage: null,
    toolCallMessageIndex: null,
    streamingMessageIndex: null,
    toolsCompleted: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const clientRef = useRef(makeClient({ apiUrl }));

  // Helper function to handle AI messages with tool calls
  const handleToolCallMessage = (message: Message) => {
    const toolCallsLength = message.tool_calls?.length ?? 0;
    const hasToolCalls = toolCallsLength > 0;

    console.log('handleToolCallMessage:', {
      hasToolCalls,
      toolCallsLength,
      toolCallsArgs: message.tool_calls?.map((tc: any) => tc.args)
    });

    // If there are tool calls (even if args are empty/partial), we should
    // record this immediately to prevent premature streaming bubbles.
    if (!hasToolCalls) return;

    setMessages(prev => {
      const newMessages = [...prev];
      const state = currentConversationState.current;

      if (state.toolCallMessageIndex === null) {
        // First time - add the tool call message
        state.toolCallMessage = message;
        state.toolCallMessageIndex = newMessages.length;
        newMessages.push(message);
        console.log('Added tool call message at index:', state.toolCallMessageIndex);
      } else {
        // Update existing tool call message
        newMessages[state.toolCallMessageIndex] = message;
        state.toolCallMessage = message;
        console.log('Updated tool call message at index:', state.toolCallMessageIndex);
      }

      return newMessages;
    });
  };

  // Helper function to handle tool results
  const handleToolResult = (message: Message) => {
    const toolId = `${message.tool_call_id}_${message.name}`;
    
    console.log('handleToolResult:', { toolId, toolCallId: message.tool_call_id, name: message.name });
    
    // Avoid duplicates
    if (seenToolResults.current.has(toolId)) {
      console.log('Skipping duplicate tool result:', toolId);
      return;
    }
    seenToolResults.current.add(toolId);
    
    setMessages(prev => {
      const newMessages = [...prev];
      const state = currentConversationState.current;
      
      // Insert after tool call message, in chronological order
      let insertIndex = newMessages.length;
      if (state.toolCallMessageIndex !== null) {
        // Find position after tool call message but before any streaming response
        insertIndex = state.toolCallMessageIndex + 1;
        
        // Count existing tool results to maintain order
        while (insertIndex < newMessages.length && newMessages[insertIndex].type === 'tool') {
          insertIndex++;
        }
      }
      
      console.log('Inserting tool result at index:', insertIndex);
      
      // Insert tool result
      newMessages.splice(insertIndex, 0, message);
      
      // Update streaming index if it exists and got shifted
      if (state.streamingMessageIndex !== null && state.streamingMessageIndex >= insertIndex) {
        state.streamingMessageIndex++;
      }
      
      return newMessages;
    });
    
    // Mark tools as completed after we've seen tool results
    console.log('Marking tools as completed');
    currentConversationState.current.toolsCompleted = true;
  };

  // Helper function to handle streaming AI responses
  const handleStreamingResponse = (message: Message, eventType: string) => {
    const hasContent = message.content && message.content.trim().length > 0;
    if (!hasContent) return;
    
    const state = currentConversationState.current;
    const hasToolCalls = state.toolCallMessage !== null;
    
    console.log('handleStreamingResponse:', {
      eventType,
      hasToolCalls,
      toolsCompleted: state.toolsCompleted,
      content: message.content.slice(0, 50)
    });
    
    // STRICT RULE: If tools were called, only show streaming response after ALL tools complete
    if (hasToolCalls && !state.toolsCompleted) {
      console.log('Blocking streaming response - tools not completed yet');
      return;
    }
    
    console.log('Allowing streaming response');
    
    setMessages(prev => {
      const newMessages = [...prev];
      
      if (state.streamingMessageIndex !== null) {
        // Update existing streaming message
        newMessages[state.streamingMessageIndex] = message;
      } else {
        // Create new streaming message at the end
        newMessages.push(message);
        state.streamingMessageIndex = newMessages.length - 1;
      }
      
      return newMessages;
    });
  };

  // Main message handler
  const handleMessage = (message: Message, eventType: string) => {
    if (message.type === 'ai') {
      if (message.tool_calls && message.tool_calls.length > 0) {
        handleToolCallMessage(message);
      } else {
        handleStreamingResponse(message, eventType);
      }
    } else if (message.type === 'tool') {
      handleToolResult(message);
    }
  };

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const endConversation = useCallback(async () => {
    const client = clientRef.current;
    const context = conversationContext.current;
    
    if (context.isInitialized) {
      try {
        console.log('Ending conversation and cleaning up...');
        await client.assistants.delete(context.assistant.assistant_id);
        await client.threads.delete(context.thread.thread_id);
        
        // Reset context
        conversationContext.current = {
          assistant: null,
          thread: null,
          isInitialized: false
        };
        
        console.log('Conversation ended and cleaned up');
      } catch (cleanupError) {
        console.warn('Cleanup error:', cleanupError);
      }
    }
  }, []);

  const submit = useCallback(async (
    input: { messages: Message[] }
  ) => {
    if (isLoading) {
      stop(); // Stop any existing stream
    }

    setError(null);
    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    
    // Reset conversation state for new message
    currentConversationState.current = {
      toolCallMessage: null,
      toolCallMessageIndex: null,
      streamingMessageIndex: null,
      toolsCompleted: false
    };

    // Add user message to UI immediately
    const userMessages = input.messages.filter(msg => msg.type === 'human');
    if (userMessages.length > 0) {
      setMessages(prev => [...prev, ...userMessages]);
    }

    try {
      const client = clientRef.current;
      
      // Initialize assistant and thread if not already done
      if (!conversationContext.current.isInitialized) {
        console.log('Initializing new conversation context...');
        
        // Create assistant for this conversation
        conversationContext.current.assistant = await client.assistants.create({
          graphId: graphId,
          config: config || { configurable: {} },
          ifExists: "raise"
        });

        // Create thread for this conversation
        conversationContext.current.thread = await client.threads.create();
        conversationContext.current.isInitialized = true;
        
        console.log('Created assistant:', conversationContext.current.assistant.assistant_id);
        console.log('Created thread:', conversationContext.current.thread.thread_id);
      } else {
        console.log('Reusing existing conversation context');
      }

      const { assistant, thread } = conversationContext.current;
      
      // Emit metadata
      const metadata: ThreadMetadata = {
        thread_id: thread.thread_id,
        run_id: undefined // Will be set when run starts
      };
      onMetadataEvent?.(metadata);

      // Start streaming run with the latest user message only
      const stream = client.runs.stream(
        thread.thread_id, 
        assistant.assistant_id,
        {
          input: { messages: userMessages }, // Only send the new user message
          streamMode: ["messages", "updates"],
          config
        }
      );

      let runId: string | undefined;

      for await (const part of stream) {
        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        // Debug logging
        console.log('Stream event:', part.event, part.data);

        if (part.event === 'metadata' && part.data) {
          runId = part.data.run_id;
          const updatedMetadata = { ...metadata, run_id: runId };
          onMetadataEvent?.(updatedMetadata);
        }

        // Handle streaming events with clean, robust logic
        if ((part.event === 'messages' || part.event === 'messages/partial' || part.event === 'messages/complete') && Array.isArray(part.data)) {
          console.log(`${part.event} event:`, part.data);
          
          for (const message of part.data) {
            handleMessage(message, part.event);
          }
        }

        if (part.event === 'updates' && part.data) {
          // Updates events are now handled by messages events above
          console.log('Updates event:', part.data);
        }

        if (part.event === 'events' && part.data) {
          // Process custom events if needed
          console.log('Custom event:', part.data);
        }
      }

      // Reset conversation state after completion
      currentConversationState.current = {
        toolCallMessage: null,
        toolCallMessageIndex: null,
        streamingMessageIndex: null,
        toolsCompleted: false
      };

      // Keep assistant and thread alive for continued conversation
      console.log('Keeping conversation context alive for next message');

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Stream failed');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [apiUrl, graphId, config, isLoading, onMetadataEvent, onError, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endConversation();
    };
  }, [endConversation]);

  return {
    messages,
    isLoading,
    submit,
    stop,
    endConversation,
    error
  };
}