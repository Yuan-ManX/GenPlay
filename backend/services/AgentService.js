/**
 * AgentService - 连接 Agent 核心层与后端的数据服务
 * 将游戏数据服务注入 Agent 工具链，实现 三层无缝联动。
 */
import { createAgent } from '../../agent/index.js';
import config from '../config/index.js';

export class AgentService {
  constructor(gameService) {
    // 将后端数据服务注入 Agent 工具链
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
    this.sessions.set(sid, { id: sid, messages: this.agent.memory.get(sid), updatedAt: new Date().toISOString() });
    return { ...result, sessionId: sid };
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
}
