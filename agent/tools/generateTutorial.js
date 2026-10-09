/**
 * generate_tutorial - Generate an in-game tutorial / onboarding sequence
 * for a game. Produces a series of guided steps that teach the player
 * core mechanics, controls, and objectives. The tutorial is stored on
 * game.tutorial and can be rendered as an overlay in the game preview.
 * AI-native: when LLM is available, generates genre-tailored step text
 * with contextual hints and difficulty-appropriate pacing.
 */

// Genre-specific tutorial step templates.
const TUTORIAL_TEMPLATES = {
  shooter: [
    { id: 1, action: 'move', text: '使用方向键或 WASD 移动战机', trigger: 'player.move > 50px' },
    { id: 2, action: 'shoot', text: '按空格键发射子弹', trigger: 'player.fire' },
    { id: 3, action: 'destroy', text: '击落一架敌机', trigger: 'enemy.destroyed >= 1' },
    { id: 4, action: 'collect', text: '拾取掉落的道具', trigger: 'powerup.collected >= 1' },
    { id: 5, action: 'survive', text: '存活 15 秒', trigger: 'time >= 15' },
  ],
  platformer: [
    { id: 1, action: 'move', text: '使用 A/D 或方向键左右移动', trigger: 'player.move > 30px' },
    { id: 2, action: 'jump', text: '按空格键跳跃', trigger: 'player.jump >= 1' },
    { id: 3, action: 'collect', text: '收集一枚金币', trigger: 'coins >= 1' },
    { id: 4, action: 'platform', text: '跳到上方平台', trigger: 'player.y < start_y - 50' },
    { id: 5, action: 'enemy', text: '跳到敌人头上击败它', trigger: 'enemy.stomp >= 1' },
  ],
  rpg: [
    { id: 1, action: 'move', text: '点击地面移动角色', trigger: 'player.move >= 1' },
    { id: 2, action: 'talk', text: '与村长对话', trigger: 'npc.talk >= 1' },
    { id: 3, action: 'battle', text: '进入战斗并击败一只怪物', trigger: 'battle.win >= 1' },
    { id: 4, action: 'levelup', text: '升到 2 级', trigger: 'player.level >= 2' },
    { id: 5, action: 'equip', text: '打开背包装备武器', trigger: 'equip >= 1' },
  ],
  puzzle: [
    { id: 1, action: 'click', text: '点击方块进行交互', trigger: 'block.click >= 1' },
    { id: 2, action: 'match', text: '匹配 3 个相同方块', trigger: 'match >= 1' },
    { id: 3, action: 'combo', text: '触发一次连锁消除', trigger: 'combo >= 2' },
    { id: 4, action: 'special', text: '使用特殊方块', trigger: 'special.used >= 1' },
    { id: 5, action: 'clear', text: '清空一个关卡', trigger: 'stage.clear >= 1' },
  ],
  tower: [
    { id: 1, action: 'build', text: '在路径旁建造一座箭塔', trigger: 'tower.build >= 1' },
    { id: 2, action: 'upgrade', text: '升级箭塔到 2 级', trigger: 'tower.upgrade >= 1' },
    { id: 3, action: 'wave', text: '抵御第一波敌人', trigger: 'wave.survive >= 1' },
    { id: 4, action: 'gold', text: '积攒 200 金币', trigger: 'gold >= 200' },
    { id: 5, action: 'strategy', text: '在关键路口建造魔法塔', trigger: 'tower.magic >= 1' },
  ],
  roguelike: [
    { id: 1, action: 'move', text: '使用方向键在地牢中移动', trigger: 'player.move >= 1' },
    { id: 2, action: 'fight', text: '与怪物战斗', trigger: 'battle >= 1' },
    { id: 3, action: 'loot', text: '拾掉落物', trigger: 'loot >= 1' },
    { id: 4, action: 'descend', text: '找到楼梯进入下一层', trigger: 'floor >= 2' },
    { id: 5, action: 'survive', text: '存活到第 3 层', trigger: 'floor >= 3' },
  ],
  racing: [
    { id: 1, action: 'accelerate', text: '按上键加速', trigger: 'speed > 0' },
    { id: 2, action: 'steer', text: '使用左右键转向', trigger: 'turn >= 1' },
    { id: 3, action: 'drift', text: '弯道按 Shift 漂移', trigger: 'drift >= 1' },
    { id: 4, action: 'lap', text: '完成一圈', trigger: 'lap >= 1' },
    { id: 5, action: 'boost', text: '使用加速道具', trigger: 'boost >= 1' },
  ],
  rhythm: [
    { id: 1, action: 'watch', text: '观察从屏幕上方落下的音符', trigger: 'time >= 3' },
    { id: 2, action: 'hit', text: '在判定线按对应键命中音符', trigger: 'note.hit >= 1' },
    { id: 3, action: 'combo', text: '连续命中 5 个音符', trigger: 'combo >= 5' },
    { id: 4, action: 'hold', text: '长按键处理长音符', trigger: 'note.hold >= 1' },
    { id: 5, action: 'perfect', text: '获得一次 Perfect 判定', trigger: 'perfect >= 1' },
  ],
};

function genericTutorial(genre) {
  return [
    { id: 1, action: 'move', text: `使用方向键移动`, trigger: 'player.move >= 1' },
    { id: 2, action: 'interact', text: '与场景交互', trigger: 'interact >= 1' },
    { id: 3, action: 'objective', text: '完成游戏目标', trigger: 'objective >= 1' },
  ];
}

export function generateTutorialTool({ gameService, provider }) {
  return {
    name: 'generate_tutorial',
    description: 'Generate an in-game tutorial / onboarding sequence with guided steps. Teaches players core mechanics, controls, and objectives. Stored on game.tutorial and rendered as an overlay in the preview.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        steps: { type: 'number', description: 'Number of tutorial steps (3-10, default: genre-specific)' },
        style: { type: 'string', description: 'guided | minimal | contextual (default: guided)' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, steps, style, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const genre = (game.genre || 'adventure').toLowerCase();
      let template = TUTORIAL_TEMPLATES[genre] || genericTutorial(genre);

      // Trim or pad steps.
      if (typeof steps === 'number') {
        const n = Math.max(3, Math.min(10, steps));
        template = template.slice(0, n);
      }

      // Apply style modifier.
      const tutorialStyle = style || 'guided';
      let stepList = template.map((s) => ({ ...s }));

      if (tutorialStyle === 'minimal') {
        // Shorter text, no triggers — just labels.
        stepList = stepList.map((s) => ({
          id: s.id,
          action: s.action,
          text: s.text.split('，')[0],
          trigger: null,
        }));
      } else if (tutorialStyle === 'contextual') {
        // Add contextual hints based on game config.
        const config = game.config || {};
        stepList = stepList.map((s) => {
          const hint = s.action === 'move' && config.player?.speed
            ? `（速度 ${config.player.speed}）`
            : s.action === 'shoot' && config.player?.atk
            ? `（攻击力 ${config.player.atk}）`
            : '';
          return { ...s, text: s.text + hint };
        });
      }

      // LLM enhancement: tailor step text.
      let llmEnhanced = false;
      if (provider?.enabled && provider.chat) {
        try {
          const stepTexts = stepList.map((s) => `${s.id}. ${s.text}`).join('\n');
          const prompt = `Rewrite these ${genre} game tutorial steps in Chinese to be more engaging and player-friendly. Keep the same numbering:\n${stepTexts}`;
          const resp = await provider.chat([{ role: 'user', content: prompt }], { maxTokens: 200 });
          if (resp?.content) {
            const lines = resp.content.split('\n').map((l) => l.trim()).filter(Boolean);
            for (let i = 0; i < stepList.length && i < lines.length; i++) {
              const m = lines[i].match(/^\d+[\.\)]\s*(.+)/);
              if (m) stepList[i].text = m[1];
            }
            llmEnhanced = true;
          }
        } catch (_) { /* fall back */ }
      }

      const tutorial = {
        genre,
        style: tutorialStyle,
        steps: stepList,
        createdAt: Date.now(),
      };

      await gameService.update(gameId, { tutorial });

      return {
        ok: true,
        tutorial,
        summary: `已生成 ${stepList.length} 步${tutorialStyle === 'minimal' ? '极简' : tutorialStyle === 'contextual' ? '情境' : '引导'}式教程${llmEnhanced ? '，AI 文案优化' : ''}`,
        editorActions: [{ type: 'studio:show-tutorial', gameId, payload: { tutorial } }],
      };
    },
  };
}
