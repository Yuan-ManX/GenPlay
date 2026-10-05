/**
 * balance_game - Auto-balance game difficulty using playtest feedback.
 * Runs a headless play_test, then adjusts player/enemy config values based on
 * the detected issues (e.g. player dying too fast -> increase hp or decrease
 * enemy damage; no deaths -> increase enemy speed or count).
 * Produces a structured balance report with before/after values.
 */

export function balanceGameTool({ gameService }) {
  return {
    name: 'balance_game',
    description: 'Auto-balance game difficulty by running a playtest simulation and adjusting player/enemy config based on detected issues. Returns a before/after balance report.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        duration: { type: 'number', description: 'Playtest duration in seconds (default 3)' },
        seed: { type: 'number', description: 'Random seed for reproducible simulation' },
        targetDifficulty: { type: 'string', description: 'easy | normal | hard (default: normal)' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, duration, seed, targetDifficulty, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const dur = typeof duration === 'number' ? duration : 3;
      const target = targetDifficulty || 'normal';

      // Target metrics per difficulty.
      const targets = {
        easy: { deaths: 0, minDuration: 5, minScore: 50 },
        normal: { deaths: 1, minDuration: 8, minScore: 200 },
        hard: { deaths: 3, minDuration: 12, minScore: 500 },
      }[target];

      const before = structuredClone(game.config || {});
      const player = before.player || {};
      const enemy = before.enemy || {};

      // Run a simulated playtest to gather feedback.
      const report = simulatePlaytest(game, dur, seed);

      // Derive adjustments from the report.
      const adjustments = [];
      const cfg = structuredClone(before);
      cfg.player = cfg.player || {};
      cfg.enemy = cfg.enemy || {};

      // Too many deaths -> buff player or nerf enemy.
      if (report.deaths > targets.deaths) {
        const nerfFactor = 0.85;
        if (typeof cfg.enemy.speed === 'number') {
          const old = cfg.enemy.speed;
          cfg.enemy.speed = +(old * nerfFactor).toFixed(2);
          adjustments.push({ field: 'enemy.speed', from: old, to: cfg.enemy.speed, reason: '玩家死亡过多，降低敌人速度' });
        }
        if (typeof cfg.player.hp === 'number') {
          const old = cfg.player.hp;
          cfg.player.hp = Math.max(1, Math.round(old + 1));
          adjustments.push({ field: 'player.hp', from: old, to: cfg.player.hp, reason: '玩家死亡过多，增加生命值' });
        }
      }

      // No deaths and high score -> increase challenge.
      if (report.deaths === 0 && report.score > targets.minScore) {
        const buffFactor = 1.15;
        if (typeof cfg.enemy.speed === 'number') {
          const old = cfg.enemy.speed;
          cfg.enemy.speed = +(old * buffFactor).toFixed(2);
          adjustments.push({ field: 'enemy.speed', from: old, to: cfg.enemy.speed, reason: '过于轻松，提高敌人速度' });
        }
        if (typeof cfg.enemy.count === 'number') {
          const old = cfg.enemy.count;
          cfg.enemy.count = old + 1;
          adjustments.push({ field: 'enemy.count', from: old, to: cfg.enemy.count, reason: '过于轻松，增加敌人数量' });
        }
      }

      // Score too low -> reduce enemy count or buff player damage.
      if (report.score < targets.minScore && report.deaths <= targets.deaths) {
        if (typeof cfg.player.atk === 'number') {
          const old = cfg.player.atk;
          cfg.player.atk = Math.round(old * 1.2);
          adjustments.push({ field: 'player.atk', from: old, to: cfg.player.atk, reason: '得分偏低，提高玩家攻击力' });
        }
      }

      // Session too short -> increase enemy spawn interval to give breathing room.
      if (report.duration < targets.minDuration && report.deaths > 0) {
        if (typeof cfg.enemy.spawnEvery === 'number') {
          const old = cfg.enemy.spawnEvery;
          cfg.enemy.spawnEvery = Math.round(old * 1.2);
          adjustments.push({ field: 'enemy.spawnEvery', from: old, to: cfg.enemy.spawnEvery, reason: '游戏过快结束，降低敌人生成频率' });
        }
      }

      let updated = game;
      if (adjustments.length) {
        updated = await gameService.update(gameId, { config: cfg });
      }

      return {
        ok: true,
        game: updated,
        targetDifficulty: target,
        playtest: report,
        adjustments,
        before,
        after: cfg,
        summary: adjustments.length
          ? `平衡调整完成（${adjustments.length} 项）：${adjustments.map((a) => `${a.field} ${a.from}→${a.to}`).join('；')}`
          : '当前数值已较为平衡，无需调整',
        editorActions: [
          {
            type: 'studio:patch-config',
            gameId,
            payload: { after: cfg, changes: adjustments.map((a) => a.field) },
          },
          {
            type: 'studio:show-playtest',
            gameId,
            payload: report,
          },
        ],
      };
    },
  };
}

/**
 * Lightweight deterministic playtest simulation used by balance_game.
 * Mirrors the play_test tool's model so balance decisions are consistent.
 */
function simulatePlaytest(game, duration, seed) {
  let s = seed || Math.floor(Math.random() * 100000);
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

  const cfg = game.config || {};
  const player = cfg.player || {};
  const enemy = cfg.enemy || {};
  const pSpeed = player.speed ?? 4;
  const pHp = player.hp ?? 3;
  const eSpeed = enemy.speed ?? 1.5;
  const eHp = enemy.hp ?? 1;
  const eCount = enemy.count ?? 3;
  const fireRate = player.fireRate ?? 15;

  let px = 0, py = 0, score = 0, deaths = 0, hp = pHp;
  const enemies = [];
  for (let i = 0; i < eCount; i++) {
    enemies.push({ x: rng() * 800, y: rng() * 600, hp: eHp });
  }

  const frames = duration * 60;
  let fireCounter = 0;
  const events = [];

  for (let f = 0; f < frames; f++) {
    // Player movement.
    px += (rng() - 0.5) * pSpeed * 0.5;
    py += (rng() - 0.5) * pSpeed * 0.5;
    px = Math.max(0, Math.min(800, px));
    py = Math.max(0, Math.min(600, py));

    // Enemy movement toward player.
    for (const e of enemies) {
      const dx = px - e.x, dy = py - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      e.x += (dx / dist) * eSpeed;
      e.y += (dy / dist) * eSpeed;
      // Enemy reaches player -> damage.
      if (dist < 25) {
        hp -= 1;
        events.push({ frame: f, type: 'hit', detail: 'enemy hit player' });
        e.x = rng() * 800;
        e.y = rng() * 600;
        if (hp <= 0) {
          deaths += 1;
          hp = pHp;
          events.push({ frame: f, type: 'death', detail: 'player died' });
        }
      }
    }

    // Player firing.
    fireCounter++;
    if (fireCounter >= fireRate) {
      fireCounter = 0;
      const target = enemies.find((e) => e.hp > 0);
      if (target) {
        target.hp -= 1;
        if (target.hp <= 0) {
          score += 100;
          target.hp = eHp;
          target.x = rng() * 800;
          target.y = rng() * 600;
          events.push({ frame: f, type: 'kill', detail: 'enemy killed' });
        }
      }
    }
  }

  const issues = [];
  if (deaths > 3) issues.push({ severity: 'high', code: 'too_hard', text: '玩家死亡次数过多，难度偏高' });
  if (deaths === 0 && score > 500) issues.push({ severity: 'low', code: 'too_easy', text: '玩家零死亡且高分，难度偏低' });
  if (score < 100 && deaths > 0) issues.push({ severity: 'medium', code: 'low_score', text: '得分偏低，可能需要增强攻击力' });

  return { score, deaths, duration, events: events.slice(0, 50), issues };
}
