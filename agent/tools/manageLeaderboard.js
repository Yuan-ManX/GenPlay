/**
 * manage_leaderboard - Manage leaderboard boards for a game.
 * Stores boards on game.meta.leaderboards. Each board has: id, label, scoring
 * (e.g. "score", "time"), and an optional top entries list.
 * Granular counterpart to configure_game_meta's leaderboards block.
 */

export function manageLeaderboardTool({ gameService }) {
  return {
    name: 'manage_leaderboard',
    description: 'Add, update, remove or list leaderboard boards. Each board has a label, scoring metric and optional top entries.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        action: { type: 'string', description: 'add | update | remove | list' },
        boardId: { type: 'string', description: 'Required for update/remove' },
        label: { type: 'string' },
        scoring: { type: 'string', description: 'e.g. "score", "time", "wins"' },
        order: { type: 'string', description: 'desc (higher is better) or asc (lower is better)' },
      },
      required: ['gameId', 'action'],
    },
    async execute({ gameId, action, boardId, label, scoring, order, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      const act = (action || '').toLowerCase();
      if (!['add', 'update', 'remove', 'list'].includes(act)) {
        return { ok: false, error: 'action must be add | update | remove | list' };
      }

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const meta = structuredClone(game.meta || {});
      const boards = Array.isArray(meta.leaderboards)
        ? structuredClone(meta.leaderboards)
        : [];

      if (act === 'list') {
        return {
          ok: true,
          boards,
          summary: `当前共 ${boards.length} 个排行榜`,
          editorActions: [{
            type: 'studio:patch-leaderboards',
            gameId,
            payload: { action: 'list', boards },
          }],
        };
      }

      let target = null;
      let changed = false;
      let summary = '';

      if (act === 'add') {
        target = {
          id: boardId || `board_${Date.now().toString(36)}`,
          label: label || '总得分榜',
          scoring: scoring || 'score',
          order: order === 'asc' ? 'asc' : 'desc',
          entries: [],
        };
        boards.push(target);
        changed = true;
        summary = `已添加排行榜「${target.label}」`;
      } else {
        const idx = boards.findIndex((b) => b.id === boardId || b.label === boardId);
        if (idx === -1) return { ok: false, error: `Board not found: ${boardId}` };
        target = boards[idx];
        if (act === 'update') {
          if (label) target.label = label;
          if (scoring) target.scoring = scoring;
          if (order) target.order = order === 'asc' ? 'asc' : 'desc';
          changed = true;
          summary = `已更新排行榜「${target.label}」`;
        } else { // remove
          boards.splice(idx, 1);
          changed = true;
          summary = `已移除排行榜「${target.label}」`;
        }
      }

      let updated = game;
      if (changed) {
        meta.leaderboards = boards;
        updated = await gameService.update(gameId, { meta });
      }

      return {
        ok: true,
        game: updated,
        boards,
        board: target,
        summary,
        editorActions: [{
          type: 'studio:patch-leaderboards',
          gameId,
          payload: { action: act, board: target, boards },
        }],
      };
    },
  };
}
