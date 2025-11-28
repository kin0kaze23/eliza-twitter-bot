import { storage, db } from "./storage";
import { knowledgeBase, agents } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { Agent, KnowledgeBase } from "@shared/schema";

interface RefreshState {
  isRunning: boolean;
  refreshTimers: Map<string, NodeJS.Timeout>;
  priorityTimers: Map<string, NodeJS.Timeout>;
}

const state: RefreshState = {
  isRunning: false,
  refreshTimers: new Map(),
  priorityTimers: new Map(),
};

export async function refreshKnowledgeBaseForAgent(agentId: string): Promise<{ refreshed: number; errors: string[] }> {
  const errors: string[] = [];
  let refreshed = 0;
  
  try {
    const kbEntries = await storage.getActiveKnowledgeBase(agentId);
    const customApis = await storage.getAllCustomApis();
    
    for (const entry of kbEntries) {
      if (entry.source !== "manual" && entry.sourceId) {
        const api = customApis.find(a => a.id === entry.sourceId);
        if (api && api.enabled) {
          try {
            const response = await fetch(api.baseUrl, {
              method: api.method || "GET",
              headers: api.headers as Record<string, string> || {},
            });
            
            if (response.ok) {
              const data = await response.json();
              let newContent = entry.content;
              
              if (api.contentPath) {
                try {
                  const jsonpath = await import("jsonpath");
                  const result = jsonpath.query(data, api.contentPath);
                  if (result && result.length > 0) {
                    newContent = typeof result[0] === "string" ? result[0] : JSON.stringify(result[0]);
                  }
                } catch (e) {
                  console.error(`JSONPath error for KB ${entry.id}:`, e);
                }
              }
              
              if (newContent !== entry.content) {
                await db.update(knowledgeBase)
                  .set({
                    content: newContent,
                    lastRefreshedAt: new Date(),
                    updatedAt: new Date(),
                  })
                  .where(eq(knowledgeBase.id, entry.id));
                refreshed++;
              }
            }
          } catch (e: any) {
            errors.push(`Failed to refresh ${entry.title}: ${e.message}`);
          }
        }
      }
    }
    
    await db.update(agents)
      .set({ kbLastAutoRefreshedAt: new Date() })
      .where(eq(agents.id, agentId));
      
  } catch (error: any) {
    errors.push(`Agent refresh error: ${error.message}`);
  }
  
  return { refreshed, errors };
}

export function parsePriorityRule(rule: string): { conditions: { keyword: string; priority: number }[] } {
  const conditions: { keyword: string; priority: number }[] = [];
  
  const lines = rule.split("\n").filter(l => l.trim());
  
  for (const line of lines) {
    const match = line.match(/if\s+(?:content\s+)?contains?\s+['"]([^'"]+)['"]\s+then\s+priority\s+(\d+)/i);
    if (match) {
      conditions.push({
        keyword: match[1].toLowerCase(),
        priority: Math.min(10, Math.max(1, parseInt(match[2], 10))),
      });
    }
  }
  
  return { conditions };
}

export async function applyPriorityRulesForAgent(agentId: string, rule: string): Promise<{ updated: number }> {
  let updated = 0;
  
  try {
    const { conditions } = parsePriorityRule(rule);
    if (conditions.length === 0) {
      return { updated: 0 };
    }
    
    const kbEntries = await storage.getActiveKnowledgeBase(agentId);
    
    for (const entry of kbEntries) {
      const contentLower = (entry.content || "").toLowerCase();
      const titleLower = (entry.title || "").toLowerCase();
      
      let newPriority = entry.priority;
      
      for (const condition of conditions) {
        if (contentLower.includes(condition.keyword) || titleLower.includes(condition.keyword)) {
          if (condition.priority > newPriority) {
            newPriority = condition.priority;
          }
        }
      }
      
      if (newPriority !== entry.priority) {
        await db.update(knowledgeBase)
          .set({
            priority: newPriority,
            updatedAt: new Date(),
          })
          .where(eq(knowledgeBase.id, entry.id));
        updated++;
      }
    }
    
    await db.update(agents)
      .set({ kbPriorityRuleLastAppliedAt: new Date() })
      .where(eq(agents.id, agentId));
      
  } catch (error) {
    console.error(`Priority rule error for agent ${agentId}:`, error);
  }
  
  return { updated };
}

function scheduleAgentRefresh(agent: Agent): void {
  if (state.refreshTimers.has(agent.id)) {
    clearInterval(state.refreshTimers.get(agent.id)!);
  }
  
  if (!agent.kbAutoRefreshEnabled || !agent.kbAutoRefreshIntervalHours) {
    return;
  }
  
  const intervalMs = agent.kbAutoRefreshIntervalHours * 60 * 60 * 1000;
  console.log(`[KB Refresh] Scheduling agent ${agent.name} with interval ${agent.kbAutoRefreshIntervalHours}h`);
  
  const timer = setInterval(async () => {
    try {
      const currentAgent = await storage.getAgent(agent.id);
      if (currentAgent?.kbAutoRefreshEnabled) {
        console.log(`[KB Refresh] Auto-refreshing KB for agent: ${currentAgent.name}`);
        const result = await refreshKnowledgeBaseForAgent(agent.id);
        console.log(`[KB Refresh] Refreshed ${result.refreshed} entries for ${currentAgent.name}`);
        
        if (currentAgent.kbPriorityRuleEnabled && currentAgent.kbPriorityRule) {
          const priorityResult = await applyPriorityRulesForAgent(agent.id, currentAgent.kbPriorityRule);
          console.log(`[KB Refresh] Updated ${priorityResult.updated} priorities for ${currentAgent.name}`);
        }
      }
    } catch (error) {
      console.error(`[KB Refresh] Error refreshing agent ${agent.id}:`, error);
    }
  }, intervalMs);
  
  state.refreshTimers.set(agent.id, timer);
}

export function startAgentKbRefresh(agent: Agent): void {
  if (agent.kbAutoRefreshEnabled) {
    scheduleAgentRefresh(agent);
  }
}

export function stopAgentKbRefresh(agentId: string): void {
  const timer = state.refreshTimers.get(agentId);
  if (timer) {
    clearInterval(timer);
    state.refreshTimers.delete(agentId);
  }
}

export async function initializeKbRefreshService(): Promise<void> {
  if (state.isRunning) return;
  
  console.log("[KB Refresh] Initializing...");
  state.isRunning = true;
  
  try {
    const allAgents = await storage.getAllAgents();
    const refreshAgents = allAgents.filter(a => a.kbAutoRefreshEnabled);
    
    console.log(`[KB Refresh] Found ${refreshAgents.length} agents with auto-refresh enabled`);
    
    for (const agent of refreshAgents) {
      scheduleAgentRefresh(agent);
    }
  } catch (error) {
    console.error("[KB Refresh] Failed to initialize:", error);
  }
}

export function shutdownKbRefreshService(): void {
  console.log("[KB Refresh] Shutting down...");
  
  const entries = Array.from(state.refreshTimers.entries());
  for (const [agentId, timer] of entries) {
    clearInterval(timer);
  }
  
  state.refreshTimers.clear();
  state.priorityTimers.clear();
  state.isRunning = false;
}

export function getKbRefreshStatus(): { isRunning: boolean; activeAgentCount: number; activeAgentIds: string[] } {
  return {
    isRunning: state.isRunning,
    activeAgentCount: state.refreshTimers.size,
    activeAgentIds: Array.from(state.refreshTimers.keys()),
  };
}

export async function startKBRefreshService(agentId: string): Promise<void> {
  try {
    const agent = await storage.getAgent(agentId);
    if (agent && agent.kbAutoRefreshEnabled) {
      startAgentKbRefresh(agent);
    }
  } catch (error) {
    console.error(`[KB Refresh] Failed to start service for agent ${agentId}:`, error);
  }
}
