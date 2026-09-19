/**
 * GameService - Game business service layer.
 * Adds publish/community listing, asset library operations,
 * and multiplayer toggle endpoints to the CRUD + run.
 */
import { GameStore } from '../models/GameStore.js';
import { SharedAssetLibrary } from '../../agent/templates/assetLibrary.js';

export class GameService {
  constructor(dataDir) {
    this.store = new GameStore(dataDir);
    this.assetLibrary = new SharedAssetLibrary();
  }

  create(data) { return this.store.create(data); }
  getById(id) { return this.store.getById(id); }
  list(filters = {}) { return this.store.list(filters); }
  stats() { return this.store.stats(); }
  update(id, patch) { return this.store.update(id, patch); }
  remove(id) { return this.store.remove(id); }

  async run(id) {
    const game = await this.store.getById(id);
    if (!game) return { ok: false, error: 'Game not found' };
    const issues = [];
    if (!game.genre) issues.push('Missing genre');
    if (!game.scripts) issues.push('Missing executable logic scripts');
    if (game.genre === 'tower' && !game.config?.path?.points?.length) issues.push('Tower defense missing path points');
    if (game.genre === 'deckbuilder' && !game.config?.cards?.length) issues.push('Deckbuilder missing card definitions');
    if (game.genre === 'auto_battler' && !game.config?.units?.length) issues.push('Auto battler missing unit pool');
    if (game.genre === 'visual_novel' && !game.config?.characters?.length) issues.push('Visual novel missing character roster');
    const result = {
      gameId: id,
      status: issues.length ? 'warning' : 'ok',
      durationMs: 12 + Math.floor(Math.random() * 40),
      issues,
      logs: [
        `[boot] Launching game ${game.name}`,
        `[run] Main loop ${issues.length ? 'warnings present' : 'running normally'}`,
      ],
    };
    await this.store.update(id, { lastRun: result, runCount: (game.runCount || 0) + 1 });
    return { ok: true, result };
  }

  // ---- Publish / Community ----
  publish(id, options = {}) { return this.store.publishGame(id, options); }
  listPublished(filters = {}) { return this.store.listPublished(filters); }
  getPublished(code) { return this.store.getPublished(code); }
  bumpPlay(code) { return this.store.bumpPublishedPlay(code); }
  likePublished(code) { return this.store.likePublished(code); }

  // ---- Asset store integration ----
  searchAssetsLibrary(query = {}) { return { ok: true, results: this.assetLibrary.search(query), totalTags: this.assetLibrary.allTags().length }; }
  listThemes() { return this.assetLibrary.listThemes(); }
  listScenarios() { return this.assetLibrary.listScenarios(); }
  listSnippets() { return this.assetLibrary.listSnippets(); }
  listNodePresets() { return this.assetLibrary.listNodePresets(); }
  installSnippet(gameId, snippetKey) {
    return (async () => {
      const game = await this.getById(gameId);
      if (!game) return { ok: false, error: 'Game not found' };
      const patch = this.assetLibrary.installSnippet(game, snippetKey);
      if (!patch) return { ok: false, error: 'Snippet not found' };
      const updated = await this.update(gameId, patch);
      return { ok: true, applied: true, game: updated };
    })();
  }

  addAsset(asset) { return this.store.addAsset(asset); }
  listAssets(filters) { return this.store.listAssets(filters); }
  installAsset(id) { return this.store.bumpAssetInstall(id); }

  // ---- Multiplayer toggles ----
  async setMultiplayer(id, config) {
    const game = await this.getById(id);
    if (!game) return { ok: false, error: 'Game not found' };
    const prev = game.config?.meta?.multiplayer || { mode: 'off', maxPlayers: 1 };
    const next = { ...prev, ...config };
    const meta = { ...(game.config?.meta || {}), multiplayer: next };
    const updated = await this.update(id, { config: { ...(game.config || {}), meta } });
    return { ok: true, multiplayer: next, game: updated };
  }
}
