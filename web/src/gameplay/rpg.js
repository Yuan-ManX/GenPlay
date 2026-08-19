import { PALETTE, roundRect } from './engine.js';

/**
 * RPG 回合制战斗
 * 状态机：player_turn -> action_anim -> enemy_turn -> action_anim -> player_turn
 * 玩家操作：1 攻击  2 技能(火球术)  3 治愈  4 防御
 */
const KEYS = {
  '1': 'attack', '2': 'skill_fire', '3': 'skill_heal', '4': 'defend',
  Enter: 'confirm',
};

const SKILLS = {
  fireball: { name: '火球术', mpCost: 8, dmg: 24, type: 'magic' },
  heal: { name: '治愈', mpCost: 10, heal: 25, type: 'heal' },
};

export default {
  keys: KEYS,
  hint: '1 攻击 · 2 火球术 (8MP) · 3 治愈 (10MP) · 4 防御',
  init(canvas, config = {}) {
    const W = canvas.width, H = canvas.height;
    const p = config.player || {};
    const e = config.enemy || {};
    return {
      W, H,
      phase: 'intro', // intro | player_turn | anim | enemy_turn | victory | defeat
      introFrames: 60,
      animFrames: 0,
      player: {
        name: p.name || '勇者',
        hp: p.hp || 100, maxHp: p.hp || 100,
        mp: p.mp || 30, maxMp: p.mp || 30,
        atk: p.atk || 18, def: p.def || 6,
        defending: false,
        flash: 0, shake: 0,
      },
      enemy: {
        name: e.name || '魔物',
        hp: e.hp || 80, maxHp: e.hp || 80,
        atk: e.atk || 12, def: e.def || 3,
        flash: 0, shake: 0,
      },
      lastAction: '',
      log: ['战斗开始！'],
      turn: 1,
    };
  },
  update(s, input) {
    if (s.phase === 'intro') {
      s.introFrames--;
      if (s.introFrames <= 0) { s.phase = 'player_turn'; s.lastAction = '你的回合'; }
      return;
    }
    if (s.phase === 'player_turn') {
      let action = null;
      if (input.attack) action = { kind: 'attack' };
      else if (input.skill_fire && s.player.mp >= SKILLS.fireball.mpCost) action = { kind: 'skill', skill: 'fireball' };
      else if (input.skill_heal && s.player.mp >= SKILLS.heal.mpCost) action = { kind: 'skill', skill: 'heal' };
      else if (input.defend) action = { kind: 'defend' };
      if (action) this._applyPlayerAction(s, action);
      return;
    }
    if (s.phase === 'anim') {
      s.animFrames--;
      s.player.flash = Math.max(0, s.player.flash - 1);
      s.enemy.flash = Math.max(0, s.enemy.flash - 1);
      if (s.animFrames <= 0) {
        if (s.enemy.hp <= 0) { s.phase = 'victory'; s.lastAction = '胜利！'; return; }
        s.phase = 'enemy_turn';
        s.animFrames = 30;
        this._applyEnemyAction(s);
      }
      return;
    }
    if (s.phase === 'enemy_turn') {
      s.animFrames--;
      s.player.flash = Math.max(0, s.player.flash - 1);
      if (s.animFrames <= 0) {
        if (s.player.hp <= 0) { s.phase = 'defeat'; s.lastAction = '战败…'; return; }
        s.phase = 'player_turn';
        s.turn++;
        s.player.defending = false;
        s.lastAction = `第 ${s.turn} 回合`;
      }
    }
  },
  _applyPlayerAction(s, action) {
    const p = s.player, e = s.enemy;
    if (action.kind === 'attack') {
      const dmg = Math.max(1, p.atk - e.def);
      e.hp = Math.max(0, e.hp - dmg);
      e.flash = 12; e.shake = 8;
      s.log.unshift(`你对 ${e.name} 造成 ${dmg} 物理伤害`);
    } else if (action.kind === 'skill' && action.skill === 'fireball') {
      p.mp -= SKILLS.fireball.mpCost;
      const dmg = SKILLS.fireball.dmg;
      e.hp = Math.max(0, e.hp - dmg);
      e.flash = 16; e.shake = 12;
      s.log.unshift(`你施展「火球术」造成 ${dmg} 魔法伤害`);
    } else if (action.kind === 'skill' && action.skill === 'heal') {
      p.mp -= SKILLS.heal.mpCost;
      const heal = SKILLS.heal.heal;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      p.flash = 12;
      s.log.unshift(`你施展「治愈」恢复 ${heal} HP`);
    } else if (action.kind === 'defend') {
      p.defending = true;
      s.log.unshift('你进入防御姿态，本回合受伤减半');
    }
    s.log = s.log.slice(0, 4);
    s.phase = 'anim';
    s.animFrames = 24;
  },
  _applyEnemyAction(s) {
    const p = s.player, e = s.enemy;
    const dmg = Math.max(1, e.atk - (p.defending ? p.def * 2 : p.def));
    p.hp = Math.max(0, p.hp - dmg);
    p.flash = 12; p.shake = 8;
    s.log.unshift(`${e.name} 对你造成 ${dmg} 伤害${p.defending ? '（防御减伤）' : ''}`);
    s.log = s.log.slice(0, 4);
  },
  render(s, ctx) {
    const [c1, c2, c3] = PALETTE.rpg;
    const W = s.W, H = s.H;
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1c1917');
    bg.addColorStop(1, '#0c0a09');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 装饰：地面与远景
    ctx.fillStyle = 'rgba(180, 83, 9, 0.15)';
    ctx.fillRect(0, H - 100, W, 100);

    // 敌人（左上）
    const eShake = s.enemy.shake > 0 ? (Math.random() - 0.5) * s.enemy.shake : 0;
    s.enemy.shake = Math.max(0, s.enemy.shake - 1);
    const ex = 100 + eShake, ey = 120;
    ctx.fillStyle = s.enemy.flash > 0 ? '#fef3c7' : c2;
    ctx.beginPath();
    ctx.arc(ex, ey, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7c2d12';
    ctx.beginPath();
    ctx.arc(ex - 18, ey - 10, 6, 0, Math.PI * 2);
    ctx.arc(ex + 18, ey - 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.enemy.name, ex, ey - 60);

    // 玩家（右下）
    const pShake = s.player.shake > 0 ? (Math.random() - 0.5) * s.player.shake : 0;
    s.player.shake = Math.max(0, s.player.shake - 1);
    const px = W - 120 + pShake, py = H - 160;
    ctx.fillStyle = s.player.flash > 0 ? '#fef3c7' : c1;
    roundRect(ctx, px - 28, py - 40, 56, 56, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.player.name, px, py - 56);

    // HP / MP 条
    this._drawBar(ctx, 20, 20, 200, 12, s.player.hp / s.player.maxHp, '#dc2626', `${s.player.hp}/${s.player.maxHp}`);
    this._drawBar(ctx, 20, 38, 200, 8, s.player.mp / s.player.maxMp, '#2563eb', `${s.player.mp}/${s.player.maxMp}`);

    this._drawBar(ctx, W - 220, 20, 200, 12, s.enemy.hp / s.enemy.maxHp, '#dc2626', `${s.enemy.hp}/${s.enemy.maxHp}`);

    // 阶段提示与日志
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    const phaseText = s.phase === 'player_turn' ? '你的回合' :
      s.phase === 'enemy_turn' ? '敌方回合' :
      s.phase === 'victory' ? '战斗胜利' :
      s.phase === 'defeat' ? '战斗失败' : '战斗开始';
    ctx.fillText(phaseText, W / 2, 30);

    ctx.textAlign = 'left';
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    s.log.slice(0, 3).forEach((line, i) => {
      ctx.fillText(line, 20, H - 80 + i * 18);
    });

    if (s.phase === 'player_turn') {
      ctx.textAlign = 'center';
      ctx.fillStyle = c3;
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('1 攻击    2 火球术(8MP)    3 治愈(10MP)    4 防御', W / 2, H - 16);
    }

    if (s.phase === 'victory') this._drawOverlay(ctx, W, H, '胜利', '#16a34a', `用时 ${s.turn} 回合 · 按 重开`);
    if (s.phase === 'defeat') this._drawOverlay(ctx, W, H, '战败', '#dc2626', `坚持 ${s.turn} 回合 · 按 重开`);
  },
  _drawBar(ctx, x, y, w, h, ratio, color, label) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w * Math.max(0, ratio), h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `${h - 2}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w + 6, y + h / 2);
    ctx.textBaseline = 'alphabetic';
  },
  _drawOverlay(ctx, W, H, title, color, sub) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
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
