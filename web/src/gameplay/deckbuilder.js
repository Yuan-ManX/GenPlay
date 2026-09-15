import { PALETTE, roundRect, clamp } from './engine.js';

/**
 * Deckbuilder engine - Card-based combat where the player draws cards
 * from a personal deck, plays them for effects, and battles enemies.
 * Press 1-5 to play cards from hand, Enter to end turn.
 */
const KEYS = {
  '1': 'card0', '2': 'card1', '3': 'card2', '4': 'card3', '5': 'card4',
  Enter: 'end_turn',
};

const CARD_POOL = [
  { name: 'Strike', cost: 1, type: 'attack', value: 6, desc: 'Deal 6 dmg' },
  { name: 'Heavy Blow', cost: 2, type: 'attack', value: 12, desc: 'Deal 12 dmg' },
  { name: 'Block', cost: 1, type: 'defend', value: 5, desc: 'Gain 5 block' },
  { name: 'Fireball', cost: 2, type: 'attack', value: 10, desc: 'Deal 10 dmg' },
  { name: 'Heal', cost: 2, type: 'heal', value: 8, desc: 'Restore 8 HP' },
  { name: 'Dash', cost: 0, type: 'attack', value: 3, desc: 'Deal 3 dmg' },
  { name: 'Shield Wall', cost: 3, type: 'defend', value: 12, desc: 'Gain 12 block' },
  { name: 'Life Drain', cost: 2, type: 'attack', value: 7, desc: 'Deal 7 + heal 3' },
];

export default {
  keys: KEYS,
  hint: '按 1-5 出牌 · Enter 结束回合 · 管理能量击败敌人',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    const deck = shuffle([...CARD_POOL, ...CARD_POOL].map(c => ({ ...c, id: Math.random() })));
    return {
      W, H,
      player: { hp: config.player?.hp || 50, maxHp: 50, energy: 3, maxEnergy: 3, block: 0, gold: 0 },
      enemy: { hp: 30, maxHp: 30, atk: 8, name: 'Goblin', intent: 'attack', intentValue: 8 },
      deck, draw: [], hand: [], discard: [],
      turn: 1,
      frame: 0,
      score: 0,
      over: false,
      won: false,
      battle: 1,
      messages: [],
    };
  },
  update(s, input) {
    if (s.over || s.won) return;
    s.frame++;

    // Draw hand at start of turn
    if (s.hand.length === 0 && s.draw.length === 0 && s.turn === 1) {
      this._drawHand(s);
    }

    // Play card
    for (let i = 0; i < 5; i++) {
      if (input['card' + i] && s.hand[i] && s.player.energy >= s.hand[i].cost) {
        this._playCard(s, i);
      }
    }

    if (input.end_turn) {
      this._endTurn(s);
    }
  },
  _drawHand(s) {
    s.draw = s.deck.slice();
    shuffle(s.draw);
    s.discard = [];
    s.hand = [];
    for (let i = 0; i < 5; i++) {
      if (s.draw.length === 0) {
        s.draw = shuffle(s.discard.slice());
        s.discard = [];
      }
      s.hand.push(s.draw.pop());
    }
    s.player.energy = s.player.maxEnergy;
    s.player.block = 0;
  },
  _playCard(s, idx) {
    const card = s.hand[idx];
    s.player.energy -= card.cost;
    if (card.type === 'attack') {
      const dmg = Math.max(0, card.value);
      s.enemy.hp -= dmg;
      s.messages.unshift(`Played ${card.name} → ${dmg} damage`);
      if (card.name === 'Life Drain') { s.player.hp = Math.min(s.player.maxHp, s.player.hp + 3); }
    } else if (card.type === 'defend') {
      s.player.block += card.value;
      s.messages.unshift(`Played ${card.name} → +${card.value} block`);
    } else if (card.type === 'heal') {
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + card.value);
      s.messages.unshift(`Played ${card.name} → +${card.value} HP`);
    }
    s.discard.push(card);
    s.hand.splice(idx, 1);
    if (s.enemy.hp <= 0) {
      s.score += 100;
      s.battle++;
      if (s.battle > 5) { s.won = true; }
      else {
        s.enemy = { hp: 30 + s.battle * 15, maxHp: 30 + s.battle * 15, atk: 6 + s.battle * 2, name: `Boss ${s.battle}`, intent: 'attack', intentValue: 6 + s.battle * 2 };
        s.messages.unshift(`New foe: ${s.enemy.name}!`);
      }
    }
  },
  _endTurn(s) {
    // Enemy attacks
    if (s.enemy.intent === 'attack' && s.enemy.hp > 0) {
      let dmg = s.enemy.intentValue;
      if (s.player.block > 0) {
        const absorbed = Math.min(s.player.block, dmg);
        s.player.block -= absorbed;
        dmg -= absorbed;
      }
      if (dmg > 0) s.player.hp -= dmg;
      s.messages.unshift(`${s.enemy.name} attacks for ${s.enemy.intentValue}!`);
      if (s.player.hp <= 0) { s.over = true; s.player.hp = 0; }
    }
    // Draw new hand
    if (!s.over && !s.won) {
      s.turn++;
      s.discard.push(...s.hand);
      s.hand = [];
      if (s.draw.length < 5) {
        s.draw = shuffle([...s.draw, ...s.discard]);
        s.discard = [];
      }
      for (let i = 0; i < 5; i++) {
        if (s.draw.length > 0) s.hand.push(s.draw.pop());
      }
      s.player.energy = s.player.maxEnergy;
      s.player.block = 0;
    }
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.puzzle;
    ctx.fillStyle = '#1e0a2e'; ctx.fillRect(0, 0, s.W, s.H);

    // Enemy
    const ex = s.W / 2, ey = 120;
    ctx.fillStyle = '#dc2626';
    ctx.beginPath(); ctx.arc(ex, ey, 35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(ex - 40, ey - 55, 80, 6);
    ctx.fillStyle = '#16a34a'; ctx.fillRect(ex - 40, ey - 55, 80 * (s.enemy.hp / s.enemy.maxHp), 6);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(s.enemy.name, ex, ey - 65);
    ctx.fillStyle = '#fbbf24'; ctx.font = '12px sans-serif';
    ctx.fillText(`Intent: ${s.enemy.intent} ${s.enemy.intentValue}`, ex, ey + 55);

    // Player stats
    ctx.fillStyle = c2; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`HP ${s.player.hp}/${s.player.maxHp} · Block ${s.player.block} · Energy ${s.player.energy}/${s.player.maxEnergy}`, 12, 22);
    ctx.textAlign = 'right';
    ctx.fillText(`Battle ${s.battle}/5 · Score ${s.score}`, s.W - 12, 22);

    // Hand
    const cardW = 80, cardH = 110, gap = 8;
    const totalW = 5 * cardW + 4 * gap;
    const startX = (s.W - totalW) / 2;
    const cardY = s.H - cardH - 20;
    s.hand.forEach((card, i) => {
      const cx = startX + i * (cardW + gap);
      const canPlay = s.player.energy >= card.cost;
      ctx.fillStyle = canPlay ? '#2d1b4e' : '#1a1a2e';
      roundRect(ctx, cx, cardY, cardW, cardH, 8); ctx.fill();
      ctx.strokeStyle = canPlay ? c2 : '#444'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = canPlay ? '#fff' : '#888';
      ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(card.name, cx + cardW / 2, cardY + 20);
      ctx.fillStyle = canPlay ? c2 : '#666';
      ctx.font = '20px sans-serif';
      ctx.fillText(`${card.cost}`, cx + 12, cardY + 18);
      ctx.fillStyle = canPlay ? '#ccc' : '#555';
      ctx.font = '10px sans-serif';
      ctx.fillText(card.desc, cx + cardW / 2, cardY + 50);
      ctx.fillStyle = canPlay ? '#aaa' : '#444';
      ctx.font = '10px sans-serif';
      ctx.fillText(`[${i + 1}]`, cx + cardW / 2, cardY + cardH - 8);
    });

    // Messages
    ctx.fillStyle = '#a78bfa'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
    s.messages.slice(0, 3).forEach((m, i) => ctx.fillText(m, 12, 45 + i * 16));

    if (s.won) this._drawEnd(ctx, s.W, s.H, 'Victory!', '#16a34a', `Cleared 5 battles · Score ${s.score}`);
    if (s.over) this._drawEnd(ctx, s.W, s.H, 'Defeated', '#dc2626', `Battle ${s.battle} · Score ${s.score}`);
  },
  _drawEnd(ctx, W, H, title, color, sub) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = color; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, H / 2 - 10);
    ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif';
    ctx.fillText(sub, W / 2, H / 2 + 22);
  },
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
