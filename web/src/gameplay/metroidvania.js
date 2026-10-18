import { PALETTE, roundRect, clamp, hit } from './engine.js';

/**
 * Metroidvania engine - Side-scrolling exploration with ability-gated
 * areas, upgrades, and interconnected rooms. Player moves, jumps,
 * and shoots to discover new zones and abilities.
 * Arrow keys / WASD to move, Space to jump, X to shoot.
 */
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  ' ': 'jump', x: 'shoot',
};

const GRAVITY = 0.55;
const JUMP_VEL = -11;
const MOVE_SPEED = 3.5;
const BULLET_SPEED = 8;

export default {
  keys: KEYS,
  hint: 'WASD 移动 · 空格跳跃 · X 射击 · 探索解锁能力',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    return {
      W, H,
      player: {
        x: 50, y: H - 100, w: 20, h: 28, vx: 0, vy: 0,
        onGround: false, hp: config.player?.hp || 100, maxHp: 100,
        hasDoubleJump: false, hasDash: false, facing: 1,
        abilities: config.player?.abilities || [],
      },
      platforms: generateMap(W, H),
      bullets: [],
      enemies: [
        { x: 300, y: H - 60, w: 20, h: 20, hp: 20, maxHp: 20, vx: 1, patrolMin: 250, patrolMax: 400 },
        { x: 600, y: H - 60, w: 20, h: 20, hp: 30, maxHp: 30, vx: -1, patrolMin: 550, patrolMax: 700 },
      ],
      pickups: [
        { x: 200, y: H - 150, type: 'double_jump', collected: false },
        { x: 700, y: H - 200, type: 'dash', collected: false },
      ],
      camera: { x: 0, y: 0 },
      frame: 0,
      score: 0,
      over: false,
      won: false,
      worldW: W * 3,
      doubleJumpUsed: false,
      dashCooldown: 0,
    };
  },
  update(s, input) {
    if (s.over || s.won) return;
    s.frame++;
    const p = s.player;

    // Horizontal movement
    if (input.left) { p.vx = -MOVE_SPEED; p.facing = -1; }
    else if (input.right) { p.vx = MOVE_SPEED; p.facing = 1; }
    else p.vx *= 0.8;

    // Dash
    if (input.up && s.player.hasDash && s.dashCooldown === 0) {
      p.vx = p.facing * 12;
      s.dashCooldown = 60;
    }
    if (s.dashCooldown > 0) s.dashCooldown--;

    // Jump
    if (input.jump && p.onGround) {
      p.vy = JUMP_VEL; p.onGround = false; s.doubleJumpUsed = false;
    } else if (input.jump && p.hasDoubleJump && !s.doubleJumpUsed && !p.onGround) {
      p.vy = JUMP_VEL * 0.85; s.doubleJumpUsed = true;
    }

    // Gravity
    p.vy += GRAVITY;
    if (p.vy > 14) p.vy = 14;

    // Apply movement with collision
    p.x += p.vx;
    p.x = clamp(p.x, 0, s.worldW - p.w);
    p.y += p.vy;

    // Platform collision
    p.onGround = false;
    s.platforms.forEach(plat => {
      if (hit(p, plat)) {
        const overlapTop = (p.y + p.h) - plat.y;
        const overlapBottom = (plat.y + plat.h) - p.y;
        const overlapLeft = (p.x + p.w) - plat.x;
        const overlapRight = (plat.x + plat.w) - p.x;
        const minO = Math.min(overlapTop, overlapBottom, overlapLeft, overlapRight);
        if (minO === overlapTop && p.vy > 0) { p.y = plat.y - p.h; p.vy = 0; p.onGround = true; }
        else if (minO === overlapBottom && p.vy < 0) { p.y = plat.y + plat.h; p.vy = 0; }
        else if (minO === overlapLeft) p.x = plat.x - p.w;
        else if (minO === overlapRight) p.x = plat.x + plat.w;
      }
    });

    // Fall death
    if (p.y > s.H + 100) { p.hp -= 20; p.x = 50; p.y = s.H - 100; p.vy = 0; if (p.hp <= 0) { s.over = true; p.hp = 0; } }

    // Shoot
    if (input.shoot && s.frame % 12 === 0) {
      s.bullets.push({ x: p.x + p.w / 2, y: p.y + p.h / 2, vx: p.facing * BULLET_SPEED, w: 8, h: 4 });
    }
    s.bullets.forEach(b => { b.x += b.vx; });
    s.bullets = s.bullets.filter(b => b.x > 0 && b.x < s.worldW && b.y > 0 && b.y < s.H);

    // Bullet-enemy collision
    s.bullets.forEach(b => {
      s.enemies.forEach(e => {
        if (hit(b, e)) { e.hp -= 6; b._dead = true; }
      });
    });
    s.bullets = s.bullets.filter(b => !b._dead);

    // Enemy AI
    s.enemies.forEach(e => {
      e.x += e.vx;
      if (e.x < e.patrolMin || e.x > e.patrolMax) e.vx *= -1;
      if (hit(p, e)) { p.hp -= 1; if (p.hp <= 0) { s.over = true; p.hp = 0; } }
    });
    s.enemies = s.enemies.filter(e => e.hp > 0);
    s.score += s.enemies.length === 0 && !s.won ? 50 : 0;
    if (s.enemies.length === 0 && !s.won) s.won = true;

    // Pickups
    s.pickups.forEach(pk => {
      if (!pk.collected && Math.hypot(p.x - pk.x, p.y - pk.y) < 25) {
        pk.collected = true;
        if (pk.type === 'double_jump') { p.hasDoubleJump = true; p.abilities.push('double_jump'); }
        if (pk.type === 'dash') { p.hasDash = true; p.abilities.push('dash'); }
        s.score += 50;
      }
    });

    // Camera follow
    s.camera.x = clamp(p.x - s.W / 2, 0, s.worldW - s.W);
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.shooter;
    ctx.fillStyle = '#0d0d1a'; ctx.fillRect(0, 0, s.W, s.H);

    ctx.save();
    ctx.translate(-s.camera.x, 0);

    // Platforms
    s.platforms.forEach(plat => {
      ctx.fillStyle = '#2a2a4a';
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      ctx.fillStyle = '#4a4a6a';
      ctx.fillRect(plat.x, plat.y, plat.w, 3);
    });

    // Pickups
    s.pickups.forEach(pk => {
      if (pk.collected) return;
      const glow = 0.5 + 0.5 * Math.sin(s.frame * 0.1);
      ctx.fillStyle = pk.type === 'double_jump' ? `rgba(96, 165, 250, ${glow})` : `rgba(168, 139, 250, ${glow})`;
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(pk.type === 'double_jump' ? 'DJ' : 'DS', pk.x, pk.y + 3);
    });

    // Enemies
    s.enemies.forEach(e => {
      ctx.fillStyle = '#dc2626';
      roundRect(ctx, e.x, e.y, e.w, e.h, 4); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(e.x - 2, e.y - 6, e.w + 4, 3);
      ctx.fillStyle = '#16a34a'; ctx.fillRect(e.x - 2, e.y - 6, (e.w + 4) * (e.hp / e.maxHp), 3);
    });

    // Bullets
    ctx.fillStyle = '#fbbf24';
    s.bullets.forEach(b => ctx.fillRect(b.x - 4, b.y - 2, 8, 4));

    // Player
    const p = s.player;
    ctx.fillStyle = c2;
    roundRect(ctx, p.x, p.y, p.w, p.h, 4); ctx.fill();
    // Facing indicator
    ctx.fillStyle = '#fff';
    ctx.fillRect(p.x + (p.facing > 0 ? p.w - 4 : 0), p.y + 6, 4, 4);

    ctx.restore();

    // HUD
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`HP ${p.hp}/${p.maxHp}`, 12, 22);
    ctx.textAlign = 'right';
    ctx.fillText(`Abilities: ${p.abilities.join(', ') || 'none'} · Score ${s.score}`, s.W - 12, 22);

    if (s.won) this._drawEnd(ctx, s.W, s.H, 'All Cleared!', '#16a34a', `Score ${s.score} · Abilities: ${p.abilities.length}`);
    if (s.over) this._drawEnd(ctx, s.W, s.H, 'Game Over', '#dc2626', `Score ${s.score}`);
  },
  _drawEnd(ctx, W, H, title, color, sub) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, H / 2 - 10);
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
    ctx.fillText(sub, W / 2, H / 2 + 22);
  },
};

function generateMap(W, H) {
  const platforms = [];
  // Ground
  platforms.push({ x: 0, y: H - 30, w: W * 3, h: 30 });
  // Floating platforms
  const layout = [
    { x: 150, y: H - 90, w: 80, h: 12 },
    { x: 280, y: H - 140, w: 100, h: 12 },
    { x: 450, y: H - 100, w: 80, h: 12 },
    { x: 600, y: H - 160, w: 100, h: 12 },
    { x: 750, y: H - 120, w: 80, h: 12 },
    { x: 900, y: H - 80, w: 120, h: 12 },
    { x: 1100, y: H - 150, w: 100, h: 12 },
    { x: 1300, y: H - 100, w: 80, h: 12 },
    { x: 1450, y: H - 180, w: 100, h: 12 },
  ];
  layout.forEach(p => platforms.push(p));
  // Walls
  platforms.push({ x: 500, y: H - 80, w: 12, h: 50 });
  platforms.push({ x: 850, y: H - 60, w: 12, h: 30 });
  return platforms;
}
