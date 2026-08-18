import { PALETTE, roundRect } from './engine.js';

/**
 * 贪吃蛇：网格化移动，吃食物变长
 * 操作：方向键/WASD 转向（不能反向）
 */
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  A: 'left', D: 'right', W: 'up', S: 'down',
};

export default {
  keys: KEYS,
  hint: '方向键 / WASD 转向 · 吃食物变长 · 撞墙或自身失败',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    const grid = config.grid || {};
    const cell = grid.cellSize || 20;
    const cols = grid.cols || Math.floor(W / cell);
    const rows = grid.rows || Math.floor(H / cell);
    const speed = (config.snake?.speed) || 8; // moves per second
    const startX = Math.floor(cols / 2);
    const startY = Math.floor(rows / 2);
    const initLen = config.snake?.initialLength || 3;
    const body = [];
    for (let i = 0; i < initLen; i++) body.push({ x: startX - i, y: startY });
    return {
      W, H, cell, cols, rows,
      body,
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      food: this._spawnFood(body, cols, rows),
      score: 0,
      over: false,
      speed,
      moveAcc: 0,
      lastTime: performance.now(),
      foodValue: config.food?.value || 10,
      foodGrowth: config.food?.growth || 1,
      pendingGrowth: 0,
    };
  },
  _spawnFood(body, cols, rows) {
    let attempts = 0;
    while (attempts++ < 200) {
      const f = { x: Math.floor(Math.random() * cols), y: Math.floor(Math.random() * rows) };
      if (!body.some((s) => s.x === f.x && s.y === f.y)) return f;
    }
    return { x: 0, y: 0 };
  },
  update(s, input, ctx) {
    if (s.over) return;
    // 转向（防反向）
    if (input.left && s.dir.x === 0) s.nextDir = { x: -1, y: 0 };
    else if (input.right && s.dir.x === 0) s.nextDir = { x: 1, y: 0 };
    else if (input.up && s.dir.y === 0) s.nextDir = { x: 0, y: -1 };
    else if (input.down && s.dir.y === 0) s.nextDir = { x: 0, y: 1 };

    const now = performance.now();
    const dt = (now - s.lastTime) / 1000;
    s.lastTime = now;
    s.moveAcc += dt;
    const interval = 1 / s.speed;

    while (s.moveAcc >= interval && !s.over) {
      s.moveAcc -= interval;
      this._step(s);
    }
  },
  _step(s) {
    s.dir = s.nextDir;
    const head = s.body[0];
    const newHead = { x: head.x + s.dir.x, y: head.y + s.dir.y };

    // 撞墙
    if (newHead.x < 0 || newHead.x >= s.cols || newHead.y < 0 || newHead.y >= s.rows) {
      s.over = true;
      return;
    }
    // 撞自身
    if (s.body.some((seg) => seg.x === newHead.x && seg.y === newHead.y)) {
      s.over = true;
      return;
    }

    s.body.unshift(newHead);

    // 吃食物
    if (newHead.x === s.food.x && newHead.y === s.food.y) {
      s.score += s.foodValue;
      s.pendingGrowth += s.foodGrowth;
      s.food = this._spawnFood(s.body, s.cols, s.rows);
    }

    // 处理生长
    if (s.pendingGrowth > 0) {
      s.pendingGrowth--;
    } else {
      s.body.pop();
    }
  },
  render(s, ctx) {
    const [c1, c2] = PALETTE.snake;
    ctx.clearRect(0, 0, s.W, s.H);
    const bg = ctx.createLinearGradient(0, 0, 0, s.H);
    bg.addColorStop(0, '#052e16');
    bg.addColorStop(1, '#022c22');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s.W, s.H);

    // 网格
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i <= s.cols; i++) {
      ctx.beginPath(); ctx.moveTo(i * s.cell, 0); ctx.lineTo(i * s.cell, s.rows * s.cell); ctx.stroke();
    }
    for (let i = 0; i <= s.rows; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * s.cell); ctx.lineTo(s.cols * s.cell, i * s.cell); ctx.stroke();
    }

    // 食物
    const f = s.food;
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 12;
    roundRect(ctx, f.x * s.cell + 2, f.y * s.cell + 2, s.cell - 4, s.cell - 4, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 蛇身
    s.body.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? c1 : (i % 2 === 0 ? c1 : c2);
      roundRect(ctx, seg.x * s.cell + 1, seg.y * s.cell + 1, s.cell - 2, s.cell - 2, 4);
      ctx.fill();
    });

    // 蛇眼
    const head = s.body[0];
    ctx.fillStyle = '#fff';
    const ex = head.x * s.cell + s.cell / 2 + s.dir.x * 4;
    const ey = head.y * s.cell + s.cell / 2 + s.dir.y * 4;
    ctx.beginPath(); ctx.arc(ex - 3, ey - 2, 2, 0, Math.PI * 2); ctx.arc(ex + 3, ey - 2, 2, 0, Math.PI * 2); ctx.fill();
  },
};
