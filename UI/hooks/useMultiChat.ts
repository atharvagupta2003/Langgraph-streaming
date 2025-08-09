'use client';

import { useState, useCallback, useRef } from 'react';
import { Message, ThreadMetadata } from '@/lib/types';
import type { Config } from '@langchain/langgraph-sdk';
import { makeClient } from '@/src/langgraphClient';

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  assistant: any;
  thread: any;
  metadata: ThreadMetadata;
  createdAt: number;
  isLoading: boolean;
  error: Error | null;
  // Streaming bookkeeping
  toolCallMessageIndex: number | null;
  streamingMessageIndex: number | null;
  toolsCompleted: boolean;
  seenToolResults: Set<string>;
}

interface UseMultiChatOptions {
  apiUrl: string;
  graphId: string;
  config?: Config;
  onMetadataEvent?: (chatId: string, event: ThreadMetadata) => void;
  onError?: (chatId: string, error: Error) => void;
}

interface UseMultiChatReturn {
  chats: ChatSession[];
  activeChat: ChatSession | null;
  activeChatId: string | null;
  createNewChat: () => string;
  switchToChat: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  sendMessage: (message: Message) => void;
  stopCurrentStream: () => void;
  isLoading: boolean;
}

export function useMultiChat(options: UseMultiChatOptions): UseMultiChatReturn {
  const { apiUrl, graphId, config, onMetadataEvent, onError } = options;
  
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const clientRef = useRef(makeClient({ apiUrl }));
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const activeChat = chats.find(chat => chat.id === activeChatId) || null;

  // Polyfill for Array.prototype.findLastIndex to support older TS lib targets
  const findLastIndex = <T,>(array: T[], predicate: (value: T, index: number, array: T[]) => boolean): number => {
    for (let i = array.length - 1; i >= 0; i--) {
      if (predicate(array[i], i, array)) return i;
    }
    return -1;
  };
  
  const generateChatTitle = (firstMessage: string): string => {
    const words = firstMessage.trim().split(' ').slice(0, 4).join(' ');
    return words.length > 30 ? words.substring(0, 30) + '...' : words || 'New Chat';
  };
  
  const createNewChat = useCallback((): string => {
    const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newChat: ChatSession = {
      id: chatId,
      title: 'New Chat',
      messages: [],
      assistant: null,
      thread: null,
      metadata: {},
      createdAt: Date.now(),
      isLoading: false,
      error: null,
      toolCallMessageIndex: null,
      streamingMessageIndex: null,
      toolsCompleted: false,
      seenToolResults: new Set<string>()
    };
    
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(chatId);
    
    console.log('Created new chat:', chatId);
    return chatId;
  }, []);
  
  const switchToChat = useCallback((chatId: string) => {
    // Stop any current streaming
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setActiveChatId(chatId);
    console.log('Switched to chat:', chatId);
  }, []);
  
  const deleteChat = useCallback(async (chatId: string) => {
    const client = clientRef.current;
    const chatToDelete = chats.find(c => c.id === chatId);
    
    if (chatToDelete) {
      // Cleanup assistant and thread
      try {
        if (chatToDelete.assistant) {
          await client.assistants.delete(chatToDelete.assistant.assistant_id);
        }
        if (chatToDelete.thread) {
          await client.threads.delete(chatToDelete.thread.thread_id);
        }
      } catch (cleanupError) {
        console.warn('Cleanup error for chat', chatId, ':', cleanupError);
      }
    }
    
    setChats(prev => prev.filter(c => c.id !== chatId));
    
    // If deleting active chat, switch to another or create new
    if (activeChatId === chatId) {
      const remainingChats = chats.filter(c => c.id !== chatId);
      if (remainingChats.length > 0) {
        setActiveChatId(remainingChats[0].id);
      } else {
        const newChatId = createNewChat();
        setActiveChatId(newChatId);
      }
    }
    
    console.log('Deleted chat:', chatId);
  }, [chats, activeChatId, createNewChat]);
  
  const sendMessage = useCallback(async (message: Message) => {
    if (!activeChatId) return;
    
    const client = clientRef.current;
    
    // Add user message to active chat immediately
    setChats(prev => prev.map(chat => 
      chat.id === activeChatId 
        ? { ...chat, messages: [...chat.messages, message] }
        : chat
    ));
    
    // Update chat title if this is the first message
    const currentChat = chats.find(c => c.id === activeChatId);
    if (currentChat && currentChat.messages.length === 0) {
      const title = generateChatTitle(message.content);
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId 
          ? { ...chat, title }
          : chat
      ));
    }
    
    // Set loading state and reset streaming bookkeeping for a fresh run
    setChats(prev => prev.map(chat => 
      chat.id === activeChatId 
        ? { 
            ...chat, 
            isLoading: true, 
            error: null,
            toolCallMessageIndex: null,
            streamingMessageIndex: null,
            toolsCompleted: false,
            seenToolResults: new Set<string>()
          }
        : chat
    ));
    
    try {
      let currentChat = chats.find(c => c.id === activeChatId);
      
      // Initialize assistant and thread if not exists
      if (!currentChat?.assistant || !currentChat?.thread) {
        console.log('Initializing assistant and thread for chat:', activeChatId);
        
        const assistant = await client.assistants.create({
          graphId,
          config: config || { configurable: {} },
          ifExists: "raise"
        });
        
        const thread = await client.threads.create();
        
        setChats(prev => prev.map(chat => 
          chat.id === activeChatId 
            ? { 
                ...chat, 
                assistant, 
                thread,
                metadata: { thread_id: thread.thread_id },
                toolCallMessageIndex: null,
                streamingMessageIndex: null,
                toolsCompleted: false,
                seenToolResults: new Set<string>()
              }
            : chat
        ));
        
        // Update current chat reference
        currentChat = { ...(currentChat as ChatSession), assistant, thread } as ChatSession;
      }
      
      if (!currentChat?.assistant || !currentChat?.thread) {
        throw new Error('Failed to initialize chat context');
      }
      
      // Emit metadata
      const metadata: ThreadMetadata = {
        thread_id: currentChat.thread.thread_id,
        run_id: undefined
      };
      onMetadataEvent?.(activeChatId, metadata);
      
      // Start streaming
      abortControllerRef.current = new AbortController();
      
      const stream = client.runs.stream(
        currentChat.thread.thread_id,
        currentChat.assistant.assistant_id,
        {
          input: { messages: [message] },
          streamMode: ["messages", "updates"],
          config
        }
      );
      
      for await (const part of stream) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }
        
        console.log('Stream event:', part.event, part.data);
        
        if (part.event === 'metadata' && part.data) {
          const updatedMetadata = { ...metadata, run_id: part.data.run_id };
          onMetadataEvent?.(activeChatId, updatedMetadata);
        }
        
        if ((part.event === 'messages' || part.event === 'messages/partial' || part.event === 'messages/complete') && Array.isArray(part.data)) {
          for (const streamMessage of part.data) {
            if (streamMessage.type === 'ai' || streamMessage.type === 'tool') {
              setChats(prev => prev.map(chat => {
                if (chat.id !== activeChatId) return chat;
                
                const updatedMessages = [...chat.messages];
                const incomingId = (streamMessage as any).id as string | undefined;
                
                if (incomingId) {
                  const existingByIdIndex = updatedMessages.findIndex((m: any) => (m as any).id === incomingId);
                  if (existingByIdIndex >= 0) {
                    updatedMessages[existingByIdIndex] = streamMessage;
                    return { ...chat, messages: updatedMessages };
                  }
                }

                if (streamMessage.type === 'ai') {
                  if (streamMessage.tool_calls && streamMessage.tool_calls.length > 0) {
                    // Record or update tool call message index
                    if (chat.toolCallMessageIndex === null) {
                      updatedMessages.push(streamMessage);
                      chat.toolCallMessageIndex = updatedMessages.length - 1;
                    } else {
                      updatedMessages[chat.toolCallMessageIndex] = streamMessage;
                    }
                  } else {
                    // AI response without tool calls - streaming final response
                    // If tools were called but not completed, do not show streaming yet
                    if (chat.toolCallMessageIndex !== null && !chat.toolsCompleted) {
                      return chat; // block until tools complete
                    }

                    if (chat.streamingMessageIndex !== null) {
                      updatedMessages[chat.streamingMessageIndex] = streamMessage;
                    } else {
                      updatedMessages.push(streamMessage);
                      chat.streamingMessageIndex = updatedMessages.length - 1;
                    }
                  }
                } else if (streamMessage.type === 'tool') {
                  // Tool result - check if we already have this specific result
                  const existingToolIndex = updatedMessages.findIndex(m => 
                    m.type === 'tool' && 
                    m.tool_call_id === streamMessage.tool_call_id &&
                    m.name === streamMessage.name
                  );
                  
                  if (existingToolIndex >= 0) {
                    // Update existing tool result
                    updatedMessages[existingToolIndex] = streamMessage;
                  } else {
                    // Add new tool result (insert after tool calls, before final response)
                    let insertIndex = updatedMessages.length;
                    
                    // Find position: after tool calls but before streaming AI response
                    for (let i = updatedMessages.length - 1; i >= 0; i--) {
                      if (updatedMessages[i].type === 'ai' && !updatedMessages[i].tool_calls) {
                        insertIndex = i;
                      } else if (updatedMessages[i].type === 'ai' && updatedMessages[i].tool_calls) {
                        break;
                      }
                    }
                    
                    updatedMessages.splice(insertIndex, 0, streamMessage);

                    // Adjust streaming index if needed
                    if (chat.streamingMessageIndex !== null && chat.streamingMessageIndex >= insertIndex) {
                      chat.streamingMessageIndex += 1;
                    }
                  }

                  // Mark tools completed
                  chat.toolsCompleted = true;
                }
                
                return { ...chat, messages: updatedMessages };
              }));
            }
          }
        }
      }
      
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Stream failed');
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId 
          ? { ...chat, error }
          : chat
      ));
      onError?.(activeChatId, error);
    } finally {
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId 
          ? { ...chat, isLoading: false }
          : chat
      ));
      abortControllerRef.current = null;
    }
  }, [activeChatId, chats, apiUrl, graphId, config, onMetadataEvent, onError]);
  
  const stopCurrentStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (activeChatId) {
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId 
          ? { ...chat, isLoading: false }
          : chat
      ));
    }
  }, [activeChatId]);
  
  return {
    chats,
    activeChat,
    activeChatId,
    createNewChat,
    switchToChat,
    deleteChat,
    sendMessage,
    stopCurrentStream,
    isLoading: activeChat?.isLoading || false
  };
}