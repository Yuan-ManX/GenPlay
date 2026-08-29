/**
 * deleteGame tool - permanently removes a game from workspace.
 * Emits editor action `sidebar:refresh-list` + `studio:refresh-game(null)`
 * so frontend panels drop stale references after deletion.
 */
export function deleteGameTool({ gameService }) {
  return {
    name: 'delete_game',
    description: 'Permanently delete a game by ID. Use with caution - cannot be undone.',
    parameters: {
      type: 'object',
      required: ['gameId'],
      properties: {
        gameId: { type: 'string', description: 'Target game identifier' },
        confirm: { type: 'boolean', description: 'Safety confirm flag (Agent sets to true after intent confirmed)' },
      },
    },
    async execute({ gameId, sessionId }) {
      if (!gameId) return { ok: false, error: 'gameId required' };
      const existed = await gameService.remove(gameId);
      if (!existed) return { ok: false, error: 'Game not found', summary: '游戏不存在或已被删除' };
      return {
        ok: true,
        summary: `已删除游戏 ${gameId}`,
        editorActions: [
          { type: 'sidebar:refresh-list', payload: { removed: gameId } },
          { type: 'studio:refresh-game', payload: { gameId: null, removed: true } },
          { type: 'studio:select-game', payload: { gameId: null } },
        ],
      };
    },
  };
}
