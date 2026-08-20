import { DEFAULT_KEYS, PALETTE, hit, clamp, roundRect } from './engine.js';

const KEYS = { ...DEFAULT_KEYS };

export default {
  keys: KEYS,
  hint: '左右键切换车道 · 躲避障碍 · 持续行驶得分',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    const lanes = config.player?.lanes || 3;
    const laneW = W / lanes;
    return {
      W, H, lanes, laneW,
      lane: Math.floor(lanes / 2),
      player: { x: 0, y: H - 60, w: 36, h: 50, speed: config.player?.speed || 5.2 },
      obstacles: [],
      frame: 0, scrollY: 0,
      score: 0, over: false,
      obstacleSpawn: config.obstacle?.spawnEvery || 24,
      obstacleSpeed: config.obstacle?.speed || 3.2,
      surviveScore: config.scoring?.survive ?? 1,
    };
  },
  update(s, input) {
    if (s.over) return;
    if (input.left && !s._leftLock) { s.lane = Math.max(0, s.lane - 1); s._leftLock = true; }
    if (!input.left) s._leftLock = false;
    if (input.right && !s._rightLock) { s.lane = Math.min(s.lanes - 1, s.lane + 1); s._rightLock = true; }
    if (!input.right) s._rightLock = false;

    s.player.x = s.lane * s.laneW + (s.laneW - s.player.w) / 2;

    s.frame++;
    s.scrollY = (s.scrollY + s.obstacleSpeed) % 40;
    if (s.frame % s.obstacleSpawn === 0) {
      const lane = Math.floor(Math.random() * s.lanes);
      s.obstacles.push({
        x: lane * s.laneW + (s.laneW - 30) / 2,
        y: -30, w: 30, h: 30,
        vy: s.obstacleSpeed,
      });
    }
    s.obstacles.forEach((o) => (o.y += o.vy));
    s.obstacles = s.obstacles.filter((o) => o.y < s.H + 30);

    if (s.frame % 60 === 0) s.score += s.surviveScore;

    if (s.obstacles.some((o) => hit(s.player, o))) s.over = true;
  },
  render(s, ctx) {
    const [c1, c2] = PALETTE.racing;
    ctx.clearRect(0, 0, s.W, s.H);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, s.W, s.H);

    // 车道线
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.setLineDash([20, 20]);
    ctx.lineWidth = 3;
    for (let i = 1; i < s.lanes; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s.laneW, 0);
      ctx.lineTo(i * s.laneW, s.H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    s.obstacles.forEach((o) => {
      ctx.fillStyle = c2;
      roundRect(ctx, o.x, o.y, o.w, o.h, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(o.x, o.y, o.w, o.h / 2);
    });

    const p = s.player;
    ctx.fillStyle = c1;
    ctx.shadowColor = c1; ctx.shadowBlur = 12;
    roundRect(ctx, p.x, p.y, p.w, p.h, 6); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.fillRect(p.x + 8, p.y + 8, p.w - 16, 6);
  },
};
