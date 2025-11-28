import { db } from "./db";
export { db };
import {
  type User,
  type InsertUser,
  type Agent,
  type InsertAgent,
  type KnowledgeBase,
  type InsertKnowledgeBase,
  type CustomApi,
  type InsertCustomApi,
  type ApiKey,
  type InsertApiKey,
  type AgentActivity,
  type InsertAgentActivity,
  type ActivityLog,
  type InsertActivityLog,
  type BibleVerseUsage,
  type InsertBibleVerseUsage,
  users,
  agents,
  knowledgeBase,
  customApis,
  apiKeys,
  agentActivity,
  activityLogs,
  bibleVerseUsages,
} from "@shared/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Agents
  getAgent(id: string): Promise<Agent | undefined>;
  getAllAgents(): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, agent: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: string): Promise<boolean>;
  updateAgentStatus(id: string, status: string): Promise<Agent | undefined>;
  
  // Knowledge Base
  getKnowledgeBaseEntries(agentId: string): Promise<KnowledgeBase[]>;
  getKnowledgeBaseEntry(id: string): Promise<KnowledgeBase | undefined>;
  getKnowledgeBaseByCategory(agentId: string, category: string): Promise<KnowledgeBase[]>;
  getActiveKnowledgeBase(agentId: string): Promise<KnowledgeBase[]>;
  getPendingKnowledgeBase(agentId: string): Promise<KnowledgeBase[]>;
  getApprovedKnowledgeBase(agentId: string): Promise<KnowledgeBase[]>;
  createKnowledgeBaseEntry(entry: InsertKnowledgeBase): Promise<KnowledgeBase>;
  updateKnowledgeBaseEntry(id: string, entry: Partial<InsertKnowledgeBase>): Promise<KnowledgeBase | undefined>;
  deleteKnowledgeBaseEntry(id: string): Promise<boolean>;
  refreshKnowledgeBaseEntry(id: string): Promise<KnowledgeBase | undefined>;
  batchApproveKnowledgeBase(agentId: string, ids: string[], approvedBy?: string): Promise<number>;
  batchArchiveKnowledgeBase(agentId: string, ids: string[]): Promise<number>;
  
  // Agent Activity (Monitoring)
  getAgentActivity(agentId: string, startDate?: string, endDate?: string): Promise<AgentActivity[]>;
  getAgentActivitySummary(agentId: string): Promise<AgentActivity | undefined>;
  createOrUpdateActivity(activity: InsertAgentActivity): Promise<AgentActivity>;
  getActivityByDate(agentId: string, date: string): Promise<AgentActivity | undefined>;
  
  // Custom APIs
  getAllCustomApis(): Promise<CustomApi[]>;
  getCustomApi(id: string): Promise<CustomApi | undefined>;
  createCustomApi(api: InsertCustomApi): Promise<CustomApi>;
  updateCustomApi(id: string, api: Partial<InsertCustomApi>): Promise<CustomApi | undefined>;
  deleteCustomApi(id: string): Promise<boolean>;
  
  // API Keys
  getAllApiKeys(): Promise<ApiKey[]>;
  getApiKey(id: string): Promise<ApiKey | undefined>;
  getApiKeysByProvider(provider: string): Promise<ApiKey[]>;
  createApiKey(key: InsertApiKey): Promise<ApiKey>;
  updateApiKey(id: string, key: Partial<InsertApiKey>): Promise<ApiKey | undefined>;
  deleteApiKey(id: string): Promise<boolean>;
  
  // Activity Logs
  getActivityLogs(agentId?: string, limit?: number): Promise<ActivityLog[]>;
  getRecentActivityLogs(limit?: number): Promise<ActivityLog[]>;
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  
  // Bible Verse Tracking
  getRecentVerseUsages(agentId: string, limit?: number): Promise<BibleVerseUsage[]>;
  logVerseUsage(agentId: string, verseRef: string, book: string, chapter: number, verseStart: number, verseEnd: number | undefined, tweetId?: string): Promise<BibleVerseUsage>;
  clearVerseHistory(agentId: string): Promise<number>;
}

export class DbStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  // Agents
  async getAgent(id: string): Promise<Agent | undefined> {
    const result = await db.select().from(agents).where(eq(agents.id, id));
    return result[0];
  }

  async getAllAgents(): Promise<Agent[]> {
    return await db.select().from(agents).orderBy(desc(agents.createdAt));
  }

  async createAgent(agent: InsertAgent): Promise<Agent> {
    const result = await db.insert(agents).values(agent as any).returning();
    return result[0];
  }

  async updateAgent(id: string, agent: Partial<InsertAgent>): Promise<Agent | undefined> {
    const updateData: any = { ...agent, updatedAt: new Date() };
    const result = await db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, id))
      .returning();
    return result[0];
  }

  async deleteAgent(id: string): Promise<boolean> {
    const result = await db.delete(agents).where(eq(agents.id, id)).returning();
    return result.length > 0;
  }

  async updateAgentStatus(id: string, status: string): Promise<Agent | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (status === "deployed") {
      updateData.lastDeployedAt = new Date();
    }
    const result = await db
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, id))
      .returning();
    return result[0];
  }

  // Knowledge Base
  async getKnowledgeBaseEntries(agentId: string): Promise<KnowledgeBase[]> {
    return await db
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.agentId, agentId))
      .orderBy(desc(knowledgeBase.createdAt));
  }

  async getKnowledgeBaseEntry(id: string): Promise<KnowledgeBase | undefined> {
    const result = await db.select().from(knowledgeBase).where(eq(knowledgeBase.id, id));
    return result[0];
  }

  async createKnowledgeBaseEntry(entry: InsertKnowledgeBase): Promise<KnowledgeBase> {
    const result = await db.insert(knowledgeBase).values(entry as any).returning();
    return result[0];
  }

  async updateKnowledgeBaseEntry(
    id: string,
    entry: Partial<InsertKnowledgeBase>
  ): Promise<KnowledgeBase | undefined> {
    const updateData: any = { ...entry, updatedAt: new Date() };
    const result = await db
      .update(knowledgeBase)
      .set(updateData)
      .where(eq(knowledgeBase.id, id))
      .returning();
    return result[0];
  }

  async deleteKnowledgeBaseEntry(id: string): Promise<boolean> {
    const result = await db.delete(knowledgeBase).where(eq(knowledgeBase.id, id)).returning();
    return result.length > 0;
  }

  async refreshKnowledgeBaseEntry(id: string): Promise<KnowledgeBase | undefined> {
    const updateData: any = {
      lastFetchedAt: new Date(),
      lastRefreshedAt: new Date(),
    };
    const result = await db
      .update(knowledgeBase)
      .set(updateData)
      .where(eq(knowledgeBase.id, id))
      .returning();
    return result[0];
  }

  async getKnowledgeBaseByCategory(agentId: string, category: string): Promise<KnowledgeBase[]> {
    // Order by priority (high > medium > low) then by newest first
    const priorityOrder = sql`CASE WHEN ${knowledgeBase.priority} = 'high' THEN 3 WHEN ${knowledgeBase.priority} = 'medium' THEN 2 ELSE 1 END`;
    return await db
      .select()
      .from(knowledgeBase)
      .where(and(eq(knowledgeBase.agentId, agentId), eq(knowledgeBase.category, category)))
      .orderBy(desc(priorityOrder), desc(knowledgeBase.createdAt));
  }

  async getActiveKnowledgeBase(agentId: string): Promise<KnowledgeBase[]> {
    // Order by priority (high > medium > low) then by newest first
    const priorityOrder = sql`CASE WHEN ${knowledgeBase.priority} = 'high' THEN 3 WHEN ${knowledgeBase.priority} = 'medium' THEN 2 ELSE 1 END`;
    return await db
      .select()
      .from(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.agentId, agentId),
          eq(knowledgeBase.active, true),
          eq(knowledgeBase.status, "approved")
        )
      )
      .orderBy(desc(priorityOrder), desc(knowledgeBase.createdAt));
  }

  async getPendingKnowledgeBase(agentId: string): Promise<KnowledgeBase[]> {
    // Order by newest first for pending entries
    return await db
      .select()
      .from(knowledgeBase)
      .where(and(eq(knowledgeBase.agentId, agentId), eq(knowledgeBase.status, "pending")))
      .orderBy(desc(knowledgeBase.createdAt));
  }

  async getApprovedKnowledgeBase(agentId: string): Promise<KnowledgeBase[]> {
    // Order by priority (high > medium > low) then by newest first
    const priorityOrder = sql`CASE WHEN ${knowledgeBase.priority} = 'high' THEN 3 WHEN ${knowledgeBase.priority} = 'medium' THEN 2 ELSE 1 END`;
    return await db
      .select()
      .from(knowledgeBase)
      .where(and(eq(knowledgeBase.agentId, agentId), eq(knowledgeBase.status, "approved")))
      .orderBy(desc(priorityOrder), desc(knowledgeBase.createdAt));
  }

  async batchApproveKnowledgeBase(agentId: string, ids: string[], approvedBy?: string): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const updateData: any = {
      status: "approved",
      active: true, // Activate when approving
      approvedAt: new Date(),
      updatedAt: new Date(),
    };

    if (approvedBy) {
      updateData.approvedBy = approvedBy;
    }

    // Only approve entries that are (1) owned by this agent and (2) currently pending
    // Use inArray for safe parameterization (prevents SQL injection)
    const result = await db
      .update(knowledgeBase)
      .set(updateData)
      .where(
        and(
          eq(knowledgeBase.agentId, agentId),
          eq(knowledgeBase.status, "pending"),
          inArray(knowledgeBase.id, ids)
        )
      )
      .returning();

    return result.length;
  }

  async batchArchiveKnowledgeBase(agentId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const updateData: any = {
      status: "archived",
      active: false,
      updatedAt: new Date(),
    };

    // Only archive entries that are owned by this agent (any status except already archived)
    // Use inArray for safe parameterization (prevents SQL injection)
    const result = await db
      .update(knowledgeBase)
      .set(updateData)
      .where(
        and(
          eq(knowledgeBase.agentId, agentId),
          sql`${knowledgeBase.status} != 'archived'`, // Don't re-archive
          inArray(knowledgeBase.id, ids)
        )
      )
      .returning();

    return result.length;
  }

  async markKnowledgeBaseAsUsed(ids: string[], tweetId: string): Promise<void> {
    if (ids.length === 0) return;
    
    for (const id of ids) {
      const entry = await db.select().from(knowledgeBase).where(eq(knowledgeBase.id, id)).limit(1);
      if (entry[0]) {
        const usedTweetIds = (entry[0].usedInTweetIds || []) as string[];
        usedTweetIds.push(tweetId);
        
        await db.update(knowledgeBase)
          .set({
            usedAt: new Date(),
            usedCount: (entry[0].usedCount || 0) + 1,
            usedInTweetIds: usedTweetIds,
            updatedAt: new Date(),
          })
          .where(eq(knowledgeBase.id, id));
      }
    }
  }

  // Agent Activity (Monitoring)
  async getAgentActivity(agentId: string, startDate?: string, endDate?: string): Promise<AgentActivity[]> {
    if (startDate && endDate) {
      return await db
        .select()
        .from(agentActivity)
        .where(
          and(
            eq(agentActivity.agentId, agentId),
            sql`${agentActivity.date} >= ${startDate}`,
            sql`${agentActivity.date} <= ${endDate}`
          )
        )
        .orderBy(desc(agentActivity.date), desc(agentActivity.hour));
    }
    
    return await db
      .select()
      .from(agentActivity)
      .where(eq(agentActivity.agentId, agentId))
      .orderBy(desc(agentActivity.date), desc(agentActivity.hour));
  }

  async getAgentActivitySummary(agentId: string): Promise<AgentActivity | undefined> {
    const result = await db
      .select()
      .from(agentActivity)
      .where(eq(agentActivity.agentId, agentId))
      .orderBy(desc(agentActivity.date), desc(agentActivity.hour))
      .limit(1);
    return result[0];
  }

  async createOrUpdateActivity(activity: InsertAgentActivity): Promise<AgentActivity> {
    const existing = await this.getActivityByDate(activity.agentId, activity.date);
    
    if (existing) {
      const updatedData: any = {
        postsGenerated: existing.postsGenerated + (activity.postsGenerated || 0),
        repliesSent: existing.repliesSent + (activity.repliesSent || 0),
        twitterApiCalls: existing.twitterApiCalls + (activity.twitterApiCalls || 0),
        aiModelCalls: existing.aiModelCalls + (activity.aiModelCalls || 0),
        tokensUsed: existing.tokensUsed + (activity.tokensUsed || 0),
        errorsCount: existing.errorsCount + (activity.errorsCount || 0),
        kbEntriesUsed: activity.kbEntriesUsed || existing.kbEntriesUsed,
        kbCategoriesUsed: activity.kbCategoriesUsed || existing.kbCategoriesUsed,
        updatedAt: new Date(),
      };
      
      const result = await db
        .update(agentActivity)
        .set(updatedData)
        .where(eq(agentActivity.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(agentActivity).values(activity as any).returning();
      return result[0];
    }
  }

  async getActivityByDate(agentId: string, date: string): Promise<AgentActivity | undefined> {
    const result = await db
      .select()
      .from(agentActivity)
      .where(and(eq(agentActivity.agentId, agentId), eq(agentActivity.date, date)));
    return result[0];
  }

  // Custom APIs
  async getAllCustomApis(): Promise<CustomApi[]> {
    return await db.select().from(customApis).orderBy(desc(customApis.createdAt));
  }

  async getCustomApi(id: string): Promise<CustomApi | undefined> {
    const result = await db.select().from(customApis).where(eq(customApis.id, id));
    return result[0];
  }

  async createCustomApi(api: InsertCustomApi): Promise<CustomApi> {
    const result = await db.insert(customApis).values(api).returning();
    return result[0];
  }

  async updateCustomApi(id: string, api: Partial<InsertCustomApi>): Promise<CustomApi | undefined> {
    const result = await db
      .update(customApis)
      .set({ ...api, updatedAt: new Date() })
      .where(eq(customApis.id, id))
      .returning();
    return result[0];
  }

  async deleteCustomApi(id: string): Promise<boolean> {
    const result = await db.delete(customApis).where(eq(customApis.id, id)).returning();
    return result.length > 0;
  }

  // API Keys
  async getAllApiKeys(): Promise<ApiKey[]> {
    return await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  }

  async getApiKey(id: string): Promise<ApiKey | undefined> {
    const result = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return result[0];
  }

  async getApiKeysByProvider(provider: string): Promise<ApiKey[]> {
    return await db.select().from(apiKeys).where(eq(apiKeys.provider, provider));
  }

  async createApiKey(key: InsertApiKey): Promise<ApiKey> {
    const result = await db.insert(apiKeys).values(key).returning();
    return result[0];
  }

  async updateApiKey(id: string, key: Partial<InsertApiKey>): Promise<ApiKey | undefined> {
    const result = await db
      .update(apiKeys)
      .set({ ...key, updatedAt: new Date() })
      .where(eq(apiKeys.id, id))
      .returning();
    return result[0];
  }

  async deleteApiKey(id: string): Promise<boolean> {
    const result = await db.delete(apiKeys).where(eq(apiKeys.id, id)).returning();
    return result.length > 0;
  }

  // Activity Logs
  async getActivityLogs(agentId?: string, limit: number = 50): Promise<ActivityLog[]> {
    if (agentId) {
      return await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.agentId, agentId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);
    }
    return await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async getRecentActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const result = await db.insert(activityLogs).values(log as any).returning();
    return result[0];
  }

  // Bible Verse Tracking
  async getRecentVerseUsages(agentId: string, limit: number = 10): Promise<BibleVerseUsage[]> {
    return await db
      .select()
      .from(bibleVerseUsages)
      .where(eq(bibleVerseUsages.agentId, agentId))
      .orderBy(desc(bibleVerseUsages.lastUsedAt))
      .limit(limit);
  }

  async logVerseUsage(
    agentId: string,
    verseRef: string,
    book: string,
    chapter: number,
    verseStart: number,
    verseEnd: number | undefined,
    tweetId?: string
  ): Promise<BibleVerseUsage> {
    // Check if this verse was already used
    const existing = await db
      .select()
      .from(bibleVerseUsages)
      .where(and(
        eq(bibleVerseUsages.agentId, agentId),
        eq(bibleVerseUsages.verseRef, verseRef)
      ));
    
    if (existing.length > 0) {
      // Update existing record
      const currentTweetIds = (existing[0].tweetIds as string[]) || [];
      const newTweetIds = tweetId ? [...currentTweetIds, tweetId] : currentTweetIds;
      
      const result = await db
        .update(bibleVerseUsages)
        .set({
          usageCount: existing[0].usageCount + 1,
          lastUsedAt: new Date(),
          tweetIds: newTweetIds,
        })
        .where(eq(bibleVerseUsages.id, existing[0].id))
        .returning();
      return result[0];
    }
    
    // Create new record
    const result = await db
      .insert(bibleVerseUsages)
      .values({
        agentId,
        verseRef,
        book,
        chapter,
        verseStart,
        verseEnd,
        tweetIds: tweetId ? [tweetId] : [],
      })
      .returning();
    return result[0];
  }

  async clearVerseHistory(agentId: string): Promise<number> {
    const result = await db
      .delete(bibleVerseUsages)
      .where(eq(bibleVerseUsages.agentId, agentId))
      .returning();
    return result.length;
  }
}

export const storage = new DbStorage();
