'use client';

import { useState, useEffect, useRef, KeyboardEvent } from "react";
import clsx from "clsx";
import { Message, ThreadMetadata } from "@/lib/types";
import MessageBubble from "./MessageBubble";
import ChatSidebar from "./ChatSidebar";
import { useMultiChat } from "@/hooks/useMultiChat";
import type { Config } from '@langchain/langgraph-sdk';

interface ChatProps {
  apiUrl: string;
  graphId: string;
  config?: Config;
}

export default function Chat({ apiUrl, graphId, config }: ChatProps) {
  const [input, setInput] = useState("");
  const [metadata, setMetadata] = useState<ThreadMetadata>({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hideHeader, setHideHeader] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const lastScrollTopRef = useRef(0);
  const chatScrollElRef = useRef<HTMLDivElement | null>(null);

  const handleMetaEvent = (chatId: string, evt: ThreadMetadata) => {
    setMetadata(evt);
  };

  const multiChat = useMultiChat({
    apiUrl,
    graphId,
    config,
    onMetadataEvent: handleMetaEvent,
    onError: (chatId, e) => console.error('Stream error for chat', chatId, ':', e),
  });

  const handleSubmit = () => {
    if (!input.trim()) return;
    
    // Create new chat if no active chat
    if (!multiChat.activeChatId) {
      multiChat.createNewChat();
    }
    
    const userMessage: Message = { type: "human", content: input.trim() };
    multiChat.sendMessage(userMessage);
    
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleStop = () => {
    multiChat.stopCurrentStream();
  };
  const handlePause = async () => {
    await multiChat.pauseCurrentRun();
  };

  const handleNewChat = () => {
    multiChat.createNewChat();
    setInput(""); // Clear input when starting new chat
  };

  const scrollToBottom = (smooth: boolean) => {
    const el = chatScrollElRef.current || document.getElementById('chat-scroll-container');
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    // Only auto-scroll if the user is already near the bottom to prevent jitter
    if (isAtBottom) {
      // Use instant scroll while streaming to avoid oscillations
      scrollToBottom(!multiChat.isLoading);
    }
  }, [multiChat.activeChat?.messages, multiChat.isLoading, isAtBottom]);

  // Removed auto-create to avoid races with hydration.

  // Auto-hide header on scroll down, show on scroll up
  useEffect(() => {
    const el = document.getElementById('chat-scroll-container');
    if (!el) return;
    chatScrollElRef.current = el as HTMLDivElement;
    const onScroll = () => {
      const current = el.scrollTop;
      const last = lastScrollTopRef.current;
      const delta = current - last;
      const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
      setIsAtBottom(distanceFromBottom < 48);
      // Show if near top
      if (current < 16) {
        setHideHeader(false);
      } else if (delta > 8) {
        // scrolling down
        setHideHeader(true);
      } else if (delta < -8) {
        // scrolling up
        setHideHeader(false);
      }
      lastScrollTopRef.current = current;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll as any);
  }, []);

  const messages = multiChat.activeChat?.messages || [];
  // Build a map of tool results by tool_call_id for combined rendering
  const toolResultsById = messages.reduce<Record<string, any>>((acc, m) => {
    if (m.type === 'tool' && m.tool_call_id) acc[m.tool_call_id] = m;
    return acc;
  }, {});
  // Hide standalone tool messages; they are shown combined under the AI tool call
  const renderMessages = messages.filter((m) => m.type !== 'tool');

  const suggestions: Array<{ label: string; prompt: string }> = [
    { label: 'Search web', prompt: 'Search top 10 startups in Brisbane and summarize each in 2 lines.' },
    { label: 'Create doc', prompt: 'Draft a project brief for a landing page with goals, scope, and timeline.' },
    { label: 'Plan meeting', prompt: 'Propose 3 times for a 30-min sync next week and a short agenda.' },
  ];

  const useSuggestion = (text: string) => {
    setInput(text);
  };

  return (
    <div className="h-screen flex">
      {/* Sidebar */}
      <ChatSidebar
        chats={multiChat.chats}
        activeChatId={multiChat.activeChatId}
        onChatSelect={multiChat.switchToChat}
        onNewChat={handleNewChat}
        onDeleteChat={multiChat.deleteChat}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Error Display */}
        {multiChat.activeChat?.error && (
          <div className="bg-red-50 border border-red-200 px-4 py-3 mx-6 mt-4 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Stream Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{multiChat.activeChat.error.message}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        {/* Hover strip to reveal header when hidden */}
        <div
          className="sticky top-0 z-30 h-2 w-full"
          onMouseEnter={() => setHideHeader(false)}
        />
        <div className="sticky top-0 z-20 px-3 sm:px-6 pt-2">
          <div
            className={
              hideHeader
                ? 'transition-all duration-300 -translate-y-1/2 opacity-60 pointer-events-none bg-transparent backdrop-blur-0 border-transparent shadow-none ring-0 rounded-2xl'
                : 'transition-all duration-300 translate-y-0 opacity-100 glass rounded-2xl px-4 sm:px-6 py-3 border-white/30'
            }
            onMouseEnter={() => setHideHeader(false)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                  {multiChat.activeChat?.title || 'LangGraph Streaming Chat'}
                </h1>
                {metadata.thread_id && (
                  <p className="text-xs sm:text-sm text-gray-600">
                    Thread: {metadata.thread_id.slice(-8)} 
                    {metadata.run_id && ` | Run: ${metadata.run_id.slice(-8)}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {multiChat.isLoading && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    Thinking
                  </span>
                )}
                {multiChat.isLoading && (
                  <button
                    onClick={handleStop}
                    className="px-3 sm:px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>
            {/* Quick suggestions */}
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => useSuggestion(s.prompt)}
                  className="text-xs sm:text-sm px-3 py-1.5 rounded-full bg-white/70 text-gray-700 hover:bg-white shadow-sm border border-white/70"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div
          className="flex-1 overflow-y-auto px-3 sm:px-6 py-4"
          id="chat-scroll-container"
          data-lenis-prevent
        >
          {messages.length === 0 ? (
            <div className="text-center text-gray-600 mt-8">
              <p>Start a conversation with your assistant!</p>
              <p className="text-sm mt-1">Try asking it to use tools or perform tasks</p>
            </div>
          ) : (
            <div className="space-y-4 w-full mx-auto max-w-[96vw] lg:max-w-[97vw] xl:max-w-[98vw] 2xl:max-w-[1600px]">
              {renderMessages.map((message, index) => {
                const anyMessage = message as any;
                const stableKey = anyMessage.id || message.tool_call_id || `${message.type}-${index}`;
                return (
                  <MessageBubble
                    key={stableKey}
                    message={message}
                    streaming={multiChat.isLoading && message.type === 'ai' && index === renderMessages.length - 1}
                    toolResultsById={toolResultsById}
                    index={index}
                    onEdit={async (idx, newText) => {
                      if (!newText) return;
                      await multiChat.editAndForkMessage(idx, newText);
                    }}
                  />
                );
              })}
            </div>
          )}
          <div ref={messagesEndRef} />
          {/* Scroll to bottom button */}
          <div className="fixed right-4 bottom-24 sm:bottom-28">
            <button
              onClick={() => scrollToBottom(true)}
              className={clsx(
                'hidden sm:inline-flex items-center gap-1 px-3 py-2 rounded-full bg-white/80 backdrop-blur border border-white/60 shadow hover:bg-white',
                isAtBottom && 'opacity-0 pointer-events-none'
              )}
              title="Scroll to bottom"
            >
              ↓
            </button>
          </div>
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-3 sm:px-6 pb-4">
          <div className="w-full mx-auto max-w-[96vw] lg:max-w-[97vw] xl:max-w-[98vw] 2xl:max-w-[1600px] sticky bottom-4">
            <div className="glass rounded-2xl p-2 border-white/30 shadow-lg">
              <div className="flex gap-2 items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                  className="flex-1 p-3 bg-white/80 border border-white/70 text-gray-900 placeholder-gray-500 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  disabled={multiChat.isLoading}
                />
                {multiChat.isLoading ? (
                  <button
                    onClick={handlePause}
                    aria-label="Pause run"
                    className="p-3 rounded-xl transition-colors flex items-center justify-center bg-blue-600 text-white hover:bg-red-600 disabled:bg-gray-400"
                    title="Pause and save state"
                    disabled={Boolean(multiChat.activeChat?.toolCallMessageIndex !== null && !multiChat.activeChat?.toolsCompleted)}
                  >
                    <span className="inline-block w-5 h-5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!input.trim()}
                    aria-label="Send message"
                    className={clsx(
                      'p-3 rounded-xl transition-colors flex items-center justify-center',
                      'text-white',
                      'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed'
                    )}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2L11 13" />
                      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}