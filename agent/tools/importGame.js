/**
 * import_game - Portable bundle importer.
 * Ingests a bundle produced by export_game (or compatible external
 * JSON) and creates a fresh game record with a new id. The original
 * sourceGameId is preserved in meta for provenance tracking.
 * Supports both object and stringified-JSON input so the Agent can
 * accept pasted bundles from chat or uploaded payloads.
 */
const BUNDLE_VERSION = 1;

export function importGameTool({ gameService }) {
  return {
    name: 'import_game',
    description:
      'Import a portable game bundle (from export_game or external JSON) and create a new game. Accepts bundle object or JSON string.',
    parameters: {
      type: 'object',
      required: ['bundle'],
      properties: {
        bundle: {
          oneOf: [{ type: 'object' }, { type: 'string' }],
          description: 'Game bundle object or JSON string from export_game',
        },
        newName: {
          type: 'string',
          description: 'Optional override name for the imported game',
        },
        owner: { type: 'string', description: 'Optional owner id for the new game' },
      },
    },
    async execute(args) {
      if (!gameService) return { ok: false, error: 'Game service unavailable' };
      let { bundle, newName, owner } = args;
      if (!bundle) return { ok: false, error: 'bundle required' };

      // Accept both object and stringified JSON.
      let parsed = bundle;
      if (typeof bundle === 'string') {
        try {
          parsed = JSON.parse(bundle);
        } catch {
          return { ok: false, error: 'Invalid bundle JSON', summary: '导入失败：JSON 格式错误' };
        }
      }

      // Tolerate a raw game object (no bundle wrapper) for ergonomic imports.
      const gameData = parsed.game || parsed;
      if (!gameData || (!gameData.name && !gameData.genre)) {
        return { ok: false, error: 'Bundle missing game data', summary: '导入失败：包内缺少游戏数据' };
      }

      const sourceId = parsed.sourceGameId || parsed.id || null;
      const meta = { ...(gameData.meta || {}) };
      if (sourceId) meta.importedFrom = sourceId;
      meta.importedAt = new Date().toISOString();

      const created = await gameService.create({
        name: newName || gameData.name || 'Imported Game',
        genre: gameData.genre || 'adventure',
        description: gameData.description || '',
        platform: gameData.platform || 'web',
        owner: owner || null,
        config: gameData.config || {},
        scripts: gameData.scripts || '',
        theme: gameData.theme || null,
        scenario: gameData.scenario || null,
        meta,
      });

      // Persist extended fields that create() does not accept directly.
      const extra = {};
      if (gameData.assets?.length) extra.assets = gameData.assets;
      if (gameData.npcs?.length) extra.npcs = gameData.npcs;
      if (gameData.nodeGraph) extra.nodeGraph = gameData.nodeGraph;
      const updated = Object.keys(extra).length
        ? await gameService.update(created.id, extra)
        : created;

      return {
        ok: true,
        summary: `已导入游戏《${updated.name}》（新 ID: ${updated.id}）`,
        game: updated,
        sourceGameId: sourceId,
        bundleVersion: parsed.version || BUNDLE_VERSION,
        editorActions: [
          { type: 'studio:load-game', payload: { gameId: updated.id } },
          { type: 'sidebar:refresh-list', payload: { added: updated.id } },
        ],
      };
    },
  };
}
