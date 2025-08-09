'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Message, ThreadMetadata } from '@/lib/types';
import type { Config } from '@langchain/langgraph-sdk';
import { makeClient, getThreadHistory, getThreadState } from '@/src/langgraphClient';
import { interruptRun } from '@/src/langgraphClient';

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
  currentRunId?: string | null;
  pausedCheckpoint?: any | null;
  pendingToolCallIds: Set<string>;
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
  pauseCurrentRun: () => Promise<void>;
  isLoading: boolean;
  editAndForkMessage: (messageIndex: number, newContent: string) => Promise<void>;
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
      seenToolResults: new Set<string>(),
      pendingToolCallIds: new Set<string>()
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
  // Persist chats to localStorage (lightweight) so sidebar survives refresh
  const persistChats = useCallback((nextChats: ChatSession[]) => {
    try {
      const minimal = nextChats.map(c => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        isLoading: false,
        threadId: c.thread?.thread_id || null,
        assistantId: c.assistant?.assistant_id || null,
        metadata: c.metadata,
      }));
      localStorage.setItem('lg_chats_v1', JSON.stringify(minimal));
    } catch {}
  }, []);

  // On mount, hydrate chats list from localStorage
  // We don’t restore messages here; we restore per chat selection via history
  // to avoid loading all threads upfront
  useEffect(() => {
    try {
      const raw = localStorage.getItem('lg_chats_v1');
      if (raw) {
        const minimal = JSON.parse(raw) as Array<any>;
        const restored: ChatSession[] = minimal.map((m) => ({
          id: m.id,
          title: m.title || 'New Chat',
          messages: [],
          assistant: m.assistantId ? { assistant_id: m.assistantId } : null,
          thread: m.threadId ? { thread_id: m.threadId } : null,
          metadata: m.metadata || {},
          createdAt: m.createdAt || Date.now(),
          isLoading: false,
          error: null,
          toolCallMessageIndex: null,
          streamingMessageIndex: null,
          toolsCompleted: false,
          seenToolResults: new Set<string>(),
          pendingToolCallIds: new Set<string>()
        }));
        if (restored.length > 0) {
          setChats(restored);
          setActiveChatId(restored[0].id);
        }
      }
    } catch {}
  }, []);

  // Persist anytime chats change (IDs/titles/threads)
  useEffect(() => {
    persistChats(chats);
  }, [chats, persistChats]);

  // Helper to restore messages for a chat by fetching thread history
  const restoreChatMessages = useCallback(async (chat: ChatSession) => {
    if (!chat.thread?.thread_id) return chat;
    try {
      const client = clientRef.current;
      const latest = await getThreadState(client, chat.thread.thread_id);
      // Extract just the latest messages from thread state
      const values = (latest as any)?.values;
      const messages = values && (Array.isArray(values) ? values : values.messages);
      const restoredMessages: Message[] = Array.isArray(messages)
        ? messages.filter((m: any) => m && (m.type === 'human' || m.type === 'ai' || m.type === 'tool'))
        : [];
      return { ...chat, messages: restoredMessages } as ChatSession;
    } catch (e) {
      console.warn('Failed to restore history for chat', chat.id, e);
      return chat;
    }
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
    const targetChatId = activeChatId;
    
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
      chat.id === targetChatId 
        ? { 
            ...chat, 
            isLoading: true, 
            error: null,
            toolCallMessageIndex: null,
            streamingMessageIndex: null,
            toolsCompleted: false,
            seenToolResults: new Set<string>(),
            // clear paused checkpoint if any; we'll consume it on this send
            pausedCheckpoint: null
          }
        : chat
    ));
    
    try {
      let currentChat = chats.find(c => c.id === targetChatId);
      const resumeCheckpoint = currentChat?.pausedCheckpoint;
      
      // Initialize assistant and thread if not exists
      if (!currentChat?.assistant || !currentChat?.thread) {
        console.log('Initializing assistant and thread for chat:', targetChatId);
        
        const assistant = await client.assistants.create({
          graphId,
          config: config || { configurable: {} },
          ifExists: "raise"
        });
        
        const thread = await client.threads.create();
        
        setChats(prev => prev.map(chat => 
          chat.id === targetChatId 
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
      onMetadataEvent?.(targetChatId, metadata);
      
      // Start streaming
      abortControllerRef.current = new AbortController();
      
      const stream = client.runs.stream(
        currentChat.thread.thread_id,
        currentChat.assistant.assistant_id,
        {
          input: { messages: [message] },
          streamMode: ["messages", "updates"],
          config,
          ...(resumeCheckpoint ? { checkpoint: resumeCheckpoint } : {})
        }
      );
      
      for await (const part of stream) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }
        
        console.log('Stream event:', part.event, part.data);
        
        if (part.event === 'metadata' && part.data) {
          const updatedMetadata = { ...metadata, run_id: part.data.run_id };
          onMetadataEvent?.(targetChatId, updatedMetadata);
          setChats(prev => prev.map(chat =>
            chat.id === targetChatId ? { ...chat, currentRunId: part.data.run_id } : chat
          ));
        }
        
        if ((part.event === 'messages' || part.event === 'messages/partial' || part.event === 'messages/complete') && Array.isArray(part.data)) {
          for (const streamMessage of part.data) {
            if (streamMessage.type === 'ai' || streamMessage.type === 'tool') {
              setChats(prev => prev.map(chat => {
                if (chat.id !== targetChatId) return chat;
                
                const updatedMessages = [...chat.messages];
                const incomingId = (streamMessage as any).id as string | undefined;
                
                if (incomingId) {
                  const existingByIdIndex = updatedMessages.findIndex((m: any) => (m as any).id === incomingId);
                  if (existingByIdIndex >= 0) {
                    const existingMsg = updatedMessages[existingByIdIndex] as any;
                    const incomingHasTools = (streamMessage as any).tool_calls && (streamMessage as any).tool_calls.length > 0;
                    const existingHasTools = existingMsg && existingMsg.type === 'ai' && existingMsg.tool_calls && existingMsg.tool_calls.length > 0;
                    // Do not overwrite an AI tool-call message with a final AI message without tool_calls.
                    // Keep the original AI tool-call message so ToolCallCards remain visible.
                    if (existingHasTools && !incomingHasTools && (streamMessage as any).type === 'ai') {
                      // Insert the final AI message after tool results instead of replacing tool-call message
                      let insertIndex = updatedMessages.length;
                      for (let i = updatedMessages.length - 1; i >= 0; i--) {
                        const msg = updatedMessages[i] as any;
                        if (msg.type === 'ai' && !msg.tool_calls) {
                          insertIndex = i;
                        } else if (msg.type === 'ai' && msg.tool_calls) {
                          break;
                        }
                      }
                      updatedMessages.splice(insertIndex, 0, streamMessage);
                      // Adjust streaming index if needed
                      if (chat.streamingMessageIndex !== null && chat.streamingMessageIndex >= insertIndex) {
                        chat.streamingMessageIndex += 1;
                      }
                      return { ...chat, messages: updatedMessages };
                    } else {
                      updatedMessages[existingByIdIndex] = streamMessage;
                      return { ...chat, messages: updatedMessages };
                    }
                  }
                }

                if (streamMessage.type === 'ai') {
                  if (streamMessage.tool_calls && streamMessage.tool_calls.length > 0) {
                    // Track pending tool_call ids for pause guard
                    const nextPending = new Set(chat.pendingToolCallIds);
                    for (const tc of streamMessage.tool_calls) {
                      if (tc?.id) nextPending.add(tc.id);
                    }
                    // Record or update tool call message index
                    if (chat.toolCallMessageIndex === null) {
                      updatedMessages.push(streamMessage);
                      chat.toolCallMessageIndex = updatedMessages.length - 1;
                    } else {
                      updatedMessages[chat.toolCallMessageIndex] = streamMessage;
                    }
                    return { ...chat, messages: updatedMessages, pendingToolCallIds: nextPending };
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
                  // Remove from pending tool ids
                  if (streamMessage.tool_call_id && chat.pendingToolCallIds.has(streamMessage.tool_call_id)) {
                    const nextPending = new Set(chat.pendingToolCallIds);
                    nextPending.delete(streamMessage.tool_call_id);
                    return { ...chat, messages: updatedMessages, pendingToolCallIds: nextPending };
                  }
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
        chat.id === targetChatId 
          ? { ...chat, isLoading: false, currentRunId: null }
          : chat
      ));
      abortControllerRef.current = null;
    }
  }, [activeChatId, chats, apiUrl, graphId, config, onMetadataEvent, onError]);

  // When active chat changes, attempt to lazily restore its messages from server
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = chats.find(c => c.id === activeChatId);
      if (current && current.messages.length === 0 && current.thread?.thread_id) {
        const restored = await restoreChatMessages(current);
        if (!cancelled) {
          setChats(prev => prev.map(c => c.id === restored.id ? restored : c));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeChatId, chats, restoreChatMessages]);
  
  const stopCurrentStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (activeChatId) {
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId 
          ? { ...chat, isLoading: false, currentRunId: null }
          : chat
      ));
    }
  }, [activeChatId]);

  const pauseCurrentRun = useCallback(async () => {
    const client = clientRef.current;
    const chat = chats.find(c => c.id === activeChatId);
    if (!chat || !chat.thread?.thread_id || !chat.currentRunId) return;
    // Guard: do not allow pause while tool calls are pending
    if (chat.pendingToolCallIds && chat.pendingToolCallIds.size > 0) {
      console.warn('Pause blocked: tool call in progress');
      return;
    }

    // Interrupt run and capture latest checkpoint from thread state
    try {
      await interruptRun(client, chat.thread.thread_id, chat.currentRunId);
      const latest = await getThreadState(client, chat.thread.thread_id);
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, pausedCheckpoint: (latest as any)?.checkpoint, isLoading: false, currentRunId: null } : c));
      // Abort any active stream loop
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    } catch (e) {
      console.warn('Failed to pause run', e);
    }
  }, [activeChatId, chats]);

  // Edit a prior human message and fork from that point in the SAME thread
  const editAndForkMessage = useCallback(async (messageIndex: number, newContent: string) => {
    if (!activeChatId) return;
    const targetChatId = activeChatId;
    const client = clientRef.current;

    let currentChat = chats.find(c => c.id === targetChatId);
    if (!currentChat) return;

    // Ensure assistant/thread exist
    if (!currentChat.assistant || !currentChat.thread) {
      const assistant = await client.assistants.create({ graphId, config: config || { configurable: {} }, ifExists: 'raise' });
      const thread = await client.threads.create();
      setChats(prev => prev.map(chat => chat.id === targetChatId ? { ...chat, assistant, thread, metadata: { thread_id: thread.thread_id } } : chat));
      currentChat = { ...(currentChat as ChatSession), assistant, thread } as ChatSession;
    }

    if (!currentChat.assistant || !currentChat.thread) return;

    // Build base history up to BEFORE the edited message; drop tool messages
    const baseMessages: Message[] = currentChat.messages.slice(0, messageIndex).filter((m) => m.type !== 'tool');
    const editedMessage: Message = { type: 'human', content: newContent };

    // Abort any active stream loop
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Update UI immediately to reflect the forked history + edited msg
    setChats(prev => prev.map(chat => chat.id === targetChatId ? {
      ...chat,
      messages: [...baseMessages, editedMessage],
      isLoading: true,
      error: null,
      toolCallMessageIndex: null,
      streamingMessageIndex: null,
      toolsCompleted: false,
      seenToolResults: new Set<string>(),
      pendingToolCallIds: new Set<string>(),
      currentRunId: null,
      pausedCheckpoint: null,
    } : chat));

    // Emit metadata baseline
    const metadata: ThreadMetadata = { thread_id: currentChat.thread.thread_id, run_id: undefined };
    onMetadataEvent?.(targetChatId, metadata);

    // Start stream: reset messages to base via command.update, then append edited via input
    abortControllerRef.current = new AbortController();
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const extra: any = { command: { update: { values: { messages: baseMessages } } } };
      const stream = client.runs.stream(
        currentChat.thread.thread_id,
        currentChat.assistant.assistant_id,
        {
          input: { messages: [editedMessage] },
          streamMode: ['messages', 'updates'],
          config,
          ...extra,
        }
      );

      for await (const part of stream) {
        if (abortControllerRef.current?.signal.aborted) break;

        if (part.event === 'metadata' && part.data) {
          const updatedMetadata = { ...metadata, run_id: part.data.run_id };
          onMetadataEvent?.(targetChatId, updatedMetadata);
          setChats(prev => prev.map(chat => chat.id === targetChatId ? { ...chat, currentRunId: part.data.run_id } : chat));
        }

        if ((part.event === 'messages' || part.event === 'messages/partial' || part.event === 'messages/complete') && Array.isArray(part.data)) {
          for (const streamMessage of part.data) {
            if (streamMessage.type === 'ai' || streamMessage.type === 'tool') {
              setChats(prev => prev.map(chat => {
                if (chat.id !== targetChatId) return chat;
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
                  if ((streamMessage as any).tool_calls && (streamMessage as any).tool_calls.length > 0) {
                    const nextPending = new Set(chat.pendingToolCallIds);
                    for (const tc of (streamMessage as any).tool_calls) { if (tc?.id) nextPending.add(tc.id); }
                    if (chat.toolCallMessageIndex === null) {
                      updatedMessages.push(streamMessage);
                      chat.toolCallMessageIndex = updatedMessages.length - 1;
                    } else {
                      updatedMessages[chat.toolCallMessageIndex] = streamMessage;
                    }
                    return { ...chat, messages: updatedMessages, pendingToolCallIds: nextPending };
                  } else {
                    if (chat.toolCallMessageIndex !== null && !chat.toolsCompleted) return chat;
                    if (chat.streamingMessageIndex !== null) {
                      updatedMessages[chat.streamingMessageIndex] = streamMessage;
                    } else {
                      updatedMessages.push(streamMessage);
                      chat.streamingMessageIndex = updatedMessages.length - 1;
                    }
                  }
                } else if (streamMessage.type === 'tool') {
                  const existingToolIndex = updatedMessages.findIndex(m => m.type === 'tool' && m.tool_call_id === (streamMessage as any).tool_call_id && (m as any).name === (streamMessage as any).name);
                  if (existingToolIndex >= 0) {
                    updatedMessages[existingToolIndex] = streamMessage;
                  } else {
                    let insertIndex = updatedMessages.length;
                    for (let i = updatedMessages.length - 1; i >= 0; i--) {
                      const ai = updatedMessages[i] as any;
                      if (updatedMessages[i].type === 'ai' && !ai.tool_calls) {
                        insertIndex = i;
                      } else if (updatedMessages[i].type === 'ai' && ai.tool_calls) {
                        break;
                      }
                    }
                    updatedMessages.splice(insertIndex, 0, streamMessage);
                    if (chat.streamingMessageIndex !== null && chat.streamingMessageIndex >= insertIndex) {
                      chat.streamingMessageIndex += 1;
                    }
                  }
                  chat.toolsCompleted = true;
                  if ((streamMessage as any).tool_call_id && chat.pendingToolCallIds.has((streamMessage as any).tool_call_id)) {
                    const nextPending = new Set(chat.pendingToolCallIds);
                    nextPending.delete((streamMessage as any).tool_call_id);
                    return { ...chat, messages: updatedMessages, pendingToolCallIds: nextPending };
                  }
                }
                return { ...chat, messages: updatedMessages };
              }));
            }
          }
        }
      }
    } catch (e) {
      const error = e instanceof Error ? e : new Error('Edit-and-fork failed');
      setChats(prev => prev.map(chat => chat.id === targetChatId ? { ...chat, error } : chat));
      onError?.(targetChatId, error as Error);
    } finally {
      setChats(prev => prev.map(chat => chat.id === targetChatId ? { ...chat, isLoading: false, currentRunId: null } : chat));
      abortControllerRef.current = null;
    }
  }, [activeChatId, chats, graphId, config, onMetadataEvent, onError]);
  
  return {
    chats,
    activeChat,
    activeChatId,
    createNewChat,
    switchToChat,
    deleteChat,
    sendMessage,
    stopCurrentStream,
    pauseCurrentRun,
    editAndForkMessage,
    isLoading: activeChat?.isLoading || false
  };
}