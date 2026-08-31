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
