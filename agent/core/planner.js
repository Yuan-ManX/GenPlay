/**
 * TaskPlanner - 意图识别与任务拆解
 * 通过规则匹配识别 GenPlay 专属意图并抽取参数。
 */

// 中文别名 -> 标准 genre key
const GENRE_ALIASES = {
  射击: 'shooter', 射击游戏: 'shooter', shooter: 'shooter',
  冒险: 'adventure', 冒险游戏: 'adventure', adventure: 'adventure',
  角色扮演: 'rpg', 角色扮演游戏: 'rpg', 回合制: 'rpg', rpg: 'rpg',
  解谜: 'puzzle', 解谜游戏: 'puzzle', 拼图: 'puzzle', puzzle: 'puzzle',
  对战: 'battle', 对战格斗: 'battle', 格斗: 'battle', 战斗: 'battle', battle: 'battle', 格斗游戏: 'battle',
  赛车: 'racing', 赛车游戏: 'racing', racing: 'racing',
  模拟: 'simulation', 模拟经营: 'simulation', simulation: 'simulation',
  平台: 'platformer', 平台跳跃: 'platformer', 跳跃: 'platformer', 横版: 'platformer', platformer: 'platformer',
  塔防: 'tower', 防御塔: 'tower', tower: 'tower', towerdefense: 'tower', td: 'tower',
  贪吃蛇: 'snake', 蛇: 'snake', snake: 'snake',
  打砖块: 'breakout', 砖块: 'breakout', breakout: 'breakout', 弹球: 'breakout',
  迷宫: 'maze', 迷宫探索: 'maze', 寻路: 'maze', maze: 'maze',
  节奏: 'rhythm', 节拍: 'rhythm', 音乐节奏: 'rhythm', rhythm: 'rhythm',
};

export class TaskPlanner {
  constructor() {
    this.intentRules = [
      { name: 'create_game', pattern: /(创建|生成|做|create|build|make).{0,20}(游戏|game)/i, args: ['name', 'genre'] },
      { name: 'edit_game', pattern: /(修改|编辑|改|edit|update|change).{0,20}(游戏|game|玩法|规则)/i, args: ['gameId', 'change'] },
      { name: 'debug_game', pattern: /(排错|排障|排查|检查问题|找出问题|debug|troubleshoot|调试)/i, args: ['gameId'] },
      { name: 'run_game', pattern: /(运行|测试|跑|试玩|run|test|play)/i, args: ['gameId'] },
      { name: 'publish_game', pattern: /(发布|上线|publish|deploy)/i, args: ['gameId'] },
      { name: 'describe_game', pattern: /(概览|介绍|详情|describe|details?|情况)/i, args: ['gameId'] },
      { name: 'list_games', pattern: /(有哪些游戏|列出|查看|list|show).{0,10}(游戏|game)/i, args: [] },
      { name: 'help', pattern: /(帮助|help|你能做什么)/i, args: [] },
    ];
  }

  detectIntent(message, history = []) {
    for (const rule of this.intentRules) {
      if (rule.pattern.test(message)) {
        return { name: rule.name, args: this.extractArgs(rule.name, message) };
      }
    }
    return { name: 'chat', args: {} };
  }

  extractArgs(intentName, message) {
    const args = {};
    if (intentName === 'create_game') {
      // 游戏名：位于"叫/名为"之后，截断到首个标点
      const nameMatch = message.match(/(?:叫|名为|游戏(?:名)?(?:为|叫))["'「]?([\w\u4e00-\u9fa5\s-]{1,30})/);
      let name = nameMatch ? nameMatch[1].trim() : '';
      name = name.split(/[，。！？、,.\s]/)[0];
      if (name) args.name = name;

      // 类型：只在"叫/名为"之前的消息片段中扫描，避免误识别名字里的类型词
      // 同时优先匹配更长的别名（更具体）
      const cutPos = nameMatch ? nameMatch.index : message.length;
      const genreScanArea = message.slice(0, cutPos).toLowerCase();
      let genre = '';
      let bestLen = -1;
      for (const alias of Object.keys(GENRE_ALIASES)) {
        const a = alias.toLowerCase();
        if (genreScanArea.includes(a) && a.length > bestLen) {
          bestLen = a.length;
          genre = alias;
        }
      }
      if (genre) args.genre = GENRE_ALIASES[genre];

      // 把原始描述传给 createGame，供 LLM/本地规则生成专属参数
      args.description = message;
    }
    if (intentName === 'edit_game' || intentName === 'debug_game' || intentName === 'run_game' ||
        intentName === 'publish_game' || intentName === 'describe_game') {
      const idMatch = message.match(/game[:\s#]*([a-zA-Z0-9_-]{6,})/i);
      if (idMatch) args.gameId = idMatch[1];
    }
    if (intentName === 'edit_game') {
      const change = message.replace(/.*?(修改|编辑|改|edit|update|change)/i, '').trim();
      if (change) args.change = change.slice(0, 120);
    }
    return args;
  }
}
