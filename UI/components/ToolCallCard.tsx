'use client';

import { useState } from "react";
import clsx from "clsx";

interface ToolCallCardProps {
  kind?: "call" | "result" | "combined";
  name?: string;
  args?: any;
  result?: any;
  toolCallId?: string;
  when?: number;
  loading?: boolean;
}

export default function ToolCallCard({ 
  kind, 
  name, 
  args, 
  result, 
  toolCallId,
  when,
  loading = false
}: ToolCallCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatJson = (data: any) => {
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  };

  const effectiveKind: "call" | "result" | "combined" = kind || (args !== undefined && result !== undefined ? "combined" : (result !== undefined ? "result" : "call"));

  return (
    <div className={clsx(
      "border rounded-lg shadow-sm mb-3 overflow-hidden",
      effectiveKind === "result" ? "border-green-200 bg-green-50" : effectiveKind === "call" && !result ? "border-blue-200 bg-blue-50" : "border-indigo-200 bg-indigo-50"
    )}>
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={clsx(
              "w-2 h-2 rounded-full",
              result !== undefined ? "bg-green-500" : "bg-blue-500"
            )} />
            <span className="font-medium text-gray-900">
              {name || (effectiveKind === "result" ? "Tool Result" : effectiveKind === "call" ? "Tool Call" : "Tool Call")}
            </span>
            {toolCallId && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                {toolCallId.slice(-6)}
              </span>
            )}
            {loading && result === undefined && (
              <span className="ml-1 inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {when && (
              <span className="text-xs text-gray-500">
                {formatTimestamp(when)}
              </span>
            )}
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
          {args !== undefined && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Arguments:</h4>
              <pre className="text-xs bg-white rounded p-2 border overflow-x-auto max-w-full">
                <code>{formatJson(args)}</code>
              </pre>
            </div>
          )}
          
          {result !== undefined && (
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