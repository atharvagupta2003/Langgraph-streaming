import { Message } from "@/lib/types";
import clsx from "clsx";

interface MessageBubbleProps {
  role: "human" | "ai";
  content: string;
  streaming?: boolean;
}

export default function MessageBubble({ role, content, streaming }: MessageBubbleProps) {
  return (
    <div className={clsx(
      "flex w-full mb-4",
      role === "human" ? "justify-end" : "justify-start"
    )}>
      <div className={clsx(
        "max-w-[80%] px-4 py-3 rounded-2xl shadow-sm",
        "leading-relaxed whitespace-pre-wrap",
        role === "human" 
          ? "bg-blue-500 text-white ml-auto" 
          : "bg-gray-100 text-gray-900 mr-auto"
      )}>
        {content}
        {streaming && role === "ai" && (
          <span className="inline-block w-2 h-4 ml-1 bg-gray-400 animate-pulse" />
        )}
      </div>
    </div>
  );
}