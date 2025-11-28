import type { Agent, KnowledgeBase } from "@shared/schema";

export interface PromptAssemblyOptions {
  includeKnowledge?: boolean;
  includeExamples?: boolean;
  includePersonality?: boolean;
  maxKbEntries?: number;
  maxKbTokens?: number;
}

export interface AssembledPrompt {
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  metadata: {
    kbEntriesUsed: number;
    examplesUsed: number;
    componentsIncluded: string[];
  };
}

/**
 * Assembles a comprehensive prompt from agent configuration and knowledge base
 * Used by both playground and runtime agents for consistent behavior
 */
export async function assemblePrompt(
  agent: Agent,
  knowledgeEntries: KnowledgeBase[],
  options: PromptAssemblyOptions = {}
): Promise<AssembledPrompt> {
  const {
    includeKnowledge = true,
    includeExamples = true,
    includePersonality = true,
    maxKbEntries = 20,
    maxKbTokens = 2000,
  } = options;

  const componentsIncluded: string[] = [];
  const messages: Array<{ role: string; content: string }> = [];

  // Build comprehensive system prompt
  let systemPrompt = "";

  // 1. Core system prompt (if available)
  if (agent.systemPrompt) {
    systemPrompt += agent.systemPrompt + "\n\n";
    componentsIncluded.push("systemPrompt");
  }

  // 2. Personality prompt (if available and enabled)
  if (includePersonality && agent.personalityPrompt) {
    systemPrompt += "## Personality\n" + agent.personalityPrompt + "\n\n";
    componentsIncluded.push("personality");
  }

  // 3. Character configuration (topics, style, adjectives)
  if (includePersonality) {
    const characterConfig: string[] = [];

    // Handle topics (stored as text, may be comma-separated)
    if (agent.topics && agent.topics.trim().length > 0) {
      characterConfig.push(`**Topics**: ${agent.topics}`);
    }

    if (agent.postStyle && agent.postStyle.trim().length > 0) {
      characterConfig.push(`**Style**: ${agent.postStyle}`);
    }

    // Handle adjectives (stored as text, may be comma-separated)
    if (agent.adjectives && agent.adjectives.trim().length > 0) {
      characterConfig.push(`**Tone**: ${agent.adjectives}`);
    }

    if (characterConfig.length > 0) {
      systemPrompt += "## Character Guidelines\n" + characterConfig.join("\n") + "\n\n";
      componentsIncluded.push("characterGuidelines");
    }
  }

  // 4. Knowledge base entries (active, approved, prioritized)
  let kbEntriesUsed = 0;
  if (includeKnowledge && knowledgeEntries.length > 0) {
    // Filter: only active and approved entries
    const activeKb = knowledgeEntries
      .filter(kb => kb.active && kb.status === "approved")
      .sort((a, b) => {
        // Sort by priority (desc), then by freshness (desc)
        if (b.priority !== a.priority) return b.priority - a.priority;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, maxKbEntries);

    if (activeKb.length > 0) {
      systemPrompt += "## Knowledge Base\n";
      systemPrompt += "Use the following information when relevant:\n\n";

      let tokenCount = 0;
      for (const kb of activeKb) {
        // Rough token estimation: ~4 chars per token
        const estimatedTokens = (kb.title.length + kb.content.length) / 4;

        if (tokenCount + estimatedTokens > maxKbTokens) {
          break; // Stop adding if we exceed token limit
        }

        systemPrompt += `### ${kb.title}\n${kb.content}\n\n`;
        tokenCount += estimatedTokens;
        kbEntriesUsed++;
      }

      componentsIncluded.push("knowledgeBase");
    }
  }

  // 5. Message examples (if available and enabled)
  let examplesUsed = 0;
  if (includeExamples && agent.messageExamples && agent.messageExamples.length > 0) {
    // Add message examples as assistant messages to demonstrate tone/style
    for (const example of agent.messageExamples.slice(0, 3)) {
      // Limit to 3 examples
      if (typeof example === "string") {
        messages.push({
          role: "assistant",
          content: example,
        });
        examplesUsed++;
      } else if (example && typeof example === "object" && "content" in example) {
        messages.push({
          role: "assistant",
          content: String(example.content),
        });
        examplesUsed++;
      }
    }

    if (examplesUsed > 0) {
      componentsIncluded.push("messageExamples");
    }
  }

  // Add fallback if no system prompt was built
  if (!systemPrompt.trim()) {
    systemPrompt = `You are ${agent.name || "an AI assistant"}, a helpful and knowledgeable agent.`;
  }

  return {
    systemPrompt: systemPrompt.trim(),
    messages,
    metadata: {
      kbEntriesUsed,
      examplesUsed,
      componentsIncluded,
    },
  };
}

/**
 * Helper to build messages array for LLM API calls
 */
export function buildMessagesArray(
  assembledPrompt: AssembledPrompt,
  conversationHistory: Array<{ role: string; content: string }> = [],
  currentMessage?: string
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  // Add system prompt
  messages.push({
    role: "system",
    content: assembledPrompt.systemPrompt,
  });

  // Add example messages (if any)
  messages.push(...assembledPrompt.messages);

  // Add conversation history
  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory);
  }

  // Add current message
  if (currentMessage) {
    messages.push({
      role: "user",
      content: currentMessage,
    });
  }

  return messages;
}
