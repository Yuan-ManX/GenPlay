import { PALETTE, roundRect, clamp } from './engine.js';

/**
 * Roguelike engine - Grid-based dungeon crawler with procedural rooms,
 * turn-based movement, enemy AI, item pickups, and floor descent.
 * Move with arrow keys / WASD; bump into enemies to attack.
 */
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  '>': 'descend',
};

const TILE = 28;
const COLS = 18;
const ROWS = 14;

export default {
  keys: KEYS,
  hint: 'WASD/方向键 移动 · 撞击敌人攻击 · 站在楼梯上按 > 下层',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    const grid = generateDungeon(COLS, ROWS, config.seed || Date.now());
    return {
      W, H,
      grid,
      player: { x: grid.stairs.x, y: grid.stairs.y, hp: config.player?.hp || 100, maxHp: 100, atk: 15, gold: 0, floor: 1 },
      enemies: grid.enemies,
      items: grid.items,
      stairs: grid.stairsDown,
      messages: ['You enter the dungeon...'],
      frame: 0,
      score: 0,
      over: false,
      won: false,
      turn: 0,
    };
  },
  update(s, input) {
    if (s.over || s.won) return;
    s.frame++;

    let dx = 0, dy = 0;
    if (input.left) dx = -1;
    else if (input.right) dx = 1;
    else if (input.up) dy = -1;
    else if (input.down) dy = 1;

    if (dx !== 0 || dy !== 0) {
      const nx = s.player.x + dx, ny = s.player.y + dy;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && s.grid.tiles[ny][nx] !== 1) {
        // Check enemy at target
        const enemy = s.enemies.find(e => e.x === nx && e.y === ny);
        if (enemy) {
          enemy.hp -= s.player.atk;
          s.messages.unshift(`You hit ${enemy.name} for ${s.player.atk}!`);
          if (enemy.hp <= 0) {
            s.player.gold += enemy.gold;
            s.score += enemy.score;
            s.enemies = s.enemies.filter(e => e !== enemy);
            s.messages.unshift(`${enemy.name} slain! +${enemy.gold}g`);
          } else {
            // Enemy retaliates
            s.player.hp -= enemy.atk;
            s.messages.unshift(`${enemy.name} hits you for ${enemy.atk}!`);
            if (s.player.hp <= 0) { s.over = true; s.player.hp = 0; }
          }
        } else {
          s.player.x = nx; s.player.y = ny;
          // Check items
          const item = s.items.find(i => i.x === nx && i.y === ny);
          if (item) {
            if (item.type === 'potion') { s.player.hp = Math.min(s.player.maxHp, s.player.hp + 30); }
            else if (item.type === 'gold') { s.player.gold += item.amount; }
            else if (item.type === 'weapon') { s.player.atk += item.bonus; }
            s.messages.unshift(`Picked up ${item.name}!`);
            s.items = s.items.filter(i => i !== item);
          }
          // Check stairs
          if (s.stairs && s.player.x === s.stairs.x && s.player.y === s.stairs.y) {
            s.player.floor++;
            if (s.player.floor >= 5) { s.won = true; }
            else {
              const ng = generateDungeon(COLS, ROWS, Date.now() + s.player.floor);
              s.grid = ng;
              s.player.x = ng.stairs.x; s.player.y = ng.stairs.y;
              s.enemies = ng.enemies;
              s.items = ng.items;
              s.stairs = ng.stairsDown;
              s.messages.unshift(`Descending to floor ${s.player.floor}...`);
            }
          }
          // Enemy turn: move toward player
          s.enemies.forEach(e => {
            const edx = Math.sign(s.player.x - e.x);
            const edy = Math.sign(s.player.y - e.y);
            if (Math.abs(s.player.x - e.x) > Math.abs(s.player.y - e.y)) {
              const tx = e.x + edx;
              if (tx >= 0 && tx < COLS && s.grid.tiles[e.y][tx] !== 1 && !s.enemies.find(o => o !== e && o.x === tx && o.y === e.y)) e.x = tx;
            } else {
              const ty = e.y + edy;
              if (ty >= 0 && ty < ROWS && s.grid.tiles[ty][e.x] !== 1 && !s.enemies.find(o => o !== e && o.x === e.x && o.y === ty)) e.y = ty;
            }
            // Adjacent attack
            if (Math.abs(e.x - s.player.x) + Math.abs(e.y - s.player.y) === 1) {
              s.player.hp -= e.atk;
              s.messages.unshift(`${e.name} bites you for ${e.atk}!`);
              if (s.player.hp <= 0) { s.over = true; s.player.hp = 0; }
            }
          });
          s.turn++;
        }
      }
    }
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.tower;
    const offX = (s.W - COLS * TILE) / 2;
    const offY = (s.H - ROWS * TILE) / 2;
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, s.W, s.H);

    // Draw tiles
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = s.grid.tiles[y][x];
        const px = offX + x * TILE, py = offY + y * TILE;
        if (t === 1) {
          ctx.fillStyle = '#2a1f1a'; ctx.fillRect(px, py, TILE, TILE);
          ctx.strokeStyle = '#3a2f2a'; ctx.strokeRect(px, py, TILE, TILE);
        } else {
          ctx.fillStyle = '#1a1a2e'; ctx.fillRect(px, py, TILE, TILE);
        }
      }
    }

    // Stairs
    if (s.stairs) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('>', offX + s.stairs.x * TILE + TILE / 2, offY + s.stairs.y * TILE + TILE * 0.7);
    }

    // Items
    s.items.forEach(item => {
      const px = offX + item.x * TILE, py = offY + item.y * TILE;
      ctx.fillStyle = item.type === 'potion' ? '#ef4444' : item.type === 'gold' ? '#fbbf24' : '#a78bfa';
      ctx.beginPath(); ctx.arc(px + TILE / 2, py + TILE / 2, 6, 0, Math.PI * 2); ctx.fill();
    });

    // Enemies
    s.enemies.forEach(e => {
      const px = offX + e.x * TILE, py = offY + e.y * TILE;
      ctx.fillStyle = '#dc2626';
      roundRect(ctx, px + 4, py + 4, TILE - 8, TILE - 8, 4); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px + 2, py - 4, TILE - 4, 3);
      ctx.fillStyle = '#16a34a'; ctx.fillRect(px + 2, py - 4, (TILE - 4) * (e.hp / e.maxHp), 3);
    });

    // Player
    const ppx = offX + s.player.x * TILE, ppy = offY + s.player.y * TILE;
    ctx.fillStyle = c2;
    roundRect(ctx, ppx + 4, ppy + 4, TILE - 8, TILE - 8, 4); ctx.fill();

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`HP ${s.player.hp}/${s.player.maxHp} · ATK ${s.player.atk} · Gold ${s.player.gold} · Floor ${s.player.floor}`, 12, 22);
    ctx.textAlign = 'right';
    ctx.fillText(`Score ${s.score}`, s.W - 12, 22);
    if (s.messages[0]) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#a78bfa';
      ctx.fillText(s.messages[0], 12, s.H - 12);
    }

    if (s.won) this._drawEnd(ctx, s.W, s.H, 'Dungeon Cleared!', '#16a34a', `Reached floor ${s.player.floor} · Score ${s.score}`);
    if (s.over) this._drawEnd(ctx, s.W, s.H, 'You Died', '#dc2626', `Floor ${s.player.floor} · Score ${s.score}`);
  },
  _drawEnd(ctx, W, H, title, color, sub) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, H / 2 - 10);
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
    ctx.fillText(sub, W / 2, H / 2 + 22);
  },
};

function generateDungeon(cols, rows, seed) {
  let rng = seed >>> 0;
  const rand = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };
  const tiles = Array.from({ length: rows }, () => Array(cols).fill(1));
  // Carve rooms
  const rooms = [];
  const numRooms = 5 + Math.floor(rand() * 4);
  for (let i = 0; i < numRooms; i++) {
    const rw = 3 + Math.floor(rand() * 5), rh = 3 + Math.floor(rand() * 4);
    const rx = 1 + Math.floor(rand() * (cols - rw - 2)), ry = 1 + Math.floor(rand() * (rows - rh - 2));
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) tiles[y][x] = 0;
    rooms.push({ rx, ry, rw, rh, cx: rx + Math.floor(rw / 2), cy: ry + Math.floor(rh / 2) });
  }
  // Connect rooms
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1], b = rooms[i];
    let cx = a.cx, cy = a.cy;
    while (cx !== b.cx) { tiles[cy][cx] = 0; cx += Math.sign(b.cx - cx); }
    while (cy !== b.cy) { tiles[cy][cx] = 0; cy += Math.sign(b.cy - cy); }
  }
  // Place player at first room center
  const stairs = { x: rooms[0].cx, y: rooms[0].cy };
  // Place down stairs at last room
  const stairsDown = { x: rooms[rooms.length - 1].cx, y: rooms[rooms.length - 1].cy };
  // Enemies
  const enemyTypes = [
    { name: 'Slime', hp: 20, atk: 5, gold: 3, score: 10 },
    { name: 'Goblin', hp: 35, atk: 8, gold: 6, score: 15 },
    { name: 'Skeleton', hp: 50, atk: 12, gold: 10, score: 25 },
  ];
  const enemies = [];
  for (let i = 1; i < rooms.length - 1; i++) {
    const r = rooms[i];
    const t = enemyTypes[Math.floor(rand() * enemyTypes.length)];
    enemies.push({ ...t, maxHp: t.hp, x: r.cx, y: r.cy });
  }
  // Items
  const items = [];
  const itemPool = [
    { type: 'potion', name: 'Health Potion' },
    { type: 'gold', name: 'Gold Pouch', amount: 15 },
    { type: 'weapon', name: 'Sharp Blade', bonus: 3 },
  ];
  for (let i = 0; i < 3; i++) {
    const r = rooms[Math.floor(rand() * rooms.length)];
    const it = itemPool[Math.floor(rand() * itemPool.length)];
    items.push({ ...it, x: r.cx + (rand() > 0.5 ? 1 : -1), y: r.cy });
  }
  return { tiles, enemies, items, stairs, stairsDown };
}
