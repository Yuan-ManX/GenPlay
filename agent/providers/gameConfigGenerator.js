/**
 * GameConfigGenerator - AI 游戏配置生成器
 *
 * 职责：根据用户的自然语言描述 + 选定 genre，
 *   1) 调用 LLM 输出符合该 genre config schema 的差异化 JSON（覆盖模板默认值）
 *   2) LLM 未启用时，回退到本地规则引擎（按描述关键词调整难度/属性/规则）
 *
 * 设计要点：
 *  - 输出始终是合法 config（不破坏前端引擎约定的字段）
 *  - 与模板默认值深度合并（LLM 仅覆盖差异部分，未声明字段保留模板值）
 *  - LLM 失败时静默回退，不阻断游戏创建
 */

import { getTemplate } from '../templates/gameTemplates.js';

// 各 genre 的 config schema 约束（用于约束 LLM 输出 + 本地规则调整）
const SCHEMA = {
  shooter:   { player: ['hp','speed','fireRate','bulletSpeed'], enemy: ['spawnEvery','speed','hp'], scoring: ['kill'] },
  adventure: { player: ['hp','speed'], coin: ['spawnEvery','speed','value'], enemy: ['spawnEvery','speed'], scoring: ['coin'] },
  rpg:       { player: ['name','hp','mp','atk','def','skills'], enemy: ['name','hp','atk','def','ai'], turn: ['mode'] },
  puzzle:    { grid: ['size'] },
  battle:    { player: ['name','hp','speed','attacks','block'], enemy: ['name','hp','speed','ai','attacks'], stage: ['width','height','ground'] },
  racing:    { player: ['speed','lanes'], obstacle: ['spawnEvery','speed'], scoring: ['survive'] },
  simulation:{ player: ['speed','capacity'], resource: ['spawnEvery','types','value'], scoring: ['collect'] },
  platformer:{ player: ['speed','jumpForce','gravity','maxJumps'], enemy: ['spawnEvery','speed'], scoring: ['stomp','coin'] },
  tower:     { player: ['gold','lives'], tower: ['cost','range','damage','fireRate'], enemy: ['spawnEvery','hp','speed','reward'], wave: ['count','enemiesPerWave'] },
  snake:     { grid: ['cellSize','cols','rows'], snake: ['speed','initialLength'], food: ['value','growth'] },
  breakout:  { paddle: ['w','speed'], ball: ['r','speed'], brick: ['rows','cols','w','h','gap','hp'] },
  maze:      { grid: ['cols','rows','cellSize'], player: ['speed'] },
  rhythm:    { track: ['lanes','noteSpeed','hitLine'], song: ['bpm','notes'], scoring: ['perfect','good','miss'], judgement: ['perfect','good','miss'] },
};

// 本地规则：按描述关键词推断难度修饰因子
const LOCAL_RULES = [
  { pattern: /(地狱|困难|hard|hardcore|nightmare|insane|very hard|极难)/i, factor: { hp: 0.6, speed: 1.4, spawn: 0.7, dmg: 1.3 } },
  { pattern: /(简单|easy|简单模式|休闲|casual|轻松)/i, factor: { hp: 1.5, speed: 0.7, spawn: 1.5, dmg: 0.6 } },
  { pattern: /(普通|normal|medium|中等)/i, factor: { hp: 1.0, speed: 1.0, spawn: 1.0, dmg: 1.0 } },
  { pattern: /(快速|fast|极速|高速|狂飙)/i, factor: { hp: 0.9, speed: 1.5, spawn: 0.85, dmg: 1.0 } },
  { pattern: /(慢速|slow|悠闲|慢节奏)/i, factor: { hp: 1.1, speed: 0.7, spawn: 1.3, dmg: 0.9 } },
  { pattern: /( Boss|首领|boss|精英)/i, factor: { hp: 1.4, speed: 1.1, spawn: 0.85, dmg: 1.4 } },
  { pattern: /(大量|潮涌|swarm|海量|无数)/i, factor: { hp: 0.9, speed: 1.0, spawn: 0.5, dmg: 1.0 } },
  { pattern: /(迷你|mini|小型|small)/i, factor: { hp: 0.85, speed: 1.0, spawn: 1.0, dmg: 0.9 } },
  { pattern: /(巨型|huge|giant|大型|boss-size)/i, factor: { hp: 1.6, speed: 0.85, spawn: 1.2, dmg: 1.2 } },
];

export class GameConfigGenerator {
  constructor({ provider } = {}) {
    this.provider = provider;
  }

  /**
   * 生成专属 config
   * @param {string} genre - 游戏类型 key
   * @param {string} description - 用户描述
   * @param {object} baseConfig - 模板默认 config（作为合并基线）
   * @returns {Promise<{config, source: 'llm'|'local'|'template', note: string}>}
   */
  async generate(genre, description, baseConfig) {
    // 1. 优先尝试 LLM 生成
    if (this.provider?.enabled) {
      try {
        const llmConfig = await this._callLLM(genre, description, baseConfig);
        if (llmConfig) {
          return {
            config: deepMerge(baseConfig, llmConfig),
            source: 'llm',
            note: '已由 LLM 根据你的描述生成专属玩法参数',
          };
        }
      } catch (err) {
        // 静默回退
      }
    }
    // 2. 本地规则生成
    const localConfig = this._localAdjust(genre, description, baseConfig);
    if (localConfig) {
      return {
        config: localConfig,
        source: 'local',
        note: '已根据描述关键词调整难度与参数（未配置 LLM Key，启用本地规则引擎）',
      };
    }
    // 3. 模板默认
    return { config: baseConfig, source: 'template', note: '已使用类型默认参数' };
  }

  async _callLLM(genre, description, baseConfig) {
    const schema = SCHEMA[genre];
    if (!schema) return null;

    const prompt = this._buildPrompt(genre, description, baseConfig, schema);
    const reply = await this.provider.chat({
      systemPrompt: '你是 GenPlay 游戏参数生成器。仅输出严格 JSON，不要任何解释文字、不要 markdown 代码块标记。',
      history: [],
      userMessage: prompt,
    });
    return this._parseLLMJson(reply, schema);
  }

  _buildPrompt(genre, description, baseConfig, schema) {
    const schemaDesc = Object.entries(schema)
      .map(([group, keys]) => `${group}: { ${keys.join(', ')} }`)
      .join('\n');
    return [
      `游戏类型：${genre}`,
      `玩家描述：${description || '（未提供具体描述，使用合理默认）'}`,
      `当前模板默认 config：${JSON.stringify(baseConfig)}`,
      ``,
      `可调整字段（仅输出这些字段的子集，不要添加新字段）：`,
      schemaDesc,
      ``,
      `请根据描述调整上述字段的数值，输出严格 JSON。要求：`,
      `1. 仅输出 JSON 对象，无任何前后缀`,
      `2. 数值合理且与描述语义匹配（如"困难"则降低玩家HP、提升敌人速度）`,
      `3. 数组字段（如 skills、types）可整体替换`,
      `4. 未提及的字段不要输出（保留模板默认值）`,
    ].join('\n');
  }

  _parseLLMJson(reply, schema) {
    if (!reply) return null;
    // 剥离可能的 markdown 代码块
    let text = String(reply).trim();
    text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end < 0) return null;
    try {
      const obj = JSON.parse(text.slice(start, end + 1));
      // 过滤掉 schema 外的字段
      const cleaned = {};
      for (const group of Object.keys(schema)) {
        if (obj[group] && typeof obj[group] === 'object') {
          cleaned[group] = {};
          for (const key of schema[group]) {
            if (key in obj[group]) cleaned[group][key] = obj[group][key];
          }
        }
      }
      return Object.keys(cleaned).length ? cleaned : null;
    } catch {
      return null;
    }
  }

  _localAdjust(genre, description, baseConfig) {
    const desc = String(description || '');
    if (!desc) return null;

    // 收集所有匹配的规则，累乘因子
    let factor = { hp: 1, speed: 1, spawn: 1, dmg: 1 };
    let matched = false;
    for (const rule of LOCAL_RULES) {
      if (rule.pattern.test(desc)) {
        matched = true;
        for (const k of Object.keys(factor)) {
          factor[k] *= rule.factor[k];
        }
      }
    }
    if (!matched) return null;

    const config = structuredClone(baseConfig);
    const apply = applyGenreAdjust(genre, factor);
    apply(config);
    return config;
  }
}

// 各 genre 的本地调整函数：把抽象因子映射到具体字段
function applyGenreAdjust(genre, f) {
  const adjusters = {
    shooter: (c) => {
      if (c.player) { c.player.hp = Math.max(1, Math.round((c.player.hp || 3) * f.hp)); c.player.speed = round1((c.player.speed || 4.6) * f.speed); }
      if (c.enemy) { c.enemy.spawnEvery = Math.max(8, Math.round((c.enemy.spawnEvery || 36) * f.spawn)); c.enemy.speed = round1((c.enemy.speed || 1.6) * f.speed); }
    },
    adventure: (c) => {
      if (c.player) { c.player.hp = Math.max(1, Math.round((c.player.hp || 1) * f.hp)); c.player.speed = round1((c.player.speed || 4.6) * f.speed); }
      if (c.enemy) { c.enemy.spawnEvery = Math.max(8, Math.round((c.enemy.spawnEvery || 36) * f.spawn)); }
      if (c.coin) { c.coin.spawnEvery = Math.max(20, Math.round((c.coin.spawnEvery || 60) * f.spawn)); }
    },
    rpg: (c) => {
      if (c.player) { c.player.hp = Math.round((c.player.hp || 100) * f.hp); c.player.atk = Math.round((c.player.atk || 18) * f.dmg); c.player.def = Math.round((c.player.def || 6) * f.hp); }
      if (c.enemy) { c.enemy.hp = Math.round((c.enemy.hp || 80) * f.hp * 1.2); c.enemy.atk = Math.round((c.enemy.atk || 12) * f.dmg); }
    },
    puzzle: (c) => {
      if (c.grid) c.grid.size = Math.min(6, Math.max(3, Math.round((c.grid.size || 3) + (f.hp < 1 ? 1 : 0))));
    },
    battle: (c) => {
      if (c.player) { c.player.hp = Math.round((c.player.hp || 100) * f.hp); }
      if (c.enemy) { c.enemy.hp = Math.round((c.enemy.hp || 100) * f.hp * 1.1); c.enemy.speed = round1((c.enemy.speed || 3.5) * f.speed); }
    },
    racing: (c) => {
      if (c.player) c.player.speed = round1((c.player.speed || 5.2) * f.speed);
      if (c.obstacle) { c.obstacle.spawnEvery = Math.max(8, Math.round((c.obstacle.spawnEvery || 24) * f.spawn)); c.obstacle.speed = round1((c.obstacle.speed || 3.2) * f.speed); }
    },
    simulation: (c) => {
      if (c.player) c.player.speed = round1((c.player.speed || 4) * f.speed);
      if (c.resource) c.resource.spawnEvery = Math.max(15, Math.round((c.resource.spawnEvery || 50) * f.spawn));
    },
    platformer: (c) => {
      if (c.player) { c.player.speed = round1((c.player.speed || 3.2) * f.speed); c.player.jumpForce = round1((c.player.jumpForce || 11) * (f.speed > 1 ? 1.1 : 0.95)); }
      if (c.enemy) c.enemy.spawnEvery = Math.max(30, Math.round((c.enemy.spawnEvery || 90) * f.spawn));
    },
    tower: (c) => {
      if (c.enemy) { c.enemy.hp = Math.round((c.enemy.hp || 30) * f.hp * 1.3); c.enemy.speed = round1((c.enemy.speed || 1) * f.speed); c.enemy.spawnEvery = Math.max(30, Math.round((c.enemy.spawnEvery || 90) * f.spawn)); }
      if (c.tower) c.tower.damage = Math.round((c.tower.damage || 8) * f.dmg);
      if (c.player) c.player.gold = Math.round((c.player.gold || 100) * (f.hp < 1 ? 1.3 : 1));
    },
    snake: (c) => {
      if (c.snake) c.snake.speed = Math.max(3, Math.min(20, Math.round((c.snake.speed || 8) * f.speed)));
    },
    breakout: (c) => {
      if (c.paddle) c.paddle.speed = round1((c.paddle.speed || 6) * f.speed);
      if (c.ball) c.ball.speed = round1((c.ball.speed || 4) * f.speed);
      if (c.brick) c.brick.rows = Math.max(2, Math.min(8, Math.round((c.brick.rows || 5) * (f.hp < 1 ? 1.4 : 0.8))));
    },
    maze: (c) => {
      if (c.grid) { c.grid.cols = Math.max(8, Math.min(25, Math.round((c.grid.cols || 15) * (f.hp < 1 ? 1.3 : 0.85)))); c.grid.rows = Math.max(6, Math.min(18, Math.round((c.grid.rows || 10) * (f.hp < 1 ? 1.3 : 0.85)))); }
    },
    rhythm: (c) => {
      if (c.track) c.track.noteSpeed = round1((c.track.noteSpeed || 3.2) * f.speed);
      if (c.song) c.song.bpm = Math.round((c.song.bpm || 120) * f.speed);
    },
  };
  return adjusters[genre] || (() => {});
}

function round1(v) { return Math.round(v * 10) / 10; }

function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) return override !== undefined ? override : base;
  if (typeof base !== 'object' || base === null) return override !== undefined ? override : base;
  if (typeof override !== 'object' || override === null) return override !== undefined ? override : base;
  const out = { ...base };
  for (const k of Object.keys(override)) {
    out[k] = deepMerge(base[k], override[k]);
  }
  return out;
}

export { SCHEMA, LOCAL_RULES };
