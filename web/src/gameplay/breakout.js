import { PALETTE, clamp, roundRect } from './engine.js';

/**
 * 打砖块：球拍反弹打砖块阵列
 * 操作：方向键/AD 移动球拍
 */
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right',
  a: 'left', d: 'right', A: 'left', D: 'right',
  ' ': 'launch', Enter: 'launch',
};

const BRICK_COLORS = ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6'];

export default {
  keys: KEYS,
  hint: 'A/D 或方向键 移动球拍 · 空格 发射 · 击碎全部砖块获胜',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    const pad = config.paddle || {};
    const ball = config.ball || {};
    const bcfg = config.brick || {};
    const cols = bcfg.cols || 10;
    const rows = bcfg.rows || 5;
    const bw = bcfg.w || 56;
    const bh = bcfg.h || 20;
    const gap = bcfg.gap || 4;
    const totalW = cols * bw + (cols - 1) * gap;
    const offX = (W - totalW) / 2;
    const bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        bricks.push({
          x: offX + c * (bw + gap),
          y: 40 + r * (bh + gap),
          w: bw, h: bh,
          hp: bcfg.hp || 1,
          color: BRICK_COLORS[r % BRICK_COLORS.length],
        });
      }
    }
    return {
      W, H,
      paddle: { x: W / 2 - (pad.w || 90) / 2, y: H - 30, w: pad.w || 90, h: pad.h || 12, speed: pad.speed || 6 },
      ball: {
        x: W / 2, y: H - 45,
        r: ball.r || 6,
        vx: 0, vy: 0,
        speed: ball.speed || 4,
        launched: false,
      },
      bricks,
      score: 0,
      over: false,
      won: false,
      brickScore: config.scoring?.brick ?? 10,
    };
  },
  update(s, input) {
    if (s.over || s.won) return;
    // 球拍移动
    if (input.left) s.paddle.x -= s.paddle.speed;
    if (input.right) s.paddle.x += s.paddle.speed;
    s.paddle.x = clamp(s.paddle.x, 0, s.W - s.paddle.w);

    const b = s.ball;
    if (!b.launched) {
      b.x = s.paddle.x + s.paddle.w / 2;
      if (input.launch) {
        b.launched = true;
        b.vx = b.speed * 0.6 * (Math.random() < 0.5 ? -1 : 1);
        b.vy = -b.speed;
      }
      return;
    }

    b.x += b.vx;
    b.y += b.vy;

    // 墙壁
    if (b.x < b.r) { b.x = b.r; b.vx = -b.vx; }
    if (b.x > s.W - b.r) { b.x = s.W - b.r; b.vx = -b.vx; }
    if (b.y < b.r) { b.y = b.r; b.vy = -b.vy; }

    // 球拍碰撞
    if (b.vy > 0 && b.y + b.r > s.paddle.y && b.y - b.r < s.paddle.y + s.paddle.h &&
        b.x > s.paddle.x && b.x < s.paddle.x + s.paddle.w) {
      b.y = s.paddle.y - b.r;
      b.vy = -Math.abs(b.vy);
      // 按击中位置改变角度
      const offset = (b.x - (s.paddle.x + s.paddle.w / 2)) / (s.paddle.w / 2);
      b.vx = b.speed * offset * 1.1;
      // 归一化保持速度
      const mag = Math.hypot(b.vx, b.vy);
      b.vx = (b.vx / mag) * b.speed;
      b.vy = (b.vy / mag) * b.speed;
    }

    // 球出界
    if (b.y > s.H) s.over = true;

    // 砖块碰撞
    for (let i = 0; i < s.bricks.length; i++) {
      const br = s.bricks[i];
      if (b.x + b.r > br.x && b.x - b.r < br.x + br.w &&
          b.y + b.r > br.y && b.y - b.r < br.y + br.h) {
        // 判断碰撞方向
        const prevX = b.x - b.vx, prevY = b.y - b.vy;
        if (prevX < br.x || prevX > br.x + br.w) b.vx = -b.vx;
        else b.vy = -b.vy;

        br.hp--;
        if (br.hp <= 0) {
          s.bricks.splice(i, 1);
          s.score += s.brickScore;
        }
        break;
      }
    }

    if (s.bricks.length === 0) s.won = true;
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.breakout;
    ctx.clearRect(0, 0, s.W, s.H);
    const bg = ctx.createLinearGradient(0, 0, 0, s.H);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(1, '#0c0a1f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s.W, s.H);

    // 砖块
    s.bricks.forEach((br) => {
      ctx.fillStyle = br.color;
      ctx.shadowColor = br.color; ctx.shadowBlur = 8;
      roundRect(ctx, br.x, br.y, br.w, br.h, 3);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(br.x, br.y, br.w, 3);
    });

    // 球拍
    ctx.fillStyle = c1;
    ctx.shadowColor = c1; ctx.shadowBlur = 14;
    roundRect(ctx, s.paddle.x, s.paddle.y, s.paddle.w, s.paddle.h, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 球
    const b = s.ball;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`得分 ${s.score}`, 12, 22);
    ctx.textAlign = 'right';
    ctx.fillText(`剩余砖块 ${s.bricks.length}`, s.W - 12, 22);

    if (!b.launched) {
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('按 空格 发射球', s.W / 2, s.H / 2);
    }

    if (s.won) this._drawEnd(ctx, s.W, s.H, '通关', '#16a34a', `得分 ${s.score}`);
    if (s.over) this._drawEnd(ctx, s.W, s.H, '失败', '#dc2626', `得分 ${s.score}`);
  },
  _drawEnd(ctx, W, H, title, color, sub) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, H / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(sub, W / 2, H / 2 + 24);
  },
};
