import { PALETTE, roundRect, clamp } from './engine.js';

/**
 * Sandbox engine - Free-form building/creation where players place blocks,
 * shape terrain, and spawn entities. A creative canvas with no win/lose
 * conditions, just build and explore.
 * Click to place blocks, right-click to erase, 1-4 to select block type.
 */
const KEYS = {
  '1': 'type0', '2': 'type1', '3': 'type2', '4': 'type3',
  c: 'clear',
};

const BLOCK_TYPES = [
  { name: 'Grass', color: '#4ade80', icon: '🌱' },
  { name: 'Stone', color: '#94a3b8', icon: '🪨' },
  { name: 'Water', color: '#38bdf8', icon: '💧' },
  { name: 'Wood', color: '#d4a574', icon: '🪵' },
];

const GRID = 20;
const COLS = 30;
const ROWS = 22;

export default {
  keys: KEYS,
  hint: '点击放置方块 · 右键删除 · 1-4 切换类型 · C 清空',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    return {
      W, H,
      blocks: {},
      selectedType: 0,
      frame: 0,
      score: 0,
      over: false,
      won: false,
      blockCount: 0,
      camera: { x: 0, y: 0 },
      entities: [],
      spawnTimer: 0,
    };
  },
  update(s, input) {
    s.frame++;

    if (input.type0) s.selectedType = 0;
    if (input.type1) s.selectedType = 1;
    if (input.type2) s.selectedType = 2;
    if (input.type3) s.selectedType = 3;
    if (input.clear) { s.blocks = {}; s.blockCount = 0; }

    // Spawn wandering entities
    s.spawnTimer++;
    if (s.spawnTimer > 180 && s.entities.length < 5 && s.blockCount > 10) {
      s.spawnTimer = 0;
      const types = ['🐱', '🐰', '🦊', '🐦'];
      s.entities.push({
        x: Math.random() * s.W,
        y: Math.random() * s.H,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        emoji: types[Math.floor(Math.random() * types.length)],
        life: 600,
      });
    }
    s.entities.forEach(e => {
      e.x += e.vx; e.y += e.vy;
      if (e.x < 0 || e.x > s.W) e.vx *= -1;
      if (e.y < 0 || e.y > s.H) e.vy *= -1;
      e.life--;
    });
    s.entities = s.entities.filter(e => e.life > 0);

    s.score = s.blockCount;
  },
  onPointer(s, x, y, isRight) {
    const gx = Math.floor(x / GRID);
    const gy = Math.floor(y / GRID);
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;
    const key = `${gx},${gy}`;
    if (isRight) {
      if (s.blocks[key]) { delete s.blocks[key]; s.blockCount--; }
    } else {
      if (!s.blocks[key]) { s.blockCount++; }
      s.blocks[key] = s.selectedType;
    }
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.simulation;
    const grad = ctx.createLinearGradient(0, 0, 0, s.H);
    grad.addColorStop(0, '#1a2a3a'); grad.addColorStop(1, '#0a1a2a');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, s.W, s.H);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    for (let x = 0; x <= COLS * GRID; x += GRID) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ROWS * GRID); ctx.stroke();
    }
    for (let y = 0; y <= ROWS * GRID; y += GRID) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(COLS * GRID, y); ctx.stroke();
    }

    // Blocks
    Object.entries(s.blocks).forEach(([key, typeIdx]) => {
      const [gx, gy] = key.split(',').map(Number);
      const bt = BLOCK_TYPES[typeIdx] || BLOCK_TYPES[0];
      ctx.fillStyle = bt.color;
      ctx.fillRect(gx * GRID, gy * GRID, GRID, GRID);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.strokeRect(gx * GRID, gy * GRID, GRID, GRID);
    });

    // Entities
    s.entities.forEach(e => {
      ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(e.emoji, e.x, e.y + 6);
    });

    // Block type selector
    BLOCK_TYPES.forEach((bt, i) => {
      const bx = 12 + i * 80, by = 8;
      const active = s.selectedType === i;
      ctx.fillStyle = active ? bt.color : '#1a1a2e';
      roundRect(ctx, bx, by, 70, 24, 4); ctx.fill();
      ctx.strokeStyle = active ? '#fff' : '#333'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = active ? '#000' : '#888';
      ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${bt.icon} ${bt.name} [${i + 1}]`, bx + 35, by + 16);
    });

    // HUD
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`Blocks: ${s.blockCount} · Entities: ${s.entities.length}`, s.W - 12, 22);
  },
  _drawEnd() {},
};
