/**
 * MemoryStore - 会话上下文记忆
 * 按 sessionId 保存消息历史，支持：
 * - 最近 N 条窗口截断
 * - 长会话自动摘要（多轮上下文压缩）
 * - 会话主题/意图跟踪，支撑多轮交互
 */
export class MemoryStore {
  constructor(limit = 40, summarizeThreshold = 30) {
    this.limit = limit;
    this.summarizeThreshold = summarizeThreshold;
    this.sessions = new Map();
  }

  get(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) return [];
    return s.messages.slice(-this.limit);
  }

  /**
   * 获取会话结构：包含摘要与消息
   */
  getSession(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) return { sessionId, summary: '', messages: [], intents: [] };
    return {
      sessionId,
      summary: s.summary,
      messages: s.messages.slice(-this.limit),
      intents: s.intents,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  push(sessionId, entry) {
    const now = Date.now();
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        messages: [],
        summary: '',
        intents: [],
        createdAt: now,
        updatedAt: now,
      });
    }
    const s = this.sessions.get(sessionId);
    s.messages.push(entry);
    s.updatedAt = now;
    if (entry.meta?.intent?.name) {
      s.intents.push({ name: entry.meta.intent.name, at: new Date(now).toISOString() });
    }
    // 超长自动摘要压缩
    if (s.messages.length > this.summarizeThreshold * 2) {
      this.summarize(sessionId);
    }
    this.trim(sessionId);
  }

  /**
   * 上下文摘要：把较早的对话压缩为一段语义概要，
   * 保留近窗口完整消息，支撑长对话的记忆延续。
   */
  summarize(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s || s.messages.length <= this.summarizeThreshold) return;
    const oldCount = s.messages.length - this.summarizeThreshold;
    const oldPart = s.messages.slice(0, oldCount);
    const keep = s.messages.slice(oldCount);
    const intents = s.intents.slice(-8);
    const topics = Array.from(new Set(intents.map((i) => i.name))).join(', ');
    const preview = oldPart
      .filter((m) => m.role === 'user')
      .slice(-6)
      .map((m) => m.content.slice(0, 60))
      .join(' | ');
    s.summary = `本会话已进行 ${s.messages.length} 轮。已覆盖主题：${topics || '对话'}。早期用户需求摘要：${preview || '—'}。`;
    s.messages = keep;
    s.summarizedCount = (s.summarizedCount || 0) + oldCount;
  }

  trim(sessionId) {
    const s = this.sessions.get(sessionId);
    if (s && s.messages.length > this.limit + 10) {
      s.messages = s.messages.slice(-this.limit);
    }
  }

  clear(sessionId) {
    this.sessions.delete(sessionId);
  }

  list() {
    const out = [];
    for (const [id, s] of this.sessions.entries()) {
      out.push({ sessionId: id, size: s.messages.length, updatedAt: s.updatedAt });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }
}
