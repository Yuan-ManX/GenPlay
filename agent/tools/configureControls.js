/**
 * configure_controls - Customize the input scheme of a game: keyboard remap
 * (action -> key), touch pad toggle and gamepad toggle. Stored on
 * config.controls; the studio preview and the playable build merge the remap
 * over the engine's default key map at runtime.
 *
 * Canonical actions: left, right, up, down, jump, shoot, confirm, reset.
 */

const ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'shoot', 'confirm', 'reset'];

export function configureControlsTool({ gameService }) {
  return {
    name: 'configure_controls',
    description: 'Customize input controls: remap keyboard actions to new keys, toggle the on-screen touch pad and gamepad support. Applies live to preview and exported builds.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        remap: { type: 'object', description: 'action -> key, e.g. { "jump": "j", "shoot": "k" }' },
        touchPad: { type: 'boolean', description: 'show on-screen touch pad' },
        gamepad: { type: 'boolean', description: 'enable gamepad polling' },
        sensitivity: { type: 'number', description: 'input sensitivity scale 0.5 - 2' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, remap, touchPad, gamepad, sensitivity }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const config = structuredClone(game.config || {});
      const controls = { ...(config.controls || {}) };
      const changes = [];

      if (remap && typeof remap === 'object') {
        const next = { ...(controls.remap || {}) };
        for (const [action, key] of Object.entries(remap)) {
          if (!ACTIONS.includes(action)) continue;
          if (key === null || key === '') {
            if (next[action]) { delete next[action]; changes.push(`恢复 ${action} 默认键位`); }
            continue;
          }
          next[action] = String(key);
          changes.push(`${action} → ${key === ' ' ? '空格' : key}`);
        }
        controls.remap = next;
      }
      if (touchPad !== undefined) {
        controls.touchPad = !!touchPad;
        changes.push(`触屏按键${controls.touchPad ? '开启' : '关闭'}`);
      }
      if (gamepad !== undefined) {
        controls.gamepad = !!gamepad;
        changes.push(`手柄支持${controls.gamepad ? '开启' : '关闭'}`);
      }
      if (sensitivity !== undefined) {
        const s = Number(sensitivity);
        if (Number.isFinite(s)) {
          controls.sensitivity = Math.max(0.5, Math.min(2, s));
          changes.push(`灵敏度=${controls.sensitivity}`);
        }
      }

      if (!changes.length) {
        return { ok: false, error: 'No control changes provided. Pass remap / touchPad / gamepad / sensitivity.' };
      }

      config.controls = controls;
      const updated = await gameService.update(gameId, { config });
      return {
        ok: true,
        game: updated,
        controls,
        config,
        summary: `操控方案已更新：${changes.join(' · ')}`,
        editorActions: [{
          type: 'studio:patch-config',
          gameId,
          payload: { after: config, changes },
        }],
      };
    },
  };
}
