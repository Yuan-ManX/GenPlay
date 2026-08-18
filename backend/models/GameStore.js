/**
 * GameStore - 游戏数据存储层
 * 优先使用 Node 内置 SQLite（node:sqlite）持久化，
 * 若运行环境不支持则回退到 JSON 文件存储。
 * 提供完整 CRUD + 搜索 + 统计。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export class GameStore {
  constructor(dir) {
    this.dir = dir;
    this.db = null;
    this.ready = this.init();
  }

  async init() {
    await mkdir(this.dir, { recursive: true });
    const dbFile = join(this.dir, 'genplay.db');
    try {
      const { DatabaseSync } = await import('node:sqlite');
      this.db = new DatabaseSync(dbFile);
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS games (
          id TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_games_updated ON games(updated_at);
      `);
      this.mode = 'sqlite';
    } catch {
      this.mode = 'json';
      this.jsonFile = join(this.dir, 'games.json');
      this.cache = new Map();
      await this.loadJson();
    }
  }

  async loadJson() {
    try {
      const raw = await readFile(this.jsonFile, 'utf-8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach((g) => this.cache.set(g.id, g));
    } catch { /* 首次启动 */ }
  }

  async persistJson() {
    await writeFile(this.jsonFile, JSON.stringify(Array.from(this.cache.values()), null, 2), 'utf-8');
  }

  async create(data) {
    await this.ready;
    const now = new Date().toISOString();
    const game = {
      id: genId(),
      name: data.name || 'Untitled Game',
      genre: data.genre || 'adventure',
      description: data.description || '',
      platform: data.platform || 'web',
      status: data.status || 'draft',
      config: data.config || {},
      editLog: [],
      scripts: data.scripts || '',
      runCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    if (this.mode === 'sqlite') {
      this.db.prepare('INSERT INTO games (id, data, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(game.id, JSON.stringify(game), now, now);
    } else {
      this.cache.set(game.id, game);
      await this.persistJson();
    }
    return game;
  }

  async getById(id) {
    await this.ready;
    if (this.mode === 'sqlite') {
      const row = this.db.prepare('SELECT data FROM games WHERE id = ?').get(id);
      return row ? JSON.parse(row.data) : null;
    }
    return this.cache.get(id) || null;
  }

  async list({ search, status, genre } = {}) {
    await this.ready;
    let games;
    if (this.mode === 'sqlite') {
      const rows = this.db.prepare('SELECT data FROM games').all();
      games = rows.map((r) => JSON.parse(r.data));
    } else {
      games = Array.from(this.cache.values());
    }
    if (search) {
      const s = String(search).toLowerCase();
      games = games.filter((g) =>
        g.name.toLowerCase().includes(s) || (g.description || '').toLowerCase().includes(s)
      );
    }
    if (status) games = games.filter((g) => g.status === status);
    if (genre) games = games.filter((g) => g.genre === genre);
    return games.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async update(id, patch) {
    await this.ready;
    const game = await this.getById(id);
    if (!game) return null;
    const updated = { ...game, ...patch, id, updatedAt: new Date().toISOString() };
    if (this.mode === 'sqlite') {
      this.db.prepare('UPDATE games SET data = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(updated), updated.updatedAt, id);
    } else {
      this.cache.set(id, updated);
      await this.persistJson();
    }
    return updated;
  }

  async remove(id) {
    await this.ready;
    if (this.mode === 'sqlite') {
      const info = this.db.prepare('DELETE FROM games WHERE id = ?').run(id);
      return info.changes > 0;
    }
    const existed = this.cache.delete(id);
    if (existed) await this.persistJson();
    return existed;
  }

  async stats() {
    await this.ready;
    const games = await this.list();
    const byStatus = {};
    const byGenre = {};
    games.forEach((g) => {
      byStatus[g.status] = (byStatus[g.status] || 0) + 1;
      byGenre[g.genre] = (byGenre[g.genre] || 0) + 1;
    });
    return { total: games.length, byStatus, byGenre };
  }
}
