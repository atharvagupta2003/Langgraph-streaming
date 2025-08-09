import { Message } from "@/lib/types";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ToolCallCard from "./ToolCallCard";
import clsx from "clsx";

interface MessageBubbleProps {
  message: Message;
  streaming?: boolean;
  // Optional map of tool results by tool_call_id for combined rendering
  toolResultsById?: Record<string, Message | undefined>;
  onEdit?: (index: number, content: string) => void;
  index?: number;
}

export default function MessageBubble({ message, streaming, toolResultsById, onEdit, index }: MessageBubbleProps) {
  const { type, content, tool_calls, name, tool_call_id } = message;
  const contentHasText = typeof content === 'string' && content.trim().length > 0;
  const hasToolCalls = Array.isArray(tool_calls) && tool_calls.length > 0;
  const shouldShowMainBubble =
    type === 'human' || (type === 'ai' && (contentHasText || !hasToolCalls));
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(typeof content === 'string' ? content : '');
  const normalizedContent = typeof content === 'string'
    ? content.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
    : '';
  
  // Render tool result as a dedicated ToolCallCard
  if (type === "tool") {
    return (
      <div className="flex w-full mb-4 justify-start">
        <div className="max-w-[80%] mr-auto">
          <ToolCallCard
            kind="result"
            name={name}
            result={content}
            toolCallId={tool_call_id}
            when={Date.now()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(
      "flex w-full mb-4 gap-2",
      type === "human" ? "justify-end" : "justify-start"
    )}>
      {/* Avatar */}
      {type !== 'human' && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-sm select-none">
          🤖
        </div>
      )}
      <div className={clsx(
        "max-w-[82%] sm:max-w-[78%] md:max-w-[70%]",
        type === "human" ? "ml-auto" : "mr-auto"
      )}>
        {/* Main message bubble */}
        {shouldShowMainBubble && (
          <div className={clsx(
            "px-4 py-3 rounded-2xl leading-relaxed transition-all duration-300",
            type === "human" 
              ? "bg-gradient-to-br from-blue-600/90 to-blue-500/90 text-white shadow-md ring-1 ring-white/10 hover:shadow-lg" 
              : "bg-white/40 backdrop-blur-xl border border-white/40 text-gray-900 shadow-md hover:bg-white/50 ring-1 ring-white/20 hover:shadow-lg"
          )}>
            {isEditing && type === 'human' ? (
              <div className="space-y-2">
                <textarea
                  className="w-full p-2 rounded-lg bg-white/80 text-gray-900 border border-white/70 focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <button
                    className="px-3 py-1 rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-300"
                    onClick={() => {
                      setIsEditing(false);
                      setDraft(typeof content === 'string' ? content : '');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => {
                      if (onEdit && typeof index === 'number') {
                        onEdit(index, draft.trim());
                        setIsEditing(false);
                      }
                    }}
                  >
                    Save & Fork
                  </button>
                </div>
              </div>
            ) : (
              <div className="break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  components={{
                    a: (props: any) => <a {...props} className={clsx('underline text-blue-600 hover:text-blue-700')} target="_blank" rel="noreferrer" />,
                    p: (props: any) => <p {...props} className="my-1 leading-relaxed" />,
                    ul: (props: any) => <ul {...props} className="list-disc pl-5 my-1" />,
                    ol: (props: any) => <ol {...props} className="list-decimal pl-5 my-1" />,
                    li: (props: any) => <li {...props} className="my-0" />,
                  }}
                >
                  {normalizedContent}
                </ReactMarkdown>
              </div>
            )}
            
            {streaming && type === "ai" && (
              <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse" />
            )}
          </div>
        )}
        
        {/* Display tool calls as combined cards with results below the message */}
        {tool_calls && tool_calls.length > 0 && (
          <div className="mt-2 space-y-2">
            {tool_calls.map((toolCall, index) => {
              const resultMsg = toolResultsById?.[toolCall.id];
              return (
                <ToolCallCard
                  key={toolCall.id || index}
                  kind="combined"
                  name={toolCall.name}
                  args={toolCall.args}
                  result={resultMsg?.content}
                  toolCallId={toolCall.id}
                  when={Date.now()}
                  loading={!resultMsg}
                />
              );
            })}
          </div>
        )}
      </div>
      {/* Right-side avatar for human */}
      {type === 'human' && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center shadow-sm select-none">
          🙋
        </div>
      )}
      {type === 'human' && !isEditing && typeof onEdit === 'function' && (
        <div className="ml-2 self-center">
          <button
            className="text-xs px-2 py-1 rounded-md bg-white/70 border border-white/60 text-gray-800 hover:bg-white"
            onClick={() => setIsEditing(true)}
            title="Edit and fork from here"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}