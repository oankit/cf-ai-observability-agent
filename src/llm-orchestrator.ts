/**
 * LLM Orchestrator - Dual-Model Strategy
 * 
 * This module orchestrates two LLMs for different purposes:
 * 1. Hermes 2 Pro Mistral 7B - Tool calling and intent classification
 * 2. Llama 3.3 70B - Conversational responses and synthesis
 */

import type { Env, Intent } from './types';
import { TOOLS, SYSTEM_PROMPT, INTENT_TO_MCP_MAP, INTENT_TO_TOOL_MAP } from './tool-definitions';

/**
 * Model IDs
 */
const HERMES_MODEL = '@hf/nousresearch/hermes-2-pro-mistral-7b';
const LLAMA_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/**
 * LLMOrchestrator handles routing between two LLMs
 */
export class LLMOrchestrator {
  constructor(private ai: Ai) {}

  /**
   * Classify user intent using Hermes 2 Pro with function calling
   * 
   * This model is specifically fine-tuned for tool selection
   * and will return which MCP server to call
   * 
   * @param query - User's question
   * @returns Intent classification with tool selection
   */
  async classifyIntent(query: string): Promise<Intent> {
    try {
      console.log(`[LLMOrchestrator] Classifying intent: "${query}"`);

      // Use Hermes 2 Pro with function calling to determine the right tool
      const response = await this.ai.run(HERMES_MODEL, {
        messages: [
          {
            role: 'system',
            content: 'You are an intent classifier for a Cloudflare observability agent. Determine which tool to call based on the user query.'
          },
          {
            role: 'user',
            content: query
          }
        ],
        tools: TOOLS
      });

      // Extract tool call from response
      if (response && response.tool_calls && response.tool_calls.length > 0) {
        const toolCall = response.tool_calls[0];
        const toolName = toolCall.name;

        console.log(`[LLMOrchestrator] Selected tool: ${toolName}`);

        // Map tool to intent type and MCP
        const intent: Intent = {
          type: this.mapToolToIntentType(toolName),
          confidence: 0.9, // High confidence when tool is explicitly selected
          targetMCP: this.mapToolToMCP(toolName),
          parameters: toolCall.arguments || {}
        };

        return intent;
      }

      // Fallback to general intent if no tool was selected
      console.log('[LLMOrchestrator] No tool selected, using general intent');
      return {
        type: 'general',
        confidence: 0.5,
        targetMCP: null,
        parameters: {}
      };
    } catch (error) {
      console.error('[LLMOrchestrator] Intent classification error:', error);
      
      // Fallback intent on error
      return {
        type: 'general',
        confidence: 0.3,
        targetMCP: null,
        parameters: {}
      };
    }
  }

  /**
   * Synthesize final response using Llama 3.3
   * 
   * This model excels at conversational responses and can
   * synthesize MCP data into helpful, actionable answers
   * 
   * @param query - Original user query
   * @param mcpData - Data returned from MCP server(s)
   * @param context - Additional context (conversation history, etc.)
   * @returns Synthesized response
   */
  async synthesize(
    query: string,
    mcpData: any,
    context?: string
  ): Promise<string> {
    try {
      console.log('[LLMOrchestrator] Synthesizing response with Llama 3.3');

      const messages = [
        {
          role: 'system' as const,
          content: SYSTEM_PROMPT
        }
      ];

      // Add context if provided
      if (context) {
        messages.push({
          role: 'system' as const,
          content: `Previous context: ${context}`
        });
      }

      // Add MCP data as system message
      if (mcpData) {
        messages.push({
          role: 'system' as const,
          content: `MCP Server Response:\n${JSON.stringify(mcpData, null, 2)}`
        });
      }

      // Add user query
      messages.push({
        role: 'user' as const,
        content: query
      });

      // Call Llama 3.3
      const response = await this.ai.run(LLAMA_MODEL, {
        messages,
        max_tokens: 1024,
        temperature: 0.7
      });

      if (response && response.response) {
        console.log('[LLMOrchestrator] Synthesis complete');
        return response.response;
      }

      // Fallback response
      console.warn('[LLMOrchestrator] Unexpected response format from Llama');
      return this.createFallbackResponse(query, mcpData);
    } catch (error) {
      console.error('[LLMOrchestrator] Synthesis error:', error);
      return this.createFallbackResponse(query, mcpData);
    }
  }

  /**
   * Generate a simple conversational response without MCP data
   * Used for general queries that don't require MCP lookups
   * 
   * @param query - User's question
   * @returns Response
   */
  async generateResponse(query: string): Promise<string> {
    try {
      const response = await this.ai.run(LLAMA_MODEL, {
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: query
          }
        ],
        max_tokens: 512,
        temperature: 0.8
      });

      if (response && response.response) {
        return response.response;
      }

      return 'I understand your question, but I need more specific information to help. Could you provide more details?';
    } catch (error) {
      console.error('[LLMOrchestrator] Response generation error:', error);
      return 'I apologize, but I encountered an error processing your request. Please try rephrasing your question.';
    }
  }

  /**
   * Map tool name to intent type
   */
  private mapToolToIntentType(toolName: string): Intent['type'] {
    const map: Record<string, Intent['type']> = {
      'query_observability': 'error_logs',
      'search_docs': 'how_to',
      'query_bindings': 'list_resources'
    };
    return map[toolName] || 'general';
  }

  /**
   * Map tool name to MCP server
   */
  private mapToolToMCP(toolName: string): Intent['targetMCP'] {
    const map: Record<string, Intent['targetMCP']> = {
      'query_observability': 'observability',
      'search_docs': 'documentation',
      'query_bindings': 'bindings'
    };
    return map[toolName] || null;
  }

  /**
   * Create a fallback response when synthesis fails
   */
  private createFallbackResponse(query: string, mcpData: any): string {
    if (mcpData) {
      return `I found some information related to your query, but I'm having trouble formatting it. Here's the raw data:\n\n${JSON.stringify(mcpData, null, 2)}`;
    }
    return 'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.';
  }
}

