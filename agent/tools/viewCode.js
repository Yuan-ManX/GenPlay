/**
 * view_code - 代码与配置查看工具
 * 输出游戏配置、逻辑脚本（DSL）及主题 JSON 供开发者审阅，
 * 同时向编辑器发射代码高亮聚焦信号。
 */
export function viewCodeTool({ gameService }) {
  return {
    name: 'view_code',
    description: '查看游戏的核心源码：config 配置 JSON、scripts 逻辑 DSL、theme 主题定义、scenario 剧情数据',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: '目标游戏 ID' },
        section: { type: 'string', description: '可选：config/scripts/theme/scenario/all，默认 all' },
      },
    },
    async execute({ gameId, section = 'all' }) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      if (!gameId) return { ok: false, error: '缺少 gameId' };
      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `未找到游戏：${gameId}` };

      const sections = String(section).toLowerCase();
      const parts = [];
      const payload = {};

      if (sections === 'all' || sections.includes('config')) {
        payload.config = game.config || {};
        parts.push(`===== CONFIG (JSON) =====\n${prettyJson(game.config || {})}`);
      }
      if (sections === 'all' || sections.includes('script')) {
        payload.scripts = game.scripts || '';
        parts.push(`===== SCRIPTS (DSL) =====\n${game.scripts || '// 暂无脚本'}`);
      }
      if (sections === 'all' || sections.includes('theme')) {
        payload.theme = game.theme || null;
        parts.push(`===== THEME =====\n${prettyJson(game.theme || { note: '未应用主题' })}`);
      }
      if (sections === 'all' || sections.includes('scenario')) {
        payload.scenario = game.scenario || null;
        parts.push(`===== SCENARIO =====\n${prettyJson(game.scenario || { note: '暂无剧情' })}`);
      }

      const editorActions = [{
        type: 'studio:focus-code',
        gameId,
        payload: { section: sections === 'all' ? 'all' : section, sections: payload },
      }];

      const summary = [
        `已为「${game.name}」输出代码快照：`,
        parts.map((p) => p.split('\n')[0].replace('===== ', '· ').replace(' =====', '')).join(''),
      ].join('');

      return {
        ok: true,
        game,
        code: parts.join('\n\n'),
        sections: payload,
        editorActions,
        summary,
      };
    },
  };
}

function prettyJson(obj) {
  try { return JSON.stringify(obj, null, 2); } catch (_) { return String(obj); }
}
