export function generateConfigTool({ gameService }) {
  return {
    name: 'generate_config',
    description: '为游戏生成/校验配置',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: '目标游戏 ID' },
        key: { type: 'string', description: '配置键' },
        value: { type: 'string', description: '配置值' },
      },
    },
    async execute({ gameId, key, value }) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      if (!gameId) return { ok: false, error: '缺少 gameId' };
      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `未找到游戏：${gameId}` };

      const config = { ...(game.config || {}) };
      if (key) config[key] = value ?? '';

      await gameService.update(gameId, { config, updatedAt: new Date().toISOString() });
      return {
        ok: true,
        config,
        summary: key
          ? `已更新配置 ${key}=${config[key]}`
          : '已生成游戏配置。',
      };
    },
  };
}
