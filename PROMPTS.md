# AI Prompts Used During Development

## Initial System Prompt

```
You are an expert software architect and DevOps engineer. I am building an AI-powered 
observability and troubleshooting agent for distributed web applications, using 
Cloudflare's platform. The project leverages Cloudflare Workers, Durable Objects, 
Vectorize, and integrates the following Cloudflare-managed MCP servers:

- Observability Server (https://observability.mcp.cloudflare.com/mcp) 
  for access to logs, traces, and analytics
- Workers Bindings Server (https://bindings.mcp.cloudflare.com/mcp) 
  for storage and compute integration
- Logpush Server (https://logs.mcp.cloudflare.com/mcp) 
  for monitoring log export jobs and pipeline health
- AI Gateway Server (https://ai-gateway.mcp.cloudflare.com/mcp) 
  for logging and tracing LLM prompt/response data
- Radar Server (https://radar.mcp.cloudflare.com/mcp) 
  for global Internet traffic insights and security enrichment
- Cloudflare Documentation Server (https://docs.mcp.cloudflare.com/mcp) 
  for up-to-date API and platform reference

The agent should allow users to interact via chat, ask about logs, traces, system 
and app performance, and get actionable summaries, analytics, or remediation 
suggestions using these MCPs.

Design and provide:
- An architecture that connects to, and orchestrates calls with, the above MCP 
  servers through Cloudflare Workers
- Modular backend logic to route user queries to the correct MCP (log search, 
  anomaly detection, summarization, RAG, documentation lookup)
- Semantic memory using Workers KV/Vectorize and MCP for storing and retrieving 
  troubleshooting sessions
- A UI (Pages/React) for chat-based user interaction, surfacing outputs from 
  all MCPs as rich responses
- Code snippets for interconnecting the agent, MCP servers, and chat interface
- Best practices for multi-MCP orchestration, reliability, and security on 
  Cloudflare

Responses should be modular, with code, diagrams, and clear rationale for each 
design choice. 
```

---

## Research Phase: Key Questions

### Challenging Assumptions
```
do I even need the mcp?
```

### Exploring Constraints
```
can I add mock data to my cloudflare environment and use mcps?
```

```
can we add the data from the dashboard?
```

### Breakthrough Simplification
```
we don't need open telemetry data then, we can just run prompts on our app
```

---

## Implementation Phase

### Context Setting
```
Here's the updated prompt and README that incorporates the 3 available Cloudflare MCPs:
[Attached README.md]

Before doing anything please read the github repo we are in and understand @README.md 
and explain what this app does
```

### Implementation Control
```
Implement the plan as specified. Do NOT edit the plan file itself. 
Mark to-dos as in_progress as you work, starting with the first one. 
Don't stop until you have completed all the to-dos.
```

### Testing & Validation
```
Did you test the application?

Implement a testing approach and use the cloudflare doc mcp to validate our plan 
and approach.
```

---

**Live Application:** https://cf-ai-observability-agent.omar-ankit2001.workers.dev

**Development Tools:** Comet Chat (research) + Cursor IDE with Claude Sonnet 4.5 (implementation)
