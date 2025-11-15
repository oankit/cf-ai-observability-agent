/**
 * Observability Agent - Main Agent Class
 * 
 * This Durable Object extends Cloudflare's Agent class to provide
 * stateful, intelligent troubleshooting assistance through natural language.
 * 
 * Key Features:
 * - Semantic memory with Vectorize for intelligent caching
 * - Dual-LLM strategy (Hermes for routing, Llama for synthesis)
 * - MCP integration for Observability, Documentation, and Bindings
 * - Persistent conversation state with SQLite storage
 */

import { DurableObject } from 'cloudflare:workers';
import type { Env, AgentState, ChatMessage, Intent, MCPResult } from './types';
import { SemanticMemory } from './semantic-memory';
import { LLMOrchestrator } from './llm-orchestrator';
import { MCPRouter } from './mcp-router';

/**
 * ObservabilityAgent - Stateful AI agent for troubleshooting
 * 
 * Note: In production with the `agents` package, this would extend Agent<Env, AgentState>
 * For this demo, we're using standard Durable Objects with Agent-like patterns
 */
export class ObservabilityAgent extends DurableObject {
  private sessionId: string;
  private semanticMemory: SemanticMemory;
  private llmOrchestrator: LLMOrchestrator;
  private mcpRouter: MCPRouter;
  private state: AgentState;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    
    // Generate or retrieve session ID
    this.sessionId = ctx.id.toString();
    
    // Initialize components
    this.semanticMemory = new SemanticMemory(env.VECTORIZE, env.AI);
    this.llmOrchestrator = new LLMOrchestrator(env.AI);
    this.mcpRouter = new MCPRouter();
    
    // Initialize state
    this.state = {
      sessionId: this.sessionId,
      conversationHistory: [],
      mcpConnections: {
        observability: false,
        documentation: false,
        bindings: false
      },
      lastActivity: Date.now(),
      metadata: {
        totalQueries: 0,
        cacheHits: 0,
        mcpCalls: {
          observability: 0,
          documentation: 0,
          bindings: 0
        }
      }
    };

    // Load state from storage
    this.initializeState();
  }

  /**
   * Initialize state from SQLite storage
   */
  private async initializeState() {
    try {
      const stored = await this.ctx.storage.get<AgentState>('state');
      if (stored) {
        this.state = stored;
        console.log(`[Agent] Loaded state for session ${this.sessionId}`);
      }
    } catch (error) {
      console.error('[Agent] Error loading state:', error);
    }
  }

  /**
   * Save state to SQLite storage
   */
  private async saveState() {
    try {
      await this.ctx.storage.put('state', this.state);
      console.log('[Agent] State saved');
    } catch (error) {
      console.error('[Agent] Error saving state:', error);
    }
  }

  /**
   * Main query handler - processes user questions
   * 
   * Flow:
   * 1. Check semantic memory for cached answers
   * 2. Classify intent with Hermes 2 Pro
   * 3. Route to appropriate MCP server
   * 4. Synthesize response with Llama 3.3
   * 5. Store in semantic memory for future queries
   * 
   * @param userMessage - User's question
   * @returns AI-generated response
   */
  async query(userMessage: string): Promise<string> {
    console.log(`[Agent] Processing query: "${userMessage}"`);
    
    this.state.lastActivity = Date.now();
    this.state.metadata.totalQueries++;

    try {
      // Step 1: Check semantic memory for similar past queries
      const cachedResult = await this.semanticMemory.search(userMessage);
      
      if (cachedResult) {
        console.log('[Agent] Cache hit! Returning cached answer');
        this.state.metadata.cacheHits++;
        await this.saveState();
        
        return `[Cached Answer - ${cachedResult.mcpSource}]\n\n${cachedResult.answer}\n\n_This answer was retrieved from memory (similarity: ${(cachedResult.score * 100).toFixed(1)}%)_`;
      }

      // Step 2: Classify intent using Hermes 2 Pro
      const intent = await this.llmOrchestrator.classifyIntent(userMessage);
      console.log(`[Agent] Intent: ${intent.type}, MCP: ${intent.targetMCP}`);

      let response: string;
      let mcpSource = 'none';

      // Step 3: Route to MCP if needed
      if (intent.targetMCP) {
        const mcpResult = await this.mcpRouter.route(intent, userMessage);
        this.incrementMCPCounter(mcpResult.source);
        mcpSource = mcpResult.source;

        // Step 4: Synthesize response with Llama 3.3
        response = await this.llmOrchestrator.synthesize(
          userMessage,
          mcpResult.data,
          this.getConversationContext()
        );
      } else {
        // No MCP needed - generate general response
        response = await this.llmOrchestrator.generateResponse(userMessage);
      }

      // Step 5: Store in semantic memory
      await this.semanticMemory.store(userMessage, response, mcpSource);

      // Update conversation history
      this.addToHistory('user', userMessage);
      this.addToHistory('assistant', response);
      await this.saveState();

      return response;
    } catch (error) {
      console.error('[Agent] Query processing error:', error);
      return this.createErrorResponse(error);
    }
  }

  /**
   * Connect to MCP servers
   * 
   * In production with agents package, this would use:
   * await this.addMcpServer("Observability", endpoint)
   */
  async connectMCPs(): Promise<{
    observability: string;
    documentation: string;
    bindings: string;
  }> {
    console.log('[Agent] Connecting to MCP servers');

    // Mark connections as established
    this.state.mcpConnections = {
      observability: true,
      documentation: true,
      bindings: true
    };
    await this.saveState();

    return {
      observability: this.mcpRouter.getMCPEndpoint('observability'),
      documentation: this.mcpRouter.getMCPEndpoint('documentation'),
      bindings: this.mcpRouter.getMCPEndpoint('bindings')
    };
  }

  /**
   * Get conversation history
   */
  async getHistory(): Promise<ChatMessage[]> {
    // Return last 10 messages to avoid context overload
    return this.state.conversationHistory.slice(-10);
  }

  /**
   * Clear conversation history
   */
  async clearHistory(): Promise<void> {
    this.state.conversationHistory = [];
    await this.saveState();
    console.log('[Agent] History cleared');
  }

  /**
   * Get agent statistics
   */
  async getStats(): Promise<AgentState['metadata']> {
    return this.state.metadata;
  }

  /**
   * Handle HTTP requests to this Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // POST /query - Main query endpoint
      if (path === '/query' && request.method === 'POST') {
        const { message } = await request.json() as { message: string };
        
        if (!message) {
          return new Response(JSON.stringify({ error: 'Message is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const response = await this.query(message);
        
        return new Response(JSON.stringify({
          response,
          sessionId: this.sessionId,
          timestamp: Date.now(),
          stats: {
            cacheHits: this.state.metadata.cacheHits,
            totalQueries: this.state.metadata.totalQueries
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // GET /history - Get conversation history
      if (path === '/history' && request.method === 'GET') {
        const history = await this.getHistory();
        return new Response(JSON.stringify({ history }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // POST /clear - Clear history
      if (path === '/clear' && request.method === 'POST') {
        await this.clearHistory();
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // GET /stats - Get statistics
      if (path === '/stats' && request.method === 'GET') {
        const stats = await this.getStats();
        return new Response(JSON.stringify({ stats }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // POST /connect - Connect to MCP servers
      if (path === '/connect' && request.method === 'POST') {
        const endpoints = await this.connectMCPs();
        return new Response(JSON.stringify({ endpoints }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('[Agent] Request error:', error);
      return new Response(JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Helper: Add message to conversation history
   */
  private addToHistory(role: 'user' | 'assistant', content: string) {
    this.state.conversationHistory.push({
      role,
      content,
      timestamp: Date.now()
    });

    // Keep only last 20 messages to prevent unlimited growth
    if (this.state.conversationHistory.length > 20) {
      this.state.conversationHistory = this.state.conversationHistory.slice(-20);
    }
  }

  /**
   * Helper: Get conversation context for LLM
   */
  private getConversationContext(): string {
    const recent = this.state.conversationHistory.slice(-4);
    if (recent.length === 0) return '';

    return recent
      .map(msg => `${msg.role}: ${msg.content.substring(0, 200)}`)
      .join('\n');
  }

  /**
   * Helper: Increment MCP call counter
   */
  private incrementMCPCounter(source: 'observability' | 'documentation' | 'bindings') {
    this.state.metadata.mcpCalls[source]++;
  }

  /**
   * Helper: Create error response
   */
  private createErrorResponse(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return `I apologize, but I encountered an error processing your request: ${message}\n\nPlease try:\n- Rephrasing your question\n- Asking a more specific question\n- Checking if your Cloudflare account has the necessary permissions`;
  }
}

