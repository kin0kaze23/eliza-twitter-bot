import { storage, db } from "./storage";
import { knowledgeBase, agents, customApis as customApisTable } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import type { Agent, KnowledgeBase, CustomApi } from "@shared/schema";

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

// Helper to build full URL with query params and construct headers with auth
function buildApiRequest(api: CustomApi): { url: string; headers: Record<string, string> } {
  // Build URL with query params
  let url = api.baseUrl;
  const queryParams = api.queryParams as Record<string, any> || {};
  
  if (Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(queryParams)) {
      // Convert value to string first
      let stringValue = String(value);
      
      // Resolve env vars in query params (e.g., {{API_KEY}} -> actual value)
      const envMatch = stringValue.match(/\{\{(\w+)\}\}/);
      if (envMatch) {
        stringValue = process.env[envMatch[1]] || stringValue;
      }
      params.append(key, stringValue);
    }
    url = url.includes('?') ? `${url}&${params.toString()}` : `${url}?${params.toString()}`;
  }
  
  // Build headers with auth
  const headers: Record<string, string> = { ...(api.headers as Record<string, string> || {}) };
  
  if (api.authType && api.authType !== 'none') {
    const apiKey = api.authKeyEnvVar ? process.env[api.authKeyEnvVar] : undefined;
    
    if (apiKey) {
      switch (api.authType) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${apiKey}`;
          break;
        case 'api_key':
          const headerName = api.authHeaderName || 'X-API-Key';
          headers[headerName] = apiKey;
          break;
        case 'basic':
          headers['Authorization'] = `Basic ${Buffer.from(apiKey).toString('base64')}`;
          break;
      }
    }
  }
  
  return { url, headers };
}

export async function refreshKnowledgeBaseForAgent(agentId: string): Promise<{ refreshed: number; errors: string[] }> {
  const errors: string[] = [];
  let refreshed = 0;
  const refreshedApiIds = new Set<string>();
  
  try {
    const kbEntries = await storage.getActiveKnowledgeBase(agentId);
    const customApis = await storage.getAllCustomApis();
    
    console.log(`[KB Refresh] Processing ${kbEntries.length} KB entries for agent ${agentId}`);
    
    for (const entry of kbEntries) {
      if (entry.source !== "manual" && entry.sourceId) {
        const api = customApis.find(a => a.id === entry.sourceId);
        if (api && api.enabled) {
          try {
            const { url, headers } = buildApiRequest(api);
            console.log(`[KB Refresh] Fetching from API: ${api.name} (${url})`);
            const response = await fetch(url, {
              method: api.method || "GET",
              headers,
            });
            
            if (response.ok) {
              const data = await response.json();
              let newContent = entry.content;
              
              if (api.contentPath) {
                try {
                  const jsonpathModule = await import("jsonpath");
                  const jsonpath = jsonpathModule.default || jsonpathModule;
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
                    lastFetchedAt: new Date(),
                    updatedAt: new Date(),
                  })
                  .where(eq(knowledgeBase.id, entry.id));
                refreshed++;
                console.log(`[KB Refresh] Updated KB entry: ${entry.title}`);
              }
              
              refreshedApiIds.add(api.id);
            } else {
              console.error(`[KB Refresh] API ${api.name} returned ${response.status}`);
              errors.push(`API ${api.name} returned status ${response.status}`);
            }
          } catch (e: any) {
            console.error(`[KB Refresh] Failed to refresh ${entry.title}:`, e.message);
            errors.push(`Failed to refresh ${entry.title}: ${e.message}`);
          }
        }
      }
    }
    
    if (refreshedApiIds.size > 0) {
      const apiIdsArray = Array.from(refreshedApiIds);
      console.log(`[KB Refresh] Updating lastRefreshedAt for ${apiIdsArray.length} APIs`);
      for (const apiId of apiIdsArray) {
        await db.update(customApisTable)
          .set({ 
            lastRefreshedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(customApisTable.id, apiId));
      }
    }
    
    await db.update(agents)
      .set({ kbLastAutoRefreshedAt: new Date() })
      .where(eq(agents.id, agentId));
    
    console.log(`[KB Refresh] Completed: ${refreshed} entries updated, ${refreshedApiIds.size} APIs refreshed`);
      
  } catch (error: any) {
    console.error(`[KB Refresh] Agent refresh error:`, error);
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

// Helper to convert priority string to number for comparison
function priorityToNumber(priority: string): number {
  switch (priority) {
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
    default: return 2; // default to medium
  }
}

// Helper to convert number to priority string
function numberToPriority(num: number): string {
  if (num >= 3) return "high";
  if (num >= 2) return "medium";
  return "low";
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
      
      // Convert current priority string to number for comparison
      let currentPriorityNum = priorityToNumber(entry.priority);
      let newPriorityNum = currentPriorityNum;
      
      for (const condition of conditions) {
        if (contentLower.includes(condition.keyword) || titleLower.includes(condition.keyword)) {
          // Map rule priority (1-10) to our scale: 1-3=low, 4-6=medium, 7-10=high
          const mappedPriority = condition.priority >= 7 ? 3 : (condition.priority >= 4 ? 2 : 1);
          if (mappedPriority > newPriorityNum) {
            newPriorityNum = mappedPriority;
          }
        }
      }
      
      const newPriorityStr = numberToPriority(newPriorityNum);
      if (newPriorityStr !== entry.priority) {
        await db.update(knowledgeBase)
          .set({
            priority: newPriorityStr,
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

async function scheduleAgentRefresh(agent: Agent): Promise<void> {
  if (state.refreshTimers.has(agent.id)) {
    clearInterval(state.refreshTimers.get(agent.id)!);
  }
  
  if (!agent.kbAutoRefreshEnabled || !agent.kbAutoRefreshIntervalHours) {
    return;
  }
  
  const intervalMs = agent.kbAutoRefreshIntervalHours * 60 * 60 * 1000;
  console.log(`[KB Refresh] Scheduling agent ${agent.name} with interval ${agent.kbAutoRefreshIntervalHours}h`);
  
  // Check if we need an immediate refresh (last refresh was longer than interval ago)
  const lastRefresh = agent.kbLastAutoRefreshedAt;
  const needsImmediateRefresh = !lastRefresh || 
    (Date.now() - new Date(lastRefresh).getTime() > intervalMs);
  
  if (needsImmediateRefresh) {
    console.log(`[KB Refresh] Triggering immediate refresh for ${agent.name} (last refresh: ${lastRefresh ? new Date(lastRefresh).toISOString() : 'never'})`);
    try {
      const result = await refreshKnowledgeBaseForAgent(agent.id);
      console.log(`[KB Refresh] Immediate refresh completed: ${result.refreshed} entries updated`);
      
      if (agent.kbPriorityRuleEnabled && agent.kbPriorityRule) {
        const priorityResult = await applyPriorityRulesForAgent(agent.id, agent.kbPriorityRule);
        console.log(`[KB Refresh] Updated ${priorityResult.updated} priorities for ${agent.name}`);
      }
    } catch (error) {
      console.error(`[KB Refresh] Immediate refresh failed for ${agent.name}:`, error);
    }
  }
  
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

export async function startAgentKbRefresh(agent: Agent): Promise<void> {
  if (agent.kbAutoRefreshEnabled) {
    await scheduleAgentRefresh(agent);
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
      await scheduleAgentRefresh(agent);
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
