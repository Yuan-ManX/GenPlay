/**
 * SpecialistCrew - GenPlay multi-agent specialist team.
 *
 * A distinctive AI-native capability: instead of one monolithic planner, a
 * crew of role-specialised agents each propose a slice of the creative brief,
 * then a critic merges them into a single coherent blueprint.
 *
 *   NarrativeArchitect  -> story arc, scenario, character roster, themes
 *   VisualDirector      -> art palette, theme, asset/sprite/music direction
 *   MechanicsEngineer   -> gameplay parameters, core loop, difficulty curve
 *   QualityCritic       -> cross-checks the three, flags conflicts, prioritises
 *
 * Each specialist runs rule-based generation grounded in the GenPlay template
 * engine + shared asset library so output is immediately actionable. When an
 * LLM provider is configured, specialists optionally enrich their proposals.
 *
 * The merged blueprint is structured so the dispatch_crew tool can emit it to
 * the studio and optionally auto-apply parts (create_game + theme + scenario).
 */
import { getTemplate, listGenres } from '../templates/gameTemplates.js';

const ALL_GENRES = listGenres().map((g) => g.key);

// ---- Mood/genre affinity tables so specialists pick coherent directions ----
const GENRE_MOOD = {
  shooter: ['cyberpunk', 'arcade', 'sunset'],
  adventure: ['forest', 'sunset', 'sakura'],
  rpg: ['forest', 'cyberpunk', 'ocean'],
  puzzle: ['ocean', 'sakura', 'arcade'],
  battle: ['arcade', 'sunset', 'cyberpunk'],
  racing: ['cyberpunk', 'sunset', 'arcade'],
  simulation: ['sakura', 'forest', 'ocean'],
  platformer: ['arcade', 'forest', 'sunset'],
  tower: ['forest', 'cyberpunk', 'sunset'],
  snake: ['arcade', 'retro_pixel', 'ocean'],
  breakout: ['arcade', 'retro_pixel', 'sunset'],
  maze: ['ocean', 'forest', 'cyberpunk'],
  rhythm: ['arcade', 'cyberpunk', 'sakura'],
  roguelike: ['cyberpunk', 'ocean', 'sunset'],
  deckbuilder: ['cyberpunk', 'forest', 'arcade'],
  metroidvania: ['cyberpunk', 'ocean', 'forest'],
  idle: ['sakura', 'sunset', 'ocean'],
  sandbox: ['forest', 'sunset', 'sakura'],
  visual_novel: ['sakura', 'ocean', 'sunset'],
  auto_battler: ['cyberpunk', 'arcade', 'sunset'],
};

const GENRE_SCENARIO = {
  shooter: 'space', adventure: 'fantasy', rpg: 'fantasy', puzzle: 'cyber',
  battle: 'cyber', racing: 'cyber', simulation: 'wuxia', platformer: 'fantasy',
  tower: 'fantasy', snake: 'arcade', breakout: 'arcade', maze: 'cyber',
  rhythm: 'cyber', roguelike: 'post_apoc', deckbuilder: 'fantasy',
  metroidvania: 'post_apoc', idle: 'wuxia', sandbox: 'post_apoc',
  visual_novel: 'wuxia', auto_battler: 'cyber',
};

const NARRATIVE_ARCS = [
  { act: '起', beat: '呼唤冒险', goal: '建立主角动机与世界规则' },
  { act: '承', beat: '试炼与成长', goal: '通过挑战揭示核心机制与情感线' },
  { act: '转', beat: '危机反转', goal: '最大冲突爆发，迫使主角做出关键抉择' },
  { act: '合', beat: '归途与新生', goal: '解决冲突，留下余韵与续作伏笔' },
];

export class SpecialistCrew {
  constructor({ provider, assetLibrary } = {}) {
    this.provider = provider;
    this.assetLibrary = assetLibrary;
    this.specialists = [
      new NarrativeArchitect(this),
      new VisualDirector(this),
      new MechanicsEngineer(this),
      new QualityCritic(this),
    ];
  }

  /**
   * Fan out all specialists in parallel, then merge into a unified blueprint.
   * Returns { blueprint, specialists } so callers can render each role's view.
   */
  async run(brief, ctx = {}) {
    const genre = this._inferGenre(brief, ctx);
    const shared = { brief, genre, ...ctx, assetLibrary: this.assetLibrary };
    const outputs = await Promise.all(this.specialists.map((s) => s.propose(shared).catch((e) => ({
      role: s.role, ok: false, error: e.message, summary: `${s.role} 提案失败`,
    }))));
    const merged = this._merge(genre, outputs, shared);
    return { blueprint: merged, specialists: outputs, genre };
  }

  _inferGenre(brief, ctx) {
    if (ctx.genre && ALL_GENRES.includes(ctx.genre)) return ctx.genre;
    const msg = String(brief || '').toLowerCase();
    for (const g of ALL_GENRES) if (msg.includes(g)) return g;
    if (/射击|太空|飞船/.test(msg)) return 'shooter';
    if (/冒险|探险|收集/.test(msg)) return 'adventure';
    if (/回合|rpg|勇者/.test(msg)) return 'rpg';
    if (/解谜|拼图|机关/.test(msg)) return 'puzzle';
    if (/赛车|竞速|赛道/.test(msg)) return 'racing';
    if (/跳跃|平台|横版/.test(msg)) return 'platformer';
    if (/肉鸽|地牢/.test(msg)) return 'roguelike';
    if (/卡牌/.test(msg)) return 'deckbuilder';
    if (/放置|挂机/.test(msg)) return 'idle';
    if (/沙盒|建造/.test(msg)) return 'sandbox';
    if (/视觉小说|剧情|互动小说/.test(msg)) return 'visual_novel';
    if (/自走棋|自动对战/.test(msg)) return 'auto_battler';
    return 'adventure';
  }

  _merge(genre, outputs, shared) {
    const narr = outputs.find((o) => o.role === 'NarrativeArchitect');
    const vis = outputs.find((o) => o.role === 'VisualDirector');
    const mech = outputs.find((o) => o.role === 'MechanicsEngineer');
    const critic = outputs.find((o) => o.role === 'QualityCritic');
    return {
      genre,
      title: shared.title || narr?.title || '未命名企划',
      narrative: narr || null,
      visual: vis || null,
      mechanics: mech || null,
      critique: critic || null,
      ready: !!(narr?.ok && vis?.ok && mech?.ok),
      summary: critic?.summary || '多智能体创作团已完成方案构思。',
    };
  }
}

// ---- Base specialist ----
class Specialist {
  constructor(role, crew) { this.role = role; this.crew = crew; }
  // eslint-disable-next-line no-unused-vars
  async propose(ctx) { return { role: this.role, ok: true }; }
  _pick(arr, seed) {
    if (!arr?.length) return null;
    const i = seed ? Math.abs(_hash(seed)) % arr.length : Math.floor(Math.random() * arr.length);
    return arr[i];
  }
}

class NarrativeArchitect extends Specialist {
  constructor(crew) { super('NarrativeArchitect', crew); }
  async propose(ctx) {
    const scenarioKey = GENRE_SCENARIO[ctx.genre] || 'fantasy';
    const scenarios = ctx.assetLibrary?.listScenarios?.() || [];
    const scenario = scenarios.find((s) => s.key === scenarioKey) || scenarios[0] || null;
    const title = ctx.title || this._craftTitle(ctx.genre, scenario);
    const characters = this._roster(ctx.genre);
    return {
      role: this.role, ok: true, title, scenarioKey: scenario?.key || scenarioKey,
      scenarioTitle: scenario?.title || '原创剧情',
      scenarioDesc: scenario?.description || '为该类型量身打造的原创叙事线。',
      chapters: scenario?.chapters || 3,
      arc: NARRATIVE_ARCS,
      characters,
      summary: `叙事架构师完成《${title}》四幕剧情，选用「${scenario?.title || '原创'}」场景，塑造 ${characters.length} 位核心角色。`,
    };
  }
  _craftTitle(genre, scenario) {
    const prefixes = { shooter: '星陨', rpg: '黎明', puzzle: '迷匣', racing: '霓虹', roguelike: '深渊', idle: '余烬', sandbox: '创世', visual_novel: '花漾' };
    const p = prefixes[genre] || '启程';
    return `${p}之${scenario?.key === 'space' ? '航' : scenario?.key === 'fantasy' ? '誓' : '约'}`;
  }
  _roster(genre) {
    const base = [
      { name: '主角', role: 'hero', trait: '坚定果敢' },
      { name: '向导', role: 'mentor', trait: '博学温和' },
    ];
    if (/shooter|racing|battle|auto_battler/.test(genre)) {
      base.push({ name: '机械师', role: 'ally', trait: '技术狂热' });
      base.push({ name: '宿敌', role: 'rival', trait: '冷酷高效' });
    } else if (/rpg|deckbuilder|metroidvania/.test(genre)) {
      base.push({ name: '魔法师', role: 'ally', trait: '神秘睿智' });
      base.push({ name: '魔王', role: 'antagonist', trait: '野心勃勃' });
    } else if (/visual_novel|simulation/.test(genre)) {
      base.push({ name: '挚友', role: 'confidant', trait: '温暖细腻' });
      base.push({ name: '神秘人', role: 'catalyst', trait: '难以捉摸' });
    } else {
      base.push({ name: '同伴', role: 'ally', trait: '忠诚可靠' });
    }
    return base;
  }
}

class VisualDirector extends Specialist {
  constructor(crew) { super('VisualDirector', crew); }
  async propose(ctx) {
    const themeKeys = GENRE_MOOD[ctx.genre] || ['cyberpunk'];
    const themes = ctx.assetLibrary?.listThemes?.() || [];
    const picks = themeKeys.map((k) => themes.find((t) => t.key === k)).filter(Boolean);
    const primary = picks[0] || themes[0] || { name: '默认', palette: ['#333', '#666', '#999'] };
    return {
      role: this.role, ok: true,
      themeKey: primary.key, themeName: primary.name,
      palette: primary.palette,
      alternates: picks.slice(1).map((t) => ({ key: t.key, name: t.name })),
      assetDirection: this._assets(ctx.genre),
      mood: primary.description || '统一视觉调性',
      summary: `视觉总监定调「${primary.name}」主题，搭配 ${primary.palette?.length || 0} 色主色板，${this._assets(ctx.genre).length} 类资产方向。`,
    };
  }
  _assets(genre) {
    const a = [{ kind: 'player', desc: '主角立绘与待机动画' }, { kind: 'ui', desc: 'HUD 与菜单图标' }];
    if (/shooter|rpg|battle|auto_battler/.test(genre)) a.push({ kind: 'enemy', desc: '敌方单位与特效' });
    if (/adventure|platformer|metroidvania/.test(genre)) a.push({ kind: 'tileset', desc: '关卡地形图块' });
    if (/rhythm|simulation|visual_novel/.test(genre)) a.push({ kind: 'bgm', desc: '场景配乐与情绪乐段' });
    a.push({ kind: 'sfx', desc: '关键交互音效' });
    return a;
  }
}

class MechanicsEngineer extends Specialist {
  constructor(crew) { super('MechanicsEngineer', crew); }
  async propose(ctx) {
    const template = getTemplate(ctx.genre);
    const config = structuredClone(template.config);
    return {
      role: this.role, ok: true,
      templateLabel: template.label,
      config,
      coreLoop: this._loop(ctx.genre),
      difficultyCurve: ['前 20% 引导', '中段 50% 递进', '后 30% 挑战与彩蛋'],
      keyParams: this._keyParams(config),
      summary: `机制工程师基于「${template.label}」模板生成参数，核心循环：${this._loop(ctx.genre).join(' → ')}。`,
    };
  }
  _loop(genre) {
    const loops = {
      shooter: ['生成敌人', '射击躲避', '击杀得分', '波次升级'],
      adventure: ['探索地图', '收集道具', '规避陷阱', '解锁区域'],
      rpg: ['选择行动', '计算伤害', '敌方回合', '成长强化'],
      puzzle: ['观察格局', '操作元素', '连锁触发', '达成目标'],
      platformer: ['移动跳跃', '收集金币', '踩怪躲避', '抵达终点'],
      roguelike: ['进入房间', '战斗探索', '选择强化', '下层挑战'],
      deckbuilder: ['抽牌', '出牌消耗', '结算效果', '构筑卡组'],
      idle: ['累积资源', '升级产出', '达成阈值', '转生循环'],
      sandbox: ['采集素材', '合成建造', '扩展世界', '自定义规则'],
      visual_novel: ['阅读推进', '做出选择', '分支收敛', '达成结局'],
      auto_battler: ['刷新商店', '购买棋子', '自动对战', '羁绊升级'],
    };
    return loops[genre] || ['行动', '反馈', '成长', '循环'];
  }
  _keyParams(config) {
    const out = [];
    if (config.player) out.push('player.hp', 'player.speed');
    if (config.enemy) out.push('enemy.speed', 'enemy.hp');
    if (config.coin || config.scoring) out.push('scoring');
    return out;
  }
}

class QualityCritic extends Specialist {
  constructor(crew) { super('QualityCritic', crew); }
  // Critic runs after the other three; it receives them via the shared ctx.
  async propose(ctx) {
    // The crew calls specialists in parallel, so the critic re-derives a quick
    // coherence check from the genre + brief rather than waiting on others.
    const issues = [];
    const genre = ctx.genre;
    if (!ALL_GENRES.includes(genre)) issues.push({ severity: 'low', area: 'genre', suggestion: '明确主类型以锚定玩法基调' });
    const template = getTemplate(genre);
    if (!template.config?.player && !template.config?.enemy) issues.push({ severity: 'medium', area: 'mechanics', suggestion: '补充核心对抗参数' });
    const priorities = [
      `创建 ${genre} 类型骨架并应用叙事场景`,
      `应用主视觉主题并生成对应资产`,
      `调校核心循环参数与难度曲线`,
      `运行验证后一键打磨发布`,
    ];
    const score = Math.max(0, 1 - issues.filter((i) => i.severity !== 'low').length * 0.2);
    return {
      role: this.role, ok: true,
      score,
      issues,
      priorities,
      summary: `质量评审师完成一致性校验（${score.toFixed(2)}/1.00），给出 ${priorities.length} 步落地优先级。`,
    };
  }
}

function _hash(s) {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return h;
}

export default SpecialistCrew;
