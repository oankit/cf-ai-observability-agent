/**
 * Tool definitions for LLM function calling
 * 
 * These tools map to MCP server capabilities and enable the LLM
 * to intelligently route queries to the appropriate backend service.
 */

import type { ToolDefinition } from './types';

/**
 * System prompt for the observability agent
 */
export const SYSTEM_PROMPT = `You are an expert Cloudflare Workers observability and troubleshooting assistant.

Your role is to help developers debug distributed applications by:
1. Querying logs, traces, and metrics from Workers Observability
2. Searching Cloudflare documentation for how-to guides and API references
3. Inspecting Workers resources like KV, R2, D1, and Durable Objects

When responding:
- Be concise and actionable
- Cite specific data from MCP queries
- Suggest next steps for debugging
- Link to relevant documentation when helpful

You have access to three MCP servers:
- Observability: Real-time logs, traces, and analytics
- Documentation: Cloudflare API and platform documentation
- Bindings: Workers resource inspection and management`;

/**
 * Tool definitions for function calling with Hermes 2 Pro
 */
export const TOOLS: ToolDefinition[] = [
  {
    name: "query_observability",
    description: "Query logs, traces, metrics, and analytics from Workers Observability MCP. Use this for debugging errors, investigating performance issues, or analyzing request patterns.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The observability query (e.g., 'show error logs', 'performance metrics', 'requests by status code')"
        },
        timeRange: {
          type: "string",
          enum: ["1h", "6h", "24h", "7d"],
          description: "Time range for the query. Defaults to 1h (last hour)"
        },
        filters: {
          type: "object",
          description: "Optional filters like status codes, worker names, or error types",
          properties: {
            statusCode: { type: "string" },
            workerName: { type: "string" },
            errorType: { type: "string" }
          }
        }
      },
      required: ["query"]
    }
  },
  {
    name: "search_docs",
    description: "Search Cloudflare documentation for API references, how-to guides, and best practices. Use this when users ask 'how to' questions or need documentation links.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The documentation search query (e.g., 'how to set up KV', 'Durable Objects API', 'Workers AI models')"
        },
        product: {
          type: "string",
          enum: ["workers", "kv", "r2", "d1", "durable-objects", "vectorize", "workers-ai", "pages"],
          description: "Optional: specific Cloudflare product to search within"
        },
        includeExamples: {
          type: "boolean",
          description: "Whether to prioritize code examples in results"
        }
      },
      required: ["query"]
    }
  },
  {
    name: "query_bindings",
    description: "List and inspect Workers resources like KV namespaces, R2 buckets, D1 databases, and Durable Objects. Use this to check configurations or list available resources.",
    parameters: {
      type: "object",
      properties: {
        resourceType: {
          type: "string",
          enum: ["kv", "r2", "d1", "durable_objects", "all"],
          description: "Type of resource to query"
        },
        action: {
          type: "string",
          enum: ["list", "inspect", "stats"],
          description: "Action to perform: list resources, inspect a specific one, or get stats"
        },
        resourceName: {
          type: "string",
          description: "Optional: specific resource name to inspect"
        }
      },
      required: ["resourceType", "action"]
    }
  }
];

/**
 * Intent classification prompts
 */
export const INTENT_CLASSIFICATION_PROMPT = `Analyze this user query and classify the intent:

Query: {{QUERY}}

Classify into one of these categories:
- error_logs: User wants to see error logs or debug issues
- performance: User wants to analyze performance metrics or identify slow requests
- how_to: User asks how to do something or needs documentation
- api_reference: User needs API documentation or examples
- list_resources: User wants to list Workers resources (KV, R2, D1, etc.)
- inspect_config: User wants to inspect a specific resource configuration
- general: General conversation or unclear intent

Respond with JSON:
{
  "type": "category",
  "confidence": 0.0-1.0,
  "targetMCP": "observability|documentation|bindings|null",
  "parameters": {}
}`;

/**
 * Map intent types to MCP servers
 */
export const INTENT_TO_MCP_MAP: Record<string, string> = {
  error_logs: 'observability',
  performance: 'observability',
  how_to: 'documentation',
  api_reference: 'documentation',
  list_resources: 'bindings',
  inspect_config: 'bindings'
};

/**
 * Map intent types to tool names
 */
export const INTENT_TO_TOOL_MAP: Record<string, string> = {
  error_logs: 'query_observability',
  performance: 'query_observability',
  how_to: 'search_docs',
  api_reference: 'search_docs',
  list_resources: 'query_bindings',
  inspect_config: 'query_bindings'
};

