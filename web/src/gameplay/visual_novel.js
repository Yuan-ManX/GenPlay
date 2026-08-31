import { PALETTE, roundRect, clamp } from './engine.js';

/**
 * Visual Novel engine - Story-driven interactive narrative where the player
 * reads text and makes branching choices that affect the story outcome.
 * Click or press 1-4 to select dialogue choices, Space to advance text.
 */
const KEYS = {
  ' ': 'next',
  '1': 'choice0', '2': 'choice1', '3': 'choice2', '4': 'choice3',
};

const STORY = [
  {
    speaker: 'Narrator',
    portrait: '🌙',
    text: 'The stars whisper your name. You stand at the crossroads of destiny, where two paths diverge into the mist...',
    choices: [
      { text: 'Take the forest path', next: 1, tag: 'forest' },
      { text: 'Take the mountain path', next: 2, tag: 'mountain' },
    ],
  },
  {
    speaker: 'Forest Spirit',
    portrait: '🌿',
    text: 'Welcome, traveler. The forest remembers those who walk with kind hearts. Will you help us?',
    choices: [
      { text: 'Help the spirit', next: 3, tag: 'kind' },
      { text: 'Ask for rewards first', next: 4, tag: 'greedy' },
      { text: 'Return to crossroads', next: 0, tag: 'back' },
    ],
  },
  {
    speaker: 'Mountain Guide',
    portrait: '🏔',
    text: 'The climb is treacherous. Only the bold survive. What do you seek at the summit?',
    choices: [
      { text: 'Seek the ancient sword', next: 5, tag: 'weapon' },
      { text: 'Seek the oracle', next: 3, tag: 'wisdom' },
      { text: 'Return to crossroads', next: 0, tag: 'back' },
    ],
  },
  {
    speaker: 'Oracle',
    portrait: '🔮',
    text: 'You have shown wisdom. The future I see for you is bright — a leader who unites the fractured lands.',
    choices: [
      { text: 'Accept your destiny', next: 6, tag: 'accept' },
    ],
  },
  {
    speaker: 'Forest Spirit',
    portrait: '🍂',
    text: 'Greed clouds your vision. The forest turns away. You walk alone now.',
    choices: [
      { text: 'Apologize and return', next: 1, tag: 'apologize' },
      { text: 'Continue alone', next: 6, tag: 'alone' },
    ],
  },
  {
    speaker: 'Guardian',
    portrait: '⚔',
    text: 'The ancient sword lies before you. It pulses with forgotten power. Only the worthy may wield it.',
    choices: [
      { text: 'Grasp the sword', next: 6, tag: 'claim' },
      { text: 'Leave it be', next: 3, tag: 'humble' },
    ],
  },
  {
    speaker: 'Narrator',
    portrait: '✨',
    text: 'Your story has reached its conclusion. The echoes of your choices will ripple through eternity.',
    choices: [
      { text: 'Begin a new story', next: 0, tag: 'restart' },
    ],
  },
];

export default {
  keys: KEYS,
  hint: '空格 继续 · 1-4 选择对话分支',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    return {
      W, H,
      node: 0,
      textProgress: 0,
      fullText: '',
      displayText: '',
      choices: [],
      frame: 0,
      score: 0,
      over: false,
      won: false,
      tags: [],
      ending: null,
      bgGradient: 0,
    };
  },
  update(s, input) {
    s.frame++;
    const node = STORY[s.node];
    if (!node) return;

    // Typewriter effect
    if (s.textProgress < node.text.length) {
      s.textProgress += 0.5;
      s.displayText = node.text.substring(0, Math.floor(s.textProgress));
    } else {
      s.displayText = node.text;
      s.choices = node.choices || [];
    }

    // Advance text
    if (input.next && s.textProgress < node.text.length) {
      s.textProgress = node.text.length;
    }

    // Handle choices
    for (let i = 0; i < 4; i++) {
      if (input['choice' + i] && s.choices[i] && s.textProgress >= node.text.length) {
        const choice = s.choices[i];
        s.tags.push(choice.tag);
        s.score += 10;
        s.node = choice.next;
        s.textProgress = 0;
        s.displayText = '';
        s.choices = [];
        if (choice.tag === 'restart') { s.tags = []; }
        if (choice.next === 6) { s.won = true; s.ending = s.tags.join(' → '); }
        break;
      }
    }

    s.bgGradient += 0.002;
  },
  onPointer(s, x, y) {
    const node = STORY[s.node];
    if (!node) return;
    if (s.textProgress < node.text.length) {
      s.textProgress = node.text.length;
      return;
    }
    // Click choice
    const startY = s.H - 40 - s.choices.length * 32;
    for (let i = 0; i < s.choices.length; i++) {
      if (y >= startY + i * 32 && y <= startY + i * 32 + 28) {
        const choice = s.choices[i];
        s.tags.push(choice.tag);
        s.score += 10;
        s.node = choice.next;
        s.textProgress = 0;
        s.displayText = '';
        s.choices = [];
        if (choice.tag === 'restart') s.tags = [];
        if (choice.next === 6) { s.won = true; s.ending = s.tags.join(' → '); }
        break;
      }
    }
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.puzzle;
    // Animated background
    const hue = (s.bgGradient * 360) % 360;
    ctx.fillStyle = `hsl(${hue}, 20%, 8%)`;
    ctx.fillRect(0, 0, s.W, s.H);

    // Floating particles
    for (let i = 0; i < 15; i++) {
      const px = (i * 73 + s.frame * 0.3) % s.W;
      const py = (i * 47 + s.frame * 0.15) % s.H;
      ctx.fillStyle = `rgba(255,255,255,${0.02 + 0.02 * Math.sin(s.frame * 0.02 + i)})`;
      ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
    }

    const node = STORY[s.node] || STORY[0];

    // Portrait
    ctx.font = '64px sans-serif'; ctx.textAlign = 'center';
    const glow = 0.5 + 0.5 * Math.sin(s.frame * 0.03);
    ctx.fillStyle = `rgba(168, 139, 250, ${glow * 0.3})`;
    ctx.beginPath(); ctx.arc(s.W / 2, 100, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillText(node.portrait, s.W / 2, 120);

    // Speaker name
    ctx.fillStyle = c2; ctx.font = 'bold 16px sans-serif';
    ctx.fillText(node.speaker, s.W / 2, 170);

    // Text box
    const boxY = s.H / 2 - 40, boxH = 120;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, 40, boxY, s.W - 80, boxH, 12); ctx.fill();
    ctx.strokeStyle = c1; ctx.lineWidth = 2; ctx.stroke();

    // Story text
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    this._wrapText(ctx, s.displayText, 60, boxY + 30, s.W - 120, 20);

    // Choices
    if (s.choices.length > 0 && s.textProgress >= node.text.length) {
      const startY = s.H - 40 - s.choices.length * 32;
      s.choices.forEach((choice, i) => {
        const cy = startY + i * 32;
        ctx.fillStyle = '#1a1a3e';
        roundRect(ctx, 60, cy, s.W - 120, 28, 6); ctx.fill();
        ctx.strokeStyle = c2; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(`[${i + 1}] ${choice.text}`, 76, cy + 18);
      });
    }

    // HUD
    ctx.fillStyle = '#a78bfa'; ctx.font = '11px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(`Score ${s.score} · Tags: ${s.tags.join(', ') || 'none'}`, s.W - 12, 22);

    if (s.won) this._drawEnd(ctx, s.W, s.H, 'Story Complete', '#a78bfa', `Path: ${s.ending} · Score ${s.score}`);
  },
  _wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split('');
    let line = '';
    let ly = y;
    for (const char of words) {
      const testLine = line + char;
      if (ctx.measureText(testLine).width > maxW) {
        ctx.fillText(line, x, ly);
        line = char; ly += lineH;
      } else {
        line = testLine;
      }
    }
    if (line) ctx.fillText(line, x, ly);
  },
  _drawEnd(ctx, W, H, title, color, sub) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, H / 2 - 10);
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif';
    ctx.fillText(sub, W / 2, H / 2 + 18);
  },
};
