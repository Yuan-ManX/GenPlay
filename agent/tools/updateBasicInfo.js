/**
 * updateBasicInfo tool - updates a game's top-level metadata fields
 * (name, description, genre) - exposed separately from save_game so
 * planner / LLM can route intent cleanly.
 */
export function updateBasicInfoTool({ gameService }) {
  return {
    name: 'update_basic_info',
    description: 'Rename, re-describe or change the genre of a game. Also updates the workspace listing.',
    parameters: {
      type: 'object',
      required: ['gameId'],
      properties: {
        gameId: { type: 'string' },
        name: { type: 'string', description: 'New game name' },
        description: { type: 'string', description: 'New description / tagline' },
        genre: { type: 'string', description: 'Genre key (adventure/shooter/rpg/puzzle/etc including all 20 new engines)' },
      },
    },
    async execute({ gameId, name, description, genre, sessionId }) {
      if (!gameId) return { ok: false, error: 'gameId required' };
      const patch = {};
      if (name !== undefined) patch.name = name;
      if (description !== undefined) patch.description = description;
      if (genre !== undefined) patch.genre = genre;
      if (Object.keys(patch).length === 0) {
        return { ok: false, error: 'No update fields provided', summary: '请提供名称、描述或类型中至少一项' };
      }
      const updated = await gameService.update(gameId, patch);
      if (!updated) return { ok: false, error: 'Game not found' };
      const parts = [];
      if (patch.name) parts.push(`重命名为「${patch.name}」`);
      if (patch.genre) parts.push(`类型变更为 ${patch.genre}`);
      if (patch.description) parts.push('描述已更新');
      return {
        ok: true,
        summary: parts.join(' · ') || '基础信息已更新',
        game: updated,
        editorActions: [
          { type: 'studio:refresh-game', payload: { gameId } },
          { type: 'sidebar:refresh-list', payload: { updated: gameId } },
        ],
      };
    },
  };
}
