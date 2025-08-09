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
      "flex w-full mb-4",
      type === "human" ? "justify-end" : "justify-start"
    )}>
      <div className={clsx(
        "max-w-[80%]",
        type === "human" ? "ml-auto" : "mr-auto"
      )}>
        {/* Main message bubble */}
        {shouldShowMainBubble && (
          <div className={clsx(
            "px-4 py-3 rounded-2xl shadow-sm leading-relaxed",
            type === "human" 
              ? "bg-blue-500 text-white" 
              : "bg-gray-100 text-gray-900"
          )}>
            <div className="whitespace-pre-wrap">
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
    </div>
  );
}