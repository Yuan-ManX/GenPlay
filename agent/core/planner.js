/**
 * TaskPlanner - 意图识别与任务拆解
 * 通过规则匹配识别 GenPlay 专属意图并抽取参数。
 */
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
      const GENRES = ['射击', '冒险', 'rpg', '解谜', '赛车', '跑酷', '益智', '休闲', '动作', '恐怖', '模拟', '沙盒', 'puzzle', 'shooter', 'racing', 'platformer', 'adventure', 'horror', 'simulation'];
      // 类型：取消息中最后一个类型词
      let genre = '';
      let genreIdx = -1;
      for (const g of GENRES) {
        const idx = message.toLowerCase().lastIndexOf(g.toLowerCase());
        if (idx > genreIdx) { genreIdx = idx; genre = g; }
      }
      if (genreIdx >= 0) args.genre = genre.toLowerCase();

      // 游戏名：位于"叫/名为/游戏"之后，截止到类型词
      const nameMatch = message.match(/(?:叫|名为|游戏(?:名)?(?:为|叫))["'「]?([\w\u4e00-\u9fa5\s-]{1,30})/i);
      let name = nameMatch ? nameMatch[1].trim() : '';
      if (genreIdx >= 0) {
        // 去掉类型词及其后缀
        const cut = message.indexOf(name, 0);
        const end = genreIdx >= cut ? genreIdx : name.length;
        name = name.slice(0, Math.max(0, end - cut)).trim();
        // 去掉尾部的"的"
        name = name.replace(/[的、]$/, '').trim();
      }
      if (name) args.name = name;
    }
    if (intentName === 'edit_game' || intentName === 'debug_game' || intentName === 'run_game' ||
        intentName === 'publish_game' || intentName === 'describe_game') {
      const idMatch = message.match(/game[:\s#]*([a-zA-Z0-9_-]{6,})/i);
      if (idMatch) args.gameId = idMatch[1];
    }
    if (intentName === 'edit_game') {
      // 提取变更内容
      const change = message.replace(/.*?(修改|编辑|改|edit|update|change)/i, '').trim();
      if (change) args.change = change.slice(0, 120);
    }
    return args;
  }
}
