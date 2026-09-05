/**
 * export_game - Portable bundle exporter.
 * Serializes a full game record (config, scripts, theme, scenario,
 * meta, assets, npcs, nodeGraph) into a self-contained JSON bundle
 * that can be re-imported via import_game, shared offline, or archived.
 * The bundle carries a schema version so future migrations stay safe.
 */
const BUNDLE_VERSION = 1;

export function exportGameTool({ gameService }) {
  return {
    name: 'export_game',
    description:
      'Export a game into a portable JSON bundle (config, scripts, theme, scenario, meta, assets, npcs, nodeGraph). Use for backup, sharing, or migration.',
    parameters: {
      type: 'object',
      required: ['gameId'],
      properties: {
        gameId: { type: 'string', description: 'Target game ID to export' },
        includeRunHistory: {
          type: 'boolean',
          description: 'Whether to include lastRun + runCount in the bundle (default false)',
        },
      },
    },
    async execute({ gameId, includeRunHistory = false }) {
      if (!gameService) return { ok: false, error: 'Game service unavailable' };
      if (!gameId) return { ok: false, error: 'gameId required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: 'Game not found', summary: '导出失败：游戏不存在' };

      const bundle = {
        bundle: 'genplay-game',
        version: BUNDLE_VERSION,
        exportedAt: new Date().toISOString(),
        sourceGameId: game.id,
        game: {
          name: game.name,
          genre: game.genre,
          description: game.description,
          platform: game.platform,
          config: game.config || {},
          scripts: game.scripts || '',
          theme: game.theme || null,
          scenario: game.scenario || null,
          meta: game.meta || {},
          assets: game.assets || [],
          npcs: game.npcs || [],
          nodeGraph: game.nodeGraph || null,
        },
      };

      if (includeRunHistory) {
        bundle.game.runCount = game.runCount || 0;
        bundle.game.lastRun = game.lastRun || null;
      }

      const json = JSON.stringify(bundle);
      const sizeKb = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(2);

      return {
        ok: true,
        summary: `已导出《${game.name}》游戏包（${sizeKb} KB）`,
        bundle,
        bundleJson: json,
        sizeKb: parseFloat(sizeKb),
        editorActions: [
          { type: 'studio:export-game', payload: { gameId, bundle } },
        ],
      };
    },
  };
}
