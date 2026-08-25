/**
 * creativeIdeate tool - Propose game concepts, genre mashups, and creative
 * directions for the user. Uses artifact memory taste profile + LLM when
 * available. Designed to inspire before creation, not replace it.
 */
export function creativeIdeateTool(services = {}) {
  const { provider, artifactMemory } = services;
  return {
    name: 'creative_ideate',
    description: 'Generate creative game concepts, genre mashups, and inspiration prompts based on user taste and context.',
    parameters: {
      type: 'object',
      properties: {
        direction: { type: 'string', description: 'Optional seed direction, e.g. "cozy", "hardcore", "retro"' },
        count: { type: 'integer', description: 'Number of concepts to propose (default 3)' },
        mood: { type: 'string', description: 'Mood filter: cozy/epic/chill/tense/whimsical/nostalgic' },
      },
    },
    async execute({ direction, count = 3, mood, sessionId }) {
      const taste = artifactMemory?.creativityContext?.() || {};
      const rule = ruleIdeas(direction, count, mood, taste);
      if (!provider?.enabled) return formatIdeas(rule, 'rule');
      try {
        const schema = {
          type: 'object',
          properties: {
            concepts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  genre: { type: 'string' },
                  mashup: { type: 'string' },
                  hook: { type: 'string' },
                  direction: { type: 'string', description: 'One sentence how to build it in GenPlay' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
                required: ['name', 'genre', 'hook', 'direction'],
              },
            },
            inspiration: { type: 'string' },
          },
          required: ['concepts'],
        };
        const sys = [
          'You are GenPlay creative director. Propose original, highly specific game concepts that feel novel and buildable.',
          'Each concept must state: name (2-5 words), genre (from GenPlay genres), mashup description, hook, and a direction the user can say to GenPlay to build it.',
          'GenPlay available genres: shooter,adventure,rpg,puzzle,battle,racing,simulation,platformer,tower,snake,breakout,maze,rhythm,roguelike,deckbuilder,metroidvania,idle,sandbox,visual_novel,auto_battler.',
        ].join('\n');
        const prompt = JSON.stringify({
          user_direction: direction || null,
          mood: mood || null,
          taste_profile: taste,
          count,
        });
        const llm = await provider.json({ systemPrompt: sys, userMessage: prompt, schema, temperature: 0.85 });
        const concepts = (llm?.concepts || []).length ? llm.concepts : rule;
        return formatIdeas(concepts.slice(0, count), llm?.inspiration || 'inspired');
      } catch (_) {
        return formatIdeas(rule, 'rule');
      }
    },
  };
}

function ruleIdeas(direction, count, mood, taste) {
  const moodTags = mood ? [mood] : [];
  const favoriteGenres = taste.favoriteGenres?.length ? taste.favoriteGenres : ['platformer', 'shooter', 'rpg'];
  const palette = [
    { name: '霓虹回廊', genre: 'metroidvania', mashup: '银河恶魔城 + 赛博跑酷', hook: '在时间倒流的霓虹城中回收散落的记忆碎片，每块碎片解锁新能力', direction: '创建一个叫霓虹回廊的 metroidvania 游戏，用赛博朋克主题，赛博场景剧情', tags: ['cyber', 'neon', 'ability-gated'] },
    { name: '花语经营', genre: 'idle', mashup: '放置增量 + 视觉小说羁绊', hook: '种花升级花店，每解锁新品种推进一位花灵的剧情支线', direction: '创建一个叫花语经营的 idle 游戏，加视觉小说角色和剧情', tags: ['cozy', 'story-rich'] },
    { name: '深渊牌匠', genre: 'deckbuilder', mashup: '卡组构筑 + Roguelike 地城层', hook: '每层地城允许重抽卡组一次，走得越深牌组越癫狂', direction: '创建一个叫深渊牌匠的 deckbuilder 加 roguelike 双风格融合', tags: ['deep', 'tactical'] },
    { name: '云端自走棋', genre: 'auto_battler', mashup: '自走棋 + 塔防合成', hook: '每回合可将两个同星级单位合成为带专属技能的塔', direction: '创建一个叫云端自走棋的 auto_battler，融合塔防单位机制', tags: ['synergy', 'build'] },
    { name: '像素拾荒', genre: 'sandbox', mashup: '开放沙盒 + Roguelike 每日重置', hook: '每晚沙盒世界重置但保留背包中的三件遗物', direction: '创建一个叫像素拾荒的 sandbox 加 roguelike 遗物机制', tags: ['nostalgic', 'pixel'] },
    { name: '纸境奇缘', genre: 'visual_novel', mashup: '视觉小说 + 解谜机关穿插', hook: '每段剧情后是一段滑块或迷宫解谜，解法隐藏在对话中', direction: '创建一个叫纸境奇缘的 visual_novel 加 puzzle 解谜穿插', tags: ['story', 'puzzle'] },
    { name: '星潮守望', genre: 'tower', mashup: '塔防 + 节奏判定塔攻击', hook: '塔需踩节奏点才输出，伤害挂钩判定评级（Perfect/Good/Miss）', direction: '创建一个叫星潮守望的 tower 加 rhythm 节奏机制', tags: ['rhythm', 'unique'] },
    { name: '迷宫信使', genre: 'maze', mashup: '迷宫 + Roguelike 背包管理', hook: '每封信占用背包格子，走得越远奖励越高但容错越低', direction: '创建一个叫迷宫信使的 maze 加 roguelike 背包机制', tags: ['tense', 'risk-reward'] },
    { name: '机甲对决', genre: 'battle', mashup: '对战格斗 + 部件定制', hook: '开场先选 6 个机甲部件组装，部件决定轻重攻击与格挡特性', direction: '创建一个叫机甲对决的 battle 加 RPG 部件属性', tags: ['epic', 'customize'] },
    { name: '夕阳狂飙', genre: 'racing', mashup: '赛车 + 射击击落', hook: '在日落公路上既躲障碍又发射撞击弹清除前方车流', direction: '创建一个叫夕阳狂飙的 racing 加 shooter 双玩法', tags: ['sunset', 'arcade'] },
  ];
  let list = palette;
  if (direction) {
    const d = String(direction).toLowerCase();
    list = palette.filter((c) => (c.name + c.mashup + c.hook + c.tags.join(' ')).toLowerCase().includes(d));
    if (!list.length) list = palette;
  } else if (favoriteGenres.length) {
    const prefer = palette.filter((c) => favoriteGenres.includes(c.genre) || c.tags.some((t) => moodTags.includes(t)));
    list = prefer.length >= count ? prefer : palette;
  }
  // Shuffle & slice
  const shuffled = list.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.max(3, count));
}

function formatIdeas(concepts, inspiration) {
  return {
    ok: true,
    summary: `生成了 ${concepts.length} 个创意概念`,
    inspiration,
    concepts,
    ideas: concepts,
    editorActions: [
      { type: 'studio:show-inspiration', payload: { concepts } },
    ],
  };
}
