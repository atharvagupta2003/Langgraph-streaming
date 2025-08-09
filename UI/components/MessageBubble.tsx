import { Message } from "@/lib/types";
import ToolCallCard from "./ToolCallCard";
import clsx from "clsx";

interface MessageBubbleProps {
  message: Message;
  streaming?: boolean;
  // Optional map of tool results by tool_call_id for combined rendering
  toolResultsById?: Record<string, Message | undefined>;
}

export default function MessageBubble({ message, streaming, toolResultsById }: MessageBubbleProps) {
  const { type, content, tool_calls, name, tool_call_id } = message;
  const contentHasText = typeof content === 'string' && content.trim().length > 0;
  const hasToolCalls = Array.isArray(tool_calls) && tool_calls.length > 0;
  const shouldShowMainBubble =
    type === 'human' || (type === 'ai' && (contentHasText || !hasToolCalls));
  
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
            <div className="whitespace-pre-wrap break-words">
              {content}
            </div>
            
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
    </div>
  );
}