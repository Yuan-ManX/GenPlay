import { getTemplate } from '../templates/gameTemplates.js';
import { GameConfigGenerator } from '../providers/gameConfigGenerator.js';

export function createGameTool({ gameService, provider } = {}) {
  const configGen = new GameConfigGenerator({ provider });
  return {
    name: 'create_game',
    description: '创建一个新的 AI 原生游戏，根据用户描述由 LLM/本地规则生成专属玩法参数',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '游戏名称' },
        genre: { type: 'string', description: '游戏类型：shooter/adventure/rpg/puzzle/battle/racing/simulation/platformer/tower/snake/breakout/maze/rhythm' },
        description: { type: 'string', description: '游戏描述（用于让 LLM 生成专属参数）' },
      },
    },
    async execute({ name = 'Untitled Game', genre = 'adventure', description = '', platform = 'web' } = {}) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      const template = getTemplate(genre);

      // AI generated config (LLM or local rule adjustment)
      const baseConfig = structuredClone(template.config);
      const { config, source, note } = await configGen.generate(genre, description, baseConfig);

      const game = await gameService.create({
        name,
        genre,
        description,
        platform,
        status: 'draft',
        config,
        scripts: template.scripts,
      });

      const editorActions = [
        {
          type: 'studio:select-game',
          payload: { gameId: game.id, name: game.name, genre: game.genre },
        },
        {
          type: 'sidebar:refresh-list',
          payload: { reason: 'new-game' },
        },
      ];

      return {
        ok: true,
        game,
        gameId: game.id,
        configSource: source,
        editorActions,
        summary: `已创建「${template.label}」游戏「${game.name}」（ID：${game.id}）。${note}`,
      };
    },
  };
}
