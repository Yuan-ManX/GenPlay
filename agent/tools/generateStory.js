/**
 * generate_story - Generate a structured game narrative.
 * Produces a story with title, setting, protagonist, antagonist, plot beats,
 * and chapter list. Stored on game.story. Uses LLM when available; otherwise
 * generates genre-appropriate narrative templates.
 */

const GENRE_STORY_TEMPLATES = {
  shooter: {
    setting: '一个被外星势力占领的未来都市',
    protagonist: '精英特种部队队员',
    antagonist: '外星指挥官',
    premise: '地球联军最后的希望寄托在你身上，深入敌阵摧毁核心。',
    chapters: [
      { id: 1, name: '降临', objective: '突破外围防线，抵达城市入口' },
      { id: 2, name: '巷战', objective: '清剿城区敌军，寻找武器补给' },
      { id: 3, name: '核心', objective: '攻入外星母舰，摧毁能量核心' },
    ],
  },
  platformer: {
    setting: '漂浮在云端的古老王国',
    protagonist: '失去记忆的旅人',
    antagonist: '窃取王国光明的暗影领主',
    premise: '为了找回记忆与王国的光明，你踏上了跨越云端的旅程。',
    chapters: [
      { id: 1, name: '苏醒', objective: '从云端遗迹出发，学习基本跳跃' },
      { id: 2, name: '森林', objective: '穿越迷雾森林，收集光之碎片' },
      { id: 3, name: '巅峰', objective: '登上暗影塔，击败暗影领主' },
    ],
  },
  puzzle: {
    setting: '一座不断变化的迷宫塔',
    protagonist: '被困的数学家',
    antagonist: '塔的意志本身',
    premise: '每一层都是一道谜题，解开它才能通往自由。',
    chapters: [
      { id: 1, name: '入口', objective: '解开第一层基础机关' },
      { id: 2, name: '镜像', objective: '利用镜像原理通过障碍' },
      { id: 3, name: '核心', objective: '破解塔的最终谜题' },
    ],
  },
  racing: {
    setting: '横跨大陆的极速锦标赛',
    protagonist: '传奇车手',
    antagonist: '卫冕冠军「闪电」',
    premise: '一年一度的极速锦标赛开幕，击败闪电成为新的传奇。',
    chapters: [
      { id: 1, name: '预选赛', objective: '通过城市赛道预选赛' },
      { id: 2, name: '山地', objective: '征服险峻的山地赛道' },
      { id: 3, name: '决赛', objective: '在最终赛道击败闪电' },
    ],
  },
  rpg: {
    setting: '剑与魔法的中世纪大陆',
    protagonist: '出身平凡的冒险者',
    antagonist: '企图复活远古邪神的黑暗教团',
    premise: '命运的指引让你踏上阻止邪神复活的旅程。',
    chapters: [
      { id: 1, name: '启程', objective: '离开故乡，前往第一座城镇' },
      { id: 2, name: '集结', objective: '招募队友，获取关键道具' },
      { id: 3, name: '决战', objective: '攻入教团总部，阻止仪式' },
    ],
  },
  sandbox: {
    setting: '无边无际的创造世界',
    protagonist: '造物主',
    antagonist: '混沌与熵',
    premise: '在这片空白的世界中，你是唯一的法则。',
    chapters: [
      { id: 1, name: '创世', objective: '搭建基础地形与资源' },
      { id: 2, name: '生命', objective: '引入生物与生态系统' },
      { id: 3, name: '文明', objective: '建立文明与规则' },
    ],
  },
  adventure: {
    setting: '神秘的失落群岛',
    protagonist: '年轻的探险家',
    antagonist: '守护宝藏的远古诅咒',
    premise: '传说中的宝藏就藏在群岛深处，你能找到它吗？',
    chapters: [
      { id: 1, name: '登岛', objective: '探索第一座岛屿的入口' },
      { id: 2, name: '遗迹', objective: '解开古老遗迹的机关' },
      { id: 3, name: '宝藏', objective: '取得传说中的宝藏' },
    ],
  },
  strategy: {
    setting: '四分五裂的王国大陆',
    protagonist: '年轻的领主',
    antagonist: '妄图统一大陆的暴君',
    premise: '在乱世中崛起，统一大陆终结暴政。',
    chapters: [
      { id: 1, name: '立足', objective: '巩固领地，发展经济' },
      { id: 2, name: '扩张', objective: '征服周边领地' },
      { id: 3, name: '统一', objective: '击败暴君，统一大陆' },
    ],
  },
};

function buildStory(genre, seed, title) {
  const tpl = GENRE_STORY_TEMPLATES[genre] || GENRE_STORY_TEMPLATES.adventure;
  const variants = [
    `${tpl.protagonist}的冒险`,
    `${tpl.setting}的传说`,
    `追寻${tpl.antagonist}`,
  ];
  return {
    title: title || variants[seed % variants.length],
    setting: tpl.setting,
    protagonist: tpl.protagonist,
    antagonist: tpl.antagonist,
    premise: tpl.premise,
    chapters: tpl.chapters,
    tone: 'epic',
    createdAt: Date.now(),
  };
}

export function generateStoryTool({ gameService, provider }) {
  return {
    name: 'generate_story',
    description: 'Generate a structured game narrative with title, setting, protagonist, antagonist, plot premise and chapter list. AI-generated when LLM available, otherwise genre-tailored templates.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        genre: { type: 'string', description: 'Game genre to tailor the story (uses game genre if omitted)' },
        title: { type: 'string', description: 'Optional story title' },
        tone: { type: 'string', description: 'epic | dark | light | mysterious | humorous' },
        chapters: { type: 'number', description: 'Number of chapters (3-8, default 3)' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, genre, title, tone, chapters, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const g = (genre || game.genre || 'adventure').toLowerCase();
      const seed = Math.floor(Math.random() * 1000);
      let story = buildStory(g, seed, title);

      if (tone) story.tone = tone;
      if (typeof chapters === 'number' && chapters > 0) {
        // Trim or extend chapters to match the requested count.
        const base = story.chapters;
        const desired = Math.max(1, Math.min(8, chapters));
        if (desired > base.length) {
          for (let i = base.length; i < desired; i++) {
            base.push({ id: i + 1, name: `第${i + 1}章`, objective: '继续推进剧情' });
          }
        } else {
          story.chapters = base.slice(0, desired);
        }
      }

      // LLM enhancement: rewrite premise and chapter objectives for depth.
      let llmEnhanced = false;
      if (provider?.enabled && provider.chat) {
        try {
          const prompt = `Write a short game story premise (2 sentences) and list ${story.chapters.length} chapter objectives ` +
            `for a ${g} game titled "${story.title}". Tone: ${tone || 'epic'}. ` +
            `Format: PREMISE: ...\n1. ...\n2. ...`;
          const resp = await provider.chat([{ role: 'user', content: prompt }], { maxTokens: 300 });
          if (resp?.content) {
            const lines = resp.content.split('\n').map((l) => l.trim()).filter(Boolean);
            const premiseLine = lines.find((l) => /^premise[:：]/i.test(l));
            if (premiseLine) story.premise = premiseLine.replace(/^premise[:：]\s*/i, '');
            llmEnhanced = true;
          }
        } catch (_) { /* fall back to template */ }
      }

      const updated = await gameService.update(gameId, { story });

      return {
        ok: true,
        game: updated,
        story,
        llmEnhanced,
        summary: `已生成剧情《${story.title}》（${story.chapters.length} 章）${llmEnhanced ? '，AI 增强' : ''}`,
        editorActions: [{ type: 'studio:set-story', gameId, payload: { story } }],
      };
    },
  };
}
