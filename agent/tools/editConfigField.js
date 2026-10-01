/**
 * edit_config_field - Read or write any leaf config field by dotted path.
 * Lets the agent and the chat precisely adjust any game.config value
 * (e.g. player.speed, enemy.hp, world.gravity) and pushes a live
 * editorAction so the studio config tab reflects the change.
 */

export function editConfigFieldTool({ gameService }) {
  return {
    name: 'edit_config_field',
    description: 'Read or write a specific config field by dotted path (e.g. player.speed, enemy.hp). Returns the new value and live editor sync.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: 'Target game id' },
        path: { type: 'string', description: 'Dotted config path, e.g. player.speed' },
        value: { description: 'New value. Omit to read-only.' },
      },
      required: ['gameId', 'path'],
    },
    async execute({ gameId, path, value, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      if (!path || typeof path !== 'string') return { ok: false, error: 'path is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const cfg = structuredClone(game.config || {});
      const before = getByPath(cfg, path);
      const readOnly = value === undefined;

      if (!readOnly) {
        setByPath(cfg, path, value);
      }
      const after = getByPath(cfg, path);

      let updated = game;
      if (!readOnly) {
        updated = await gameService.update(gameId, { config: cfg });
      }

      const editorActions = [{
        type: 'studio:patch-config-field',
        gameId,
        payload: { path, before, after, readOnly },
      }];

      const summary = readOnly
        ? `config.${path} = ${JSON.stringify(after)}`
        : `已将 config.${path} 从 ${JSON.stringify(before)} 改为 ${JSON.stringify(after)}`;

      return {
        ok: true,
        game: updated,
        path,
        before,
        after,
        readOnly,
        editorActions,
        summary,
      };
    },
  };
}

/**
 * Resolve a dotted path against an object. Returns undefined when a
 * segment is missing rather than throwing, so reads of unset keys
 * degrade gracefully.
 */
function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc == null || typeof acc !== 'object') return undefined;
    return acc[key];
  }, obj);
}

/**
 * Set a value at a dotted path, creating intermediate objects as needed.
 */
function setByPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[keys[keys.length - 1]] = value;
}
