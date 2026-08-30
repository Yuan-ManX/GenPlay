import { PALETTE, roundRect, clamp } from './engine.js';

/**
 * Auto Battler engine - Strategic unit placement where teams of units
 * fight automatically in rounds. Buy units between rounds, position them
 * on a grid, and watch the battle resolve. Upgrade and merge for power.
 * Click to place units, 1-3 to select unit type, Enter to start battle.
 */
const KEYS = {
  '1': 'select0', '2': 'select1', '3': 'select2',
  Enter: 'start_battle',
};

const UNIT_TYPES = [
  { name: 'Warrior', cost: 3, hp: 50, atk: 12, range: 25, icon: '⚔', color: '#ef4444' },
  { name: 'Archer', cost: 4, hp: 30, atk: 15, range: 80, icon: '🏹', color: '#22c55e' },
  { name: 'Mage', cost: 5, hp: 25, atk: 20, range: 60, icon: '🔮', color: '#a855f7' },
];

export default {
  keys: KEYS,
  hint: '1-3 选择兵种 · 点击放置 · Enter 开始对战',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    return {
      W, H,
      gold: 15,
      round: 1,
      maxRounds: 5,
      phase: 'build', // build | battle | won | lost
      units: [],
      enemies: [],
      bullets: [],
      selectedType: 0,
      frame: 0,
      score: 0,
      over: false,
      won: false,
      battleTimer: 0,
    };
  },
  update(s, input) {
    s.frame++;

    if (input.select0) s.selectedType = 0;
    if (input.select1) s.selectedType = 1;
    if (input.select2) s.selectedType = 2;

    if (s.phase === 'build' && input.start_battle && s.units.length > 0) {
      s.phase = 'battle';
      s.battleTimer = 0;
      s.enemies = generateEnemyTeam(s.round);
    }

    if (s.phase === 'battle') {
      s.battleTimer++;

      // All units auto-attack
      const allUnits = [...s.units.map(u => ({ ...u, side: 'player' })), ...s.enemies.map(e => ({ ...e, side: 'enemy' }))];

      allUnits.forEach(unit => {
        if (unit.hp <= 0) return;
        unit.cooldown = Math.max(0, (unit.cooldown || 0) - 1);
        if (unit.cooldown === 0) {
          const targets = allUnits.filter(u => u.side !== unit.side && u.hp > 0);
          // Find nearest target
          let target = null, minDist = Infinity;
          targets.forEach(t => {
            const d = Math.hypot(t.x - unit.x, t.y - unit.y);
            if (d < unit.range && d < minDist) { minDist = d; target = t; }
          });
          if (target) {
            s.bullets.push({ x: unit.x, y: unit.y, tx: target.x, ty: target.y, target, dmg: unit.atk, t: 0, color: unit.side === 'player' ? '#60a5fa' : '#f87171' });
            unit.cooldown = 40;
          } else {
            // Move toward nearest enemy
            if (targets.length > 0) {
              const nearest = targets.reduce((a, b) => Math.hypot(b.x - unit.x, b.y - unit.y) < Math.hypot(a.x - unit.x, a.y - unit.y) ? b : a);
              const dx = nearest.x - unit.x, dy = nearest.y - unit.y;
              const dist = Math.hypot(dx, dy);
              if (dist > 0) {
                unit.x += (dx / dist) * 1.2;
                unit.y += (dy / dist) * 1.2;
              }
            }
          }
        }
        // Sync back
        if (unit.side === 'player') {
          const orig = s.units.find(u => u.id === unit.id);
          if (orig) { orig.x = unit.x; orig.y = unit.y; orig.cooldown = unit.cooldown; }
        } else {
          const orig = s.enemies.find(e => e.id === unit.id);
          if (orig) { orig.x = unit.x; orig.y = unit.y; orig.cooldown = unit.cooldown; }
        }
      });

      // Bullet collision
      s.bullets.forEach(b => {
        b.t++;
        if (b.target && b.target.hp > 0) { b.tx = b.target.x; b.ty = b.target.y; }
        const dx = b.tx - b.x, dy = b.ty - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 6) {
          if (b.target && b.target.hp > 0) {
            b.target.hp -= b.dmg;
            if (b.target.hp <= 0) {
              s.score += 20;
              if (b.target.side === 'player') {
                s.units = s.units.filter(u => u.id !== b.target.id);
              } else {
                s.enemies = s.enemies.filter(e => e.id !== b.target.id);
              }
            }
          }
          b._dead = true;
        } else {
          b.x += dx / dist * 6;
          b.y += dy / dist * 6;
        }
      });
      s.bullets = s.bullets.filter(b => !b._dead && b.t < 120);

      // Check battle end
      if (s.enemies.length === 0) {
        s.gold += 5 + s.round * 2;
        s.score += 50;
        s.round++;
        if (s.round > s.maxRounds) { s.won = true; s.over = true; s.phase = 'won'; }
        else { s.phase = 'build'; s.enemies = []; }
      } else if (s.units.length === 0) {
        s.over = true; s.phase = 'lost';
      }
    }
  },
  onPointer(s, x, y) {
    if (s.phase !== 'build') return;
    // Place unit on the left half (player side)
    if (x > s.W / 2 - 40) return;
    const ut = UNIT_TYPES[s.selectedType];
    if (s.gold < ut.cost) return;
    if (s.units.length >= 6) return;
    s.gold -= ut.cost;
    s.units.push({ ...ut, id: 'u' + Date.now() + Math.random(), x, y, cooldown: 0, side: 'player' });
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.battle;
    ctx.fillStyle = '#1a0a0a'; ctx.fillRect(0, 0, s.W, s.H);

    // Arena split
    ctx.fillStyle = 'rgba(239, 68, 68, 0.05)'; ctx.fillRect(0, 0, s.W / 2, s.H);
    ctx.fillStyle = 'rgba(248, 113, 113, 0.05)'; ctx.fillRect(s.W / 2, 0, s.W / 2, s.H);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(s.W / 2, 0); ctx.lineTo(s.W / 2, s.H); ctx.stroke();

    // Units
    s.units.forEach(u => this._drawUnit(ctx, u, '#60a5fa'));
    s.enemies.forEach(e => this._drawUnit(ctx, e, '#f87171'));

    // Bullets
    s.bullets.forEach(b => {
      ctx.fillStyle = b.color || '#fbbf24';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    });

    // HUD
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`Gold ${s.gold} · Round ${s.round}/${s.maxRounds} · ${s.phase === 'build' ? 'Build Phase' : 'Battle!'}`, 12, 22);
    ctx.textAlign = 'right';
    ctx.fillText(`Score ${s.score} · Units ${s.units.length}`, s.W - 12, 22);

    // Unit selector
    if (s.phase === 'build') {
      UNIT_TYPES.forEach((ut, i) => {
        const bx = 12 + i * 90, by = s.H - 40;
        const active = s.selectedType === i;
        const affordable = s.gold >= ut.cost;
        ctx.fillStyle = active ? ut.color : '#1a1a2e';
        roundRect(ctx, bx, by, 80, 30, 6); ctx.fill();
        ctx.strokeStyle = affordable ? '#fff' : '#444'; ctx.stroke();
        ctx.fillStyle = active ? '#000' : affordable ? '#fff' : '#666';
        ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`${ut.icon} ${ut.name} [${i + 1}]`, bx + 40, by + 13);
        ctx.fillText(`${ut.cost}g`, bx + 40, by + 25);
      });
    }

    if (s.won) this._drawEnd(ctx, s.W, s.H, 'Champion!', '#16a34a', `Cleared ${s.maxRounds} rounds · Score ${s.score}`);
    if (s.over && !s.won) this._drawEnd(ctx, s.W, s.H, 'Defeated', '#dc2626', `Round ${s.round} · Score ${s.score}`);
  },
  _drawUnit(ctx, u, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(u.x, u.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(u.icon, u.x, u.y + 5);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(u.x - 14, u.y - 20, 28, 3);
    ctx.fillStyle = '#16a34a'; ctx.fillRect(u.x - 14, u.y - 20, 28 * Math.max(0, u.hp / u.maxHp || u.hp / 50), 3);
  },
  _drawEnd(ctx, W, H, title, color, sub) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, H / 2 - 10);
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
    ctx.fillText(sub, W / 2, H / 2 + 22);
  },
};

function generateEnemyTeam(round) {
  const count = 2 + round;
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const ut = UNIT_TYPES[Math.floor(Math.random() * UNIT_TYPES.length)];
    enemies.push({
      ...ut,
      id: 'e' + Date.now() + i,
      x: 400 + Math.random() * 200,
      y: 80 + Math.random() * (200),
      hp: ut.hp + round * 5,
      maxHp: ut.hp + round * 5,
      atk: ut.atk + round * 2,
      cooldown: Math.floor(Math.random() * 30),
      side: 'enemy',
    });
  }
  return enemies;
}
