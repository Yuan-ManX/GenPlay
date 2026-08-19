import { PALETTE, roundRect } from './engine.js';

/**
 * 解谜：3x3 数字华容道（点击相邻空格的方块进行滑动）
 * 胜利条件：1 2 3 / 4 5 6 / 7 8 _（升序排列）
 */
const KEYS = { r: 'reset', R: 'reset' };

export default {
  keys: KEYS,
  hint: '点击与空格相邻的方块进行滑动 · 排序为 1-8 即胜 · R 键重洗',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    const size = config.grid?.size || 3;
    const target = config.winCondition?.target ||
      Array.from({ length: size * size }, (_, i) => (i + 1) % (size * size));
    return {
      W, H, size,
      grid: shuffle(size),
      target,
      moves: 0,
      solved: false,
      cell: Math.min(W, H - 80) / size - 6,
      offX: 0, offY: 60,
      anim: null,
      score: 0,
    };
  },
  update(s) {
    if (s.solved) return;
    if (s.anim) {
      s.anim.t++;
      if (s.anim.t > 8) {
        const { from, to } = s.anim;
        s.grid[to] = s.grid[from];
        s.grid[from] = 0;
        s.anim = null;
        s.moves++;
        if (this._isSolved(s)) {
          s.solved = true;
          s.score = Math.max(0, 1000 - s.moves * 10);
        }
      }
    }
  },
  onPointer(s, x, y) {
    if (s.solved || s.anim) return;
    const idx = this._pickTile(s, x, y);
    if (idx < 0) return;
    const empty = s.grid.indexOf(0);
    if (this._adjacent(idx, empty, s.size)) {
      s.anim = { from: idx, to: empty, t: 0 };
    }
  },
  _pickTile(s, x, y) {
    const c = s.cell + 6;
    if (x < s.offX || y < s.offY) return -1;
    const col = Math.floor((x - s.offX) / c);
    const row = Math.floor((y - s.offY) / c);
    if (col < 0 || col >= s.size || row < 0 || row >= s.size) return -1;
    return row * s.size + col;
  },
  _adjacent(a, b, size) {
    const ar = Math.floor(a / size), ac = a % size;
    const br = Math.floor(b / size), bc = b % size;
    return (ar === br && Math.abs(ac - bc) === 1) || (ac === bc && Math.abs(ar - br) === 1);
  },
  _isSolved(s) {
    return s.grid.every((v, i) => v === s.target[i]);
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.puzzle;
    ctx.clearRect(0, 0, s.W, s.H);
    const bg = ctx.createLinearGradient(0, 0, 0, s.H);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(1, '#312e81');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s.W, s.H);

    const c = s.cell + 6;
    s.offX = (s.W - s.size * c) / 2;

    // 棋盘背景
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, s.offX - 8, s.offY - 8, s.size * c + 16, s.size * c + 16, 14);
    ctx.fill();

    // 网格槽
    for (let i = 0; i < s.size * s.size; i++) {
      const r = Math.floor(i / s.size), col = i % s.size;
      const x = s.offX + col * c, y = s.offY + r * c;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      roundRect(ctx, x + 3, y + 3, s.cell, s.cell, 8);
      ctx.fill();
    }

    // 数字方块
    for (let i = 0; i < s.grid.length; i++) {
      const v = s.grid[i];
      if (v === 0) continue;
      let pos = i;
      if (s.anim && s.anim.from === i) {
        const target = s.anim.to;
        const fr = Math.floor(i / s.size), fc = i % s.size;
        const tr = Math.floor(target / s.size), tc = target % s.size;
        const t = s.anim.t / 8;
        const x = s.offX + (fc + (tc - fc) * t) * c;
        const y = s.offY + (fr + (tr - fr) * t) * c;
        this._drawTile(ctx, x, y, s.cell, v, c1, '#fff');
        continue;
      }
      const r = Math.floor(pos / s.size), col = pos % s.size;
      const x = s.offX + col * c, y = s.offY + r * c;
      const correct = v === s.target[pos];
      this._drawTile(ctx, x, y, s.cell, v, correct ? '#10b981' : c2, '#fff');
    }

    // 顶栏
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`步数 ${s.moves}`, 20, 30);
    ctx.textAlign = 'right';
    ctx.fillText(s.solved ? `已完成 · 得分 ${s.score}` : '华容道 · 滑块解谜', s.W - 20, 30);
  },
  _drawTile(ctx, x, y, size, value, fill, fg) {
    ctx.fillStyle = fill;
    ctx.shadowColor = fill; ctx.shadowBlur = 10;
    roundRect(ctx, x + 3, y + 3, size, size, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = fg;
    ctx.font = `bold ${Math.floor(size * 0.5)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), x + 3 + size / 2, y + 3 + size / 2);
    ctx.textBaseline = 'alphabetic';
  },
};

function shuffle(size) {
  const n = size * size;
  const arr = Array.from({ length: n }, (_, i) => (i + 1) % n);
  // 通过反向打乱保证可解
  let empty = arr.indexOf(0);
  for (let i = 0; i < 200; i++) {
    const moves = neighbors(empty, size);
    const next = moves[Math.floor(Math.random() * moves.length)];
    [arr[empty], arr[next]] = [arr[next], arr[empty]];
    empty = next;
  }
  return arr;
}

function neighbors(idx, size) {
  const r = Math.floor(idx / size), c = idx % size;
  const out = [];
  if (r > 0) out.push(idx - size);
  if (r < size - 1) out.push(idx + size);
  if (c > 0) out.push(idx - 1);
  if (c < size - 1) out.push(idx + 1);
  return out;
}
