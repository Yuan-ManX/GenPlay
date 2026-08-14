export function createGameTool({ gameService }) {
  return {
    name: 'create_game',
    description: '创建一个新的 AI 原生游戏',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '游戏名称' },
        genre: { type: 'string', description: '游戏类型，如 shooter/rpg/puzzle' },
        description: { type: 'string', description: '游戏描述' },
      },
    },
    async execute({ name = 'Untitled Game', genre = 'adventure', description = '', platform = 'web' }) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      const game = await gameService.create({
        name,
        genre,
        description,
        platform,
        status: 'draft',
      });
      return {
        ok: true,
        game,
        summary: `已创建游戏「${game.name}」（类型：${game.genre}），游戏 ID：${game.id}`,
      };
    },
  };
}
