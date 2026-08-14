export function listGamesTool({ gameService }) {
  return {
    name: 'list_games',
    description: '列出当前所有游戏',
    parameters: { type: 'object', properties: {} },
    async execute() {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      const games = await gameService.list();
      return {
        ok: true,
        games,
        summary: games.length ? `当前共有 ${games.length} 个游戏。` : '当前还没有游戏，试着创建一个吧。',
      };
    },
  };
}
