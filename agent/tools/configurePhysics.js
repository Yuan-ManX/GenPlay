/**
 * configure_physics - Tune the physical feel of a game: gravity, jump force,
 * move speed, bounce, friction and multi-jump count. Values are stored on
 * config.physics and propagated onto config.player so genre engines that
 * read player.jumpForce / player.gravity / player.maxJumps / player.speed
 * (platformer, metroidvania, roguelike, ...) pick the changes up at once.
 */

export function configurePhysicsTool({ gameService }) {
  return {
    name: 'configure_physics',
    description: 'Tune game physics: gravity, jump force, move speed, bounce elasticity, friction and max jumps. Writes config.physics and syncs engine-facing player fields.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        gravity: { type: 'number', description: 'gravity per frame (engine units, e.g. 0.5)' },
        jumpForce: { type: 'number', description: 'jump impulse (engine units, e.g. 11)' },
        moveSpeed: { type: 'number', description: 'player move speed (engine units)' },
        bounce: { type: 'number', description: 'elasticity 0 - 1 for bouncing entities' },
        friction: { type: 'number', description: 'ground friction 0 - 1' },
        maxJumps: { type: 'number', description: '1 = single jump, 2 = double jump, ...' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, gravity, jumpForce, moveSpeed, bounce, friction, maxJumps }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const config = structuredClone(game.config || {});
      const physics = { ...(config.physics || {}) };
      const changes = [];

      const setNum = (key, value, min, max, label) => {
        if (value === undefined || value === null) return;
        const n = Number(value);
        if (!Number.isFinite(n)) return;
        const v = Math.max(min, Math.min(max, n));
        if (physics[key] !== v) {
          physics[key] = v;
          changes.push(`${label}=${v}`);
        }
      };

      setNum('gravity', gravity, 0, 5, '重力');
      setNum('jumpForce', jumpForce, 1, 40, '跳跃力');
      setNum('moveSpeed', moveSpeed, 0.5, 30, '移动速度');
      setNum('bounce', bounce, 0, 1, '弹性');
      setNum('friction', friction, 0, 1, '摩擦力');
      setNum('maxJumps', maxJumps, 1, 5, '跳跃段数');

      if (!changes.length) {
        return { ok: false, error: 'No physics values provided. Pass gravity / jumpForce / moveSpeed / bounce / friction / maxJumps.' };
      }

      config.physics = physics;
      // Propagate to engine-facing player fields so existing genre engines
      // apply the new feel without any engine code changes.
      config.player = { ...(config.player || {}) };
      if (physics.jumpForce !== undefined) config.player.jumpForce = physics.jumpForce;
      if (physics.gravity !== undefined) config.player.gravity = physics.gravity;
      if (physics.maxJumps !== undefined) config.player.maxJumps = physics.maxJumps;
      if (physics.moveSpeed !== undefined) config.player.speed = physics.moveSpeed;

      const updated = await gameService.update(gameId, { config });
      return {
        ok: true,
        game: updated,
        physics,
        config,
        summary: `物理手感已更新：${changes.join(' · ')}。平台跳跃、恶魔城、肉鸽等引擎即刻生效`,
        editorActions: [{
          type: 'studio:patch-config',
          gameId,
          payload: { after: config, changes },
        }],
      };
    },
  };
}
