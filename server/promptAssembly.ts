import type { Agent, KnowledgeBase, BibleVerseUsage } from "@shared/schema";

export interface PromptAssemblyOptions {
  includeKnowledge?: boolean;
  includeExamples?: boolean;
  includePersonality?: boolean;
  maxKbEntries?: number;
  maxKbTokens?: number;
  recentVerses?: BibleVerseUsage[]; // Recently used Bible verses to avoid
}

export interface AssembledPrompt {
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  metadata: {
    kbEntriesUsed: number;
    kbEntriesUsedIds: string[];
    examplesUsed: number;
    componentsIncluded: string[];
  };
}

/**
 * Assembles a comprehensive prompt from agent configuration and knowledge base
 * Used by both playground and runtime agents for consistent behavior
 */
// Helper function to convert priority string to number for sorting
function priorityToNumber(priority: string | null): number {
  switch (priority) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 2; // Default to medium
  }
}

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
    recentVerses = [],
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

  // 4. Knowledge base entries (active, approved, prioritized with reuse policy)
  let kbEntriesUsed = 0;
  const kbEntriesUsedIds: string[] = [];
  const reusePolicy = (agent as any).kbReusePolicy || "deprioritize";
  const reuseCooldownHours = (agent as any).kbReuseCooldownHours || 24;
  const now = new Date();
  
  if (includeKnowledge && knowledgeEntries.length > 0) {
    // Filter: only active and approved entries
    let activeKb = knowledgeEntries
      .filter(kb => kb.active && kb.status === "approved");
    
    // Apply reuse policy
    if (reusePolicy === "never") {
      // Exclude entries used within cooldown period
      activeKb = activeKb.filter(kb => {
        if (!kb.usedAt) return true; // Never used, include
        const usedTime = new Date(kb.usedAt).getTime();
        const cooldownMs = reuseCooldownHours * 60 * 60 * 1000;
        return (now.getTime() - usedTime) > cooldownMs; // Include if cooldown passed
      });
    }
    
    // Sort entries with reuse consideration
    activeKb = activeKb.sort((a, b) => {
      // If deprioritize policy, penalize recently used entries
      if (reusePolicy === "deprioritize") {
        const aUsed = a.usedAt ? 1 : 0;
        const bUsed = b.usedAt ? 1 : 0;
        if (aUsed !== bUsed) return aUsed - bUsed; // Unused entries first
        
        // If both used, prefer the one used longer ago
        if (a.usedAt && b.usedAt) {
          const aTime = new Date(a.usedAt).getTime();
          const bTime = new Date(b.usedAt).getTime();
          if (aTime !== bTime) return aTime - bTime; // Older usage first
        }
      }
      
      // Then sort by priority (desc), then by freshness (desc)
      const aPriority = priorityToNumber(a.priority);
      const bPriority = priorityToNumber(b.priority);
      if (bPriority !== aPriority) return bPriority - aPriority;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }).slice(0, maxKbEntries);

    if (activeKb.length > 0) {
      systemPrompt += "## Knowledge Base (PRIMARY SOURCE - MUST USE)\n";
      systemPrompt += "IMPORTANT: You MUST incorporate this content into your responses. This is your PRIMARY source material:\n\n";

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
        kbEntriesUsedIds.push(kb.id);
      }

      componentsIncluded.push("knowledgeBase");
    }
  }

  // 5. Bible Verse Avoidance Instructions (if verse tracking is enabled)
  const verseTrackingEnabled = (agent as any).verseTrackingEnabled !== false; // Default true
  const verseReusePolicy = (agent as any).verseReusePolicy || "avoid_recent";
  
  if (verseTrackingEnabled && verseReusePolicy !== "allow" && recentVerses.length > 0) {
    const verseList = recentVerses.map(v => v.verseRef).join(", ");
    
    systemPrompt += "## Bible Verse Usage Guidelines\n";
    systemPrompt += "IMPORTANT: When including Scripture references, please AVOID using the following verses that have been used recently:\n";
    systemPrompt += `${verseList}\n\n`;
    systemPrompt += "Choose different, fresh Scripture passages to provide variety for your audience.\n\n";
    
    componentsIncluded.push("verseAvoidance");
  }

  // 6. Message examples (if available and enabled)
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
          content: String((example as any).content),
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
      kbEntriesUsedIds,
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
