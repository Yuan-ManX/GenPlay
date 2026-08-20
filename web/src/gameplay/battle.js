import { PALETTE, clamp, roundRect } from './engine.js';

/**
 * 对战格斗：P1 vs AI
 * 操作：A/D 移动 · J 轻拳 · K 重拳（前摇18帧）· L 防御
 * 玩家与 AI 在同一地面上近身互搏
 */
const KEYS = {
  a: 'left', d: 'right', A: 'left', D: 'right',
  j: 'light', J: 'light',
  k: 'heavy', K: 'heavy',
  l: 'block', L: 'block',
  Enter: 'confirm',
};

const STAGE = { ground: 320, halfWidth: 60 };

export default {
  keys: KEYS,
  hint: 'A/D 移动 · J 轻拳 · K 重拳 · L 防御',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    const p = config.player || {};
    const e = config.enemy || {};
    return {
      W, H,
      ground: (config.stage?.ground) || (H - 80),
      player: makeFighter(p, 120, 'P1', true),
      enemy: makeFighter(e, W - 160, 'AI', false),
      frame: 0,
      score: 0,
      over: false,
      winner: null,
      log: ['战斗开始'],
      // ai state
      aiPlan: { cd: 60, mode: 'approach' },
    };
  },
  update(s, input) {
    if (s.over) return;
    s.frame++;

    const P = s.player, E = s.enemy;
    P.flash = Math.max(0, P.flash - 1);
    E.flash = Math.max(0, E.flash - 1);
    P.action = stepAction(P);
    E.action = stepAction(E);

    // P1 操作
    if (input.left) P.x -= P.speed;
    if (input.right) P.x += P.speed;
    P.x = clamp(P.x, 20, s.W - 80);

    if (!P.action) {
      if (input.light) startAttack(P, 'light', 8, 6);
      else if (input.heavy) startAttack(P, 'heavy', 18, 20);
      P.blocking = Boolean(input.block);
    } else {
      P.blocking = false;
    }

    // AI 决策
    this._ai(s);

    // 命中判定（同帧内互不抵消）
    resolveHit(P, E, s);
    resolveHit(E, P, s);

    // 朝向
    P.face = E.x > P.x ? 1 : -1;
    E.face = P.x > E.x ? 1 : -1;

    if (P.hp <= 0) { s.over = true; s.winner = 'enemy'; s.log.unshift('AI 胜出'); }
    else if (E.hp <= 0) { s.over = true; s.winner = 'player'; s.score = Math.max(10, 200 - s.frame / 3 | 0); s.log.unshift('你胜出'); }
    s.log = s.log.slice(0, 3);
  },
  _ai(s) {
    const P = s.player, E = s.enemy;
    s.aiPlan.cd--;
    const dist = Math.abs(P.x - E.x);

    if (E.action) return;

    if (s.aiPlan.cd <= 0) {
      // 决策
      if (dist > 90) {
        s.aiPlan.mode = 'approach';
        s.aiPlan.cd = 20 + Math.random() * 30;
      } else if (dist < 50 && Math.random() < 0.3) {
        s.aiPlan.mode = 'retreat';
        s.aiPlan.cd = 20 + Math.random() * 20;
      } else if (dist < 90 && Math.random() < 0.6) {
        // 攻击：根据玩家是否防御选择轻重
        const kind = P.blocking ? (Math.random() < 0.4 ? 'heavy' : 'light') : (Math.random() < 0.6 ? 'light' : 'heavy');
        startAttack(E, kind, kind === 'light' ? 7 : 16, kind === 'light' ? 5 : 18);
        s.aiPlan.cd = 40 + Math.random() * 30;
        s.aiPlan.mode = 'idle';
        return;
      } else if (Math.random() < 0.2) {
        s.aiPlan.mode = 'block';
        s.aiPlan.cd = 15 + Math.random() * 15;
      } else {
        s.aiPlan.mode = 'idle';
        s.aiPlan.cd = 20 + Math.random() * 30;
      }
    }

    if (s.aiPlan.mode === 'approach') E.x += E.speed * Math.sign(P.x - E.x);
    else if (s.aiPlan.mode === 'retreat') E.x -= E.speed * Math.sign(P.x - E.x);
    E.blocking = s.aiPlan.mode === 'block';
    E.x = clamp(E.x, 20, s.W - 80);
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.battle;
    const W = s.W, H = s.H;
    ctx.clearRect(0, 0, W, H);

    // 背景：黄昏竞技场
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#7f1d1d');
    bg.addColorStop(0.6, '#450a0a');
    bg.addColorStop(1, '#1c0a0a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 太阳
    ctx.fillStyle = 'rgba(252, 165, 165, 0.5)';
    ctx.beginPath(); ctx.arc(W / 2, 120, 60, 0, Math.PI * 2); ctx.fill();

    // 地面
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, s.ground, W, H - s.ground);
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, s.ground); ctx.lineTo(W, s.ground); ctx.stroke();

    // 角色
    drawFighter(ctx, s.player, c1, 'left');
    drawFighter(ctx, s.enemy, c2, 'right');

    // HP 条
    drawHp(ctx, 20, 20, 240, 16, s.player.hp / s.player.maxHp, s.player.name, c1);
    drawHp(ctx, W - 260, 20, 240, 16, s.enemy.hp / s.enemy.maxHp, s.enemy.name, c2, true);

    // 日志
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    s.log.slice(0, 2).forEach((line, i) => ctx.fillText(line, W / 2, H - 30 + i * 16));

    if (s.over) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = s.winner === 'player' ? '#16a34a' : '#dc2626';
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.winner === 'player' ? '胜 利' : '战 败', W / 2, H / 2);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText(`用时 ${(s.frame / 60).toFixed(1)}s · 按 回车 重新开始`, W / 2, H / 2 + 30);
    }
  },
};

function makeFighter(cfg, x, name, isPlayer) {
  const attacks = cfg.attacks || {};
  return {
    name,
    x,
    y: 0,
    w: 50, h: 80,
    speed: cfg.speed || (isPlayer ? 4 : 3.5),
    hp: cfg.hp || 100,
    maxHp: cfg.hp || 100,
    atk: { light: attacks.light || 8, heavy: attacks.heavy || 18 },
    face: isPlayer ? 1 : -1,
    blocking: false,
    action: null, // { kind, windup, active, recover, t, hitDone }
    flash: 0,
    blockReduce: cfg.block?.dmgReduce || 0.5,
  };
}

function startAttack(f, kind, windup, recover) {
  f.action = {
    kind,
    windup: kind === 'light' ? 6 : 14,
    active: 4,
    recover,
    t: 0,
    hitDone: false,
    range: kind === 'light' ? 60 : 70,
    dmg: f.atk[kind],
  };
}

function stepAction(f) {
  if (!f.action) return null;
  f.action.t++;
  if (f.action.t > f.action.windup + f.action.active + f.action.recover) {
    f.action = null;
  }
  return f.action;
}

function resolveHit(attacker, defender, s) {
  if (!attacker.action || attacker.action.hitDone) return;
  const inActive = attacker.action.t > attacker.action.windup &&
                   attacker.action.t <= attacker.action.windup + attacker.action.active;
  if (!inActive) return;
  const reach = attacker.action.range;
  const dist = Math.abs(attacker.x - defender.x);
  const facing = Math.sign(defender.x - attacker.x) === attacker.face;
  if (dist <= reach && facing) {
    let dmg = attacker.action.dmg;
    if (defender.blocking) dmg = Math.max(1, Math.round(dmg * (1 - defender.blockReduce)));
    defender.hp = Math.max(0, defender.hp - dmg);
    defender.flash = 12;
    attacker.action.hitDone = true;
    s.log.unshift(`${attacker.name} ${attacker.action.kind === 'light' ? '轻拳' : '重拳'} 命中 ${defender.name} -${dmg}${defender.blocking ? '（被防）' : ''}`);
  }
}

function drawFighter(ctx, f, color, side) {
  const groundY = ctx.canvas.height - 80;
  const top = groundY - f.h;
  const flash = f.flash > 0;
  ctx.fillStyle = flash ? '#fef3c7' : color;
  ctx.shadowColor = color; ctx.shadowBlur = 12;
  roundRect(ctx, f.x, top, f.w, f.h, 8);
  ctx.fill();
  ctx.shadowBlur = 0;

  // 头
  ctx.fillStyle = flash ? '#fff' : '#fde68a';
  ctx.beginPath();
  ctx.arc(f.x + f.w / 2, top + 18, 12, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛朝向
  ctx.fillStyle = '#1c1917';
  const eyeX = f.x + f.w / 2 + f.face * 4;
  ctx.beginPath(); ctx.arc(eyeX, top + 16, 2, 0, Math.PI * 2); ctx.fill();

  // 攻击拳套
  if (f.action && f.action.t > f.action.windup && f.action.t <= f.action.windup + f.action.active) {
    const punchX = f.x + f.w / 2 + f.face * (f.action.range * 0.6);
    ctx.fillStyle = f.action.kind === 'heavy' ? '#fbbf24' : '#fde68a';
    ctx.beginPath(); ctx.arc(punchX, top + 50, 10, 0, Math.PI * 2); ctx.fill();
  }

  // 防御盾
  if (f.blocking) {
    ctx.fillStyle = 'rgba(34, 197, 94, 0.6)';
    const sx = f.x + f.w / 2 + f.face * 30;
    roundRect(ctx, sx - 6, top + 30, 12, 30, 4);
    ctx.fill();
  }

  // 名称
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(f.name, f.x + f.w / 2, top - 8);
}

function drawHp(ctx, x, y, w, h, ratio, label, color, rightAlign = false) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = color;
  if (rightAlign) {
    roundRect(ctx, x + w * (1 - Math.max(0, ratio)), y, w * Math.max(0, ratio), h, h / 2);
  } else {
    roundRect(ctx, x, y, w * Math.max(0, ratio), h, h / 2);
  }
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = rightAlign ? 'right' : 'left';
  ctx.fillText(label, rightAlign ? x + w - 4 : x + 4, y + h - 3);
}
