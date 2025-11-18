import { db } from "./db";
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
  users,
  agents,
  knowledgeBase,
  customApis,
  apiKeys,
  agentActivity,
} from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";

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
  createKnowledgeBaseEntry(entry: InsertKnowledgeBase): Promise<KnowledgeBase>;
  updateKnowledgeBaseEntry(id: string, entry: Partial<InsertKnowledgeBase>): Promise<KnowledgeBase | undefined>;
  deleteKnowledgeBaseEntry(id: string): Promise<boolean>;
  
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

  async getKnowledgeBaseByCategory(agentId: string, category: string): Promise<KnowledgeBase[]> {
    return await db
      .select()
      .from(knowledgeBase)
      .where(and(eq(knowledgeBase.agentId, agentId), eq(knowledgeBase.category, category)))
      .orderBy(desc(knowledgeBase.priority), desc(knowledgeBase.createdAt));
  }

  async getActiveKnowledgeBase(agentId: string): Promise<KnowledgeBase[]> {
    return await db
      .select()
      .from(knowledgeBase)
      .where(and(eq(knowledgeBase.agentId, agentId), eq(knowledgeBase.active, true)))
      .orderBy(desc(knowledgeBase.priority), desc(knowledgeBase.createdAt));
  }

  // Agent Activity (Monitoring)
  async getAgentActivity(agentId: string, startDate?: string, endDate?: string): Promise<AgentActivity[]> {
    let query = db.select().from(agentActivity).where(eq(agentActivity.agentId, agentId));
    
    if (startDate && endDate) {
      query = query.where(
        and(
          eq(agentActivity.agentId, agentId),
          sql`${agentActivity.date} >= ${startDate}`,
          sql`${agentActivity.date} <= ${endDate}`
        )
      );
    }
    
    return await query.orderBy(desc(agentActivity.date), desc(agentActivity.hour));
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
}

export const storage = new DbStorage();
