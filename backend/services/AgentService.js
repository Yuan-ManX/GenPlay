/**
 * AgentService - 连接 Agent 核心层与后端的数据服务
 * 将游戏数据服务注入 Agent 工具链，实现三层无缝联动。
 * 新增：/editor/action 通道，让前端也可以直接通过 Agent 工具签名对编辑器
 * 执行原子操作（与 Agent 对话内部工具共享同一条执行链路）。
 */
import { createAgent } from '../../agent/index.js';
import config from '../config/index.js';

export class AgentService {
  constructor(gameService) {
    this.gameService = gameService;
    this.agent = createAgent({
      gameService,
      provider: {
        apiKey: config.llm.apiKey || undefined,
        baseURL: config.llm.baseURL || undefined,
        model: config.llm.model || undefined,
      },
    });
    this.sessions = new Map();
  }

  async chat({ sessionId, message }) {
    const sid = sessionId || this.newSession();
    const result = await this.agent.handleMessage({ sessionId: sid, message });
    this.sessions.set(sid, {
      id: sid,
      messages: this.agent.memory.get(sid),
      currentGameId: result.currentGameId || null,
      updatedAt: new Date().toISOString(),
    });
    return { ...result, sessionId: sid };
  }

  /**
   * Streaming chat: forwards lifecycle events from the orchestrator to an
   * onEvent callback so the SSE endpoint can push them to the frontend in
   * realtime (plan, tool_start, tool_end, reply, done).
   */
  async chatStream({ sessionId, message, onEvent }) {
    const sid = sessionId || this.newSession();
    const result = await this.agent.handleMessage({ sessionId: sid, message, onEvent });
    this.sessions.set(sid, {
      id: sid,
      messages: this.agent.memory.get(sid),
      currentGameId: result.currentGameId || null,
      updatedAt: new Date().toISOString(),
    });
    return { ...result, sessionId: sid };
  }

  /**
   * Execute a raw agent tool by name + args (bypasses planner & reasoning loop).
   * Used by /api/editor/action for frontend-driven studio operations that want
   * shared tool semantics and editorActions.
   */
  async runTool({ toolName, args = {}, sessionId }) {
    const sid = sessionId || this.newSession();
    const raw = await this.agent.tools.invoke(toolName, args, { sessionId: sid });
    return { sessionId: sid, tool: toolName, result: raw, editorActions: raw.editorActions || [] };
  }

  newSession() {
    return 'sess_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  listSessions() {
    // Enrich raw session entries with memory-backed metadata so the
    // frontend sidebar can render previews, intent counts, and timestamps
    // without a second round-trip per session.
    return Array.from(this.sessions.values()).map((s) => {
      const mem = this.agent.memory.getSession(s.id);
      const messages = mem?.messages || [];
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      const intents = mem?.intents || [];
      const distinctTools = Array.from(new Set(intents.map((i) => i.name)));
      return {
        id: s.id,
        messageCount: messages.length,
        currentGameId: s.currentGameId || null,
        updatedAt: s.updatedAt,
        createdAt: mem?.createdAt || s.updatedAt,
        summary: mem?.summary || '',
        intents: distinctTools,
        lastUserPreview: lastUser?.content?.slice(0, 80) || '',
        lastAssistantPreview: lastAssistant?.content?.slice(0, 80) || '',
      };
    }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  getSession(id) {
    const s = this.sessions.get(id);
    if (!s) return null;
    const mem = this.agent.memory.getSession(id);
    return {
      ...mem,
      id,
      currentGameId: s.currentGameId || null,
      updatedAt: s.updatedAt,
    };
  }

  reset(sessionId) {
    this.agent.reset(sessionId);
    this.sessions.delete(sessionId);
  }

  listTools() {
    return this.agent.tools.describe();
  }
}
