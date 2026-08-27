/**
 * ArtifactMemory - Persistent cross-session artifact tracking for GenPlay.
 * Captures every game/asset/config created by the Agent so it can:
 *   - reference prior creations in follow-up conversations (e.g. "reuse the cyberpunk theme from that space shooter")
 *   - surface a personal "workbench" of reusable components (assets, rules, snippets)
 *   - power procedural ideation ("you like roguelikes, here is a twist")
 */
export class ArtifactMemory {
  constructor() {
    this.games = new Map();          // gameId -> full snapshot with tags
    this.themes = new Map();         // themeKey -> theme definition + usage count
    this.scenarios = new Map();      // scenarioKey -> scenario + usage count
    this.snippets = new Map();       // snippetKey -> DSL script fragment + tags
    this.assets = new Map();         // assetId -> { type, prompt, ref, tags }
    this.tagsIndex = new Map();      // tag -> Set<artifactKey>
    // Cross-session user preference signals aggregated from every interaction.
    // These let the agent personalize future suggestions without asking.
    this.preferences = {
      genreCounts: new Map(),        // genre -> create count
      themeCounts: new Map(),        // theme key -> apply count
      difficultyCounts: new Map(),   // difficulty -> tweak count
      toolCounts: new Map(),         // tool name -> invocation count
      styleKeywords: [],             // free-text style descriptors extracted from messages
      sessionCount: 0,
      lastActiveAt: null,
    };
  }

  // ---- Games ----
  recordGame(game, tags = []) {
    if (!game?.id) return null;
    const entry = {
      id: game.id,
      name: game.name,
      genre: game.genre,
      description: game.description || '',
      theme: game.theme?.key || null,
      scenario: game.scenario?.key || null,
      config: game.config || {},
      scripts: game.scripts || '',
      createdAt: game.createdAt || Date.now(),
      tags: Array.from(new Set([game.genre, ...tags])),
      version: (this.games.get(game.id)?.version || 0) + 1,
    };
    this.games.set(game.id, entry);
    this._indexTags(entry.id, 'game', entry.tags);
    // Track genre preference
    this._bump(this.preferences.genreCounts, game.genre);
    this._touchSession();
    return entry;
  }

  getGame(id) { return this.games.get(id) || null; }

  searchGames(query = {}, limit = 10) {
    const entries = Array.from(this.games.values());
    const filtered = entries.filter((g) => {
      if (query.genre && g.genre !== query.genre) return false;
      if (query.tag && !g.tags.includes(query.tag)) return false;
      if (query.text) {
        const q = String(query.text).toLowerCase();
        if (!(g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q))) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  // ---- Themes ----
  recordTheme(theme, usageGameId = null) {
    if (!theme?.key) return null;
    const existing = this.themes.get(theme.key) || { ...theme, usageCount: 0, games: [] };
    existing.usageCount += 1;
    if (usageGameId && !existing.games.includes(usageGameId)) existing.games.push(usageGameId);
    existing.definition = theme.definition || theme;
    this.themes.set(theme.key, existing);
    this._indexTags(theme.key, 'theme', theme.tags || [theme.key]);
    // Track theme preference
    this._bump(this.preferences.themeCounts, theme.key);
    this._touchSession();
    return existing;
  }

  listThemes() { return Array.from(this.themes.values()).sort((a, b) => b.usageCount - a.usageCount); }

  // ---- Scenarios ----
  recordScenario(scenario, usageGameId = null) {
    if (!scenario?.key) return null;
    const existing = this.scenarios.get(scenario.key) || { ...scenario, usageCount: 0, games: [] };
    existing.usageCount += 1;
    if (usageGameId && !existing.games.includes(usageGameId)) existing.games.push(usageGameId);
    this.scenarios.set(scenario.key, existing);
    this._indexTags(scenario.key, 'scenario', scenario.tags || [scenario.key]);
    return existing;
  }

  listScenarios() { return Array.from(this.scenarios.values()).sort((a, b) => b.usageCount - a.usageCount); }

  // ---- Snippets (reusable DSL fragments) ----
  recordSnippet(key, script, tags = []) {
    const entry = { key, script, tags, usageCount: this.snippets.get(key)?.usageCount || 0 };
    this.snippets.set(key, entry);
    this._indexTags(key, 'snippet', tags);
    return entry;
  }

  searchSnippets(tag) {
    return Array.from(this.snippets.values()).filter((s) => !tag || s.tags.includes(tag));
  }

  // ---- Assets ----
  recordAsset(id, asset) {
    const entry = { id, ...asset, createdAt: Date.now() };
    this.assets.set(id, entry);
    this._indexTags(id, 'asset', asset.tags || []);
    return entry;
  }

  listAssets(type = null) {
    return Array.from(this.assets.values()).filter((a) => !type || a.type === type);
  }

  // ---- Tags index ----
  _indexTags(key, kind, tags) {
    for (const t of tags || []) {
      const composite = `${kind}:${t}`;
      if (!this.tagsIndex.has(composite)) this.tagsIndex.set(composite, new Set());
      this.tagsIndex.get(composite).add(key);
    }
  }

  searchByTag(tag, kind = null) {
    const out = [];
    for (const [composite, set] of this.tagsIndex.entries()) {
      const [k, t] = composite.split(':');
      if (t !== tag) continue;
      if (kind && k !== kind) continue;
      for (const id of set) out.push({ kind: k, id });
    }
    return out;
  }

  /**
   * Build creativity context string for LLM ideation prompt.
   * Summarizes recent creations + top reused themes/scenarios so the
   * creative tool can propose variations aligned with user taste.
   * Merges cross-session preference signals (favorite genres, themes,
   * difficulty bias) so suggestions feel personalized over time.
   */
  creativityContext() {
    const recentGames = this.searchGames({}, 5);
    const topThemes = this.listThemes().slice(0, 3);
    const topScenarios = this.listScenarios().slice(0, 3);
    // Use preference counts (cross-session) as the source of truth for
    // "favorites" — falls back to recent-game genres if no preferences yet.
    const genreRanking = this._topKeys(this.preferences.genreCounts, 5);
    const genres = genreRanking.length
      ? genreRanking
      : Array.from(new Set(recentGames.map((g) => g.genre)));
    const themeRanking = this._topKeys(this.preferences.themeCounts, 3);
    const difficultyRanking = this._topKeys(this.preferences.difficultyCounts, 1);
    return {
      recentGames: recentGames.map((g) => ({ id: g.id, name: g.name, genre: g.genre })),
      favoriteGenres: genres,
      favoriteThemes: themeRanking.length ? themeRanking : topThemes.map((t) => t.key),
      topScenarios: topScenarios.map((s) => s.key),
      preferredDifficulty: difficultyRanking[0] || null,
      totalGames: this.games.size,
      totalSessions: this.preferences.sessionCount,
      styleKeywords: this.preferences.styleKeywords.slice(-10),
    };
  }

  /**
   * Record a tool invocation for preference tracking. Extracts implicit
   * signals like difficulty tweaks and style keywords from the args.
   */
  recordToolUsage(toolName, args = {}) {
    this._bump(this.preferences.toolCounts, toolName);
    // Difficulty preference: track tweak patterns
    if (toolName === 'tweak_params' && args.difficulty) {
      this._bump(this.preferences.difficultyCounts, args.difficulty);
    }
    if (toolName === 'remix_game' && args.tweak) {
      this._bump(this.preferences.difficultyCounts, args.tweak);
    }
    // Style keyword extraction from theme application
    if (toolName === 'apply_style_theme' && args.theme) {
      const kw = String(args.theme).toLowerCase();
      if (!this.preferences.styleKeywords.includes(kw)) {
        this.preferences.styleKeywords.push(kw);
      }
    }
    this._touchSession();
  }

  /**
   * Produce a concise preference summary for the LLM system prompt so
   * the agent can personalize tone and suggestions without extra calls.
   */
  preferenceSummary() {
    const cc = this.creativityContext();
    const parts = [];
    if (cc.favoriteGenres?.length) parts.push(`喜爱类型: ${cc.favoriteGenres.slice(0, 3).join(', ')}`);
    if (cc.favoriteThemes?.length) parts.push(`偏好风格: ${cc.favoriteThemes.join(', ')}`);
    if (cc.preferredDifficulty) parts.push(`难度倾向: ${cc.preferredDifficulty}`);
    if (cc.totalGames) parts.push(`累计创作: ${cc.totalGames} 款`);
    if (cc.totalSessions) parts.push(`会话数: ${cc.totalSessions}`);
    return parts.join('; ');
  }

  // ---- Internal helpers for preference tracking ----
  _bump(map, key) {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  }

  _topKeys(map, n) {
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k]) => k);
  }

  _touchSession() {
    this.preferences.sessionCount = (this.preferences.sessionCount || 0) + 1;
    this.preferences.lastActiveAt = new Date().toISOString();
  }

  export() {
    return {
      games: Object.fromEntries(this.games),
      themes: Object.fromEntries(this.themes),
      scenarios: Object.fromEntries(this.scenarios),
      snippets: Object.fromEntries(this.snippets),
      assets: Object.fromEntries(this.assets),
    };
  }
}
