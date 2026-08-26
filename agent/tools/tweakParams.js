/**
 * tweak_params - 游戏参数调优工具
 * 对玩家速度、血量、伤害、难度等核心数值做精细化调整，
 * 同时向编辑器前端发射 studio 同步信号。
 */
const DIFFICULTY_PRESETS = {
  easy:   { enemy: { speed: 0.7, hp: 0.8 }, player: { speed: 1.15, hp: 1.5 } },
  normal: { enemy: { speed: 1.0, hp: 1.0 }, player: { speed: 1.0,  hp: 1.0 } },
  hard:   { enemy: { speed: 1.25, hp: 1.3 }, player: { speed: 0.95, hp: 0.85 } },
  hell:   { enemy: { speed: 1.55, hp: 1.7 }, player: { speed: 0.9,  hp: 0.7 } },
};

export function tweakParamsTool({ gameService }) {
  return {
    name: 'tweak_params',
    description: '调整游戏核心参数：玩家速度、血量、伤害、难度预设、敌人强度等',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: '目标游戏 ID' },
        speed: { type: 'number', description: '玩家移动速度（绝对值）' },
        hp: { type: 'number', description: '玩家生命值（绝对值）' },
        damage: { type: 'number', description: '玩家单次攻击伤害' },
        difficulty: { type: 'string', description: '难度预设：easy/normal/hard/hell 或 简单/普通/困难/地狱' },
        enemySpeed: { type: 'number', description: '敌人速度倍率或绝对值' },
        enemyHp: { type: 'number', description: '敌人血量倍率或绝对值' },
      },
    },
    async execute({ gameId, speed, hp, damage, difficulty, enemySpeed, enemyHp }) {
      if (!gameService) return { ok: false, error: '游戏数据服务未就绪' };
      if (!gameId) return { ok: false, error: '缺少 gameId' };
      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `未找到游戏：${gameId}` };

      const before = structuredClone(game.config || {});
      const cfg = structuredClone(game.config || {});
      const changes = [];

      // Apply difficulty preset first (multiplier based)
      if (difficulty) {
        const key = difficulty.toLowerCase();
        const preset = DIFFICULTY_PRESETS[key] || DIFFICULTY_PRESETS[key === '简单' ? 'easy' : key === '困难' ? 'hard' : key === '地狱' ? 'hell' : 'normal'];
        if (preset && cfg.player) {
          if (typeof cfg.player.speed === 'number') cfg.player.speed = round2(cfg.player.speed * preset.player.speed);
          if (typeof cfg.player.hp === 'number') cfg.player.hp = round(cfg.player.hp * preset.player.hp);
        }
        if (preset && cfg.enemy) {
          if (typeof cfg.enemy.speed === 'number') cfg.enemy.speed = round2(cfg.enemy.speed * preset.enemy.speed);
          if (typeof cfg.enemy.hp === 'number') cfg.enemy.hp = round(cfg.enemy.hp * preset.enemy.hp);
        }
        changes.push(`难度预设：${difficulty}`);
      }

      // Override specific absolute values after preset
      if (typeof speed === 'number' && cfg.player) {
        cfg.player.speed = round2(speed);
        changes.push(`玩家速度 → ${cfg.player.speed}`);
      }
      if (typeof hp === 'number' && cfg.player) {
        cfg.player.hp = round(hp);
        changes.push(`玩家生命值 → ${cfg.player.hp}`);
      }
      if (typeof damage === 'number' && cfg.player) {
        cfg.player.atk = round(damage);
        changes.push(`玩家攻击力 → ${cfg.player.atk}`);
      }
      if (typeof enemySpeed === 'number' && cfg.enemy) {
        cfg.enemy.speed = round2(enemySpeed);
        changes.push(`敌人速度 → ${cfg.enemy.speed}`);
      }
      if (typeof enemyHp === 'number' && cfg.enemy) {
        cfg.enemy.hp = round(enemyHp);
        changes.push(`敌人血量 → ${cfg.enemy.hp}`);
      }

      if (changes.length === 0) {
        return { ok: false, error: '未提供任何可调整的参数。可用：speed / hp / damage / difficulty / enemySpeed / enemyHp。' };
      }

      const updated = await gameService.update(gameId, {
        config: cfg,
        updatedAt: new Date().toISOString(),
        tweakLog: [...(game.tweakLog || []), { at: new Date().toISOString(), changes }],
      });

      // Emit editor sync signal so frontend studio reflects the new config
      const editorActions = [{
        type: 'studio:patch-config',
        gameId,
        payload: { before, after: cfg, changes },
      }];

      return {
        ok: true,
        game: updated,
        before,
        after: cfg,
        editorActions,
        summary: `已对「${game.name}」调参：${changes.join('；')}。创作工坊实时同步已刷新。`,
      };
    },
  };
}

function round(n) { return Math.max(1, Math.round(Number(n))); }
function round2(n) { return Math.round(Number(n) * 100) / 100; }
