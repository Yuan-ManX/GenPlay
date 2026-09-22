import { DEFAULT_KEYS, PALETTE, circleHit, clamp, roundRect } from './engine.js';

const RES_TYPES = [
  { key: 'wood', color: '#a16207', glyph: '木' },
  { key: 'stone', color: '#64748b', glyph: '石' },
  { key: 'food', color: '#16a34a', glyph: '食' },
];

export default {
  keys: DEFAULT_KEYS,
  hint: '方向键 / WASD 移动 · 碰触资源采集 · 满 10 自动存入',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    return {
      W, H,
      player: { x: W / 2, y: H / 2, w: 30, h: 30, speed: config.player?.speed || 4 },
      resources: [],
      frame: 0,
      score: 0, over: false,
      cap: config.player?.capacity || 10,
      carried: 0,
      resSpawn: config.resource?.spawnEvery || 50,
      resValue: config.scoring?.collect ?? 3,
      types: config.resource?.types || ['wood', 'stone', 'food'],
    };
  },
  update(s, input) {
    if (input.left) s.player.x -= s.player.speed;
    if (input.right) s.player.x += s.player.speed;
    if (input.up) s.player.y -= s.player.speed;
    if (input.down) s.player.y += s.player.speed;
    s.player.x = clamp(s.player.x, 0, s.W - s.player.w);
    s.player.y = clamp(s.player.y, 0, s.H - s.player.h);

    s.frame++;
    if (s.frame % s.resSpawn === 0) {
      const type = s.types[Math.floor(Math.random() * s.types.length)];
      s.resources.push({
        x: 30 + Math.random() * (s.W - 60),
        y: 30 + Math.random() * (s.H - 60),
        r: 12, type,
      });
    }

    s.resources.forEach((r, ri) => {
      if (circleHit(r.x, r.y, r.r, s.player)) {
        s.resources.splice(ri, 1);
        s.carried++;
        s.score += s.resValue;
        if (s.carried >= s.cap) {
          s.carried = 0;
          s.score += s.resValue * 2;
        }
      }
    });
  },
  render(s, ctx) {
    const [c1] = PALETTE.simulation;
    ctx.clearRect(0, 0, s.W, s.H);
    const bg = ctx.createLinearGradient(0, 0, 0, s.H);
    bg.addColorStop(0, '#022c22');
    bg.addColorStop(1, '#064e3b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s.W, s.H);

    // 网格
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x < s.W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s.H); ctx.stroke(); }
    for (let y = 0; y < s.H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s.W, y); ctx.stroke(); }

    s.resources.forEach((r) => {
      const t = RES_TYPES.find((x) => x.key === r.type) || RES_TYPES[0];
      ctx.fillStyle = t.color;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.glyph, r.x, r.y);
    });

    const p = s.player;
    ctx.fillStyle = c1;
    ctx.shadowColor = c1; ctx.shadowBlur = 12;
    roundRect(ctx, p.x, p.y, p.w, p.h, 6); ctx.fill();
    ctx.shadowBlur = 0;

    // 携带条
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(p.x, p.y - 6, p.w, 3);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(p.x, p.y - 6, p.w * (s.carried / s.cap), 3);
  },
};
