'use client';

import { useState, useCallback, useRef } from 'react';
import { makeClient } from '@/src/langgraphClient';
import { Message, ThreadMetadata } from '@/lib/types';
import type { Config } from '@langchain/langgraph-sdk';

interface UseGraphStreamOptions {
  apiUrl: string;
  graphId: string;
  config?: Config;
  onUpdateEvent?: (event: any) => void;
  onMetadataEvent?: (event: ThreadMetadata) => void;
  onCustomEvent?: (event: any) => void;
  onError?: (error: Error) => void;
}

interface UseGraphStreamReturn {
  messages: Message[];
  isLoading: boolean;
  submit: (input: { messages: Message[] }) => void;
  stop: () => void;
  error: Error | null;
}

export function useGraphStream(options: UseGraphStreamOptions): UseGraphStreamReturn {
  const {
    apiUrl,
    graphId,
    config,
    onUpdateEvent,
    onMetadataEvent,
    onCustomEvent,
    onError
  } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const clientRef = useRef(makeClient({ apiUrl }));

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
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

    // Add user message to UI immediately
    const userMessages = input.messages.filter(msg => msg.type === 'human');
    if (userMessages.length > 0) {
      setMessages(prev => [...prev, ...userMessages]);
    }

    try {
      const client = clientRef.current;
      
      // Create assistant for this run
      const assistant = await client.assistants.create({
        graphId: graphId,
        config: config || { configurable: {} },
        ifExists: "raise"
      });

      // Create thread
      const thread = await client.threads.create();
      
      // Emit metadata
      const metadata: ThreadMetadata = {
        thread_id: thread.thread_id,
        run_id: undefined // Will be set when run starts
      };
      onMetadataEvent?.(metadata);

      // Start streaming run
      const stream = client.runs.stream(
        thread.thread_id, 
        assistant.assistant_id,
        {
          input,
          streamMode: ["messages", "updates"],
          config
        }
      );

      let runId: string | undefined;
      let currentStreamingMessageIndex: number | null = null;

      // Add a placeholder AI message immediately to reserve the position
      setMessages(prev => {
        const newMessages = [...prev];
        currentStreamingMessageIndex = newMessages.length;
        newMessages.push({ type: 'ai', content: '' });
        return newMessages;
      });

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

        if (part.event === 'messages' && Array.isArray(part.data)) {
          console.log('Messages event data:', part.data);
          // Handle direct message updates
          const aiMessages = part.data.filter((msg: Message) => msg.type === 'ai');
          if (aiMessages.length > 0 && currentStreamingMessageIndex !== null) {
            const messageIndex = currentStreamingMessageIndex; // Capture the value
            setMessages(prev => {
              const newMessages = [...prev];
              const latestAiMessage = aiMessages[aiMessages.length - 1];
              
              // Update the pre-allocated message position
              if (messageIndex < newMessages.length) {
                newMessages[messageIndex] = latestAiMessage;
              }
              return newMessages;
            });
          }
        }

        if (part.event === 'updates' && part.data) {
          onUpdateEvent?.(part.data);
          
          // Extract messages from updates
          for (const [, update] of Object.entries(part.data)) {
            if (update && typeof update === 'object' && 'messages' in update) {
              const nodeMessages = (update as any).messages;
              if (Array.isArray(nodeMessages)) {
                const aiMessages = nodeMessages.filter((msg: Message) => msg.type === 'ai');
                if (aiMessages.length > 0 && currentStreamingMessageIndex !== null) {
                  const messageIndex = currentStreamingMessageIndex; // Capture the value
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const latestAiMessage = aiMessages[aiMessages.length - 1];
                    
                    // Update the pre-allocated message position
                    if (messageIndex < newMessages.length) {
                      newMessages[messageIndex] = latestAiMessage;
                    }
                    return newMessages;
                  });
                }
              }
            }
          }
        }

        if (part.event === 'events' && part.data) {
          onCustomEvent?.(part.data);
        }
      }

      // Cleanup: delete assistant and thread
      try {
        await client.assistants.delete(assistant.assistant_id);
        await client.threads.delete(thread.thread_id);
      } catch (cleanupError) {
        console.warn('Cleanup error:', cleanupError);
      }

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Stream failed');
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [apiUrl, graphId, config, isLoading, onUpdateEvent, onMetadataEvent, onCustomEvent, onError, stop]);

  return {
    messages,
    isLoading,
    submit,
    stop,
    error
  };
}