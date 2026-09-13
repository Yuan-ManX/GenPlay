import { PALETTE, roundRect, clamp } from './engine.js';

/**
 * Idle/Incremental engine - Click to generate resources, buy auto-collectors,
 * and watch numbers grow. Upgrades multiply output and unlock new tiers.
 * Click the resource orb or press Space to manually gather.
 * Press 1-5 to buy upgrades.
 */
const KEYS = {
  ' ': 'gather', '1': 'buy0', '2': 'buy1', '3': 'buy2', '4': 'buy3', '5': 'buy4',
};

const UPGRADES = [
  { name: 'Auto-Miner', cost: 15, rate: 0.3, icon: '⛏', desc: '+0.3/sec' },
  { name: 'Crystal Drill', cost: 100, rate: 1.5, icon: '💎', desc: '+1.5/sec' },
  { name: 'Plasma Reactor', cost: 500, rate: 8, icon: '⚡', desc: '+8/sec' },
  { name: 'Quantum Forge', cost: 2500, rate: 40, icon: '🌀', desc: '+40/sec' },
  { name: 'Singularity Core', cost: 12000, rate: 200, icon: '🌟', desc: '+200/sec' },
];

export default {
  keys: KEYS,
  hint: '空格 点击采集 · 1-5 购买升级 · 数字自动增长',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    return {
      W, H,
      resources: config.player?.resources || 0,
      totalGathered: 0,
      clickPower: 1,
      autoRate: 0,
      upgrades: UPGRADES.map(u => ({ ...u, count: 0 })),
      frame: 0,
      score: 0,
      over: false,
      won: false,
      clickFlash: 0,
      particles: [],
      tier: 1,
    };
  },
  update(s, input) {
    s.frame++;

    // Manual gather
    if (input.gather) {
      s.resources += s.clickPower;
      s.totalGathered += s.clickPower;
      s.clickFlash = 15;
      s.particles.push({ x: s.W / 2, y: s.H / 2 - 50, vy: -2, life: 30, text: `+${s.clickPower}` });
    }

    // Buy upgrades
    for (let i = 0; i < s.upgrades.length; i++) {
      if (input['buy' + i]) {
        const u = s.upgrades[i];
        const cost = Math.floor(u.cost * Math.pow(1.5, u.count));
        if (s.resources >= cost) {
          s.resources -= cost;
          u.count++;
          s.autoRate += u.rate;
          s.clickPower += 1;
          s.particles.push({ x: 100 + i * 120, y: s.H - 80, vy: -1.5, life: 40, text: `${u.name}!` });
          if (i === UPGRADES.length - 1 && u.count >= 3) s.won = true;
        }
      }
    }

    // Auto generation
    s.resources += s.autoRate / 60;
    s.totalGathered += s.autoRate / 60;
    s.score = Math.floor(s.totalGathered);

    // Tier progression
    s.tier = s.totalGathered > 5000 ? 5 : s.totalGathered > 1000 ? 4 : s.totalGathered > 200 ? 3 : s.totalGathered > 50 ? 2 : 1;

    // Click flash decay
    if (s.clickFlash > 0) s.clickFlash--;

    // Particles
    s.particles.forEach(p => { p.y += p.vy; p.life--; });
    s.particles = s.particles.filter(p => p.life > 0);
  },
  onPointer(s, x, y) {
    // Click on the central orb
    const cx = s.W / 2, cy = s.H / 2 - 30;
    if (Math.hypot(x - cx, y - cy) < 60) {
      s.resources += s.clickPower;
      s.totalGathered += s.clickPower;
      s.clickFlash = 15;
      s.particles.push({ x, y, vy: -2, life: 30, text: `+${s.clickPower}` });
    }
    // Click upgrade buttons
    for (let i = 0; i < s.upgrades.length; i++) {
      const bx = 20 + i * 120, by = s.H - 80;
      if (x >= bx && x <= bx + 110 && y >= by && y <= by + 60) {
        const u = s.upgrades[i];
        const cost = Math.floor(u.cost * Math.pow(1.5, u.count));
        if (s.resources >= cost) {
          s.resources -= cost;
          u.count++;
          s.autoRate += u.rate;
          s.clickPower += 1;
          s.particles.push({ x: bx + 55, y: by, vy: -1.5, life: 40, text: `${u.name}!` });
          if (i === UPGRADES.length - 1 && u.count >= 3) s.won = true;
        }
      }
    }
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.simulation;
    const grad = ctx.createLinearGradient(0, 0, 0, s.H);
    grad.addColorStop(0, '#0c0a1a'); grad.addColorStop(0.5, '#1a0a2e'); grad.addColorStop(1, '#0c0a1a');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, s.W, s.H);

    // Central resource orb
    const cx = s.W / 2, cy = s.H / 2 - 30;
    const pulse = 1 + (s.clickFlash > 0 ? 0.15 * s.clickFlash / 15 : 0) + 0.05 * Math.sin(s.frame * 0.05);
    const orbR = 50 * pulse;
    const orbGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, orbR);
    orbGrad.addColorStop(0, c2); orbGrad.addColorStop(0.6, c1); orbGrad.addColorStop(1, 'rgba(13,148,136,0)');
    ctx.fillStyle = orbGrad;
    ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c2; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, orbR, 0, Math.PI * 2); ctx.stroke();

    // Resource text on orb
    ctx.fillStyle = '#fff'; ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(formatNum(s.resources), cx, cy + 8);
    ctx.font = '10px sans-serif'; ctx.fillStyle = '#aaa';
    ctx.fillText('RESOURCES', cx, cy + 24);

    // Stats
    ctx.textAlign = 'left'; ctx.fillStyle = '#0d9488'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`Total: ${formatNum(s.totalGathered)}`, 12, 22);
    ctx.textAlign = 'right';
    ctx.fillText(`Auto: ${s.autoRate.toFixed(1)}/s · Click: ${s.clickPower} · Tier ${s.tier}`, s.W - 12, 22);

    // Upgrades
    s.upgrades.forEach((u, i) => {
      const bx = 20 + i * 120, by = s.H - 80;
      const cost = Math.floor(u.cost * Math.pow(1.5, u.count));
      const affordable = s.resources >= cost;
      ctx.fillStyle = affordable ? '#1e3a5f' : '#1a1a2e';
      roundRect(ctx, bx, by, 110, 60, 8); ctx.fill();
      ctx.strokeStyle = affordable ? c2 : '#333'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = affordable ? '#fff' : '#666';
      ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(u.icon, bx + 55, by + 18);
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(u.name, bx + 55, by + 32);
      ctx.fillStyle = affordable ? '#fbbf24' : '#553';
      ctx.font = '10px sans-serif';
      ctx.fillText(`${formatNum(cost)}g · x${u.count}`, bx + 55, by + 46);
      ctx.fillStyle = affordable ? c2 : '#444';
      ctx.font = '8px sans-serif';
      ctx.fillText(`[${i + 1}]`, bx + 55, by + 56);
    });

    // Particles
    s.particles.forEach(p => {
      ctx.globalAlpha = p.life / 30;
      ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y);
    });
    ctx.globalAlpha = 1;

    if (s.won) this._drawEnd(ctx, s.W, s.H, 'Singularity!', '#fbbf24', `Total: ${formatNum(s.totalGathered)} · Tier ${s.tier}`);
  },
  _drawEnd(ctx, W, H, title, color, sub) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, H / 2 - 10);
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
    ctx.fillText(sub, W / 2, H / 2 + 22);
  },
};

function formatNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.floor(n).toString();
}
