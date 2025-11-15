/**
 * CF AI Observability Agent Frontend
 *
 * Enhanced chat interface with MCP indicators, cache hit visualization,
 * and real-time statistics.
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const clearButton = document.getElementById("clear-button");
const typingIndicator = document.getElementById("typing-indicator");
const welcomeMessage = document.getElementById("welcome-message");
const exampleQueries = document.querySelectorAll(".example-query");

// Stats elements
const totalQueriesEl = document.getElementById("total-queries");
const cacheHitsEl = document.getElementById("cache-hits");
const cacheRateEl = document.getElementById("cache-rate");

// Session state
let sessionId = generateSessionId();
let isProcessing = false;
let stats = {
  totalQueries: 0,
  cacheHits: 0,
};

// Initialize
loadWelcomeMessage();

// Auto-resize textarea as user types
userInput.addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = this.scrollHeight + "px";
});

// Send message on Enter (without Shift)
userInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Event listeners
sendButton.addEventListener("click", sendMessage);
clearButton.addEventListener("click", clearConversation);

// Example query click handlers
exampleQueries.forEach((example) => {
  example.addEventListener("click", function () {
    const query = this.getAttribute("data-query");
    userInput.value = query;
    userInput.focus();
    sendMessage();
  });
});

/**
 * Load welcome message from API
 */
async function loadWelcomeMessage() {
  try {
    const response = await fetch("/api/welcome");
    const data = await response.json();
    welcomeMessage.textContent = data.message;
  } catch (error) {
    welcomeMessage.textContent =
      "Welcome to the Cloudflare AI Observability Agent! Ask me anything about your Workers.";
  }
}

/**
 * Send message to the agent
 */
async function sendMessage() {
  const message = userInput.value.trim();

  // Don't send empty messages
  if (message === "" || isProcessing) return;

  // Disable input while processing
  isProcessing = true;
  userInput.disabled = true;
  sendButton.disabled = true;

  // Add user message to chat
  addMessageToChat("user", message);

  // Clear input
  userInput.value = "";
  userInput.style.height = "auto";

  // Show typing indicator
  typingIndicator.classList.add("visible");

  try {
    // Send request to API
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        sessionId,
      }),
    });

    // Handle errors
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Update session ID if new
    if (data.sessionId) {
      sessionId = data.sessionId;
    }

    // Detect if this was a cache hit
    const isCacheHit = data.response.includes("[Cached Answer");
    const mcpSource = extractMCPSource(data.response);

    // Add assistant message
    addMessageToChat("assistant", data.response, {
      cacheHit: isCacheHit,
      mcpSource: mcpSource,
    });

    // Update stats
    if (data.stats) {
      updateStats(data.stats);
    }
  } catch (error) {
    console.error("Error:", error);
    addMessageToChat(
      "assistant",
      "Sorry, there was an error processing your request. Please try again.",
      { error: true },
    );
  } finally {
    // Hide typing indicator
    typingIndicator.classList.remove("visible");

    // Re-enable input
    isProcessing = false;
    userInput.disabled = false;
    sendButton.disabled = false;
    userInput.focus();
  }
}

/**
 * Clear conversation history
 */
async function clearConversation() {
  if (!confirm("Are you sure you want to clear the conversation?")) {
    return;
  }

  try {
    await fetch("/api/clear", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });

    // Clear chat UI
    chatMessages.innerHTML = "";

    // Reload welcome message
    const welcomeDiv = document.createElement("div");
    welcomeDiv.className = "message assistant-message";
    welcomeDiv.innerHTML = `<div class="message-content" id="welcome-message">Loading...</div>`;
    chatMessages.appendChild(welcomeDiv);
    loadWelcomeMessage();

    // Generate new session
    sessionId = generateSessionId();

    // Reset stats display
    stats = { totalQueries: 0, cacheHits: 0 };
    updateStats(stats);
  } catch (error) {
    console.error("Error clearing conversation:", error);
    alert("Failed to clear conversation. Please try again.");
  }
}

/**
 * Add message to chat with metadata
 */
function addMessageToChat(role, content, metadata = {}) {
  const messageEl = document.createElement("div");
  let classes = `message ${role}-message`;

  if (metadata.cacheHit) {
    classes += " cache-hit";
  }

  messageEl.className = classes;

  let html = "";

  // Add metadata for assistant messages
  if (role === "assistant" && (metadata.mcpSource || metadata.cacheHit)) {
    html += '<div class="message-meta">';

    if (metadata.cacheHit) {
      html += '<span>⚡ Cache Hit</span>';
    }

    if (metadata.mcpSource) {
      const mcpClass = `mcp-${metadata.mcpSource.toLowerCase()}`;
      html += `<span class="mcp-badge ${mcpClass}">${metadata.mcpSource}</span>`;
    }

    html += "</div>";
  }

  html += `<div class="message-content">${markdownToHtml(content)}</div>`;
  messageEl.innerHTML = html;

  chatMessages.appendChild(messageEl);

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Extract MCP source from response
 */
function extractMCPSource(response) {
  if (response.includes("[Cached Answer - observability]")) {
    return "observability";
  }
  if (response.includes("[Cached Answer - documentation]")) {
    return "documentation";
  }
  if (response.includes("[Cached Answer - bindings]")) {
    return "bindings";
  }

  // Try to infer from content
  if (
    response.toLowerCase().includes("log") ||
    response.toLowerCase().includes("error") ||
    response.toLowerCase().includes("metric")
  ) {
    return "observability";
  }
  if (
    response.toLowerCase().includes("documentation") ||
    response.toLowerCase().includes("how to") ||
    response.toLowerCase().includes("example")
  ) {
    return "documentation";
  }
  if (
    response.toLowerCase().includes("kv") ||
    response.toLowerCase().includes("r2") ||
    response.toLowerCase().includes("durable object")
  ) {
    return "bindings";
  }

  return null;
}

/**
 * Update statistics display
 */
function updateStats(newStats) {
  stats = newStats;

  totalQueriesEl.textContent = stats.totalQueries || 0;
  cacheHitsEl.textContent = stats.cacheHits || 0;

  const cacheRate =
    stats.totalQueries > 0
      ? Math.round((stats.cacheHits / stats.totalQueries) * 100)
      : 0;
  cacheRateEl.textContent = `${cacheRate}%`;
}

/**
 * Generate unique session ID
 */
function generateSessionId() {
  return (
    "session_" +
    Date.now() +
    "_" +
    Math.random().toString(36).substring(2, 15)
  );
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Simple markdown to HTML converter
 * Handles: bold, italic, links, code blocks, lists, line breaks
 */
function markdownToHtml(text) {
  // Escape HTML first
  let html = escapeHtml(text);
  
  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  
  // Italic: *text* or _text_
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');
  
  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  
  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Headers: ### text
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  
  // Lists: - item or * item or 1. item
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>');
  
  // Line breaks: double newline = paragraph break
  html = html.replace(/\n\n/g, '<br><br>');
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

/**
 * Load conversation history on page load
 */
async function loadHistory() {
  try {
    const response = await fetch(`/api/history?sessionId=${sessionId}`);
    if (response.ok) {
      const data = await response.json();
      if (data.history && data.history.length > 0) {
        // Clear existing messages except welcome
        const messages = chatMessages.querySelectorAll(".message");
        messages.forEach((msg, idx) => {
          if (idx > 0) msg.remove(); // Keep welcome message
        });

        // Add history messages
        data.history.forEach((msg) => {
          if (msg.role !== "system") {
            addMessageToChat(msg.role, msg.content);
          }
        });
      }
    }
  } catch (error) {
    console.log("No previous history found");
  }
}

// Load history if session exists in localStorage
const savedSessionId = localStorage.getItem("sessionId");
if (savedSessionId) {
  sessionId = savedSessionId;
  loadHistory();
}

// Save session ID
localStorage.setItem("sessionId", sessionId);
