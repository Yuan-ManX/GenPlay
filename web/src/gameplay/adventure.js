import { DEFAULT_KEYS, PALETTE, hit, circleHit, clamp, roundRect } from './engine.js';

export default {
  keys: DEFAULT_KEYS,
  hint: '方向键 / WASD 移动 · 收集金币 · 躲避敌人',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    return {
      W, H,
      player: { x: W / 2, y: H - 50, w: 34, h: 34, speed: config.player?.speed || 4.6 },
      coins: [], enemies: [],
      frame: 0,
      score: 0, over: false,
      coinSpawn: config.coin?.spawnEvery || 60,
      coinSpeed: config.coin?.speed || 1.2,
      coinValue: config.scoring?.coin ?? 5,
      enemySpawn: config.enemy?.spawnEvery || 36,
      enemySpeed: config.enemy?.speed || 1.6,
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

    s.frame++;
    if (s.frame % s.coinSpawn === 0) {
      s.coins.push({ x: 20 + Math.random() * (s.W - 40), y: -18, r: 9, vy: s.coinSpeed });
    }
    s.coins.forEach((c) => (c.y += c.vy));
    s.coins = s.coins.filter((c) => c.y < s.H + 20);

    if (s.frame % s.enemySpawn === 0) {
      s.enemies.push({ x: 20 + Math.random() * (s.W - 40), y: -24, w: 26, h: 26, vy: s.enemySpeed });
    }
    s.enemies.forEach((e) => (e.y += e.vy));
    s.enemies = s.enemies.filter((e) => e.y < s.H + 30);

    s.coins.forEach((c, ci) => {
      if (circleHit(c.x, c.y, c.r, s.player)) {
        s.coins.splice(ci, 1);
        s.score += s.coinValue;
      }
    });

    if (s.enemies.some((e) => hit(s.player, e))) s.over = true;
  },
  render(s, ctx) {
    const [c1, c2] = PALETTE.adventure;
    ctx.clearRect(0, 0, s.W, s.H);
    const bg = ctx.createLinearGradient(0, 0, 0, s.H);
    bg.addColorStop(0, '#064e3b');
    bg.addColorStop(1, '#022c22');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s.W, s.H);

    s.coins.forEach((c) => {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.45, 0, Math.PI * 2); ctx.fill();
    });

    s.enemies.forEach((e) => {
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, 0, Math.PI * 2);
      ctx.fill();
    });

    const p = s.player;
    ctx.fillStyle = c1;
    ctx.shadowColor = c1; ctx.shadowBlur = 14;
    roundRect(ctx, p.x, p.y, p.w, p.h, 8); ctx.fill();
    ctx.shadowBlur = 0;
  },
};
