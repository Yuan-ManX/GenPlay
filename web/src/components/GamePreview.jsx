import { useEffect, useRef, useState } from 'react';

/**
 * GamePreview - 真实可玩的游戏预览画布
 * 基于 Canvas 的即时渲染引擎，按游戏类型(genre)适配不同玩法，
 * 支持键盘与鼠标交互，为创作者提供即时的可玩预览体验。
 */
const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  a: 'left', d: 'right', w: 'up', s: 'down',
  ' ': 'shoot', Enter: 'shoot',
};

const PALETTE = {
  shooter: ['#7c3aed', '#a78bfa', '#4f46e5'],
  adventure: ['#059669', '#34d399', '#10b981'],
  rpg: ['#b45309', '#f59e0b', '#d97706'],
  puzzle: ['#db2777', '#f472b6', '#ec4899'],
  racing: ['#dc2626', '#f87171', '#ef4444'],
  simulation: ['#0891b2', '#22d3ee', '#06b6d4'],
};

export default function GamePreview({ game }) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);
  const resetRef = useRef(null);
  const [status, setStatus] = useState('ready');
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const genre = (game?.genre || 'adventure').toLowerCase();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = 640;
    const H = canvas.height = 400;
    const [c1, c2, c3] = PALETTE[genre] || PALETTE.adventure;

    const reset = () => {
      stateRef.current = {
        player: { x: W / 2, y: H - 50, w: 34, h: 34, speed: 4.6 },
        bullets: [],
        enemies: [],
        coins: [],
        obstacles: [],
        keys: new Set(),
        score: 0,
        over: false,
        frame: 0,
        spawnAcc: 0,
      };
      setScore(0);
      setOver(false);
      setStatus('running');
    };
    resetRef.current = reset;
    reset();

    let raf;
    const loop = () => {
      const s = stateRef.current;
      if (!s) return;
      const input = { left: s.keys.has('left'), right: s.keys.has('right'), up: s.keys.has('up'), down: s.keys.has('down'), shoot: s.keys.has('shoot') };

      if (!s.over) {
        // 玩家移动
        if (input.left) s.player.x -= s.player.speed;
        if (input.right) s.player.x += s.player.speed;
        if (input.up) s.player.y -= s.player.speed;
        if (input.down) s.player.y += s.player.speed;
        s.player.x = Math.max(0, Math.min(W - s.player.w, s.player.x));
        s.player.y = Math.max(0, Math.min(H - s.player.h, s.player.y));

        // 射击（shooter / rpg）
        if (input.shoot && s.frame % 12 === 0) {
          s.bullets.push({ x: s.player.x + s.player.w / 2, y: s.player.y, vy: -7 });
        }
        s.bullets.forEach((b) => (b.y += b.vy));
        s.bullets = s.bullets.filter((b) => b.y > -20);

        // 生成敌人/障碍
        s.frame++;
        s.spawnAcc++;
        const spawnEvery = genre === 'racing' ? 24 : 36;
        if (s.spawnAcc > spawnEvery) {
          s.spawnAcc = 0;
          const ex = 20 + Math.random() * (W - 40);
          s.enemies.push({ x: ex, y: -24, w: 26, h: 26, vy: 1.6 + Math.random() });
          if (genre === 'racing') {
            s.obstacles.push({ x: Math.random() * (W - 40), y: -30, w: 30, h: 30, vy: 3.2 });
          }
        }

        // 敌人/障碍下落
        s.enemies.forEach((e) => (e.y += e.vy));
        s.enemies = s.enemies.filter((e) => e.y < H + 30);
        s.obstacles.forEach((o) => (o.y += o.vy));
        s.obstacles = s.obstacles.filter((o) => o.y < H + 30);

        // 生成金币（adventure / simulation 收集）
        if ((genre === 'adventure' || genre === 'simulation' || genre === 'puzzle') && s.frame % 60 === 0) {
          s.coins.push({ x: 20 + Math.random() * (W - 40), y: -18, r: 9, vy: 1.2 });
        }
        s.coins.forEach((c) => (c.y += c.vy));
        s.coins = s.coins.filter((c) => c.y < H + 20);

        const hit = (a, b) =>
          a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        const circleHit = (px, py, pr, b) =>
          px > b.x - pr && px < b.x + b.w + pr && py > b.y - pr && py < b.y + b.h + pr;

        // 子弹命中敌人
        s.bullets.forEach((b, bi) => {
          s.enemies.forEach((e, ei) => {
            if (b.x > e.x && b.x < e.x + e.w && b.y > e.y && b.y < e.y + e.h) {
              s.enemies.splice(ei, 1);
              s.bullets.splice(bi, 1);
              s.score += 10;
              setScore(s.score);
            }
          });
        });

        // 碰撞：敌人/障碍 -> 结束
        const collided = s.enemies.some((e) => hit(s.player, e)) ||
          s.obstacles.some((o) => hit(s.player, o));
        if (collided) {
          s.over = true;
          setOver(true);
          setStatus('over');
        }

        // 收集金币
        s.coins.forEach((c, ci) => {
          if (circleHit(c.x, c.y, c.r, s.player)) {
            s.coins.splice(ci, 1);
            s.score += 5;
            setScore(s.score);
          }
        });
      }

      // ---------- 渲染 ----------
      ctx.clearRect(0, 0, W, H);
      // 背景渐变
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#1e1b4b');
      bg.addColorStop(1, '#0f0a1f');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // 装饰网格
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // 金币
      s.coins.forEach((c) => {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      });

      // 障碍物（racing）
      s.obstacles.forEach((o) => {
        ctx.fillStyle = c3;
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(o.x, o.y, o.w, o.h / 2);
      });

      // 敌人
      s.enemies.forEach((e) => {
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.arc(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(e.x + e.w / 2 - 5, e.y + e.h / 2 - 4, 3, 0, Math.PI * 2);
        ctx.arc(e.x + e.w / 2 + 5, e.y + e.h / 2 - 4, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // 子弹
      s.bullets.forEach((b) => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(b.x - 2, b.y, 4, 12);
      });

      // 玩家
      const p = s.player;
      ctx.fillStyle = c1;
      ctx.shadowColor = c1;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(p.x, p.y, p.w, p.h, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(p.x + 10, p.y + 12, 4, 0, Math.PI * 2);
      ctx.arc(p.x + p.w - 10, p.y + 12, 4, 0, Math.PI * 2);
      ctx.fill();

      if (s.over) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('游戏结束', W / 2, H / 2 - 10);
        ctx.font = '16px sans-serif';
        ctx.fillStyle = c2;
        ctx.fillText(`得分 ${s.score} · 按 回车 重新开始`, W / 2, H / 2 + 30);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e) => {
      const k = KEYS[e.key];
      if (!k) return;
      e.preventDefault();
      const s = stateRef.current;
      if (e.type === 'keydown') {
        if (k === 'shoot' && s.over) { reset(); return; }
        s.keys.add(k);
      } else {
        s.keys.delete(k);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    canvas.focus?.();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [genre]);

  const labelMap = {
    shooter: '射击生存', adventure: '收集探险', rpg: 'RPG 战斗',
    puzzle: '解谜收集', racing: '极速躲避', simulation: '模拟采集',
  };

  return (
    <div className="game-preview">
      <div className="preview-head">
        <span className="preview-title">{game?.name || '未命名游戏'}</span>
        <span className="preview-genre">{labelMap[genre] || game?.genre}</span>
        <span className={`preview-status ${status}`}>{status === 'running' ? '运行中' : status === 'over' ? '已结束' : '就绪'}</span>
      </div>
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="preview-canvas"
        aria-label="游戏预览画布"
      />
      <div className="preview-foot">
        <span>得分 <b>{score}</b></span>
        <span className="preview-controls">方向键 / WASD 移动 · 空格 射击 · 回车 重开</span>
        {over && (
          <button className="btn-ghost btn-sm" onClick={() => resetRef.current?.()}>重新开始</button>
        )}
      </div>
    </div>
  );
}
