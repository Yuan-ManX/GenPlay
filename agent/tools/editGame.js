export function editGameTool({ gameService }) {
  return {
    name: 'edit_game',
    description: '编辑/修改现有游戏的内容、玩法或逻辑',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: '要编辑的游戏 ID' },
        change: { type: 'string', description: '要执行的修改描述' },
        patch: { type: 'object', description: '字段级修改' },
      },
    },
    async execute({ gameId, change, patch }) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      if (!gameId) return { ok: false, error: '缺少 gameId' };
      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `未找到游戏：${gameId}` };

      const updates = patch || {};
      if (change) {
        // 简易的规则编辑：记录编辑历史
        game.editLog = game.editLog || [];
        game.editLog.push({ at: new Date().toISOString(), change });
      }
      const updated = await gameService.update(gameId, {
        ...updates,
        editLog: game.editLog,
        updatedAt: new Date().toISOString(),
      });
      return {
        ok: true,
        game: updated,
        summary: `已编辑游戏「${updated.name}」${change ? `：${change}` : ''}`,
      };
    },
  };
}
