/**
 * GameStore - Persistence layer for games + published community index
 * + asset store records. Uses Node built-in SQLite when available,
 * otherwise falls back to JSON files in the configured data directory.
 * Provides: CRUD, search, stats, publish listing, asset store CRUD.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

function genId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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
        CREATE TABLE IF NOT EXISTS published (
          share_code TEXT PRIMARY KEY,
          game_id TEXT NOT NULL,
          author TEXT,
          title TEXT,
          description TEXT,
          genre TEXT,
          data TEXT,
          created_at TEXT NOT NULL,
          plays INTEGER DEFAULT 0,
          likes INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_published_created ON published(created_at);
        CREATE TABLE IF NOT EXISTS assets (
          id TEXT PRIMARY KEY,
          kind TEXT,
          owner TEXT,
          tags TEXT,
          data TEXT,
          created_at TEXT NOT NULL,
          installs INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets(kind);
        CREATE TABLE IF NOT EXISTS community_events (
          id TEXT PRIMARY KEY,
          game_id TEXT,
          kind TEXT,
          payload TEXT,
          created_at TEXT NOT NULL
        );
      `);
      this.mode = 'sqlite';
    } catch {
      this.mode = 'json';
      this.jsonFile = join(this.dir, 'games.json');
      this.publishedFile = join(this.dir, 'published.json');
      this.assetsFile = join(this.dir, 'assets.json');
      this.cache = new Map();
      this.published = new Map();
      this.assets = new Map();
      await this.loadJson();
    }
  }

  async loadJson() {
    for (const [path, cache] of [
      [this.jsonFile, this.cache],
      [this.publishedFile, this.published],
      [this.assetsFile, this.assets],
    ]) {
      try {
        const raw = await readFile(path, 'utf-8');
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) arr.forEach((g) => cache.set(g.id || g.share_code, g));
      } catch { /* first boot */ }
    }
  }

  async persistJson() {
    await writeFile(this.jsonFile, JSON.stringify(Array.from(this.cache.values()), null, 2), 'utf-8');
    await writeFile(this.publishedFile, JSON.stringify(Array.from(this.published.values()), null, 2), 'utf-8');
    await writeFile(this.assetsFile, JSON.stringify(Array.from(this.assets.values()), null, 2), 'utf-8');
  }

  // ---- Games ----
  async create(data) {
    await this.ready;
    const now = new Date().toISOString();
    const game = {
      id: genId('g_'),
      name: data.name || 'Untitled Game',
      genre: data.genre || 'adventure',
      description: data.description || '',
      platform: data.platform || 'web',
      status: data.status || 'draft',
      owner: data.owner || null,
      config: data.config || {},
      editLog: [],
      scripts: data.scripts || '',
      theme: data.theme || null,
      scenario: data.scenario || null,
      meta: data.meta || {},
      runCount: 0,
      lastRun: null,
      shareCode: null,
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

  async list({ search, status, genre, owner, limit = 100 } = {}) {
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
    if (owner) games = games.filter((g) => g.owner === owner);
    return games.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, limit);
  }

  async update(id, patch) {
    await this.ready;
    const game = await this.getById(id);
    if (!game) return null;
    // Deep merge for config so partial config patches don't wipe sibling keys
    const mergedConfig = (patch.config && game.config)
      ? deepMerge(game.config, patch.config)
      : (patch.config || game.config);
    const updated = {
      ...game,
      ...patch,
      config: mergedConfig,
      id,
      updatedAt: new Date().toISOString(),
    };
    if (updated.editLog && game.editLog && updated.editLog === game.editLog) {
      // ensure we don't accidentally truncate editLog if caller omitted it
    } else if (patch.editLog) {
      updated.editLog = patch.editLog;
    } else {
      updated.editLog = [...(game.editLog || []), { at: updated.updatedAt, patch: Object.keys(patch) }];
    }
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
    const games = await this.list({ limit: Infinity });
    const publishedCount = this.mode === 'sqlite'
      ? (this.db.prepare('SELECT COUNT(*) AS c FROM published').get().c)
      : this.published.size;
    const byStatus = {};
    const byGenre = {};
    games.forEach((g) => {
      byStatus[g.status] = (byStatus[g.status] || 0) + 1;
      byGenre[g.genre] = (byGenre[g.genre] || 0) + 1;
    });
    return { total: games.length, published: publishedCount, byStatus, byGenre };
  }

  // ---- Publish / Community Listing ----
  async publishGame(gameId, { title, description, author }) {
    await this.ready;
    const game = await this.getById(gameId);
    if (!game) return null;
    // gp_ prefix keeps share codes recognisable and lets the planner's remix
    // pattern (gp_[a-z0-9]{4,}) match community share codes consistently.
    const shareCode = genId('gp_');
    const now = new Date().toISOString();
    const rec = {
      share_code: shareCode,
      game_id: gameId,
      author: author || 'Anonymous',
      title: title || game.name,
      description: description || game.description || '',
      genre: game.genre,
      data: {
        genre: game.genre,
        config: game.config,
        scripts: game.scripts,
        theme: game.theme,
        scenario: game.scenario,
      },
      created_at: now,
      plays: 0,
      likes: 0,
    };
    if (this.mode === 'sqlite') {
      this.db.prepare(`
        INSERT INTO published (share_code, game_id, author, title, description, genre, data, created_at, plays, likes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
      `).run(rec.share_code, rec.game_id, rec.author, rec.title, rec.description, rec.genre, JSON.stringify(rec.data), now);
    } else {
      this.published.set(shareCode, rec);
      await this.persistJson();
    }
    // Tag the game itself as published
    await this.update(gameId, { status: 'published', shareCode });
    return { shareCode, publishedAt: now, title: rec.title, author: rec.author };
  }

  async listPublished({ genre, sort = 'recent', search, limit = 50 } = {}) {
    await this.ready;
    let rows;
    if (this.mode === 'sqlite') {
      const r = this.db.prepare('SELECT share_code, game_id, author, title, description, genre, created_at, plays, likes FROM published').all();
      rows = r.map((x) => ({
        shareCode: x.share_code,
        gameId: x.game_id,
        author: x.author,
        title: x.title,
        description: x.description,
        genre: x.genre,
        createdAt: x.created_at,
        plays: x.plays,
        likes: x.likes,
      }));
    } else {
      rows = Array.from(this.published.values()).map((x) => ({
        shareCode: x.share_code,
        gameId: x.game_id,
        author: x.author,
        title: x.title,
        description: x.description,
        genre: x.genre,
        createdAt: x.created_at,
        plays: x.plays,
        likes: x.likes,
      }));
    }
    if (genre) rows = rows.filter((r) => r.genre === genre);
    if (search) {
      const s = String(search).toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(s) || (r.description || '').toLowerCase().includes(s));
    }
    rows.sort((a, b) => {
      if (sort === 'popular') return b.plays + b.likes * 5 - (a.plays + a.likes * 5);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return rows.slice(0, limit);
  }

  async getPublished(shareCode) {
    await this.ready;
    if (this.mode === 'sqlite') {
      const row = this.db.prepare('SELECT * FROM published WHERE share_code = ?').get(shareCode);
      if (!row) return null;
      return { ...row, data: JSON.parse(row.data) };
    }
    return this.published.get(shareCode) || null;
  }

  async bumpPublishedPlay(shareCode) {
    await this.ready;
    if (this.mode === 'sqlite') {
      this.db.prepare('UPDATE published SET plays = plays + 1 WHERE share_code = ?').run(shareCode);
    } else {
      const p = this.published.get(shareCode);
      if (p) { p.plays = (p.plays || 0) + 1; await this.persistJson(); }
    }
    return true;
  }

  async likePublished(shareCode) {
    await this.ready;
    if (this.mode === 'sqlite') {
      this.db.prepare('UPDATE published SET likes = likes + 1 WHERE share_code = ?').run(shareCode);
    } else {
      const p = this.published.get(shareCode);
      if (p) { p.likes = (p.likes || 0) + 1; await this.persistJson(); }
    }
    return true;
  }

  // ---- Asset Store ----
  async addAsset(asset) {
    await this.ready;
    const id = asset.id || genId('a_');
    const now = new Date().toISOString();
    const rec = {
      id,
      kind: asset.kind || 'custom',
      owner: asset.owner || 'user',
      tags: (asset.tags || []).join(','),
      data: asset.data || {},
      created_at: now,
      installs: 0,
    };
    if (this.mode === 'sqlite') {
      this.db.prepare('INSERT INTO assets (id, kind, owner, tags, data, created_at, installs) VALUES (?,?,?,?,?,?,0)')
        .run(rec.id, rec.kind, rec.owner, rec.tags, JSON.stringify(rec.data), now);
    } else {
      this.assets.set(id, { ...rec, tags: asset.tags || [], createdAt: now });
      await this.persistJson();
    }
    return { id, createdAt: now };
  }

  async listAssets({ kind, tag, search, limit = 100 } = {}) {
    await this.ready;
    let rows;
    if (this.mode === 'sqlite') {
      rows = this.db.prepare('SELECT * FROM assets').all().map((r) => ({
        id: r.id, kind: r.kind, owner: r.owner,
        tags: (r.tags || '').split(',').filter(Boolean),
        data: JSON.parse(r.data),
        createdAt: r.created_at,
        installs: r.installs,
      }));
    } else {
      rows = Array.from(this.assets.values());
    }
    if (kind) rows = rows.filter((r) => r.kind === kind);
    if (tag) rows = rows.filter((r) => (r.tags || []).includes(tag));
    if (search) {
      const s = String(search).toLowerCase();
      rows = rows.filter((r) =>
        r.id.toLowerCase().includes(s) || (r.tags || []).some((t) => t.toLowerCase().includes(s))
      );
    }
    return rows.slice(0, limit);
  }

  async bumpAssetInstall(id) {
    await this.ready;
    if (this.mode === 'sqlite') {
      this.db.prepare('UPDATE assets SET installs = installs + 1 WHERE id = ?').run(id);
    } else {
      const a = this.assets.get(id);
      if (a) { a.installs = (a.installs || 0) + 1; await this.persistJson(); }
    }
    return true;
  }
}

function deepMerge(base, extra) {
  if (typeof base !== 'object' || base === null || typeof extra !== 'object' || extra === null) {
    return extra === undefined ? base : extra;
  }
  if (Array.isArray(base) || Array.isArray(extra)) {
    return extra === undefined ? base : extra;
  }
  const out = { ...base };
  for (const key of Object.keys(extra)) {
    out[key] = deepMerge(base[key], extra[key]);
  }
  return out;
}

export default GameStore;
