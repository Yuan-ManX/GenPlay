import { PALETTE, clamp, roundRect } from './engine.js';

/**
 * 迷宫：自动生成俯视角迷宫，玩家从左上角到达右下角终点
 * 操作：方向键/WASD 在网格中移动（无墙才能通过）
 */
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  A: 'left', D: 'right', W: 'up', S: 'down',
};

export default {
  keys: KEYS,
  hint: '方向键 / WASD 移动 · 从左上到达右下角终点 · 步数越少分越高',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    const grid = config.grid || {};
    const cols = grid.cols || 15;
    const rows = grid.rows || 10;
    const cellSize = grid.cellSize || Math.min(W / cols, (H - 40) / rows);
    const cells = genMaze(cols, rows);
    return {
      W, H, cols, rows, cellSize,
      cells,
      player: { x: 0, y: 0, px: cellSize / 2, py: cellSize / 2 },
      goal: { x: cols - 1, y: rows - 1 },
      moves: 0,
      score: 0,
      over: false,
      won: false,
      speed: config.player?.speed || 2.4,
      moveCd: 0,
      reachScore: config.goal?.reward || 100,
      perMove: config.scoring?.perMove || -1,
    };
  },
  update(s, input) {
    if (s.over || s.won) return;
    if (s.moveCd > 0) { s.moveCd--; return; }

    let dx = 0, dy = 0;
    if (input.left) dx = -1;
    else if (input.right) dx = 1;
    else if (input.up) dy = -1;
    else if (input.down) dy = 1;

    if (dx === 0 && dy === 0) return;

    // 墙壁检测
    const cur = s.cells[s.player.y][s.player.x];
    const wall = getWall(cur, dx, dy);
    if (wall) return;

    s.player.x += dx;
    s.player.y += dy;
    s.moves++;
    s.score += s.perMove;
    s.moveCd = 6;

    if (s.player.x === s.goal.x && s.player.y === s.goal.y) {
      s.won = true;
      s.score += s.reachScore;
    }
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.maze;
    ctx.clearRect(0, 0, s.W, s.H);
    const bg = ctx.createLinearGradient(0, 0, 0, s.H);
    bg.addColorStop(0, '#2e1065');
    bg.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s.W, s.H);

    const offX = (s.W - s.cols * s.cellSize) / 2;
    const offY = 40;

    // 单元格背景
    for (let y = 0; y < s.rows; y++) {
      for (let x = 0; x < s.cols; x++) {
        const cell = s.cells[y][x];
        const cx = offX + x * s.cellSize;
        const cy = offY + y * s.cellSize;
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(cx, cy, s.cellSize, s.cellSize);

        // 墙
        ctx.strokeStyle = c2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (cell.top) { ctx.moveTo(cx, cy); ctx.lineTo(cx + s.cellSize, cy); }
        if (cell.bottom) { ctx.moveTo(cx, cy + s.cellSize); ctx.lineTo(cx + s.cellSize, cy + s.cellSize); }
        if (cell.left) { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + s.cellSize); }
        if (cell.right) { ctx.moveTo(cx + s.cellSize, cy); ctx.lineTo(cx + s.cellSize, cy + s.cellSize); }
        ctx.stroke();
      }
    }

    // 终点
    const gx = offX + s.goal.x * s.cellSize;
    const gy = offY + s.goal.y * s.cellSize;
    ctx.fillStyle = '#22c55e';
    ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 14;
    roundRect(ctx, gx + 4, gy + 4, s.cellSize - 8, s.cellSize - 8, 4);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(s.cellSize * 0.5)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('终', gx + s.cellSize / 2, gy + s.cellSize / 2);
    ctx.textBaseline = 'alphabetic';

    // 玩家
    const px = offX + s.player.x * s.cellSize;
    const py = offY + s.player.y * s.cellSize;
    ctx.fillStyle = c1;
    ctx.shadowColor = c1; ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(px + s.cellSize / 2, py + s.cellSize / 2, s.cellSize / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`步数 ${s.moves}`, 12, 22);
    ctx.textAlign = 'right';
    ctx.fillText(`得分 ${s.score}`, s.W - 12, 22);

    if (s.won) this._drawEnd(ctx, s.W, s.H, '通关', '#16a34a', `用时 ${s.moves} 步 · 得分 ${s.score}`);
  },
  _drawEnd(ctx, W, H, title, color, sub) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color;
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, H / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(sub, W / 2, H / 2 + 24);
  },
};

// 获取单元格在指定方向是否有墙
function getWall(cell, dx, dy) {
  if (dx === 1) return cell.right;
  if (dx === -1) return cell.left;
  if (dy === 1) return cell.bottom;
  if (dy === -1) return cell.top;
  return true;
}

// 递归回溯生成迷宫
function genMaze(cols, rows) {
  const grid = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      row.push({ top: true, right: true, bottom: true, left: true, visited: false });
    }
    grid.push(row);
  }

  const stack = [{ x: 0, y: 0 }];
  grid[0][0].visited = true;

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const neighbors = [];
    if (cur.y > 0 && !grid[cur.y - 1][cur.x].visited) neighbors.push({ x: cur.x, y: cur.y - 1, dir: 'top' });
    if (cur.x < cols - 1 && !grid[cur.y][cur.x + 1].visited) neighbors.push({ x: cur.x + 1, y: cur.y, dir: 'right' });
    if (cur.y < rows - 1 && !grid[cur.y + 1][cur.x].visited) neighbors.push({ x: cur.x, y: cur.y + 1, dir: 'bottom' });
    if (cur.x > 0 && !grid[cur.y][cur.x - 1].visited) neighbors.push({ x: cur.x - 1, y: cur.y, dir: 'left' });

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const next = neighbors[Math.floor(Math.random() * neighbors.length)];
    const a = grid[cur.y][cur.x];
    const b = grid[next.y][next.x];
    if (next.dir === 'top') { a.top = false; b.bottom = false; }
    else if (next.dir === 'right') { a.right = false; b.left = false; }
    else if (next.dir === 'bottom') { a.bottom = false; b.top = false; }
    else if (next.dir === 'left') { a.left = false; b.right = false; }

    b.visited = true;
    stack.push({ x: next.x, y: next.y });
  }

  // 清理 visited 标记
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) delete grid[y][x].visited;
  }
  return grid;
}
