/**
 * publish_game - 发布工具
 * 将草稿游戏发布为可玩/已发布状态。
 * Persists a canonical snapshot into the published index so community tools
 * (explore_community, remix_game) can resolve the share code later.
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

      // Delegate to GameService.publish so the canonical snapshot lands in the
      // published index (config/scripts/theme/scenario). This keeps the share
      // code resolvable by remix_game and the community listing, not just by
      // the live game record.
      const pub = await gameService.publish(gameId, {
        title: game.name,
        description: game.description,
        author: game.owner || 'Anonymous',
      });
      if (!pub || !pub.shareCode) {
        return { ok: false, error: '发布失败：无法写入社区索引' };
      }
      const shareCode = pub.shareCode;
      const shareLink = `/play/${shareCode}`;
      // Ensure shareLink is stamped on the game record (publishGame sets
      // status + shareCode but not the friendly link).
      const updated = await gameService.update(gameId, {
        shareLink,
        publishedAt: pub.publishedAt,
        updatedAt: new Date().toISOString(),
      });

      const editorActions = [
        {
          type: 'studio:set-status',
          gameId,
          payload: { status: 'published', shareCode, shareLink },
        },
        { type: 'sidebar:refresh-list', payload: { reason: 'published' } },
      ];

      return {
        ok: true,
        game: updated,
        shareCode,
        shareLink,
        editorActions,
        summary: `游戏「${updated.name}」已成功发布上线，分享码：${shareCode}，访问路径：${shareLink}`,
      };
    },
  };
}
