/**
 * Type definitions for the AI Observability Agent.
 */

import type { AgentNamespace } from 'agents';

/**
 * Environment bindings for the Worker
 */
export interface Env {
  /**
   * Workers AI binding for LLM inference
   */
  AI: Ai;

  /**
   * Static assets binding
   */
  ASSETS: { fetch: (request: Request) => Promise<Response> };

  /**
   * Vectorize binding for semantic memory
   */
  VECTORIZE: VectorizeIndex;

  /**
   * Durable Object binding for the ObservabilityAgent
   */
  OBSERVABILITY_AGENT: AgentNamespace<any>;
}

/**
 * Chat message structure
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: number;
}

/**
 * Agent state stored in Durable Object
 */
export interface AgentState {
  sessionId: string;
  conversationHistory: ChatMessage[];
  mcpConnections: {
    observability: boolean;
    documentation: boolean;
    bindings: boolean;
  };
  lastActivity: number;
  metadata: {
    totalQueries: number;
    cacheHits: number;
    mcpCalls: {
      observability: number;
      documentation: number;
      bindings: number;
    };
  };
}

/**
 * Intent classification result
 */
export interface Intent {
  type: 'error_logs' | 'performance' | 'how_to' | 'api_reference' | 'list_resources' | 'inspect_config' | 'general';
  confidence: number;
  targetMCP: 'observability' | 'documentation' | 'bindings' | null;
  parameters?: Record<string, any>;
}

/**
 * Tool definition for function calling
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * MCP query result
 */
export interface MCPResult {
  source: 'observability' | 'documentation' | 'bindings';
  data: any;
  timestamp: number;
  cached: boolean;
}

/**
 * Semantic memory search result
 */
export interface MemorySearchResult {
  score: number;
  question: string;
  answer: string;
  mcpSource: string;
  timestamp: number;
}

/**
 * WebSocket message types
 */
export interface WSMessage {
  type: 'query' | 'response' | 'mcp_call' | 'cache_hit' | 'error' | 'status';
  content?: string;
  data?: any;
  timestamp: number;
}

/**
 * Example query for testing
 */
export interface ExampleQuery {
  query: string;
  expectedMCP: 'observability' | 'documentation' | 'bindings';
  expectedTool: string;
  description?: string;
}
