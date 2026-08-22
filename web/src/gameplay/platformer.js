import { DEFAULT_KEYS, PALETTE, hit, clamp, roundRect } from './engine.js';

/**
 * 平台跳跃：横版跳跃，重力+二段跳+踩怪得分
 * 操作：方向键/AD 移动 · 空格/W/上 跳跃（支持二段跳）
 */
const KEYS = {
  ...DEFAULT_KEYS,
  ' ': 'jump', Enter: 'jump',
  w: 'jump', W: 'jump', ArrowUp: 'jump',
};

export default {
  keys: KEYS,
  hint: 'A/D 移动 · 空格/W 跳跃（可二段跳）· 踩怪得分',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    const cfg = config.player || {};
    return {
      W, H,
      groundY: H - 50,
      player: {
        x: 80, y: H - 80, w: 28, h: 32,
        vx: 0, vy: 0,
        speed: cfg.speed || 3.2,
        jumpForce: cfg.jumpForce || 11,
        gravity: cfg.gravity || 0.5,
        maxJumps: cfg.maxJumps || 2,
        jumpsLeft: cfg.maxJumps || 2,
        onGround: false,
      },
      platforms: this._genPlatforms(W, H - 50, config.platform),
      enemies: [],
      coins: [],
      frame: 0,
      score: 0,
      over: false,
      enemySpawn: config.enemy?.spawnEvery || 120,
      enemySpeed: config.enemy?.speed || 1.4,
      stompScore: config.scoring?.stomp ?? 15,
      coinScore: config.scoring?.coin ?? 5,
      camX: 0,
      jumpHeld: false,
    };
  },
  _genPlatforms(W, groundY, cfg = {}) {
    const plats = [{ x: 0, y: groundY, w: W, h: 50 }];
    const count = cfg.count || 5;
    const out = [...plats];
    let x = 200;
    for (let i = 0; i < count; i++) {
      const w = 80 + Math.random() * 60;
      const gap = (cfg.gapMin || 80) + Math.random() * ((cfg.gapMax || 160) - (cfg.gapMin || 80));
      const y = groundY - 60 - Math.random() * (cfg.heightVar || 60);
      out.push({ x, y, w, h: 12 });
      x += w + gap;
    }
    // 加一个无限延伸的地面
    out[0].w = x + 400;
    return out;
  },
  update(s, input) {
    if (s.over) return;
    const p = s.player;

    // 水平移动
    if (input.left) p.vx = -p.speed;
    else if (input.right) p.vx = p.speed;
    else p.vx = 0;
    p.x += p.vx;

    // 跳跃（边沿触发，避免按住连跳）
    if (input.jump && !s.jumpHeld && p.jumpsLeft > 0) {
      p.vy = -p.jumpForce;
      p.jumpsLeft--;
      p.onGround = false;
    }
    s.jumpHeld = Boolean(input.jump);

    // 重力
    p.vy += p.gravity;
    p.vy = Math.min(p.vy, 16);
    p.y += p.vy;

    // 平台碰撞（仅从上方落下时支持）
    p.onGround = false;
    for (const plat of s.platforms) {
      if (p.x + p.w > plat.x && p.x < plat.x + plat.w) {
        if (p.vy >= 0 && p.y + p.h >= plat.y && p.y + p.h <= plat.y + plat.h + 12) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
          p.jumpsLeft = p.maxJumps;
        }
      }
    }

    // 摄像机跟随
    s.camX = Math.max(0, p.x - 200);

    // 生成敌人
    s.frame++;
    if (s.frame % s.enemySpawn === 0) {
      s.enemies.push({
        x: p.x + 500 + Math.random() * 100,
        y: s.groundY - 28, w: 28, h: 28,
        vx: -s.enemySpeed,
        patrolBase: 0, patrolRange: 80,
      });
    }
    s.enemies.forEach((e) => { e.x += e.vx; });
    s.enemies = s.enemies.filter((e) => e.x > s.camX - 100);

    // 生成金币
    if (s.frame % 90 === 0) {
      s.coins.push({
        x: p.x + 300 + Math.random() * 200,
        y: s.groundY - 80 - Math.random() * 60,
        r: 8, vy: 0,
      });
    }
    s.coins = s.coins.filter((c) => c.x > s.camX - 50);

    // 碰撞：踩怪
    s.enemies.forEach((e, ei) => {
      if (hit(p, e)) {
        if (p.vy > 0 && p.y + p.h - 10 < e.y) {
          // 踩中
          s.enemies.splice(ei, 1);
          s.score += s.stompScore;
          p.vy = -p.jumpForce * 0.6;
        } else {
          s.over = true;
        }
      }
    });

    // 碰撞：金币
    s.coins.forEach((c, ci) => {
      if (c.x > p.x - 8 && c.x < p.x + p.w + 8 && c.y > p.y - 8 && c.y < p.y + p.h + 8) {
        s.coins.splice(ci, 1);
        s.score += s.coinScore;
      }
    });

    // 掉落出地图
    if (p.y > s.H + 100) s.over = true;
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.platformer || PALETTE.adventure;
    ctx.clearRect(0, 0, s.W, s.H);
    const bg = ctx.createLinearGradient(0, 0, 0, s.H);
    bg.addColorStop(0, '#1e3a8a');
    bg.addColorStop(1, '#0c1e4d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s.W, s.H);

    // 远景星星
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 30; i++) {
      const x = (i * 73 - s.camX * 0.3) % s.W;
      const y = (i * 31) % (s.H - 100);
      ctx.fillRect((x + s.W) % s.W, y, 2, 2);
    }

    ctx.save();
    ctx.translate(-s.camX, 0);

    // 平台
    s.platforms.forEach((plat) => {
      ctx.fillStyle = '#15803d';
      roundRect(ctx, plat.x, plat.y, plat.w, plat.h, 4);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(plat.x, plat.y, plat.w, 4);
    });

    // 金币
    s.coins.forEach((c) => {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.5, 0, Math.PI * 2); ctx.fill();
    });

    // 敌人
    s.enemies.forEach((e) => {
      ctx.fillStyle = c2;
      roundRect(ctx, e.x, e.y, e.w, e.h, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x + 8, e.y + 8, 3, 0, Math.PI * 2); ctx.arc(e.x + 20, e.y + 8, 3, 0, Math.PI * 2); ctx.fill();
    });

    // 玩家
    const p = s.player;
    ctx.fillStyle = c1;
    ctx.shadowColor = c1; ctx.shadowBlur = 12;
    roundRect(ctx, p.x, p.y, p.w, p.h, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.fillRect(p.x + 6, p.y + 8, 5, 5);
    ctx.fillRect(p.x + 17, p.y + 8, 5, 5);

    ctx.restore();
  },
};
