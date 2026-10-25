/**
 * MemoryStore - session memory with optional disk persistence.
 *
 * Responsibilities:
 * - keep a rolling window of messages per session
 * - compress long conversations into a semantic summary
 * - track intents for multi-turn coordination
 * - persist sessions to disk so the agent can recall earlier work across
 *   process restarts and across sessions
 * - expose keyword search over the whole memory for recall_memory
 */
import fs from 'node:fs';
import path from 'node:path';

const SAVE_DEBOUNCE_MS = 1200;
const MAX_PERSISTED_MESSAGES = 240;

export class MemoryStore {
  constructor(limit = 40, summarizeThreshold = 30, options = {}) {
    this.limit = limit;
    this.summarizeThreshold = summarizeThreshold;
    this.persistPath = options.persistPath || null;
    this.sessions = new Map();
    this._saveTimer = null;
    if (this.persistPath) this.load();
  }

  get(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) return [];
    return s.messages.slice(-this.limit);
  }

  /**
   * Full session view: summary + rolling window + intent timeline.
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
        summarizedCount: 0,
      });
    }
    const s = this.sessions.get(sessionId);
    const record = { ...entry, at: entry?.at || new Date(now).toISOString() };
    s.messages.push(record);
    s.updatedAt = now;
    if (entry.meta?.intent?.name) {
      s.intents.push({ name: entry.meta.intent.name, at: new Date(now).toISOString() });
    }
    // Compress older turns once the conversation grows past the threshold.
    if (s.messages.length > this.summarizeThreshold * 2) {
      this.summarize(sessionId);
    }
    this.trim(sessionId);
    this._scheduleSave();
  }

  /**
   * Context summary: collapses earlier turns into a short semantic digest so
   * long conversations keep their thread without exhausting the prompt window.
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
      .map((m) => String(m.content || '').slice(0, 60))
      .join(' | ');
    s.summary = `Session covered ${s.messages.length} turns. Topics: ${topics || 'conversation'}. Early requests: ${preview || '-'}.`;
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
    this._scheduleSave();
  }

  list() {
    const out = [];
    for (const [id, s] of this.sessions.entries()) {
      out.push({ sessionId: id, size: s.messages.length, updatedAt: s.updatedAt });
    }
    return out.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Keyword search across every session's messages.
   * Returns ranked snippets so the recall_memory tool can cite what was
   * discussed in earlier conversations, even after a restart.
   */
  search(query, limit = 8) {
    const tokens = tokenize(query);
    if (!tokens.length) return [];
    const hits = [];
    for (const [sessionId, s] of this.sessions.entries()) {
      const total = Math.max(1, s.messages.length);
      s.messages.forEach((message, index) => {
        const content = String(message?.content || '');
        if (!content) return;
        const lower = content.toLowerCase();
        let score = 0;
        for (const token of tokens) {
          if (lower.includes(token)) score += 1;
        }
        if (!score) return;
        // Slightly favor newer turns within a session.
        score += (index / total) * 0.5;
        hits.push({
          sessionId,
          role: message.role || 'user',
          content: content.slice(0, 240),
          score: Number(score.toFixed(2)),
          at: message.at || null,
        });
      });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, Math.max(1, limit));
  }

  /**
   * Aggregate stats for introspection surfaces.
   */
  stats() {
    let messageCount = 0;
    let oldest = null;
    let newest = null;
    for (const s of this.sessions.values()) {
      messageCount += s.messages.length;
      if (!oldest || s.createdAt < oldest) oldest = s.createdAt;
      if (!newest || s.updatedAt > newest) newest = s.updatedAt;
    }
    return {
      sessions: this.sessions.size,
      messages: messageCount,
      oldestAt: oldest ? new Date(oldest).toISOString() : null,
      newestAt: newest ? new Date(newest).toISOString() : null,
      persisted: Boolean(this.persistPath),
    };
  }

  // ---- Persistence ----

  load() {
    if (!this.persistPath) return;
    try {
      if (!fs.existsSync(this.persistPath)) return;
      const raw = fs.readFileSync(this.persistPath, 'utf8');
      const parsed = JSON.parse(raw);
      const sessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
      for (const entry of sessions) {
        if (!entry?.sessionId || !Array.isArray(entry.messages)) continue;
        this.sessions.set(entry.sessionId, {
          messages: entry.messages.slice(-MAX_PERSISTED_MESSAGES),
          summary: entry.summary || '',
          intents: Array.isArray(entry.intents) ? entry.intents : [],
          createdAt: entry.createdAt || Date.now(),
          updatedAt: entry.updatedAt || Date.now(),
          summarizedCount: entry.summarizedCount || 0,
        });
      }
    } catch (err) {
      // Corrupted or unreadable memory file should never block startup.
      console.warn('[GenPlay memory] load skipped:', err.message);
    }
  }

  save() {
    if (!this.persistPath) return;
    try {
      const sessions = [];
      for (const [sessionId, s] of this.sessions.entries()) {
        sessions.push({
          sessionId,
          summary: s.summary || '',
          intents: s.intents.slice(-40),
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
          summarizedCount: s.summarizedCount || 0,
          messages: s.messages.slice(-MAX_PERSISTED_MESSAGES),
        });
      }
      const dir = path.dirname(this.persistPath);
      fs.mkdirSync(dir, { recursive: true });
      const payload = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), sessions });
      const tmp = `${this.persistPath}.tmp`;
      fs.writeFileSync(tmp, payload, 'utf8');
      fs.renameSync(tmp, this.persistPath);
    } catch (err) {
      console.warn('[GenPlay memory] save failed:', err.message);
    }
  }

  _scheduleSave() {
    if (!this.persistPath) return;
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.save();
    }, SAVE_DEBOUNCE_MS);
    this._saveTimer.unref?.();
  }
}

/**
 * Tokenize a query for keyword matching. Latin words are kept whole;
 * CJK runs additionally produce character bigrams so partial phrases match.
 */
function tokenize(query) {
  const text = String(query || '').toLowerCase().trim();
  if (!text) return [];
  const tokens = new Set();
  const parts = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  for (const part of parts) {
    if (part.length <= 1) {
      tokens.add(part);
      continue;
    }
    tokens.add(part);
    if (/[\u4e00-\u9fa5]/.test(part)) {
      for (let i = 0; i < part.length - 1; i++) tokens.add(part.slice(i, i + 2));
    }
  }
  return Array.from(tokens);
}
