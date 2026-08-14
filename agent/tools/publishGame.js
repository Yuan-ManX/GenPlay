/**
 * publish_game - 发布工具
 * 将草稿游戏发布为可玩/已发布状态。
 */
export function publishGameTool({ gameService }) {
  return {
    name: 'publish_game',
    description: '将游戏发布上线（草稿 -> 已发布）',
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

      if (!(game.scripts || '').trim()) {
        return { ok: false, error: '游戏尚无逻辑脚本，无法发布。请先生成游戏逻辑。' };
      }

      const updated = await gameService.update(gameId, {
        status: 'published',
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return {
        ok: true,
        game: updated,
        summary: `游戏「${updated.name}」已成功发布上线，现可通过多端访问。`,
      };
    },
  };
}
