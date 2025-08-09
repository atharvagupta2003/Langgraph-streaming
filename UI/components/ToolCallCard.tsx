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
  const [activeTab, setActiveTab] = useState<'args' | 'result'>(result !== undefined ? 'result' : 'args');
  const [copied, setCopied] = useState<null | 'args' | 'result'>(null);

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatJson = (data: any) => {
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  };

  const effectiveKind: "call" | "result" | "combined" = kind || (args !== undefined && result !== undefined ? "combined" : (result !== undefined ? "result" : "call"));
  const status: 'running' | 'completed' | 'pending' = result !== undefined ? 'completed' : (loading ? 'running' : 'pending');

  return (
    <div className={clsx(
      "group relative rounded-xl shadow-md mb-3 overflow-hidden border bg-blue-100/25 backdrop-blur-xl ring-1 ring-white/20",
      status === 'completed' ? "border-green-200" : status === 'running' ? "border-blue-200" : "border-gray-200"
    )}>
      {/* Accent bar */}
      <div className={clsx(
        "absolute left-0 top-0 h-full w-1",
        status === 'completed' ? "bg-gradient-to-b from-green-400 to-green-600" : status === 'running' ? "bg-gradient-to-b from-blue-400 to-blue-600" : "bg-gradient-to-b from-gray-300 to-gray-400"
      )} />
      <div className="pl-3 pr-4 sm:pl-4 sm:pr-6 py-3 border-b border-white/40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Icon */}
            <div className={clsx("flex items-center justify-center w-7 h-7 rounded-full text-white ring-1",
              status === 'completed' ? "bg-green-500 ring-white/30" : status === 'running' ? "bg-blue-500 ring-white/30" : "bg-gray-400 ring-white/20")}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3l3 3m-7.4 7.4l-3-3m9.9-6.9a2.121 2.121 0 10-3-3l-8.49 8.49a2 2 0 00-.57 1.11l-.3 2.4a1 1 0 001.13 1.13l2.4-.3a2 2 0 001.11-.57L18.3 8.7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium text-gray-900 truncate">{name || 'Tool'}</span>
                {toolCallId && (
                  <span className="px-2 py-0.5 text-[10px] sm:text-xs bg-gray-100 text-gray-600 rounded-full border border-gray-200">{toolCallId.slice(-6)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={clsx("text-[10px] sm:text-xs px-2 py-0.5 rounded-full border",
                  status === 'completed' ? "bg-green-50 text-green-700 border-green-200" : status === 'running' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-700 border-gray-200")}
                >
                  {status === 'completed' ? 'Completed' : status === 'running' ? 'Running' : 'Pending'}
                </span>
                {when && <span className="text-[10px] sm:text-xs text-gray-500">{formatTimestamp(when)}</span>}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <span>{isExpanded ? 'Hide' : 'Details'}</span>
            <svg className={clsx("w-3 h-3 transition-transform", isExpanded ? "rotate-180" : "rotate-0")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-3 sm:px-4 py-3">
          {/* Tabs */}
          <div className="flex items-center gap-2 mb-3">
            {args !== undefined && (
              <button
                onClick={() => setActiveTab('args')}
                className={clsx("text-xs px-3 py-1.5 rounded-full border", activeTab === 'args' ? "bg-white text-gray-900 border-gray-300" : "bg-white/70 text-gray-600 border-white/60 hover:bg-white")}
              >
                Arguments
              </button>
            )}
            {result !== undefined && (
              <button
                onClick={() => setActiveTab('result')}
                className={clsx("text-xs px-3 py-1.5 rounded-full border", activeTab === 'result' ? "bg-white text-gray-900 border-gray-300" : "bg-white/70 text-gray-600 border-white/60 hover:bg-white")}
              >
                Result
              </button>
            )}
          </div>
          {/* Panels */}
          {activeTab === 'args' && args !== undefined && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Arguments</h4>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(formatJson(args));
                      setCopied('args');
                      setTimeout(() => setCopied(null), 1200);
                    } catch {}
                  }}
                  className="text-xs px-2 py-1 rounded bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200"
                >
                  {copied === 'args' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="max-h-60 overflow-auto no-scrollbar bg-white rounded border" data-lenis-prevent>
                <pre className="text-xs p-2 min-w-0">
                  <code className="break-words whitespace-pre-wrap">{formatJson(args)}</code>
                </pre>
              </div>
            </div>
          )}
          {activeTab === 'result' && result !== undefined && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Result</h4>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(formatJson(result));
                      setCopied('result');
                      setTimeout(() => setCopied(null), 1200);
                    } catch {}
                  }}
                  className="text-xs px-2 py-1 rounded bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200"
                >
                  {copied === 'result' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="max-h-60 overflow-auto no-scrollbar bg-white rounded border" data-lenis-prevent>
                <pre className="text-xs p-2 min-w-0">
                  <code className="break-words whitespace-pre-wrap">{formatJson(result)}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}