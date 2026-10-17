/**
 * undo_redo - Revert or reapply the last game modification.
 * Actions:
 *   undo    - pop the last snapshot, restore game state, push current to future
 *   redo    - pop from future, restore game state, push current to past
 *   peek    - return undo/redo availability without changing state
 *   history - return full past/future timeline for UI display
 *
 * The orchestrator pushes snapshots automatically before modifying tools run,
 * so the user simply says "撤销" or "重做" and this tool does the rest.
 */

export function undoRedoTool({ gameService, undoManager }) {
  return {
    name: 'undo_redo',
    description: 'Undo or redo the last game modification. Supports undo, redo, peek (check availability), and history (full timeline). Snapshots are captured automatically before each modifying action.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: 'Target game id' },
        action: { type: 'string', description: 'undo | redo | peek | history (default: undo)' },
      },
      required: ['gameId', 'action'],
    },
    async execute({ gameId, action, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      if (!undoManager) return { ok: false, error: 'Undo manager not initialized' };

      const act = (action || 'undo').toLowerCase();
      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      if (act === 'peek') {
        const status = undoManager.peek(gameId);
        return {
          ok: true,
          status,
          summary: `可撤销 ${status.pastCount} 步，可重做 ${status.futureCount} 步`,
          editorActions: [{ type: 'studio:undo-status', gameId, payload: status }],
        };
      }

      if (act === 'history') {
        const hist = undoManager.history(gameId);
        return {
          ok: true,
          history: hist,
          summary: `历史记录：${hist.past.length} 步可撤销，${hist.future.length} 步可重做`,
          editorActions: [{ type: 'studio:undo-history', gameId, payload: hist }],
        };
      }

      if (act === 'undo') {
        const snapshot = undoManager.undo(gameId);
        if (!snapshot) return { ok: false, error: '没有可撤销的操作' };
        // Push current state to future so redo can restore it.
        const currentClone = JSON.parse(JSON.stringify(game));
        currentClone.__label = snapshot.__label;
        currentClone.__action = snapshot.__action;
        currentClone.__ts = snapshot.__ts;
        undoManager.pushFuture(gameId, currentClone);
        // Strip metadata before persisting.
        const restore = { ...snapshot };
        delete restore.__label; delete restore.__action; delete restore.__ts;
        const restored = await gameService.update(gameId, restore);
        return {
          ok: true,
          game: restored,
          restored: true,
          label: snapshot.__label || '上一操作',
          summary: `已撤销：${snapshot.__label || '上一操作'}`,
          editorActions: [
            { type: 'studio:refresh-game', gameId, payload: { restored } },
            { type: 'studio:undo-status', gameId, payload: undoManager.peek(gameId) },
          ],
        };
      }

      if (act === 'redo') {
        const snapshot = undoManager.redo(gameId);
        if (!snapshot) return { ok: false, error: '没有可重做的操作' };
        const currentClone = JSON.parse(JSON.stringify(game));
        currentClone.__label = snapshot.__label;
        currentClone.__action = snapshot.__action;
        currentClone.__ts = snapshot.__ts;
        undoManager.pushPast(gameId, currentClone);
        const restore = { ...snapshot };
        delete restore.__label; delete restore.__action; delete restore.__ts;
        const restored = await gameService.update(gameId, restore);
        return {
          ok: true,
          game: restored,
          restored: true,
          label: snapshot.__label || '重做操作',
          summary: `已重做：${snapshot.__label || '重做操作'}`,
          editorActions: [
            { type: 'studio:refresh-game', gameId, payload: { restored } },
            { type: 'studio:undo-status', gameId, payload: undoManager.peek(gameId) },
          ],
        };
      }

      return { ok: false, error: `Unknown action: ${act}. Use undo | redo | peek | history` };
    },
  };
}
