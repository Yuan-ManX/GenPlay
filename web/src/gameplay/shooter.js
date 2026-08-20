import { DEFAULT_KEYS, PALETTE, hit, clamp, roundRect } from './engine.js';

const KEYS = {
  ...DEFAULT_KEYS,
  ' ': 'shoot', Enter: 'shoot',
};

export default {
  keys: KEYS,
  hint: '方向键 / WASD 移动 · 空格 射击 · 回车 重开',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    const cfg = config.player || {};
    return {
      W, H,
      player: { x: W / 2, y: H - 50, w: 34, h: 34, speed: cfg.speed || 4.6 },
      bullets: [], enemies: [],
      frame: 0, spawnAcc: 0,
      score: 0, over: false,
      fireRate: cfg.fireRate || 12,
      bulletSpeed: cfg.bulletSpeed || -7,
      enemySpawn: config.enemy?.spawnEvery || 36,
      enemySpeed: config.enemy?.speed || 1.6,
      killScore: config.scoring?.kill ?? 10,
    };
  },
  update(s, input) {
    if (s.over) return;
    if (input.left) s.player.x -= s.player.speed;
    if (input.right) s.player.x += s.player.speed;
    if (input.up) s.player.y -= s.player.speed;
    if (input.down) s.player.y += s.player.speed;
    s.player.x = clamp(s.player.x, 0, s.W - s.player.w);
    s.player.y = clamp(s.player.y, 0, s.H - s.player.h);

    if (input.shoot && s.frame % s.fireRate === 0) {
      s.bullets.push({ x: s.player.x + s.player.w / 2, y: s.player.y, vy: s.bulletSpeed });
    }
    s.bullets.forEach((b) => (b.y += b.vy));
    s.bullets = s.bullets.filter((b) => b.y > -20);

    s.frame++;
    s.spawnAcc++;
    if (s.spawnAcc > s.enemySpawn) {
      s.spawnAcc = 0;
      s.enemies.push({
        x: 20 + Math.random() * (s.W - 40),
        y: -24, w: 26, h: 26,
        vy: s.enemySpeed + Math.random(),
      });
    }
    s.enemies.forEach((e) => (e.y += e.vy));
    s.enemies = s.enemies.filter((e) => e.y < s.H + 30);

    s.bullets.forEach((b, bi) => {
      s.enemies.forEach((e, ei) => {
        if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
          s.enemies.splice(ei, 1);
          s.bullets.splice(bi, 1);
          s.score += s.killScore;
        }
      });
    });

    if (s.enemies.some((e) => hit(s.player, e))) {
      s.over = true;
    }
  },
  render(s, ctx) {
    const [c1, c2] = PALETTE.shooter;
    ctx.clearRect(0, 0, s.W, s.H);
    const bg = ctx.createLinearGradient(0, 0, 0, s.H);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(1, '#0f0a1f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s.W, s.H);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let x = 0; x < s.W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s.H); ctx.stroke(); }

    s.enemies.forEach((e) => {
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(e.x + e.w / 2 - 5, e.y + e.h / 2 - 4, 3, 0, Math.PI * 2);
      ctx.arc(e.x + e.w / 2 + 5, e.y + e.h / 2 - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    s.bullets.forEach((b) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(b.x - 2, b.y, 4, 12);
    });
    const p = s.player;
    ctx.fillStyle = c1;
    ctx.shadowColor = c1;
    ctx.shadowBlur = 16;
    roundRect(ctx, p.x, p.y, p.w, p.h, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
  },
};
