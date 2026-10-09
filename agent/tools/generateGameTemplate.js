/**
 * generate_game_template - Create a genre-specific game with pre-configured
 * settings, assets, NPCs, scripts, audio, and progression. Unlike create_game
 * (which creates a bare skeleton), this tool produces a fully-featured starter
 * game tailored to the chosen genre — including balanced config, a fitting
 * theme, a narrative hook, and genre-specific gameplay mechanics.
 * AI-native: when LLM is available, generates a custom game name, description,
 * and unique mechanic twist.
 */

// Genre-specific template blueprints.
const TEMPLATES = {
  shooter: {
    config: {
      player: { hp: 100, speed: 5, atk: 25, fireRate: 0.15, bulletSpeed: 8 },
      enemy: { hp: 30, speed: 2, count: 5, spawnRate: 1.5 },
      winCondition: { type: 'score', threshold: 1000 },
      bullets: { maxPlayer: 20, maxEnemy: 10, size: 4 },
    },
    theme: 'cyberpunk',
    scenario: '太空舰队入侵，玩家驾驶战机保卫基地',
    npcs: [
      { name: '导航员 AI', role: 'ally', dialog: '注意敌方主力舰队正在接近！' },
      { name: '指挥官', role: 'mentor', dialog: '坚持住，增援正在路上。' },
    ],
    assets: [
      { name: '玩家战机', type: 'sprite', url: 'ship_fighter.png' },
      { name: '敌方战机', type: 'sprite', url: 'enemy_drone.png' },
      { name: '星空背景', type: 'background', url: 'space_stars.png' },
    ],
    audio: {
      playlist: [{ id: 'bgm_battle', name: '战斗BGM', mood: 'intense', volume: 0.6, loop: true }],
      sfx: [
        { id: 'sfx_shoot', name: '射击', trigger: 'shoot', volume: 0.4 },
        { id: 'sfx_explode', name: '爆炸', trigger: 'destroy', volume: 0.5 },
      ],
    },
    achievements: [
      { id: 'first_blood', name: '初次击杀', desc: '击落第一架敌机', condition: 'kills>=1' },
      { id: 'ace', name: '王牌飞行员', desc: '单局击落50架敌机', condition: 'kills>=50' },
    ],
    mechanics: ['连射击系统', '护盾道具', 'Boss 战', '波次递增'],
  },
  platformer: {
    config: {
      player: { hp: 3, speed: 4, jumpForce: 12, gravity: 0.6 },
      enemy: { hp: 1, speed: 1.5, count: 3 },
      winCondition: { type: 'reach', target: 'flag' },
      platforms: { count: 15, gapMin: 80, gapMax: 160 },
    },
    theme: 'pixel_art',
    scenario: '勇者穿越浮空岛，寻找失落的星之碎片',
    npcs: [
      { name: '老工匠', role: 'mentor', dialog: '跳到云端之上，碎片就在那里！' },
    ],
    assets: [
      { name: '勇者精灵', type: 'sprite', url: 'hero_sprite.png' },
      { name: '浮空岛', type: 'background', url: 'floating_island.png' },
    ],
    audio: {
      playlist: [{ id: 'bgm_adventure', name: '冒险BGM', mood: 'cheerful', volume: 0.5, loop: true }],
      sfx: [{ id: 'sfx_jump', name: '跳跃', trigger: 'jump', volume: 0.3 }],
    },
    achievements: [
      { id: 'collector', name: '收藏家', desc: '收集所有星之碎片', condition: 'coins>=10' },
    ],
    mechanics: ['二段跳', '移动平台', '弹簧加速', '隐藏区域'],
  },
  rpg: {
    config: {
      player: { hp: 120, atk: 15, def: 10, speed: 3, level: 1, exp: 0 },
      enemy: { hp: 50, atk: 8, def: 5, count: 4 },
      winCondition: { type: 'defeat', target: 'boss' },
    },
    theme: 'fantasy',
    scenario: '预言中的勇者踏上讨伐魔王的旅途',
    npcs: [
      { name: '村长', role: 'quest_giver', dialog: '勇者啊，北方的暗影正在蔓延……' },
      { name: '商人', role: 'shop', dialog: '看看我的商品吧！' },
      { name: '魔王', role: 'antagonist', dialog: '你终究会倒在黑暗之中。' },
    ],
    assets: [
      { name: '勇者立绘', type: 'sprite', url: 'rpg_hero.png' },
      { name: '村庄地图', type: 'background', url: 'rpg_village.png' },
    ],
    audio: {
      playlist: [{ id: 'bgm_town', name: '村庄BGM', mood: 'calm', volume: 0.4, loop: true }],
      sfx: [{ id: 'sfx_levelup', name: '升级', trigger: 'levelup', volume: 0.5 }],
    },
    achievements: [
      { id: 'first_level', name: '初出茅庐', desc: '达到2级', condition: 'level>=2' },
      { id: 'hero', name: '勇者之名', desc: '击败魔王', condition: 'boss_defeated' },
    ],
    mechanics: ['经验升级', '装备系统', '回合战斗', '任务系统'],
  },
  puzzle: {
    config: {
      player: { hp: 1, speed: 0 },
      enemy: { hp: 0, speed: 0, count: 0 },
      winCondition: { type: 'clear', target: 'all' },
      grid: { rows: 8, cols: 8 },
    },
    theme: 'neon',
    scenario: '用智慧点亮所有方块，解开远古谜题',
    npcs: [],
    assets: [
      { name: '方块集', type: 'sprite', url: 'puzzle_blocks.png' },
    ],
    audio: {
      playlist: [{ id: 'bgm_puzzle', name: '解谜BGM', mood: 'mysterious', volume: 0.35, loop: true }],
      sfx: [{ id: 'sfx_match', name: '消除', trigger: 'match', volume: 0.4 }],
    },
    achievements: [
      { id: 'solver', name: '解谜高手', desc: '通关3个关卡', condition: 'stages>=3' },
    ],
    mechanics: ['连锁消除', '限时挑战', '特殊方块', '连击计分'],
  },
  tower: {
    config: {
      player: { hp: 20, speed: 0, gold: 100 },
      enemy: { hp: 40, speed: 1.5, count: 10, spawnRate: 2 },
      winCondition: { type: 'survive', waves: 10 },
      path: { points: [{ x: 0, y: 200 }, { x: 300, y: 200 }, { x: 300, y: 100 }, { x: 600, y: 100 }] },
    },
    theme: 'medieval',
    scenario: '守护王国大门，抵御兽人军团的入侵',
    npcs: [
      { name: '军师', role: 'mentor', dialog: '在路口建箭塔，效率最高！' },
    ],
    assets: [
      { name: '箭塔', type: 'sprite', url: 'tower_arrow.png' },
      { name: '魔法塔', type: 'sprite', url: 'tower_magic.png' },
    ],
    audio: {
      playlist: [{ id: 'bgm_defense', name: '防御BGM', mood: 'tense', volume: 0.5, loop: true }],
      sfx: [{ id: 'sfx_build', name: '建造', trigger: 'build', volume: 0.4 }],
    },
    achievements: [
      { id: 'fortress', name: '铜墙铁壁', desc: '守住10波', condition: 'waves>=10' },
    ],
    mechanics: ['多塔种', '升级系统', '金币经济', '波次难度'],
  },
  roguelike: {
    config: {
      player: { hp: 80, atk: 12, speed: 4, gold: 0 },
      enemy: { hp: 25, atk: 6, count: 6 },
      winCondition: { type: 'descend', floors: 10 },
      dungeon: { floors: 10, roomsPerFloor: 5 },
    },
    theme: 'dark_fantasy',
    scenario: '深入无尽地牢，寻找造物主的遗物',
    npcs: [
      { name: '幽灵商人', role: 'shop', dialog: '嘘……用灵魂换宝藏？' },
    ],
    assets: [
      { name: '地牢瓦片', type: 'sprite', url: 'dungeon_tiles.png' },
    ],
    audio: {
      playlist: [{ id: 'bgm_dungeon', name: '地牢BGM', mood: 'ominous', volume: 0.45, loop: true }],
      sfx: [{ id: 'sfx_loot', name: '拾取', trigger: 'pickup', volume: 0.35 }],
    },
    achievements: [
      { id: 'spelunker', name: '深渊探索者', desc: '到达第5层', condition: 'floor>=5' },
    ],
    mechanics: ['随机生成', '永久死亡', '遗物系统', '背包管理'],
  },
  racing: {
    config: {
      player: { hp: 1, speed: 8, acceleration: 0.3, maxSpeed: 15 },
      enemy: { hp: 1, speed: 7, count: 5 },
      winCondition: { type: 'finish', laps: 3 },
    },
    theme: 'neon',
    scenario: '未来都市夜间竞速，争夺街头车神之名',
    npcs: [
      { name: '技师', role: 'mentor', dialog: '弯道漂移能更快！' },
    ],
    assets: [
      { name: '赛车', type: 'sprite', url: 'race_car.png' },
      { name: '赛道', type: 'background', url: 'neon_track.png' },
    ],
    audio: {
      playlist: [{ id: 'bgm_race', name: '竞速BGM', mood: 'energetic', volume: 0.6, loop: true }],
      sfx: [{ id: 'sfx_drift', name: '漂移', trigger: 'drift', volume: 0.4 }],
    },
    achievements: [
      { id: 'speedster', name: '极速', desc: '单圈速度超过12', condition: 'speed>=12' },
    ],
    mechanics: ['漂移加速', '道具系统', '圈数计时', '排名竞争'],
  },
  rhythm: {
    config: {
      player: { hp: 1, speed: 0 },
      enemy: { hp: 0, count: 0 },
      winCondition: { type: 'score', threshold: 5000 },
      bpm: 120, notesPerBeat: 2,
    },
    theme: 'neon',
    scenario: '跟随音乐节拍，点亮星空的旋律',
    npcs: [],
    assets: [
      { name: '音符', type: 'sprite', url: 'note_icon.png' },
    ],
    audio: {
      playlist: [{ id: 'bgm_rhythm', name: '旋律BGM', mood: 'upbeat', volume: 0.7, loop: true }],
      sfx: [{ id: 'sfx_hit', name: '命中', trigger: 'hit', volume: 0.3 }],
    },
    achievements: [
      { id: 'perfect', name: '完美连击', desc: '100连击', condition: 'combo>=100' },
    ],
    mechanics: ['节拍判定', '连击计分', '多轨音符', '难度递增'],
  },
};

// Fallback for genres without a dedicated template.
function genericTemplate(genre) {
  return {
    config: {
      player: { hp: 100, speed: 4, atk: 10 },
      enemy: { hp: 30, speed: 2, count: 3 },
      winCondition: { type: 'score', threshold: 500 },
    },
    theme: 'default',
    scenario: `${genre} 游戏冒险`,
    npcs: [],
    assets: [],
    audio: { playlist: [], sfx: [] },
    achievements: [],
    mechanics: ['基础移动', '得分系统'],
  };
}

export function generateGameTemplateTool({ gameService, provider }) {
  return {
    name: 'generate_game_template',
    description: 'Create a fully-featured starter game from a genre template. Pre-configures balanced settings, theme, NPCs, assets, audio, achievements, and mechanics. Faster than create_game + manual configuration.',
    parameters: {
      type: 'object',
      properties: {
        genre: { type: 'string', description: 'Game genre (shooter, platformer, rpg, puzzle, tower, roguelike, racing, rhythm, etc.)' },
        name: { type: 'string', description: 'Game name (auto-generated if omitted)' },
        difficulty: { type: 'string', description: 'easy | normal | hard (default: normal)' },
      },
      required: ['genre'],
    },
    async execute({ genre, name, difficulty, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      const g = (genre || 'adventure').toLowerCase();
      const tmpl = TEMPLATES[g] || genericTemplate(g);

      // Apply difficulty modifier.
      const diff = (difficulty || 'normal').toLowerCase();
      const config = JSON.parse(JSON.stringify(tmpl.config));
      if (diff === 'easy') {
        if (config.player?.hp) config.player.hp = Math.round(config.player.hp * 1.5);
        if (config.enemy?.hp) config.enemy.hp = Math.round(config.enemy.hp * 0.7);
        if (config.enemy?.count) config.enemy.count = Math.max(1, Math.round(config.enemy.count * 0.7));
      } else if (diff === 'hard') {
        if (config.player?.hp) config.player.hp = Math.round(config.player.hp * 0.7);
        if (config.enemy?.hp) config.enemy.hp = Math.round(config.enemy.hp * 1.4);
        if (config.enemy?.count) config.enemy.count = Math.round(config.enemy.count * 1.4);
        if (config.enemy?.speed) config.enemy.speed = +(config.enemy.speed * 1.2).toFixed(1);
      }

      // LLM enhancement: custom name and unique mechanic twist.
      let gameName = name || `${g}_${Date.now().toString(36)}`;
      let mechanicTwist = '';
      if (provider?.enabled && provider.chat) {
        try {
          const prompt = `For a ${g} game, suggest a creative Chinese name (max 6 chars) and one unique gameplay twist (1 sentence). Format: name|twist`;
          const resp = await provider.chat([{ role: 'user', content: prompt }], { maxTokens: 80 });
          if (resp?.content) {
            const parts = resp.content.split('|');
            if (parts[0]?.trim()) gameName = parts[0].trim();
            if (parts[1]?.trim()) mechanicTwist = parts[1].trim();
          }
        } catch (_) { /* fall back to defaults */ }
      }

      const game = await gameService.create({
        name: gameName,
        genre: g,
        description: tmpl.scenario,
        config,
        theme: tmpl.theme,
        scenario: tmpl.scenario,
        status: 'draft',
      });

      // Persist extended fields (npcs, assets, audio, meta, mechanics)
      // via update, since create() only stores core fields.
      const updated = await gameService.update(game.id, {
        npcs: tmpl.npcs,
        assets: tmpl.assets,
        audio: tmpl.audio,
        meta: {
          achievements: tmpl.achievements,
          leaderboards: [{ id: 'score', name: '高分榜', scope: 'global' }],
        },
        mechanics: mechanicTwist ? [...tmpl.mechanics, mechanicTwist] : tmpl.mechanics,
      });

      const finalGame = updated || { ...game, npcs: tmpl.npcs, assets: tmpl.assets, audio: tmpl.audio, meta: { achievements: tmpl.achievements, leaderboards: [{ id: 'score', name: '高分榜', scope: 'global' }] }, mechanics: mechanicTwist ? [...tmpl.mechanics, mechanicTwist] : tmpl.mechanics };

      return {
        ok: true,
        gameId: game.id,
        game: finalGame,
        template: g,
        difficulty: diff,
        summary: `已从${g}模板创建游戏「${gameName}」${mechanicTwist ? `，特色：${mechanicTwist}` : ''}`,
        editorActions: [
          { type: 'studio:load-game', gameId: game.id, payload: game },
          { type: 'sidebar:refresh-list' },
        ],
      };
    },
  };
}
