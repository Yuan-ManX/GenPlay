/**
 * manage_asset - Add, update, or remove a single asset in game.assets.
 * Asset types: sprite, sound, music, ui. Returns the updated asset list
 * and emits a live editor action for the studio assets tab.
 */

const ASSET_TYPES = ['sprite', 'sound', 'music', 'ui'];

export function manageAssetTool({ gameService }) {
  return {
    name: 'manage_asset',
    description: 'Add, update, or remove a single game asset (sprite/sound/music/ui). Controls name, type and description.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        action: { type: 'string', description: 'add | update | remove' },
        assetId: { type: 'string', description: 'Required for update/remove' },
        name: { type: 'string' },
        assetType: { type: 'string', description: 'sprite | sound | music | ui' },
        description: { type: 'string' },
      },
      required: ['gameId', 'action'],
    },
    async execute({ gameId, action, assetId, name, assetType, description, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      const act = (action || '').toLowerCase();
      if (!['add', 'update', 'remove'].includes(act)) {
        return { ok: false, error: 'action must be add | update | remove' };
      }

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const assets = Array.isArray(game.assets) ? structuredClone(game.assets) : [];
      let changed = false;
      let target = null;

      if (act === 'add') {
        const type = (assetType && ASSET_TYPES.includes(assetType)) ? assetType : 'sprite';
        target = {
          id: assetId || `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
          name: name || `${type}_${assets.length + 1}`,
          type,
          description: description || `${type} asset for ${game.name}`,
          createdAt: new Date().toISOString(),
        };
        assets.push(target);
        changed = true;
      } else {
        const idx = assets.findIndex((a) => a.id === assetId || a.name === assetId);
        if (idx === -1) return { ok: false, error: `Asset not found: ${assetId}` };
        target = assets[idx];
        if (act === 'update') {
          if (name) target.name = name;
          if (assetType && ASSET_TYPES.includes(assetType)) target.type = assetType;
          if (description) target.description = description;
          changed = true;
        } else { // remove
          assets.splice(idx, 1);
          changed = true;
        }
      }

      let updated = game;
      if (changed) {
        updated = await gameService.update(gameId, { assets });
      }

      const editorActions = [{
        type: 'studio:patch-assets',
        gameId,
        payload: { action: act, asset: target, assets },
      }];

      const summary = act === 'add'
        ? `已添加资产「${target.name}」（${target.type}）`
        : act === 'update'
          ? `已更新资产「${target.name}」`
          : `已移除资产「${target.name}」`;

      return {
        ok: true,
        game: updated,
        assets,
        asset: target,
        editorActions,
        summary,
      };
    },
  };
}
