import { PALETTE, roundRect } from './engine.js';

/**
 * 节奏判定：4 轨道下落式音符
 * 操作：D F J K 分别对应 4 个轨道的判定
 */
const KEYS = {
  d: 'lane0', D: 'lane0',
  f: 'lane1', F: 'lane1',
  j: 'lane2', J: 'lane2',
  k: 'lane3', K: 'lane3',
};

const LANE_KEYS = ['D', 'F', 'J', 'K'];
const LANE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ec4899'];

export default {
  keys: KEYS,
  hint: 'D F J K 对应 4 轨 · 音符到达判定线时按下 · 完美 +100 / 良好 +50 / Miss -20',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    const track = config.track || {};
    const song = config.song || {};
    const lanes = track.lanes || 4;
    const noteSpeed = track.noteSpeed || 3.2;
    const hitLine = track.hitLine || H - 80;
    const notesCount = song.notes || 32;
    const bpm = song.bpm || 120;

    // 生成音符谱面
    const notes = [];
    const interval = Math.floor(60 / bpm * 60); // 帧间隔
    for (let i = 0; i < notesCount; i++) {
      notes.push({
        lane: Math.floor(Math.random() * lanes),
        y: -i * interval - 60,
        hit: false,
        missed: false,
      });
    }

    return {
      W, H, lanes, hitLine, noteSpeed,
      notes,
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      good: 0,
      miss: 0,
      over: false,
      won: false,
      frame: 0,
      laneFlash: [0, 0, 0, 0],
      lastHit: '',
      lastHitFrame: 0,
      perfectScore: config.scoring?.perfect ?? 100,
      goodScore: config.scoring?.good ?? 50,
      missScore: config.scoring?.miss ?? -20,
      perfectWindow: (config.judgement?.perfect) ?? 12,
      goodWindow: (config.judgement?.good) ?? 24,
      missWindow: (config.judgement?.miss) ?? 36,
      minScore: config.winCondition?.minScore || 500,
      laneW: W / lanes,
    };
  },
  update(s, input) {
    if (s.over || s.won) return;
    s.frame++;

    // 音符下落
    s.notes.forEach((n) => {
      if (!n.hit && !n.missed) {
        n.y += s.noteSpeed;
        // miss 判定
        if (n.y > s.hitLine + s.missWindow) {
          n.missed = true;
          s.miss++;
          s.combo = 0;
          s.score += s.missScore;
          s.lastHit = 'Miss';
          s.lastHitFrame = s.frame;
        }
      }
    });

    // 按键判定
    for (let lane = 0; lane < s.lanes; lane++) {
      if (input['lane' + lane]) {
        s.laneFlash[lane] = 8;
        // 寻找该 lane 上最接近判定线的未命中音符
        let target = null, minDist = Infinity;
        s.notes.forEach((n) => {
          if (n.lane === lane && !n.hit && !n.missed) {
            const d = Math.abs(n.y - s.hitLine);
            if (d < s.goodWindow && d < minDist) {
              minDist = d;
              target = n;
            }
          }
        });
        if (target) {
          target.hit = true;
          if (minDist <= s.perfectWindow) {
            s.score += s.perfectScore;
            s.perfect++;
            s.combo++;
            s.lastHit = 'Perfect';
          } else {
            s.score += s.goodScore;
            s.good++;
            s.combo++;
            s.lastHit = 'Good';
          }
          s.maxCombo = Math.max(s.maxCombo, s.combo);
          s.lastHitFrame = s.frame;
        }
      }
    }

    // 衰减闪光
    for (let i = 0; i < s.lanes; i++) {
      if (s.laneFlash[i] > 0) s.laneFlash[i]--;
    }

    // 歌曲结束判定
    const allDone = s.notes.every((n) => n.hit || n.missed);
    if (allDone) {
      s.over = true;
      s.won = s.score >= s.minScore;
    }
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.rhythm;
    ctx.clearRect(0, 0, s.W, s.H);
    const bg = ctx.createLinearGradient(0, 0, 0, s.H);
    bg.addColorStop(0, '#1e1b4b');
    bg.addColorStop(1, '#0c0a1f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, s.W, s.H);

    // 轨道
    for (let i = 0; i < s.lanes; i++) {
      const x = i * s.laneW;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)';
      ctx.fillRect(x, 0, s.laneW, s.H);

      // 轨道闪烁
      if (s.laneFlash[i] > 0) {
        ctx.fillStyle = `rgba(${hexToRgb(LANE_COLORS[i])}, ${s.laneFlash[i] / 16})`;
        ctx.fillRect(x, 0, s.laneW, s.H);
      }
    }

    // 判定线
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, s.hitLine);
    ctx.lineTo(s.W, s.hitLine);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 判定圈
    for (let i = 0; i < s.lanes; i++) {
      const cx = i * s.laneW + s.laneW / 2;
      ctx.strokeStyle = LANE_COLORS[i];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, s.hitLine, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(LANE_KEYS[i], cx, s.hitLine);
      ctx.textBaseline = 'alphabetic';
    }

    // 音符
    s.notes.forEach((n) => {
      if (n.hit || n.missed) return;
      const cx = n.lane * s.laneW + s.laneW / 2;
      ctx.fillStyle = LANE_COLORS[n.lane];
      ctx.shadowColor = LANE_COLORS[n.lane]; ctx.shadowBlur = 10;
      roundRect(ctx, cx - 22, n.y - 8, 44, 16, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // HUD
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`得分 ${s.score}`, 12, 28);
    ctx.textAlign = 'center';
    ctx.fillStyle = c2;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`Combo ${s.combo}`, s.W / 2, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Perfect ${s.perfect} · Good ${s.good} · Miss ${s.miss}`, s.W - 12, 28);

    // 判定文字
    if (s.lastHit && s.frame - s.lastHitFrame < 30) {
      const color = s.lastHit === 'Perfect' ? '#22c55e' : s.lastHit === 'Good' ? '#fbbf24' : '#ef4444';
      ctx.fillStyle = color;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.lastHit, s.W / 2, s.hitLine - 40);
    }

    if (s.over) {
      this._drawEnd(ctx, s.W, s.H, s.won ? '通关' : '未达标', s.won ? '#16a34a' : '#dc2626',
        `得分 ${s.score} · 最高连击 ${s.maxCombo}`);
    }
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

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
