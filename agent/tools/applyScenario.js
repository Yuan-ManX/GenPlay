/**
 * apply_scenario - 场景剧情应用工具
 * 为游戏注入叙事背景、关卡设定、角色台词等，
 * 同时扩展 gameConfig 的 scenario 字段，供游戏引擎渲染剧情。
 */
const SCENARIO_TEMPLATES = {
  space: {
    title: '星际远征',
    backdrop: '人类最后一艘方舟"黎明号"穿越虫洞，寻找新的家园。',
    chapters: [
      { id: 1, name: '冲出银河', objective: '逃离外星追击舰队' },
      { id: 2, name: '虫洞深处', objective: '穿越异常星域收集能量矿' },
      { id: 3, name: '新家园', objective: '击退轨道守卫，建立殖民地' },
    ],
    dialog: {
      intro: '指挥官，超光速引擎已就绪。请做好跳跃准备。',
      win: '我们做到了，指挥官。那颗行星，就是我们的未来。',
      lose: '黎明号失去动力……信号，中断了。',
    },
  },
  fantasy: {
    title: '黎明之剑',
    backdrop: '上古封印松动，魔王即将复苏。勇者踏上寻找传说神剑的旅程。',
    chapters: [
      { id: 1, name: '新手村外', objective: '击退森林哥布林群' },
      { id: 2, name: '矮人矿坑', objective: '突破矿坑深处的魔像守卫' },
      { id: 3, name: '魔王城堡', objective: '手持黎明之剑击败魔王' },
    ],
    dialog: {
      intro: '勇者大人，圣剑在西边的神山上闪耀，去吧！',
      win: '黎明降临，大地恢复了生机。传说将永远铭记你的名字。',
      lose: '剑从手中滑落，黑暗吞噬了一切……',
    },
  },
  cyber: {
    title: '霓虹回路',
    backdrop: '2099年，巨型企业控制了整座新东京市。黑客少年要打破数据牢笼。',
    chapters: [
      { id: 1, name: '数据巷', objective: '绕过企业防火墙，窃取情报' },
      { id: 2, name: '赛博工厂', objective: '摧毁精神控制芯片生产线' },
      { id: 3, name: '核心主脑', objective: '注入自由代码，解放全体市民' },
    ],
    dialog: {
      intro: '神经链接已激活，ICE 防火墙 10 秒后检测到你，快行动！',
      win: '自由代码传播完成。整座城市的霓虹灯，为你闪烁。',
      lose: '连接被切断……你的意识，永远留在了赛博空间。',
    },
  },
};

export function applyScenarioTool({ gameService, provider }) {
  return {
    name: 'apply_scenario',
    description: '为游戏应用剧情场景与叙事背景，添加关卡章节与对话文本',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: '目标游戏 ID' },
        scenarioType: { type: 'string', description: '场景类型：space / fantasy / cyber / custom' },
        title: { type: 'string', description: '自定义剧情标题' },
        backdrop: { type: 'string', description: '自定义故事背景描述' },
      },
    },
    async execute({ gameId, scenarioType, title, backdrop }) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      if (!gameId) return { ok: false, error: '缺少 gameId' };
      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `未找到游戏：${gameId}` };

      // Pick a scenario template
      let scenario;
      const key = String(scenarioType || '').toLowerCase();
      if (key === 'space' || /太空|宇宙|星|方舟/i.test(title || backdrop || game.name || game.description || '')) {
        scenario = structuredClone(SCENARIO_TEMPLATES.space);
      } else if (key === 'fantasy' || /魔幻|魔|剑|勇者|奇幻/i.test(title || backdrop || game.name || game.description || '')) {
        scenario = structuredClone(SCENARIO_TEMPLATES.fantasy);
      } else if (key === 'cyber' || /赛博|黑客|霓虹|都市|未来/i.test(title || backdrop || game.name || game.description || '')) {
        scenario = structuredClone(SCENARIO_TEMPLATES.cyber);
      } else {
        scenario = structuredClone(SCENARIO_TEMPLATES.fantasy);
      }
      if (title) scenario.title = title;
      if (backdrop) scenario.backdrop = backdrop;

      // Merge with genre-specific objective hints
      scenario.appliedGenre = game.genre;
      if (!scenario.enrichedAt) scenario.enrichedAt = new Date().toISOString();

      const updated = await gameService.update(gameId, {
        scenario,
        description: game.description
          ? `${game.description} · 剧情：${scenario.title} - ${scenario.backdrop}`
          : `${scenario.title}：${scenario.backdrop}`,
        updatedAt: new Date().toISOString(),
      });

      const editorActions = [{
        type: 'studio:set-scenario',
        gameId,
        payload: scenario,
      }];

      const chapters = scenario.chapters.map((c) => `第${c.id}章《${c.name}》：${c.objective}`).join('；');
      return {
        ok: true,
        game: updated,
        scenario,
        editorActions,
        summary: `已为「${game.name}」应用剧情《${scenario.title}》。${scenario.backdrop} 章节：${chapters}。`,
      };
    },
  };
}
