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
    return Array.from(this.sessions.values());
  }

  getSession(id) {
    const s = this.sessions.get(id);
    if (!s) return null;
    return this.agent.memory.getSession(id);
  }

  reset(sessionId) {
    this.agent.reset(sessionId);
    this.sessions.delete(sessionId);
  }

  listTools() {
    return this.agent.tools.describe();
  }
}
