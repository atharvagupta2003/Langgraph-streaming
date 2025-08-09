'use client';

import { ToolEvent } from "@/lib/types";
import clsx from "clsx";
import { useState } from "react";

interface ToolCallCardProps extends ToolEvent {}

export default function ToolCallCard({ 
  kind, 
  name, 
  node, 
  args, 
  result, 
  when 
}: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatJson = (data: any) => {
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  };

  return (
    <div className={clsx(
      "border rounded-lg shadow-sm mb-3 overflow-hidden",
      kind === "call" ? "border-blue-200 bg-blue-50" : "border-green-200 bg-green-50"
    )}>
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={clsx(
              "w-2 h-2 rounded-full",
              kind === "call" ? "bg-blue-500" : "bg-green-500"
            )} />
            <span className="font-medium text-gray-900">
              {name || (kind === "call" ? "Tool Call" : "Tool Result")}
            </span>
            {node && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                {node}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {formatTimestamp(when)}
            </span>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-4 py-3">
          {kind === "call" && args && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Arguments:</h4>
              <pre className="text-xs bg-white rounded p-2 border overflow-x-auto max-w-full">
                <code>{formatJson(args)}</code>
              </pre>
            </div>
          )}
          
          {kind === "result" && result !== undefined && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Result:</h4>
              <pre className="text-xs bg-white rounded p-2 border overflow-x-auto max-w-full">
                <code>{formatJson(result)}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}