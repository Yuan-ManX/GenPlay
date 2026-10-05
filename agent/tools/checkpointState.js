/**
 * checkpoint_state - Save and load game state during playtest.
 * Unlike version_history (which snapshots the game config), this tool
 * manages runtime checkpoints: the live game state (player position, HP,
 * score, inventory, level) at a moment during play. The tool emits
 * studio:checkpoint-* events that the GamePreview component listens to,
 * capturing/restoring the actual canvas state. Checkpoint metadata is
 * persisted on game.checkpoints.
 */

export function checkpointStateTool({ gameService }) {
  return {
    name: 'checkpoint_state',
    description: 'Save, load, list or delete runtime checkpoints during playtest. Captures live game state (position, HP, score, level) so you can quickly retry a tricky section. Emits checkpoint events the preview canvas listens to.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        action: { type: 'string', description: 'save | load | list | delete | clear' },
        checkpointId: { type: 'string', description: 'Required for load/delete' },
        name: { type: 'string', description: 'Optional label for save action' },
      },
      required: ['gameId', 'action'],
    },
    async execute({ gameId, action, checkpointId, name, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const act = (action || '').toLowerCase();
      if (!['save', 'load', 'list', 'delete', 'clear'].includes(act)) {
        return { ok: false, error: 'action must be save | load | list | delete | clear' };
      }

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const checkpoints = Array.isArray(game.checkpoints) ? game.checkpoints : [];

      if (act === 'list') {
        return {
          ok: true,
          checkpoints,
          summary: `当前共 ${checkpoints.length} 个检查点`,
          editorActions: [{ type: 'studio:list-checkpoints', gameId, payload: { checkpoints } }],
        };
      }

      if (act === 'clear') {
        await gameService.update(gameId, { checkpoints: [] });
        return {
          ok: true,
          checkpoints: [],
          summary: '已清除所有检查点',
          editorActions: [{ type: 'studio:clear-checkpoints', gameId, payload: {} }],
        };
      }

      if (act === 'delete') {
        if (!checkpointId) return { ok: false, error: 'checkpointId is required for delete' };
        const filtered = checkpoints.filter((c) => c.id !== checkpointId);
        await gameService.update(gameId, { checkpoints: filtered });
        return {
          ok: true,
          checkpoints: filtered,
          summary: `已删除检查点 ${checkpointId}`,
          editorActions: [{ type: 'studio:delete-checkpoint', gameId, payload: { checkpointId, checkpoints: filtered } }],
        };
      }

      if (act === 'save') {
        // Generate a checkpoint record. The actual runtime state is captured
        // by the GamePreview when it receives the studio:save-checkpoint event.
        const id = `cp_${Date.now().toString(36)}`;
        const entry = {
          id,
          name: name || `检查点 ${checkpoints.length + 1}`,
          createdAt: Date.now(),
          // The frontend fills in the actual state snapshot via the event.
          state: null,
        };
        const updated = [...checkpoints, entry];
        // Keep at most 10 checkpoints.
        const trimmed = updated.slice(-10);
        await gameService.update(gameId, { checkpoints: trimmed });
        return {
          ok: true,
          checkpoint: entry,
          checkpoints: trimmed,
          summary: `已保存检查点「${entry.name}」`,
          editorActions: [{ type: 'studio:save-checkpoint', gameId, payload: { checkpoint: entry, checkpoints: trimmed } }],
        };
      }

      // load
      if (!checkpointId) return { ok: false, error: 'checkpointId is required for load' };
      const target = checkpoints.find((c) => c.id === checkpointId);
      if (!target) return { ok: false, error: `Checkpoint not found: ${checkpointId}` };
      return {
        ok: true,
        checkpoint: target,
        summary: `已加载检查点「${target.name}」`,
        editorActions: [{ type: 'studio:load-checkpoint', gameId, payload: { checkpoint: target } }],
      };
    },
  };
}
