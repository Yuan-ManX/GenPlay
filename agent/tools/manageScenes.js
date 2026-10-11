/**
 * manage_scenes - Multi-scene / multi-level management.
 * Stores an ordered list of scenes on game.scenes. Each scene has an id, name,
 * type (e.g. "menu", "level", "boss", "cutscene"), background, and an optional
 * config override. Platformer, metroidvania and adventure games benefit from
 * multiple scenes that the agent can add, reorder, update or remove.
 */

const SCENE_TYPES = ['menu', 'level', 'boss', 'cutscene', 'shop', 'gameover', 'victory'];

export function manageScenesTool({ gameService }) {
  return {
    name: 'manage_scenes',
    description: 'Manage multiple scenes/levels of a game. Add, update, remove, list or reorder scenes. Each scene has name, type, background and optional config override.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        action: { type: 'string', description: 'add | update | remove | list | reorder' },
        sceneId: { type: 'string', description: 'Required for update/remove' },
        name: { type: 'string' },
        sceneType: { type: 'string', description: 'menu | level | boss | cutscene | shop | gameover | victory' },
        background: { type: 'string', description: 'background color or image reference' },
        config: { type: 'object', description: 'per-scene config override (e.g. enemy count, time limit)' },
        order: { type: 'array', description: 'Array of scene ids in desired order (for reorder action)' },
        position: { type: 'number', description: 'Index at which to insert the new scene' },
      },
      required: ['gameId', 'action'],
    },
    async execute({ gameId, action, sceneId, name, sceneType, background, config, order, position, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      const act = (action || '').toLowerCase();
      if (!['add', 'update', 'remove', 'list', 'reorder'].includes(act)) {
        return { ok: false, error: 'action must be add | update | remove | list | reorder' };
      }

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const scenes = Array.isArray(game.scenes) ? structuredClone(game.scenes) : [];
      let changed = false;
      let target = null;
      let summary = '';

      if (act === 'list') {
        return {
          ok: true,
          scenes,
          summary: `当前共 ${scenes.length} 个场景`,
          editorActions: [{
            type: 'studio:patch-scenes',
            gameId,
            payload: { action: 'list', scenes },
          }],
        };
      }

      if (act === 'reorder') {
        if (!Array.isArray(order) || !order.length) {
          return { ok: false, error: 'order must be a non-empty array of scene ids' };
        }
        const idMap = new Map(scenes.map((s) => [s.id, s]));
        const reordered = order.map((id) => idMap.get(id)).filter(Boolean);
        // Preserve any scenes not mentioned in the order array at the end.
        const mentioned = new Set(order);
        for (const s of scenes) if (!mentioned.has(s.id)) reordered.push(s);
        changed = true;
        target = reordered;
        summary = `已重排 ${reordered.length} 个场景`;
        const updated = await gameService.update(gameId, { scenes: reordered });
        return {
          ok: true,
          game: updated,
          scenes: reordered,
          summary,
          editorActions: [{
            type: 'studio:patch-scenes',
            gameId,
            payload: { action: 'reorder', scenes: reordered },
          }],
        };
      }

      if (act === 'add') {
        target = {
          id: sceneId || `scene_${Date.now().toString(36)}`,
          name: name || `第 ${scenes.length + 1} 关`,
          type: SCENE_TYPES.includes(sceneType) ? sceneType : 'level',
          background: background || '#1a1a2e',
          config: config || {},
        };
        if (typeof position === 'number' && position >= 0 && position <= scenes.length) {
          scenes.splice(position, 0, target);
        } else {
          scenes.push(target);
        }
        changed = true;
        summary = `已添加场景「${target.name}」`;
      } else {
        const idx = scenes.findIndex((s) => s.id === sceneId || s.name === sceneId);
        if (idx === -1) return { ok: false, error: `Scene not found: ${sceneId}` };
        target = scenes[idx];
        if (act === 'update') {
          if (name) target.name = name;
          if (sceneType && SCENE_TYPES.includes(sceneType)) target.type = sceneType;
          if (background) target.background = background;
          if (config) target.config = { ...(target.config || {}), ...config };
          changed = true;
          summary = `已更新场景「${target.name}」`;
        } else { // remove
          scenes.splice(idx, 1);
          changed = true;
          summary = `已移除场景「${target.name}」`;
        }
      }

      let updated = game;
      if (changed) {
        updated = await gameService.update(gameId, { scenes });
      }

      return {
        ok: true,
        game: updated,
        scenes,
        scene: target,
        summary,
        editorActions: [{
          type: 'studio:patch-scenes',
          gameId,
          payload: { action: act, scene: target, scenes },
        }],
      };
    },
  };
}
