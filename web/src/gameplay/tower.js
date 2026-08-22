import { PALETTE, roundRect } from './engine.js';

/**
 * 塔防：敌人沿固定路径前进，玩家点击空地部署塔
 * 操作：点击画布空地（非路径上）建造塔 · 塔自动射击最近敌人
 */
const KEYS = {
  '1': 'start_wave', Enter: 'start_wave',
};

export default {
  keys: KEYS,
  hint: '点击空地建造塔（-25金币）· 按 1/回车 开启下一波 · 塔自动射击',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    const path = config.path?.points || [[0, 200], [200, 200], [200, 100], [450, 100], [450, 300], [W, 300]];
    return {
      W, H,
      path,
      gold: config.player?.gold || 100,
      lives: config.player?.lives || 10,
      towers: [],
      enemies: [],
      bullets: [],
      frame: 0,
      score: 0,
      over: false,
      won: false,
      waveNum: 0,
      waveActive: false,
      waveSpawned: 0,
      waveKilled: 0,
      waveTarget: config.wave?.enemiesPerWave || 8,
      waveCount: config.wave?.count || 5,
      enemySpawn: config.enemy?.spawnEvery || 90,
      enemyHp: config.enemy?.hp || 30,
      enemySpeed: config.enemy?.speed || 1.0,
      enemyReward: config.enemy?.reward || 10,
      towerCost: config.tower?.cost || 25,
      towerRange: config.tower?.range || 80,
      towerDamage: config.tower?.damage || 8,
      towerFireRate: config.tower?.fireRate || 30,
      killScore: config.scoring?.kill ?? 10,
      pathSegments: buildSegments(path),
    };
  },
  update(s, input) {
    if (s.over || s.won) return;
    s.frame++;

    // 自动开始首波
    if (!s.waveActive && s.waveNum === 0 && s.frame > 60) {
      this._startWave(s);
    }

    // 波次内刷怪
    if (s.waveActive && s.waveSpawned < s.waveTarget && s.frame % s.enemySpawn === 0) {
      s.enemies.push({
        x: s.path[0][0],
        y: s.path[0][1],
        hp: s.enemyHp + s.waveNum * 5,
        maxHp: s.enemyHp + s.waveNum * 5,
        segIdx: 0,
        segT: 0,
        speed: s.enemySpeed,
      });
      s.waveSpawned++;
    }

    // 敌人沿路径移动
    s.enemies.forEach((e) => {
      const seg = s.pathSegments[e.segIdx];
      if (!seg) return;
      const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
      const len = Math.hypot(dx, dy);
      e.segT += e.speed / len;
      if (e.segT >= 1) {
        e.segIdx++;
        e.segT = 0;
        if (e.segIdx >= s.pathSegments.length) {
          // 到达终点
          s.lives--;
          e._reached = true;
          if (s.lives <= 0) s.over = true;
        }
      }
      const nextSeg = s.pathSegments[e.segIdx];
      if (nextSeg) {
        e.x = nextSeg.x1 + (nextSeg.x2 - nextSeg.x1) * e.segT;
        e.y = nextSeg.y1 + (nextSeg.y2 - nextSeg.y1) * e.segT;
      }
    });
    s.enemies = s.enemies.filter((e) => !e._reached && e.hp > 0);

    // 塔射击
    s.towers.forEach((t) => {
      t.cooldown = Math.max(0, t.cooldown - 1);
      if (t.cooldown === 0) {
        // 寻找最近敌人
        let target = null, minDist = Infinity;
        s.enemies.forEach((e) => {
          const d = Math.hypot(e.x - t.x, e.y - t.y);
          if (d < s.towerRange && d < minDist) { minDist = d; target = e; }
        });
        if (target) {
          s.bullets.push({ x: t.x, y: t.y, tx: target.x, ty: target.y, target, dmg: s.towerDamage, t: 0 });
          t.cooldown = s.towerFireRate;
        }
      }
    });

    // 子弹飞行
    s.bullets.forEach((b) => {
      b.t++;
      if (b.target && b.target.hp > 0) {
        b.tx = b.target.x; b.ty = b.target.y;
      }
      const dx = b.tx - b.x, dy = b.ty - b.y;
      const dist = Math.hypot(dx, dy);
      const speed = 8;
      if (dist < speed) {
        // 命中
        if (b.target && b.target.hp > 0) {
          b.target.hp -= b.dmg;
          if (b.target.hp <= 0) {
            s.gold += s.enemyReward;
            s.score += s.killScore;
            s.waveKilled++;
          }
        }
        b._dead = true;
      } else {
        b.x += dx / dist * speed;
        b.y += dy / dist * speed;
      }
    });
    s.bullets = s.bullets.filter((b) => !b._dead && b.t < 60);

    // 波次结束
    if (s.waveActive && s.waveSpawned >= s.waveTarget && s.enemies.length === 0) {
      s.waveActive = false;
      s.gold += 30; // 波次奖励
      if (s.waveNum >= s.waveCount) s.won = true;
    }

    if (input.start_wave && !s.waveActive && !s.won) {
      this._startWave(s);
    }
  },
  _startWave(s) {
    s.waveNum++;
    s.waveActive = true;
    s.waveSpawned = 0;
    s.waveKilled = 0;
  },
  onPointer(s, x, y) {
    // 在非路径区域放置塔
    if (s.gold < s.towerCost) return;
    if (this._onPath(s, x, y, 20)) return;
    if (s.towers.some((t) => Math.hypot(t.x - x, t.y - y) < 30)) return;
    s.towers.push({ x, y, cooldown: 0 });
    s.gold -= s.towerCost;
  },
  _onPath(s, x, y, threshold) {
    for (const seg of s.pathSegments) {
      const dist = distToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
      if (dist < threshold) return true;
    }
    return false;
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.tower;
    ctx.clearRect(0, 0, s.W, s.H);
    const bg = ctx.createLinearGradient(0, 0, 0, s.H);
    bg.addColorStop(0, '#1c1917');
    bg.addColorStop(1, '#0c0a09');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s.W, s.H);

    // 网格
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    for (let x = 0; x < s.W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, s.H); ctx.stroke(); }
    for (let y = 0; y < s.H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s.W, y); ctx.stroke(); }

    // 路径
    ctx.strokeStyle = c3;
    ctx.lineWidth = 32;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.path.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
    ctx.stroke();
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 28;
    ctx.beginPath();
    s.path.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
    ctx.stroke();

    // 敌人
    s.enemies.forEach((e) => {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath(); ctx.arc(e.x, e.y, 10, 0, Math.PI * 2); ctx.fill();
      // HP 条
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - 12, e.y - 18, 24, 4);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(e.x - 12, e.y - 18, 24 * (e.hp / e.maxHp), 4);
    });

    // 塔
    s.towers.forEach((t) => {
      // 射程圈
      ctx.fillStyle = 'rgba(124, 45, 18, 0.15)';
      ctx.beginPath(); ctx.arc(t.x, t.y, s.towerRange, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = c2;
      roundRect(ctx, t.x - 10, t.y - 10, 20, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#7c2d12';
      ctx.fillRect(t.x - 3, t.y - 16, 6, 12);
    });

    // 子弹
    s.bullets.forEach((b) => {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`金币 ${s.gold} · 生命 ${s.lives}`, 12, 22);
    ctx.textAlign = 'right';
    ctx.fillText(`第 ${s.waveNum}/${s.waveCount} 波 ${s.waveActive ? '· 进行中' : '· 按 1 开始'}`, s.W - 12, 22);

    if (s.won) this._drawEnd(ctx, s.W, s.H, '胜利', '#16a34a', `清剿全部 ${s.waveCount} 波`);
    if (s.over) this._drawEnd(ctx, s.W, s.H, '失败', '#dc2626', `坚持到第 ${s.waveNum} 波`);
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

function buildSegments(points) {
  const segs = [];
  for (let i = 0; i < points.length - 1; i++) {
    segs.push({ x1: points[i][0], y1: points[i][1], x2: points[i + 1][0], y2: points[i + 1][1] });
  }
  return segs;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
