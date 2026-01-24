import type { Agent, KnowledgeBase, BibleVerseUsage, ContentTypeUsage, ActivityLog } from "@shared/schema";
import type { ScrapedTweet } from "./twitterScraper";

// All 7 content types for rotation
export const ALL_CONTENT_TYPES = [
  "EVENT_BASED", "VERSE_REFLECTION", "DEEP_QUESTION",
  "WISDOM_BITE", "CULTURAL_INSIGHT", "ENCOURAGEMENT", "ETERNITY_ANCHOR"
] as const;

export type ContentType = typeof ALL_CONTENT_TYPES[number];

export interface PromptAssemblyOptions {
  includeKnowledge?: boolean;
  includeExamples?: boolean;
  includePersonality?: boolean;
  maxKbEntries?: number;
  maxKbTokens?: number;
  recentVerses?: BibleVerseUsage[]; // Recently used Bible verses to avoid
  recentContentTypes?: ContentTypeUsage[]; // Recently used content types to avoid
  selectedContentType?: ContentType; // Server-selected content type (for rotation)
  recentPosts?: ActivityLog[]; // Recent posts for anti-repetition context
  focusTopic?: string; // Specific topic to focus on
  newsContext?: ScrapedTweet[]; // Context from News Monitor
}

/**
 * Server-side content type selection based on rotation history
 * This removes the burden from the AI and ensures proper rotation
 */
export function selectNextContentType(
  recentContentTypes: ContentTypeUsage[],
  hasKnowledgeBase: boolean,
  rotationPolicy: "rotate_all" | "avoid_last" | "allow" = "rotate_all"
): ContentType {
  // If no rotation, pick randomly
  if (rotationPolicy === "allow") {
    const validTypes = hasKnowledgeBase
      ? ALL_CONTENT_TYPES
      : ALL_CONTENT_TYPES.filter(t => t !== "EVENT_BASED" && t !== "CULTURAL_INSIGHT");
    return validTypes[Math.floor(Math.random() * validTypes.length)];
  }

  const recentTypeNames = recentContentTypes.slice(0, 7).map(ct => ct.contentType);

  // Find unused types
  let unusedTypes = ALL_CONTENT_TYPES.filter(t => !recentTypeNames.includes(t));

  // If no KB, exclude types that require current events
  if (!hasKnowledgeBase) {
    unusedTypes = unusedTypes.filter(t => t !== "EVENT_BASED" && t !== "CULTURAL_INSIGHT");
  }

  if (rotationPolicy === "rotate_all") {
    if (unusedTypes.length > 0) {
      // Pick randomly from unused types
      return unusedTypes[Math.floor(Math.random() * unusedTypes.length)];
    } else {
      // All types used - reset cycle, pick randomly from all valid types
      const validTypes = hasKnowledgeBase
        ? [...ALL_CONTENT_TYPES]
        : ALL_CONTENT_TYPES.filter(t => t !== "EVENT_BASED" && t !== "CULTURAL_INSIGHT");
      return validTypes[Math.floor(Math.random() * validTypes.length)];
    }
  } else if (rotationPolicy === "avoid_last") {
    const lastType = recentTypeNames[0];
    const validTypes = hasKnowledgeBase
      ? ALL_CONTENT_TYPES.filter(t => t !== lastType)
      : ALL_CONTENT_TYPES.filter(t => t !== lastType && t !== "EVENT_BASED" && t !== "CULTURAL_INSIGHT");
    return validTypes[Math.floor(Math.random() * validTypes.length)];
  }

  // Fallback
  return "VERSE_REFLECTION";
}

/**
 * Format content type for human-readable display
 */
export function formatContentType(type: string): string {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
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
    selectedContentType,
    focusTopic,
  } = options;

  const componentsIncluded: string[] = [];
  const messages: Array<{ role: string; content: string }> = [];

  // Build comprehensive system prompt
  // CRITICAL: Examples go FIRST to ensure AI follows format before anything else
  let systemPrompt = "";

  // 1. Message examples FIRST (highest priority - must follow format exactly)
  // CRITICAL: Only include examples matching the server-selected content type
  let examplesUsed = 0;
  const examplesWithTypes: { content: string; contentType?: string }[] = [];

  if (includeExamples && agent.messageExamples && agent.messageExamples.length > 0) {
    // Parse all examples and extract content types
    const allExamples: { content: string; contentType?: string }[] = [];
    for (const example of agent.messageExamples) {
      let content: string | null = null;
      let contentType: string | undefined = undefined;

      if (typeof example === "string") {
        content = example;
      } else if (example && typeof example === "object" && "content" in example) {
        content = String((example as any).content);
        contentType = (example as any).contentType;
      }

      if (content) {
        allExamples.push({ content, contentType });
      }
    }

    // Filter examples: if selectedContentType is set, only include matching examples
    let filteredExamples = allExamples;
    if (selectedContentType) {
      const matchingExamples = allExamples.filter(ex => {
        if (!ex.contentType) return false;
        // Normalize: uppercase, replace spaces/hyphens/dashes with underscores
        const normalizedType = ex.contentType
          .toUpperCase()
          .replace(/[\s\-–—]+/g, "_") // Handle spaces, hyphens, en-dashes, em-dashes
          .replace(/[^A-Z_]/g, ""); // Remove any other non-letter/underscore chars
        return normalizedType === selectedContentType;
      });
      // Use matching examples if found, otherwise fall back to all (shouldn't happen if examples are properly tagged)
      if (matchingExamples.length > 0) {
        filteredExamples = matchingExamples;
        console.log(`[PROMPT] Filtered to ${matchingExamples.length} examples for content type: ${selectedContentType}`);
      } else {
        console.log(`[PROMPT] WARNING: No matching examples found for content type: ${selectedContentType}. Using all ${allExamples.length} examples as fallback.`);
      }
    }

    // Build the example section with clear formatting instructions
    const selectedTypeLabel = selectedContentType ? formatContentType(selectedContentType) : null;

    if (selectedContentType && filteredExamples.length > 0) {
      // Single content type mode - very focused instructions
      const typeLabel = formatContentType(selectedContentType);
      systemPrompt += `## YOUR TASK: Generate a "${typeLabel}" Post\n\n`;
      systemPrompt += `You MUST generate a post that follows this EXACT format:\n\n`;

      for (const ex of filteredExamples.slice(0, 2)) { // Max 2 examples for the selected type
        systemPrompt += `### EXAMPLE FORMAT:\n${ex.content}\n\n`;
        examplesUsed++;
        examplesWithTypes.push(ex);
      }

      systemPrompt += `### GUIDELINES FOR ${typeLabel.toUpperCase()}:\n\n`;
      systemPrompt += `**NATURAL STYLE (CRITICAL):**\n`;
      systemPrompt += `- Write like a real human on Twitter/X, not a corporate bot\n`;
      systemPrompt += `- Vary your sentence length. Mix short punchy lines with longer thoughts\n`;
      systemPrompt += `- Don't be afraid of being "messy" or using lowercase if the example does\n`;
      systemPrompt += `- Avoid "LinkedIn style" rigid paragraph spacing unless the example uses it\n\n`;
      systemPrompt += `**STRUCTURE:**\n`;
      systemPrompt += `- Follow the *vibe* and *structure* of the example, but don't copy it robotically\n`;
      systemPrompt += `- Ensure the core message lands effectively\n\n`;
      systemPrompt += `**DO NOT:**\n`;
      systemPrompt += `- Use cringey AI openers like "Let's dive in" or "In the world of..."\n`;
      systemPrompt += `- Use hashtags unless they are prevalent in the example\n`;
      systemPrompt += `- Over-polish. Real tweets have character.\n\n`;

      componentsIncluded.push("messageExamples");
      componentsIncluded.push(`contentType:${selectedContentType}`);
    } else {
      // No specific type selected - include multiple examples (fallback mode)
      systemPrompt += "## Message Format Examples\n";
      systemPrompt += "Follow these examples exactly when generating content:\n\n";

      for (const ex of filteredExamples.slice(0, 7)) {
        const typeLabel = ex.contentType ? formatContentType(ex.contentType) : null;
        if (typeLabel) {
          systemPrompt += `### ${typeLabel} Example:\n${ex.content}\n\n`;
        } else {
          systemPrompt += `${ex.content}\n\n`;
        }
        examplesUsed++;
        examplesWithTypes.push(ex);
      }

      if (examplesUsed > 0) {
        componentsIncluded.push("messageExamples");
      }
    }
  }

  // 2. Core system prompt (if available)
  if (agent.systemPrompt) {
    systemPrompt += agent.systemPrompt + "\n\n";
    componentsIncluded.push("systemPrompt");
  }

  // 3. Personality prompt (if available and enabled)
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

      // Special Formatting Rules based on style keywords
      const lowerStyle = (agent.postStyle || "").toLowerCase();

      if (lowerStyle.includes("lowercase")) {
        systemPrompt += "## FORMATTING RULE: LOWERCASE ONLY\n";
        systemPrompt += "You must write in all lowercase letters. Use minimal punctuation.\n\n";
        componentsIncluded.push("format:lowercase");
      }

      if (lowerStyle.includes("shitpost") || lowerStyle.includes("unhinged") || lowerStyle.includes("chaotic")) {
        systemPrompt += "## FORMATTING RULE: CHAOS MODE\n";
        systemPrompt += "Be unpredictable. Ignore standard grammar. Be obscure, esoteric, or aggressive as needed.\n\n";
        componentsIncluded.push("format:chaos");
      }

      if (lowerStyle.includes("academic") || lowerStyle.includes("formal")) {
        systemPrompt += "## FORMATTING RULE: ACADEMIC\n";
        systemPrompt += "Use precise language, proper citations (if applicable), and complex sentence structures.\n\n";
        componentsIncluded.push("format:academic");
      }
    }
  }

  // 3b. Focus Topic (Anti-Repetition)
  if (focusTopic) {
    systemPrompt += "## REQUIRED TOPIC\n";
    systemPrompt += `You MUST write this post about: **${focusTopic}**\n`;
    systemPrompt += "- Focus strictly on this specific topic\n";
    systemPrompt += "- Do not drift to other general subjects\n\n";
    componentsIncluded.push(`focusTopic:${focusTopic}`);
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

  // 7. Add News Monitor Context (if available)
  if (options.newsContext && options.newsContext.length > 0) {
    const newsItems = options.newsContext.slice(0, 3).map(t => `- @${t.username}: ${t.text.replace(/\n/g, ' ')}`).join('\n');
    promptParts.push(`
GLOBAL CONTEXT (Latest News):
${newsItems}

INSTRUCTION: If these events are relevant to your topic/verse, you may subtly reference them to make your post timely. Otherwise, ignore them.
`);
  }

  // 8. Add Recent Post Context (Anti-Repetition)
  // 4b. Recent Posts Context (Anti-Repetition) - Show AI what it recently posted
  const recentPosts = options.recentPosts || [];
  if (recentPosts.length > 0) {
    systemPrompt += "## RECENT POSTS (DO NOT REPEAT)\n\n";
    systemPrompt += "These are your most recent posts. You MUST create something DIFFERENT:\n";
    systemPrompt += "- Different theme/meaning (not the same core message)\n";
    systemPrompt += "- Different tone/posture (not the same emotional angle)\n";
    systemPrompt += "- Different ending style (not the same conclusion pattern)\n";
    systemPrompt += "- Different Scripture (if using verses)\n\n";

    for (let i = 0; i < recentPosts.length; i++) {
      const post = recentPosts[i];
      const contentType = post.contentType ? formatContentType(post.contentType) : "Unknown";
      const postDate = post.postedAt ? new Date(post.postedAt).toLocaleDateString() : "Recent";

      systemPrompt += `### Post ${i + 1} (${contentType}, ${postDate}):\n`;
      systemPrompt += `${post.content || "[No content]"}\n\n`;
    }

    systemPrompt += "---\n";
    systemPrompt += "Now create something FRESH with a different message, theme, and approach.\n\n";

    componentsIncluded.push("recentPostContext");
  }

  // 5. Bible Verse Guidelines with Historical Context Requirement
  const verseTrackingEnabled = (agent as any).verseTrackingEnabled !== false; // Default true
  const verseReusePolicy = (agent as any).verseReusePolicy || "avoid_recent";

  systemPrompt += "## Bible Verse Guidelines\n\n";

  // CRITICAL: Historical context requirement
  systemPrompt += "### REQUIRED: Historical Context for Bible Verses\n";
  systemPrompt += "When sharing ANY Bible verse, you MUST include brief historical or cultural context:\n";
  systemPrompt += "- Who wrote it and to whom (audience, setting)\n";
  systemPrompt += "- What was happening at the time (historical situation)\n";
  systemPrompt += "- Why it matters for the original audience\n";
  systemPrompt += "- How it connects to readers today\n\n";
  systemPrompt += "Example: 'Paul wrote this to believers in Rome who faced persecution...'\n";
  systemPrompt += "Example: 'Jesus spoke these words during the Sermon on the Mount to crowds...'\n\n";
  componentsIncluded.push("historicalContext");

  if (verseTrackingEnabled && verseReusePolicy !== "allow" && recentVerses.length > 0) {
    const verseList = recentVerses.map(v => v.verseRef).join(", ");

    systemPrompt += "### Verse Avoidance (for variety)\n";
    systemPrompt += "AVOID these recently used verses:\n";
    systemPrompt += `${verseList}\n\n`;

    if (recentVerses.length >= 20) {
      systemPrompt += "NOTE: Many verses used recently. If needed:\n";
      systemPrompt += "- Use a less common translation or paraphrase\n";
      systemPrompt += "- Reference thematically without direct quotation\n";
      systemPrompt += "- Prioritize content quality over strict avoidance\n\n";
    } else {
      systemPrompt += "Choose different, fresh Scripture passages for variety.\n\n";
    }

    componentsIncluded.push("verseAvoidance");
  } else {
    systemPrompt += "Include book, chapter, and verse references when citing Scripture.\n\n";
  }

  // 5b. Content Type - Now handled server-side, only add if NOT using server selection
  // If selectedContentType is set, the task header already specifies what type to generate
  if (!selectedContentType) {
    // Fallback mode: Let AI choose (not recommended but supported)
    systemPrompt += "## Content Type Selection\n";
    systemPrompt += "Available types: Event-based, Verse Reflection, Deep Question, Wisdom Bite, Cultural Insight, Encouragement, Eternity Anchor\n";
    systemPrompt += "Choose one that fits your inspiration and follow its example format exactly.\n\n";
    componentsIncluded.push("contentTypeGuidance");
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

export interface ConversationPromptOptions {
  includeKnowledge?: boolean;
  includePersonality?: boolean;
  maxKbEntries?: number;
  maxKbTokens?: number;
}

export interface AssembledConversationPrompt {
  systemPrompt: string;
  metadata: {
    kbEntriesUsed: number;
    componentsIncluded: string[];
  };
}

/**
 * Assembles a CONVERSATIONAL prompt for replies and chat interactions.
 * This is DIFFERENT from assemblePrompt which is for auto-posts.
 * 
 * Key differences:
 * - No content type rotation
 * - No post formatting instructions
 * - Focused on natural, engaging dialogue
 * - Uses personality for conversation, not broadcasting
 */
export async function assembleConversationPrompt(
  agent: Agent,
  knowledgeEntries: KnowledgeBase[],
  options: ConversationPromptOptions = {}
): Promise<AssembledConversationPrompt> {
  const {
    includeKnowledge = true,
    includePersonality = true,
    maxKbEntries = 10,
    maxKbTokens = 1500,
  } = options;

  const componentsIncluded: string[] = [];
  let systemPrompt = "";

  // 1. Core Identity & Conversational Role
  systemPrompt += `# Who You Are\n\n`;
  systemPrompt += `You are ${agent.name || "an AI assistant"}`;

  if (agent.personalityPrompt && agent.personalityPrompt.trim().length > 0) {
    systemPrompt += `. ${agent.personalityPrompt}\n\n`;
    componentsIncluded.push("personality");
  } else {
    systemPrompt += `, a helpful and engaging conversationalist.\n\n`;
    if (includePersonality) {
      componentsIncluded.push("personality-default"); // Track that default personality was used
    }
  }

  // 2. Conversational Style Guidelines
  systemPrompt += `## How You Communicate\n\n`;

  // Add topics, style, and adjectives if available
  if (agent.topics && agent.topics.trim().length > 0) {
    systemPrompt += `**Your Areas of Expertise**: ${agent.topics}\n`;
    componentsIncluded.push("topics");
  }

  if (agent.postStyle && agent.postStyle.trim().length > 0) {
    systemPrompt += `**Your Communication Style**: ${agent.postStyle}\n`;
    componentsIncluded.push("style");
  }

  if (agent.adjectives && agent.adjectives.trim().length > 0) {
    systemPrompt += `**Your Tone**: ${agent.adjectives}\n`;
    componentsIncluded.push("adjectives");
  }

  systemPrompt += `\n`;

  // 3. Conversational Behavior Rules
  systemPrompt += `## Conversation Guidelines\n\n`;
  systemPrompt += `- Be warm, genuine, and engaging in your responses\n`;
  systemPrompt += `- Listen carefully to what the person is saying and respond thoughtfully\n`;
  systemPrompt += `- Keep responses concise and conversational (aim for 1-3 sentences when possible)\n`;
  systemPrompt += `- Ask follow-up questions when appropriate to show genuine interest\n`;
  systemPrompt += `- Share insights and wisdom naturally, without lecturing\n`;
  systemPrompt += `- Match the energy and tone of the person you're talking to\n`;
  systemPrompt += `- Be helpful and supportive, offering encouragement when needed\n`;
  systemPrompt += `- Stay true to your character and voice\n\n`;
  componentsIncluded.push("conversationGuidelines");

  // 4. Add knowledge base context (if available and requested)
  let kbEntriesUsed = 0;

  if (includeKnowledge && knowledgeEntries.length > 0) {
    const activeKb = knowledgeEntries
      .filter(kb => kb.active && kb.status === "approved")
      .sort((a, b) => {
        const aPriority = priorityToNumber(a.priority);
        const bPriority = priorityToNumber(b.priority);
        if (bPriority !== aPriority) return bPriority - aPriority;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, maxKbEntries);

    if (activeKb.length > 0) {
      systemPrompt += `## Your Knowledge (Reference When Relevant)\n\n`;
      systemPrompt += `Use this information naturally in conversation when it helps answer questions or add value:\n\n`;

      let tokenCount = 0;
      for (const kb of activeKb) {
        const estimatedTokens = (kb.title.length + kb.content.length) / 4;
        if (tokenCount + estimatedTokens > maxKbTokens) break;

        systemPrompt += `**${kb.title}**: ${kb.content}\n\n`;
        tokenCount += estimatedTokens;
        kbEntriesUsed++;
      }

      componentsIncluded.push("knowledgeBase");
    }
  }

  // 5. Important reminders for conversational context
  systemPrompt += `## Important Reminders\n\n`;
  systemPrompt += `- You are having a CONVERSATION, not writing a social media post\n`;
  systemPrompt += `- Respond directly to what the person said\n`;
  systemPrompt += `- Don't use hashtags or post-style formatting\n`;
  systemPrompt += `- Keep it natural and human-like\n`;
  componentsIncluded.push("conversationalReminders");

  return {
    systemPrompt: systemPrompt.trim(),
    metadata: {
      kbEntriesUsed,
      componentsIncluded,
    },
  };
}

/**
 * Build messages array specifically for conversational contexts
 */
export function buildConversationMessages(
  conversationPrompt: AssembledConversationPrompt,
  conversationHistory: Array<{ role: string; content: string }> = [],
  currentMessage?: string
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  // Add system prompt
  messages.push({
    role: "system",
    content: conversationPrompt.systemPrompt,
  });

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
