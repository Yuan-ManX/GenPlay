/**
 * describe_game - 概览工具
 * 生成游戏的可读概要（用于 Agent 对话与前端展示）。
 */
export function describeGameTool({ gameService }) {
  return {
    name: 'describe_game',
    description: '生成游戏的概要描述',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: '目标游戏 ID' },
      },
    },
    async execute({ gameId }) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      if (!gameId) return { ok: false, error: '缺少 gameId' };
      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `未找到游戏：${gameId}` };

      const summary = [
        `【${game.name}】`,
        `类型：${game.genre}，平台：${game.platform}，状态：${game.status}`,
        game.description ? `描述：${game.description}` : '暂无描述',
        `运行次数：${game.runCount || 0}，最近运行：${game.lastRun ? game.lastRun.status : '未运行'}`,
        `编辑记录：${(game.editLog || []).length} 条`,
      ].join('\n');

      return { ok: true, game, summary };
    },
  };
}
