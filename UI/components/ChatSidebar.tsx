'use client';

import { useState } from "react";
import clsx from "clsx";

interface ChatSession {
  id: string;
  title: string;
  messages: any[];
  createdAt: number;
  isLoading: boolean;
}

interface ChatSidebarProps {
  chats: ChatSession[];
  activeChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function ChatSidebar({
  chats,
  activeChatId,
  onChatSelect,
  onNewChat,
  onDeleteChat,
  isCollapsed = false,
  onToggleCollapse
}: ChatSidebarProps) {
  const [hoveredChat, setHoveredChat] = useState<string | null>(null);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 7 * 24) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className={clsx(
      "bg-gray-50 border-r border-gray-200 flex flex-col transition-all duration-300",
      isCollapsed ? "w-16" : "w-80"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!isCollapsed && (
          <h2 className="text-lg font-semibold text-gray-900">Chats</h2>
        )}
        <div className="flex gap-2">
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              )}
            </button>
          )}
          <button
            onClick={onNewChat}
            className="p-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors"
            title="New chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {isCollapsed ? (
              <div className="text-xs">No chats</div>
            ) : (
              <div>
                <p>No chats yet</p>
                <p className="text-sm mt-1">Create a new chat to get started</p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-2">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={clsx(
                  "relative group p-3 rounded-lg cursor-pointer transition-all mb-2",
                  activeChatId === chat.id
                    ? "bg-blue-100 border border-blue-200"
                    : "hover:bg-gray-100 border border-transparent",
                  isCollapsed && "p-2"
                )}
                onClick={() => onChatSelect(chat.id)}
                onMouseEnter={() => setHoveredChat(chat.id)}
                onMouseLeave={() => setHoveredChat(null)}
              >
                <div className="flex items-start justify-between">
                  <div className={clsx("flex-1 min-w-0", isCollapsed && "hidden")}>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate">
                        {chat.title}
                      </h3>
                      {chat.isLoading && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-500">
                        {chat.messages.length} messages
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatTime(chat.createdAt)}
                      </p>
                    </div>
                  </div>

                  {isCollapsed && (
                    <div className="flex flex-col items-center">
                      <div className={clsx(
                        "w-3 h-3 rounded-full mb-1",
                        activeChatId === chat.id ? "bg-blue-500" : "bg-gray-400"
                      )}></div>
                      {chat.isLoading && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                  )}

                  {/* Delete button */}
                  {!isCollapsed && (hoveredChat === chat.id || activeChatId === chat.id) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                      className="ml-2 p-1 text-gray-400 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete chat"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Tooltip for collapsed mode */}
                {isCollapsed && hoveredChat === chat.id && (
                  <div className="absolute left-full ml-2 top-0 z-10 bg-black text-white text-sm px-2 py-1 rounded whitespace-nowrap">
                    {chat.title}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer info */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200 text-xs text-gray-500">
          <p>Each chat maintains its own conversation context</p>
        </div>
      )}
    </div>
  );
}