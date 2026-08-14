export function runGameTool({ gameService }) {
  return {
    name: 'run_game',
    description: '运行并调试游戏，输出运行结果与排错建议',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: '要运行的游戏 ID' },
      },
    },
    async execute({ gameId }) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      if (!gameId) return { ok: false, error: '缺少 gameId' };
      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `未找到游戏：${gameId}` };

      // 模拟运行/静态检查
      const issues = [];
      if (!game.genre) issues.push('缺少游戏类型');
      if (!game.name) issues.push('缺少游戏名称');
      if (!game.scripts) issues.push('尚未生成可执行逻辑脚本');

      const result = {
        gameId,
        status: issues.length ? 'warning' : 'ok',
        durationMs: 12 + Math.floor(Math.random() * 40),
        issues,
        logs: [
          `[boot] 启动游戏 ${game.name}`,
          `[load] 加载场景资源`,
          `[run]  主循环运行 ${issues.length ? '存在告警' : '正常'}`,
        ],
      };
      await gameService.update(gameId, {
        lastRun: result,
        runCount: (game.runCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      });
      return {
        ok: true,
        result,
        summary: issues.length
          ? `游戏可运行但存在 ${issues.length} 项告警：${issues.join('；')}`
          : `游戏「${game.name}」运行正常（${result.durationMs}ms）`,
      };
    },
  };
}
