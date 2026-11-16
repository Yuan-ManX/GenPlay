/**
 * GenPlay 前端玩法引擎 - 共享工具与基类
 * 每个 genre 实现一个 handler，导出 { init, update, render, keys, hint } 接口
 *  - init(canvas, config) -> state
 *  - update(state, input, ctx) -> 可能修改 state、上报 score/over
 *  - render(state, ctx)        -> 绘制一帧
 *  - keys                      -> 该玩法用到的键盘映射
 *  - hint                       -> 操作提示文本
 *  - onPointer(state, x, y, ctx) -> 可选，处理画布点击（解谜用）
 */

export const PALETTE = {
  shooter: ['#7c3aed', '#a78bfa', '#4f46e5'],
  adventure: ['#059669', '#34d399', '#10b981'],
  rpg: ['#b45309', '#f59e0b', '#d97706'],
  puzzle: ['#db2777', '#f472b6', '#ec4899'],
  battle: ['#dc2626', '#f87171', '#ef4444'],
  racing: ['#0891b2', '#22d3ee', '#06b6d4'],
  simulation: ['#0d9488', '#2dd4bf', '#14b8a6'],
  platformer: ['#2563eb', '#60a5fa', '#1e40af'],
  tower: ['#7c2d12', '#fb923c', '#9a3412'],
  snake: ['#16a34a', '#86efac', '#15803d'],
  breakout: ['#c026d3', '#e879f9', '#a21caf'],
  maze: ['#9333ea', '#c084fc', '#7e22ce'],
  rhythm: ['#db2777', '#f9a8d4', '#be185d'],
  roguelike: ['#7c2d12', '#dc2626', '#92400e'],
  deckbuilder: ['#5b21b6', '#a78bfa', '#4c1d95'],
  metroidvania: ['#0f766e', '#2dd4bf', '#155e54'],
  idle: ['#a16207', '#fbbf24', '#854d0e'],
  sandbox: ['#15803d', '#4ade80', '#166534'],
  visual_novel: ['#be185d', '#f9a8d4', '#9d174d'],
  auto_battler: ['#1e40af', '#3b82f6', '#1e3a8a'],
};

export const DEFAULT_KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  ' ': 'shoot', Enter: 'shoot',
};

// 矩形碰撞
export function hit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// 圆点 vs 矩形
export function circleHit(px, py, pr, b) {
  return px > b.x - pr && px < b.x + b.w + pr && py > b.y - pr && py < b.y + b.h + pr;
}

// 限定范围
export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// 绘制圆角矩形（兼容老 Canvas）
export function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ======================================================================
 * Runtime presentation layer: particles, environment grading, screen shake.
 * Pure helpers shared by the studio preview and the standalone playable
 * build (the builder concatenates this module into the exported HTML).
 * All state is plain serializable data; no DOM access happens here.
 * ==================================================================== */

// Ambient particle presets. Ranges are [min, max]; positions in px, speeds
// in px/s. `sway` adds a sinusoidal horizontal drift, `twinkle` fades alpha.
export const FX_PRESETS = {
  rain:     { count: 90, color: '#93c5fd', size: [1, 2.2],   vx: [40, 70],   vy: [280, 400],  life: [0.5, 1.0], shape: 'line',  spawn: 'top' },
  snow:     { count: 70, color: '#e2e8f0', size: [1.5, 3.5], vx: [-24, 24],  vy: [28, 70],    life: [3, 6],     sway: 40,       spawn: 'top' },
  petals:   { count: 40, color: '#f9a8d4', size: [2, 4],     vx: [-30, 10],  vy: [25, 55],    life: [4, 7],     sway: 60,       spawn: 'top' },
  sparks:   { count: 50, color: '#fbbf24', size: [1, 2.5],   vx: [-15, 15],  vy: [-60, -20],  life: [0.8, 1.6], gravity: 40,    spawn: 'bottom' },
  bubbles:  { count: 35, color: '#67e8f9', size: [2, 5],     vx: [-10, 10],  vy: [-45, -20],  life: [2.5, 5],   sway: 25,       spawn: 'bottom' },
  stars:    { count: 60, color: '#fef9c3', size: [1, 2],     vx: [0, 0],     vy: [0, 0],      life: [2, 4],     twinkle: true,  spawn: 'anywhere' },
  embers:   { count: 45, color: '#fb923c', size: [1, 3],     vx: [-12, 12],  vy: [-70, -30],  life: [1, 2.2],   gravity: -15,   spawn: 'bottom' },
  confetti: { count: 80, color: 'multi',   size: [2, 4],     vx: [-50, 50],  vy: [30, 90],    life: [2, 4],     gravity: 60, sway: 50, spawn: 'top' },
};

const CONFETTI_COLORS = ['#f472b6', '#facc15', '#34d399', '#60a5fa', '#a78bfa', '#fb7185'];

function fxRand(min, max) { return min + Math.random() * (max - min); }

function fxSpawn(sys, p, W, H, initial) {
  const def = sys.def;
  const spread = sys.spawn;
  p.x = fxRand(0, W);
  if (spread === 'top') p.y = initial ? fxRand(-H, 0) : fxRand(-20, -4);
  else if (spread === 'bottom') p.y = initial ? fxRand(0, H) : fxRand(H + 4, H + 20);
  else p.y = fxRand(0, H);
  p.vx = fxRand(def.vx[0], def.vx[1]) * sys.speed;
  p.vy = fxRand(def.vy[0], def.vy[1]) * sys.speed;
  p.maxLife = fxRand(def.life[0], def.life[1]);
  p.life = p.maxLife;
  p.size = fxRand(def.size[0], def.size[1]);
  p.seed = Math.random() * Math.PI * 2;
  p.color = def.color === 'multi'
    ? CONFETTI_COLORS[(Math.random() * CONFETTI_COLORS.length) | 0]
    : (sys.color || def.color);
}

/**
 * Create a particle system from a vfx entry.
 * @param {object} effect { preset, intensity?, color?, speed? }
 * intensity scales particle count (0.2 - 2), speed scales velocity (0.2 - 3).
 */
export function createFx(effect, W = 640, H = 400) {
  const def = FX_PRESETS[effect?.preset] || FX_PRESETS.stars;
  const intensity = clamp(Number(effect?.intensity) || 1, 0.2, 2);
  const sys = {
    preset: FX_PRESETS[effect?.preset] ? effect.preset : 'stars',
    def,
    spawn: def.spawn || 'top',
    speed: clamp(Number(effect?.speed) || 1, 0.2, 3),
    color: effect?.color || null,
    count: Math.round(def.count * intensity),
    parts: [],
  };
  for (let i = 0; i < sys.count; i++) {
    const p = {};
    fxSpawn(sys, p, W, H, true);
    sys.parts.push(p);
  }
  return sys;
}

/** Advance a particle system by dt seconds, recycling dead particles. */
export function updateFx(sys, dt, W = 640, H = 400) {
  if (!sys || !sys.parts) return;
  const g = sys.def.gravity || 0;
  const sway = sys.def.sway || 0;
  for (const p of sys.parts) {
    p.vy += g * dt;
    p.x += p.vx * dt + (sway ? Math.sin(p.seed + p.life * 2) * sway * dt : 0);
    p.y += p.vy * dt;
    p.life -= dt;
    const outBottom = p.y > H + 24;
    const outTop = p.y < -24 && p.vy < 0;
    const outSide = p.x < -24 || p.x > W + 24;
    if (p.life <= 0 || outBottom || outTop || outSide) fxSpawn(sys, p, W, H, false);
  }
}

/** Draw a particle system onto a 2D context. */
export function renderFx(sys, ctx) {
  if (!sys || !sys.parts) return;
  ctx.save();
  for (const p of sys.parts) {
    const fade = sys.def.twinkle
      ? 0.35 + 0.65 * Math.abs(Math.sin(p.seed + p.life * 3))
      : clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = 0.25 + 0.75 * fade;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    if (sys.def.shape === 'line') {
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

const CYCLE_TINTS = {
  day:   null,
  dawn:  [255, 190, 120, 0.12],
  dusk:  [255, 120, 40, 0.16],
  night: [10, 14, 40, 0.38],
};
const GRADING_TINTS = {
  warm:  [255, 180, 80, 0.08],
  cool:  [80, 160, 255, 0.09],
  noir:  [20, 20, 30, 0.22],
  vivid: [255, 90, 200, 0.05],
};

/**
 * Apply environment presentation: day/night tint, color grading and vignette.
 * `cycle: 'auto'` derives the phase from elapsed time (full loop ~48s).
 */
export function applyEnvironment(env, ctx, W = 640, H = 400, tSec = 0) {
  if (!env) return;
  let cycle = env.cycle || 'day';
  if (cycle === 'auto') {
    const phase = (tSec % 48) / 48;
    cycle = phase < 0.4 ? 'day' : phase < 0.5 ? 'dusk' : phase < 0.85 ? 'night' : 'dawn';
  }
  const tint = CYCLE_TINTS[cycle];
  ctx.save();
  if (tint) {
    ctx.fillStyle = `rgba(${tint[0]},${tint[1]},${tint[2]},${tint[3]})`;
    ctx.fillRect(0, 0, W, H);
  }
  const grading = GRADING_TINTS[env.grading];
  if (grading) {
    ctx.fillStyle = `rgba(${grading[0]},${grading[1]},${grading[2]},${grading[3]})`;
    ctx.fillRect(0, 0, W, H);
  }
  const vig = clamp(Number(env.vignette) || 0, 0, 1);
  if (vig > 0 && ctx.createRadialGradient) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${0.55 * vig})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

/**
 * Screen shake helper for game feel. trigger(strength) kicks the shake,
 * shakeOffset advances the decay and returns the current {x, y} offset.
 */
export function createShake() {
  return { mag: 0 };
}

export function shakeTrigger(shake, strength = 4) {
  if (!shake) return;
  shake.mag = Math.max(shake.mag, clamp(strength, 0, 24));
}

export function shakeOffset(shake, dt) {
  if (!shake || shake.mag <= 0.05) {
    if (shake) shake.mag = 0;
    return { x: 0, y: 0 };
  }
  const m = shake.mag;
  shake.mag *= Math.max(0, 1 - dt * 6);
  return { x: fxRand(-m, m), y: fxRand(-m, m) };
}
