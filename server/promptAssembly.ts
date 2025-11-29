import type { Agent, KnowledgeBase, BibleVerseUsage, ContentTypeUsage } from "@shared/schema";

export interface PromptAssemblyOptions {
  includeKnowledge?: boolean;
  includeExamples?: boolean;
  includePersonality?: boolean;
  maxKbEntries?: number;
  maxKbTokens?: number;
  recentVerses?: BibleVerseUsage[]; // Recently used Bible verses to avoid
  recentContentTypes?: ContentTypeUsage[]; // Recently used content types to avoid
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
    recentContentTypes = [],
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
      systemPrompt += "## Knowledge Base (USE WHEN RELEVANT)\n";
      systemPrompt += "The following is current, real-world information. Use it for Event-based or Cultural/Tech posts. For Verse Reflections, Encouragement, Wisdom Bites, or Eternity Anchors, you may write from your own knowledge without referencing these entries:\n\n";

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
    } else {
      // Fallback when no KB entries available
      systemPrompt += "## Knowledge Base Status\n";
      systemPrompt += "No current Knowledge Base entries are available. For this post:\n";
      systemPrompt += "- AVOID Event-based or Cultural/Tech content types (they require current news/data)\n";
      systemPrompt += "- PREFER: Verse Reflection, Wisdom Bite, Encouragement, Deep Question, or Eternity Anchor\n";
      systemPrompt += "- Draw from timeless Scripture and spiritual wisdom instead of current events\n\n";
      componentsIncluded.push("kbFallback");
    }
  }

  // 5. Bible Verse Avoidance Instructions (if verse tracking is enabled)
  const verseTrackingEnabled = (agent as any).verseTrackingEnabled !== false; // Default true
  const verseReusePolicy = (agent as any).verseReusePolicy || "avoid_recent";
  
  systemPrompt += "## Bible Verse Usage Guidelines\n";
  
  if (verseTrackingEnabled && verseReusePolicy !== "allow" && recentVerses.length > 0) {
    const verseList = recentVerses.map(v => v.verseRef).join(", ");
    
    systemPrompt += "When including Scripture references, please AVOID these recently used verses:\n";
    systemPrompt += `${verseList}\n\n`;
    
    if (recentVerses.length >= 20) {
      // Many verses used - provide flexibility guidance
      systemPrompt += "NOTE: Many verses have been used recently. If you cannot find an unused verse that fits your content:\n";
      systemPrompt += "- You MAY use a less common translation or paraphrase of a verse\n";
      systemPrompt += "- You MAY reference a verse thematically without direct quotation\n";
      systemPrompt += "- Prioritize content quality over strict avoidance if needed\n\n";
    } else {
      systemPrompt += "Choose different, fresh Scripture passages to provide variety for your audience.\n\n";
    }
    
    componentsIncluded.push("verseAvoidance");
  } else {
    systemPrompt += "Feel free to use any Scripture that fits your content. Include book, chapter, and verse references.\n\n";
  }

  // 5b. Content Type Selection Instructions (if content type tracking is enabled)
  const contentTypeTrackingEnabled = (agent as any).contentTypeTrackingEnabled !== false; // Default true
  const contentTypeReusePolicy = (agent as any).contentTypeReusePolicy || "rotate_all";
  
  const allContentTypes = [
    "EVENT_BASED", "VERSE_REFLECTION", "DEEP_QUESTION", 
    "WISDOM_BITE", "CULTURAL_INSIGHT", "ENCOURAGEMENT", "ETERNITY_ANCHOR"
  ];
  
  systemPrompt += "## Content Type Selection Guidelines\n";
  systemPrompt += "Available content types: Event-based, Verse Reflection, Deep Question, Wisdom Bite, Cultural Insight, Encouragement, Eternity Anchor\n\n";
  
  if (contentTypeTrackingEnabled && contentTypeReusePolicy !== "allow" && recentContentTypes.length > 0) {
    const recentTypeNames = recentContentTypes.slice(0, 3).map(ct => ct.contentType);
    const unusedTypes = allContentTypes.filter(t => !recentTypeNames.includes(t));
    
    if (contentTypeReusePolicy === "rotate_all") {
      if (unusedTypes.length > 0) {
        // Format unused types for readability
        const formattedUnused = unusedTypes.map(t => t.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())).join(", ");
        systemPrompt += `SELECT FROM: ${formattedUnused}\n`;
        systemPrompt += `These content types have NOT been used recently - pick one of these.\n\n`;
      } else {
        // All types recently used - reset cycle
        systemPrompt += `All 7 content types have been used in the rotation cycle.\n`;
        systemPrompt += `You may now select ANY content type - the cycle will reset.\n\n`;
      }
      
      const formattedRecent = recentTypeNames.map(t => t.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())).join(", ");
      systemPrompt += `RECENTLY USED (lower priority): ${formattedRecent}\n\n`;
    } else if (contentTypeReusePolicy === "avoid_last") {
      const lastType = recentTypeNames[0]?.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      systemPrompt += `SKIP: "${lastType}" was just used.\n`;
      systemPrompt += `Select any OTHER content type for this post.\n\n`;
    }
    
    componentsIncluded.push("contentTypeGuidance");
  } else {
    systemPrompt += "Choose any content type that fits your inspiration for this post.\n\n";
  }

  // 6. Message examples (if available and enabled)
  let examplesUsed = 0;
  const examplesWithTypes: { content: string; contentType?: string }[] = [];
  
  if (includeExamples && agent.messageExamples && agent.messageExamples.length > 0) {
    // Add explicit instruction about following examples format
    systemPrompt += "## Message Examples (FOLLOW THIS FORMAT EXACTLY)\n";
    systemPrompt += "The following are examples of EXACTLY how your posts should be structured. You MUST follow this format precisely - same structure, same sections, same style. Do not add hashtags unless shown in examples:\n\n";
    
    // Add examples to system prompt (support up to 10 for multiple content types)
    // If example has contentType metadata, include it as a label
    for (const example of agent.messageExamples.slice(0, 10)) {
      let content: string | null = null;
      let contentType: string | undefined = undefined;
      
      if (typeof example === "string") {
        content = example;
      } else if (example && typeof example === "object" && "content" in example) {
        content = String((example as any).content);
        contentType = (example as any).contentType;
      }
      
      if (content) {
        // Format content type label if metadata exists (human-readable)
        const typeLabel = contentType 
          ? contentType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
          : null;
        
        if (typeLabel) {
          systemPrompt += `### ${typeLabel} Example:\n---\n${content}\n---\n\n`;
        } else {
          systemPrompt += `---\n${content}\n---\n\n`;
        }
        
        examplesUsed++;
        examplesWithTypes.push({ content, contentType });
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
