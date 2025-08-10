'use client';

import Chat from "@/components/Chat";
import type { Config } from '@langchain/langgraph-sdk';

export default function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_LANGGRAPH_URL || 'http://localhost:2024';
  const graphId = process.env.NEXT_PUBLIC_GRAPH_ID;

  // Default config that can be overridden via environment variables
  const config: Config = {
    configurable: {
      model_name: process.env.NEXT_PUBLIC_MODEL_NAME || "openai", // Use OpenAI by default
      code_suggestions_model: process.env.NEXT_PUBLIC_CODE_SUGGESTIONS_MODEL || "gpt-4o",
      code_summary_model: process.env.NEXT_PUBLIC_CODE_SUMMARY_MODEL || "gpt-4o",
      localization_model: process.env.NEXT_PUBLIC_LOCALIZATION_MODEL || "gpt-4o",
      pull_request_review_model: process.env.NEXT_PUBLIC_PULL_REQUEST_REVIEW_MODEL || "gpt-4o",
      test_framework: process.env.NEXT_PUBLIC_TEST_FRAMEWORK || "jest",
    }
  };

  if (!graphId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Configuration Required</h1>
          <p className="text-gray-600 mb-2">Please set the following environment variables:</p>
          <div className="bg-gray-100 p-4 rounded-lg text-left font-mono text-sm">
            <div>NEXT_PUBLIC_LANGGRAPH_URL={apiUrl}</div>
            <div className="text-red-600">NEXT_PUBLIC_GRAPH_ID=&lt;YOUR_GRAPH_ID&gt;</div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Optional: Set model configurations like NEXT_PUBLIC_CODE_SUGGESTIONS_MODEL
          </p>
        </div>
      </div>
    );
  }

  return (
    <Chat apiUrl={apiUrl} graphId={graphId} config={config} />
  );
}