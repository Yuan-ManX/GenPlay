/**
 * control_runtime - Control the in-browser game preview from the agent.
 * Emits studio:runtime-* events that the GamePreview component listens to.
 * Supports: restart, set speed multiplier, spawn test entities, toggle
 * invincibility, toggle god mode, and trigger win/lose test scenarios.
 * This lets the agent drive the preview for demonstration or testing without
 * manual keyboard input.
 */

export function controlRuntimeTool({ gameService }) {
  return {
    name: 'control_runtime',
    description: 'Control the live game preview. Restart, set game speed, spawn test entities, toggle invincibility/god mode, or trigger win/lose scenarios. Emits runtime events the preview canvas listens to.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        command: { type: 'string', description: 'restart | speed | spawn | invincible | godmode | win | lose | pause | resume' },
        speed: { type: 'number', description: 'Speed multiplier (0.1 - 3.0) for speed command' },
        entity: { type: 'string', description: 'Entity type to spawn: enemy | powerup | obstacle | boss' },
        count: { type: 'number', description: 'Number of entities to spawn (default 1)' },
        enabled: { type: 'boolean', description: 'For invincible/godmode commands' },
      },
      required: ['gameId', 'command'],
    },
    async execute({ gameId, command, speed, entity, count, enabled, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      const cmd = (command || '').toLowerCase();
      const valid = ['restart', 'speed', 'spawn', 'invincible', 'godmode', 'win', 'lose', 'pause', 'resume'];
      if (!valid.includes(cmd)) return { ok: false, error: `command must be one of: ${valid.join(', ')}` };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const payload = { command: cmd };
      let summary = '';

      switch (cmd) {
        case 'restart':
          summary = '游戏已重启';
          break;
        case 'speed': {
          const sp = typeof speed === 'number' ? Math.max(0.1, Math.min(3, speed)) : 1;
          payload.speed = sp;
          summary = `游戏速度设为 ${sp}x`;
          break;
        }
        case 'spawn': {
          const ent = entity || 'enemy';
          const n = typeof count === 'number' ? Math.max(1, Math.min(20, count)) : 1;
          payload.entity = ent;
          payload.count = n;
          summary = `已生成 ${n} 个 ${ent}`;
          break;
        }
        case 'invincible':
          payload.enabled = enabled ?? true;
          summary = `无敌模式 ${payload.enabled ? '开启' : '关闭'}`;
          break;
        case 'godmode':
          payload.enabled = enabled ?? true;
          summary = `上帝模式 ${payload.enabled ? '开启' : '关闭'}`;
          break;
        case 'win':
          summary = '触发胜利场景';
          break;
        case 'lose':
          summary = '触发失败场景';
          break;
        case 'pause':
          summary = '游戏已暂停';
          break;
        case 'resume':
          summary = '游戏已继续';
          break;
      }

      return {
        ok: true,
        command: cmd,
        payload,
        summary,
        editorActions: [{ type: 'studio:runtime-command', gameId, payload }],
      };
    },
  };
}
