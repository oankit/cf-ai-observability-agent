/**
 * Example Queries for Testing
 * 
 * These queries demonstrate the agent's capabilities across
 * all three MCP servers (Observability, Documentation, Bindings)
 */

import type { ExampleQuery } from './types';

/**
 * 10 comprehensive example queries covering all MCP integrations
 */
export const EXAMPLE_QUERIES: ExampleQuery[] = [
  // Observability MCP Examples
  {
    query: "Show me error logs from the last hour",
    expectedMCP: "observability",
    expectedTool: "query_observability",
    description: "Query recent error logs to identify issues"
  },
  {
    query: "Why is my worker responding slowly? Check performance metrics",
    expectedMCP: "observability",
    expectedTool: "query_observability",
    description: "Analyze performance data to identify bottlenecks"
  },
  {
    query: "How many 5xx errors did I get in the last 24 hours?",
    expectedMCP: "observability",
    expectedTool: "query_observability",
    description: "Query specific error status codes over time"
  },

  // Documentation MCP Examples
  {
    query: "How do I set up a KV namespace?",
    expectedMCP: "documentation",
    expectedTool: "search_docs",
    description: "Search documentation for setup instructions"
  },
  {
    query: "What's the difference between KV and Durable Objects?",
    expectedMCP: "documentation",
    expectedTool: "search_docs",
    description: "Compare different storage options"
  },
  {
    query: "Show me examples of using Workers AI for text generation",
    expectedMCP: "documentation",
    expectedTool: "search_docs",
    description: "Find code examples in documentation"
  },

  // Bindings MCP Examples
  {
    query: "List all my R2 buckets",
    expectedMCP: "bindings",
    expectedTool: "query_bindings",
    description: "Query available R2 storage resources"
  },
  {
    query: "What KV namespaces do I have configured?",
    expectedMCP: "bindings",
    expectedTool: "query_bindings",
    description: "List KV namespace bindings"
  },
  {
    query: "Show me my Durable Objects configuration",
    expectedMCP: "bindings",
    expectedTool: "query_bindings",
    description: "Inspect Durable Objects setup"
  },

  // Complex Multi-Step Query
  {
    query: "My worker is failing with 500 errors. Help me debug this - check logs and suggest what docs I should read",
    expectedMCP: "observability",
    expectedTool: "query_observability",
    description: "Multi-step troubleshooting requiring Observability first, then Documentation"
  }
];

/**
 * Test function to run all example queries
 * Useful for validating the agent's behavior
 */
export async function runExampleQueries(agentStub: any): Promise<void> {
  console.log('===== Running Example Queries =====\n');

  for (let i = 0; i < EXAMPLE_QUERIES.length; i++) {
    const example = EXAMPLE_QUERIES[i];
    console.log(`\n--- Example ${i + 1}/${EXAMPLE_QUERIES.length} ---`);
    console.log(`Query: ${example.query}`);
    console.log(`Expected MCP: ${example.expectedMCP}`);
    console.log(`Description: ${example.description}`);

    try {
      const response = await agentStub.fetch(new Request('http://agent/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: example.query })
      }));

      const data = await response.json();
      console.log(`Response: ${data.response.substring(0, 200)}...`);
      console.log(`Stats: ${JSON.stringify(data.stats)}`);
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  }

  console.log('\n===== Example Queries Complete =====');
}

/**
 * Welcome message with example queries for users
 */
export const WELCOME_MESSAGE = `Welcome to the Cloudflare AI Observability Agent! 🚀

I can help you debug and troubleshoot your Cloudflare Workers applications using natural language.

**What I can do:**
📊 Query logs, traces, and metrics from your Workers
📚 Search Cloudflare documentation and examples
🔍 Inspect your Workers resources (KV, R2, D1, Durable Objects)
🧠 Remember past conversations for faster answers

**Try these example questions:**

**Observability:**
• "Show me error logs from the last hour"
• "Why is my worker responding slowly?"
• "How many 5xx errors did I get today?"

**Documentation:**
• "How do I set up a KV namespace?"
• "What's the difference between KV and Durable Objects?"
• "Show me Workers AI examples"

**Resources:**
• "List all my R2 buckets"
• "What KV namespaces do I have?"
• "Show me my Durable Objects configuration"

Ask me anything about your Cloudflare Workers! 💬`;

