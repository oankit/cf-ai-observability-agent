/**
 * Cloudflare AI Observability Agent
 *
 * An intelligent observability and troubleshooting agent that uses:
 * - Workers AI (Llama 3.3 + Hermes 2 Pro) for LLM capabilities
 * - Durable Objects for stateful conversation management
 * - Vectorize for semantic memory and intelligent caching
 * - MCP servers for Observability, Documentation, and Bindings
 *
 * @license MIT
 */

import { Env } from "./types";
import { ObservabilityAgent } from "./agent";
import { WELCOME_MESSAGE } from "./examples";

// Export the Durable Object class
export { ObservabilityAgent };

/**
 * Main Worker export
 */
export default {
  /**
   * Main request handler for the Worker
   */
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Enable CORS for all API requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Serve static assets (frontend)
    if (path === "/" || (!path.startsWith("/api/") && !path.startsWith("/agent/"))) {
      return env.ASSETS.fetch(request);
    }

    // API Routes
    try {
      // GET /api/welcome - Get welcome message
      if (path === "/api/welcome" && request.method === "GET") {
        return new Response(JSON.stringify({
          message: WELCOME_MESSAGE,
          timestamp: Date.now()
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // POST /api/chat - Chat endpoint (routes to Durable Object)
      if (path === "/api/chat" && request.method === "POST") {
        const { message, sessionId } = await request.json() as {
          message: string;
          sessionId?: string;
        };

        if (!message) {
          return new Response(JSON.stringify({ error: 'Message is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get or create Durable Object for this session
        const id = sessionId
          ? env.OBSERVABILITY_AGENT.idFromName(sessionId)
          : env.OBSERVABILITY_AGENT.newUniqueId();
        const stub = env.OBSERVABILITY_AGENT.get(id);

        // Forward request to Durable Object
        const agentResponse = await stub.fetch(new Request('http://agent/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        }));

        const data = await agentResponse.json();

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // GET /api/history - Get conversation history
      if (path === "/api/history" && request.method === "GET") {
        const sessionId = url.searchParams.get('sessionId');
        
        if (!sessionId) {
          return new Response(JSON.stringify({ error: 'sessionId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const id = env.OBSERVABILITY_AGENT.idFromName(sessionId);
        const stub = env.OBSERVABILITY_AGENT.get(id);

        const response = await stub.fetch(new Request('http://agent/history', {
          method: 'GET'
        }));

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // POST /api/clear - Clear conversation history
      if (path === "/api/clear" && request.method === "POST") {
        const { sessionId } = await request.json() as { sessionId: string };

        if (!sessionId) {
          return new Response(JSON.stringify({ error: 'sessionId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const id = env.OBSERVABILITY_AGENT.idFromName(sessionId);
        const stub = env.OBSERVABILITY_AGENT.get(id);

        await stub.fetch(new Request('http://agent/clear', {
          method: 'POST'
        }));

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // GET /api/stats - Get agent statistics
      if (path === "/api/stats" && request.method === "GET") {
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) {
          return new Response(JSON.stringify({ error: 'sessionId is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const id = env.OBSERVABILITY_AGENT.idFromName(sessionId);
        const stub = env.OBSERVABILITY_AGENT.get(id);

        const response = await stub.fetch(new Request('http://agent/stats', {
          method: 'GET'
        }));

        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // GET /api/health - Health check
      if (path === "/api/health" && request.method === "GET") {
        return new Response(JSON.stringify({
          status: 'healthy',
          timestamp: Date.now(),
          version: '1.0.0'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle 404 for unmatched API routes
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      console.error("Error processing request:", error);
      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  },
} satisfies ExportedHandler<Env>;
