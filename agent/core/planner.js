/**
 * TaskPlanner - 意图识别与任务拆解
 * 通过规则匹配识别 GenPlay 专属意图并抽取参数。
 * 同时支持 LLM fallback pickTool 所做的二次工具选择。
 */

// Chinese aliases -> standard genre key.
// Longer aliases are intentionally placed first so GENRE_ALIASES key iteration
// (which favors longer matches) correctly resolves ambiguous phrases like
// "roguelike卡牌构筑" without mis-picking "rougelike" when deckbuilder was
// actually requested.
const GENRE_ALIASES = {
  射击: 'shooter', 射击游戏: 'shooter', shooter: 'shooter',
  冒险: 'adventure', 冒险游戏: 'adventure', adventure: 'adventure',
  角色扮演: 'rpg', 角色扮演游戏: 'rpg', 回合制: 'rpg', rpg: 'rpg',
  解谜: 'puzzle', 解谜游戏: 'puzzle', 拼图: 'puzzle', puzzle: 'puzzle',
  对战格斗: 'battle', 对战: 'battle', 格斗: 'battle', 战斗: 'battle', 格斗游戏: 'battle', battle: 'battle',
  赛车: 'racing', 赛车游戏: 'racing', racing: 'racing',
  模拟经营: 'simulation', 模拟: 'simulation', simulation: 'simulation',
  平台跳跃: 'platformer', 横版跳跃: 'platformer', 平台: 'platformer', 跳跃: 'platformer', 横版: 'platformer', platformer: 'platformer',
  塔防: 'tower', 防御塔: 'tower', towerdefense: 'tower', td: 'tower', tower: 'tower',
  贪吃蛇: 'snake', 蛇: 'snake', snake: 'snake',
  打砖块: 'breakout', 砖块: 'breakout', 弹球: 'breakout', breakout: 'breakout',
  迷宫探索: 'maze', 迷宫: 'maze', 寻路: 'maze', maze: 'maze',
  音乐节奏: 'rhythm', 节奏判定: 'rhythm', 节奏: 'rhythm', 节拍: 'rhythm', rhythm: 'rhythm',
  卡牌构筑: 'deckbuilder', 卡组构筑: 'deckbuilder', deckbuilder: 'deckbuilder', 卡牌: 'deckbuilder',
  银河恶魔城: 'metroidvania', 恶魔城: 'metroidvania', metroidvania: 'metroidvania', 类银河: 'metroidvania',
  放置挂机: 'idle', 放置: 'idle', 挂机: 'idle', idle: 'idle', 增量: 'idle',
  沙盒模拟: 'sandbox', 沙盒: 'sandbox', sandbox: 'sandbox', 自由建造: 'sandbox',
  视觉小说: 'visual_novel', 文字冒险: 'visual_novel', visual_novel: 'visual_novel', 互动小说: 'visual_novel',
  自动对战: 'auto_battler', 自走棋: 'auto_battler', auto_battler: 'auto_battler',
  roguelike: 'roguelike', 肉鸽: 'roguelike', 地牢roguelike: 'roguelike', 随机地牢: 'roguelike',
};

export class TaskPlanner {
  constructor() {
    this.intentRules = [
      // ---- CRUD & meta info first - user intent to CREATE is never ambiguous,
      // and ordering create_game BEFORE apply_style_theme avoids Sakura-themed
      // names from being misclassified as style requests (e.g. "创建视觉小说樱花之约").
      { name: 'create_game', pattern: /(创建|生成|做|create|build|make|新建|开发|设计一款).{0,20}(游戏|game)/i, args: ['name', 'genre'] },
      { name: 'delete_game', pattern: /(删除.*游戏|移除|destroy|delete|remove|drop|清空.*作品|不要了|删掉.*游戏)/i, args: ['gameId', 'confirm'] },
      { name: 'list_games', pattern: /(有哪些游戏|列出|查看列表|list|show|我的游戏|作品列表).{0,12}(游戏|game|作品|$)/i, args: [] },
      { name: 'save_game', pattern: /(保存|存档|持久化|写入|commit|flush|sync|保存游戏|同步保存)/i, args: ['gameId'] },
      { name: 'update_basic_info', pattern: /(重命名|改名字|改.*名称|改.*描述|切换.*类型|变更.*类型|把.*类型改为|更新.*(基础|信息|描述|名称|分类))/i, args: ['gameId', 'name', 'description', 'genre'] },

      // High specificity quality + community tools (BEFORE help to avoid
      // false-positive on keywords like "功能" inside install/asset requests)
      {
        name: 'install_snippet',
        pattern: /(安装|引入|导入|snippet|片段|配方|预设代码|加上.*(逻辑|功能|机制)|二段跳|双段跳|冲刺|突进|dash|收集|coin|金币|Boss|boss|首领|对话树|剧情分支|成就|无敌|连击|限时|倒计时)/i,
        args: ['gameId', 'snippetKey'],
      },
      {
        name: 'creative_ideate',
        pattern: /(创意|构思|灵感|混搭|想一个|brainstorm|mashup|idea|创新|提案).{0,40}(游戏|玩法|方向|风格|)/i,
        args: ['count', 'mashup'],
      },
      {
        name: 'explore_community',
        pattern: /(社区|探索|浏览|热门|新作|精选|community|explore|排行榜|作品|大家的)/i,
        args: ['genre', 'sort', 'search', 'limit'],
      },
      {
        name: 'edit_node_graph',
        pattern: /(节点|逻辑图|可视化|node|graph|连线|从.*DSL.*导入|导出.*DSL|导入.*逻辑|导出.*脚本)/i,
        args: ['gameId', 'action'],
      },
      {
        name: 'search_asset_library',
        pattern: /(资产库|素材库|共享库|搜索.*(素材|资产|主题|预设)|asset.*library|查找.*(主题|片段|脚本))/i,
        args: ['category', 'query'],
      },
      {
        name: 'rapid_iterate',
        pattern: /(快速迭代|一键优化|质量自检|自动打磨|polish|iterate|balance|refine|持续优化|再优化|整体优化)/i,
        args: ['gameId', 'focus'],
      },
      {
        name: 'configure_game_meta',
        pattern: /(多人|联机|协作|观战|商业|内购|广告|成就|无障碍|色盲|存档|排行榜|leaderboard|multiplayer|monetization|meta|云端|同步)/i,
        args: ['gameId', 'multiplayer', 'monetization', 'achievements', 'accessibility'],
      },
      {
        name: 'generate_npc',
        pattern: /(设计.*角色|生成.*NPC|设计.*NPC|新角色|配角|队友|伙伴|npc|character|persona).{0,30}/i,
        args: ['gameId', 'count'],
      },
      {
        name: 'generate_asset',
        pattern: /(生成.*资产|设计.*素材|精灵图|音效|配乐|UI界面|asset|sprite|sound|music|ui|美术资源|视觉资源)/i,
        args: ['gameId', 'assetType', 'name', 'description'],
      },
      {
        name: 'procedural_level',
        pattern: /(生成.*关卡|程序化|地图|布局|地形|地牢|房间|level|procedural|map|地牢生成|5个关卡|更多关卡)/i,
        args: ['gameId', 'count', 'seed'],
      },
      // Theme / Scenario / Tweak / Code tools (after CRUD to avoid create-game false positives)
      {
        name: 'apply_style_theme',
        pattern: /(主题|风格|theme|style|配色|赛博|像素|复古|街机|日落|深海|森林|绿林|霓虹夜幕)|\b(cyberpunk|sakura|ocean|arcade|sunset|forest|retro_pixel|neon_night)\b/i,
        args: ['gameId', 'theme'],
      },
      {
        name: 'apply_scenario',
        pattern: /(场景|剧情|story|scenario|关卡|叙事|故事|章节|古域|秘境|奇幻|太空|魔幻)/i,
        args: ['gameId', 'scenarioType'],
      },
      {
        name: 'debug_with_diffs',
        pattern: /(diff|差异|对比|前后|变更|深度调试|深度修复|自动修复|修复.*问题|打补丁|patcher)/i,
        args: ['gameId'],
      },
      {
        name: 'tweak_params',
        pattern: /(调参|参数|tweak|(?:难度|速度|血量|伤害|强度|预设)).{0,30}(?:游戏|$)/i,
        args: ['gameId', 'speed', 'hp', 'damage', 'difficulty'],
      },
      {
        name: 'view_code',
        pattern: /(查看代码|查看脚本|代码|脚本|code|script|source|源码|section|节点图)/i,
        args: ['gameId', 'section'],
      },

      // Remaining standard ops
      { name: 'edit_game', pattern: /(修改|编辑|改|edit|update|change|调整).{0,20}(游戏|game|玩法|规则|内容|机制)/i, args: ['gameId', 'change'] },
      { name: 'debug_game', pattern: /(排错|排障|排查|检查问题|找出问题|debug|troubleshoot|静态检查|问题检查)(?!.*(深度|自动修复|diff|修复|打补丁))/i, args: ['gameId'] },
      { name: 'run_game', pattern: /(运行|测试|跑|试玩|run|test|play|启动|预览试玩)/i, args: ['gameId'] },
      { name: 'publish_game', pattern: /(发布|上线|publish|deploy|分享|公开发布)/i, args: ['gameId'] },
      { name: 'describe_game', pattern: /(概览|介绍|详情|describe|details?|情况|游戏简介|复盘)/i, args: ['gameId'] },
      { name: 'generate_config', pattern: /(配置|参数表|生成配置|config|schema|参数概览|参数结构)/i, args: ['gameId'] },

      // Help LAST - catch-all, but only when user explicitly asks for help
      // (avoid the ambiguous "功能" keyword which appears in many tool contexts)
      { name: 'help', pattern: /^(帮助|help|你能做什么|怎么用|使用说明|指令表|能帮我做什么|你能做啥|\?\?|\/\?)$/i, args: [] },
    ];
  }

  detectIntent(message, history = []) {
    const msg = String(message || '');
    for (const rule of this.intentRules) {
      if (rule.pattern.test(msg)) {
        return { name: rule.name, args: this.extractArgs(rule.name, message, history) };
      }
    }
    return { name: 'chat', args: {} };
  }

  extractArgs(intentName, message, history = []) {
    const args = {};
    const historyGameId = this._extractRecentGameId(history);

    if (intentName === 'create_game') {
      // Match patterns: 名叫XXX / 叫XXX / 名为XXX / 名叫"XXX" / 游戏名为XXX
      const nameMatch = message.match(/(?:名?叫|名(?:为|是)|游戏(?:名)?(?:为|叫|是))\s*["'「]?\s*([\w\u4e00-\u9fa5][\w\u4e00-\u9fa5\s\-_·]{0,29})/);
      let name = nameMatch ? nameMatch[1].trim() : '';
      name = name.split(/[，。！？、,.!?;:：；\s]/).filter(Boolean)[0] || name;
      if (name) args.name = name;

      // Genre only from text before the name marker to avoid mis-pick inside title
      const cutPos = nameMatch ? nameMatch.index + (nameMatch[0]?.indexOf(nameMatch[1]) || 0) : message.length;
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
      args.description = message;
    }

    // Game ID extraction for all game-targeted intents.
    // Covers every tool that operates on an existing game so users can omit
    // explicit IDs when chatting while a game is already in-session.
    const targets = [
      'edit_game', 'debug_game', 'run_game', 'publish_game', 'describe_game',
      'generate_config', 'tweak_params', 'apply_scenario', 'apply_style_theme',
      'view_code', 'debug_with_diffs', 'install_snippet', 'edit_node_graph',
      'generate_npc', 'generate_asset', 'procedural_level', 'rapid_iterate',
      'configure_game_meta', 'save_game', 'delete_game', 'update_basic_info',
    ];
    if (targets.includes(intentName)) {
      const idMatch = message.match(/game[:\s#_-]*([a-zA-Z0-9_-]{6,})/i);
      const shortIdMatch = message.match(/[#]([a-zA-Z0-9_-]{4,})/);
      if (idMatch) args.gameId = idMatch[1];
      else if (shortIdMatch) args.gameId = shortIdMatch[1];
      else if (historyGameId) args.gameId = historyGameId;
    }

    if (intentName === 'edit_game') {
      const change = message.replace(/.*?(修改|编辑|改|edit|update|change|调整)/i, '').trim();
      if (change) args.change = change.slice(0, 160);
    }

    if (intentName === 'tweak_params') {
      Object.assign(args, extractTweakInline(message));
    }

    if (intentName === 'apply_style_theme') {
      const theme = detectThemeInline(message);
      if (theme) args.theme = theme;
    }

    if (intentName === 'apply_scenario') {
      const type = detectScenarioInline(message);
      if (type) args.scenarioType = type;
    }

    if (intentName === 'view_code') {
      if (/config|配置/i.test(message)) args.section = 'config';
      else if (/script|脚本/i.test(message)) args.section = 'scripts';
      else if (/theme|主题/i.test(message)) args.section = 'theme';
      else if (/scenario|剧情|场景/i.test(message)) args.section = 'scenario';
      else if (/meta|元设置|成就|多人/i.test(message)) args.section = 'meta';
      else if (/asset|资产|资源/i.test(message)) args.section = 'assets';
      else if (/npc|角色/i.test(message)) args.section = 'npcs';
    }

    if (intentName === 'creative_ideate') {
      const cm = message.match(/(\d+)\s*(个|款|种|条|组)/);
      if (cm) args.count = Math.max(1, Math.min(12, Number(cm[1])));
      const mashupMatch = message.match(/混搭(?!.*?不)[：:\s]*([\u4e00-\u9fa5A-Za-z0-9、,\s]{2,40})/);
      if (mashupMatch) args.mashup = mashupMatch[1].trim();
    }

    if (intentName === 'explore_community') {
      const tagMsg = message.toLowerCase();
      for (const alias of Object.keys(GENRE_ALIASES)) {
        if (tagMsg.includes(alias.toLowerCase())) {
          args.genre = GENRE_ALIASES[alias];
          break;
        }
      }
      if (/热门|最火|人气|popular|排名/i.test(message)) args.sort = 'popular';
      else args.sort = 'recent';
      const searchMatch = message.match(/(?:搜索|查找|关键词|关键字|query)[：:\s]*([\u4e00-\u9fa5A-Za-z0-9_\- ]{1,40})/);
      if (searchMatch) args.search = searchMatch[1].trim();
      const lm = message.match(/前(\d+)|limit\s*[:=]?\s*(\d+)|(\d+)条/);
      if (lm) args.limit = Number(lm[1] || lm[2] || lm[3]);
    }

    if (intentName === 'install_snippet') {
      const text = message.toLowerCase();
      // Explicit keyword mapping first (higher priority than regex scanning)
      if (/二段跳|双段跳|double[ _-]?jump/i.test(message)) args.snippetKey = 'double_jump';
      else if (/冲刺|突进|dash[ _-]?attack|dash_attack/i.test(message)) args.snippetKey = 'dash_attack';
      else if (/金币|收集品|coin|拾取|collectible/i.test(message)) args.snippetKey = 'collectible_coin';
      else if (/boss|首领|关卡boss|boss[ _-]?wave/i.test(message)) args.snippetKey = 'boss_wave';
      else if (/检查点|复活点|存档点|checkpoint/i.test(message)) args.snippetKey = 'checkpoint';
      else if (/对话树|分支对话|剧情分支|dialogue[ _-]?tree/i.test(message)) args.snippetKey = 'dialogue_tree';
      else if (/成就|achievement|解锁条件/i.test(message)) args.snippetKey = 'achievement_trigger';
      else if (/无敌闪烁|短暂无敌|invincible[ _-]?blink/i.test(message)) args.snippetKey = 'invincible_blink';
      else if (/连击|combo|score[ _-]?combo/i.test(message)) args.snippetKey = 'score_combo';
      else if (/限时|时间限制|倒计时|time[ _-]?limit/i.test(message)) args.snippetKey = 'time_limit';
      // Regex fallback for any remaining known keys
      if (!args.snippetKey) {
        const known = ['double_jump', 'dash_attack', 'collectible_coin', 'boss_wave',
                       'checkpoint', 'dialogue_tree', 'achievement_trigger', 'invincible_blink',
                       'score_combo', 'time_limit'];
        for (const key of known) {
          const alt = key.replace(/_/g, '[-_ ]?');
          if (new RegExp(alt).test(text)) { args.snippetKey = key; break; }
        }
      }
    }

    if (intentName === 'generate_npc') {
      const cm = message.match(/(\d+)\s*(个|位|名|组)/);
      if (cm) args.count = Math.max(1, Math.min(10, Number(cm[1])));
    }

    if (intentName === 'generate_asset') {
      if (/精灵|sprite|图|2d|立绘/i.test(message)) args.assetType = 'sprite';
      else if (/音效|sound|sfx|特效音/i.test(message)) args.assetType = 'sound';
      else if (/音乐|配乐|bgm|music|曲目|背景音/i.test(message)) args.assetType = 'music';
      else if (/界面|ui|HUD|面板/i.test(message)) args.assetType = 'ui';
    }

    if (intentName === 'procedural_level') {
      const cm = message.match(/(\d+)\s*(个|道|张|层|关)/);
      if (cm) args.count = Math.max(1, Math.min(50, Number(cm[1])));
      const sm = message.match(/seed[:=\s]*(\d+)|种子[:为\s]*(\d+)/);
      if (sm) args.seed = Number(sm[1] || sm[2]);
    }

    if (intentName === 'rapid_iterate') {
      if (/平衡|数值|balance|difficulty|难度/i.test(message)) args.focus = 'balance';
      else if (/主题|风格|theme|视觉|美术/i.test(message)) args.focus = 'theme';
      else if (/剧情|场景|scenario|叙事/i.test(message)) args.focus = 'scenario';
      else if (/关卡|level|地图/i.test(message)) args.focus = 'level';
      else if (/品质|质量|quality|全面|整体/i.test(message)) args.focus = 'quality';
    }

    if (intentName === 'configure_game_meta') {
      if (/多人|联机|pvp|协同|协作|组队/i.test(message)) args.multiplayer = { enabled: true };
      if (/广告|ad|激励视频|奖励广告/i.test(message)) {
        args.monetization = { ...(args.monetization || {}), ads: true };
      }
      if (/内购|iap|付费道具|皮肤/i.test(message)) {
        args.monetization = { ...(args.monetization || {}), iap: true };
      }
      if (/色盲|无障碍|可访问|accessibility/i.test(message)) {
        args.accessibility = { ...(args.accessibility || {}), colorBlind: true };
      }
    }

    if (intentName === 'update_basic_info') {
      const nm = message.match(/(?:重命名|改名为?|名称改为?|新名字|新名称)[：:\s]*["'「]?\s*([\w\u4e00-\u9fa5][\w\u4e00-\u9fa5\s\-_·]{0,29})/);
      if (nm) args.name = nm[1].trim();
      // Genre inline detection for this intent only
      for (const alias of Object.keys(GENRE_ALIASES)) {
        if (message.includes(alias) && GENRE_ALIASES[alias]) {
          args.genre = GENRE_ALIASES[alias];
          break;
        }
      }
      const dm = message.match(/(?:描述改为?|简介为?|简介改为?)[：:\s]*([\u4e00-\u9fa5A-Za-z0-9_\- ,，。.!?！？]{2,80})/);
      if (dm) args.description = dm[1].trim();
    }

    if (intentName === 'delete_game') {
      // Agent safety: only mark confirmed when user uses explicit strong delete phrase
      if (/(确认|确定|一定要|强制|真的要|不可撤销|立刻).*(删除|移除|destroy|drop|remove|delete)/i.test(message)) {
        args.confirm = true;
      }
    }

    if (intentName === 'search_asset_library') {
      if (/主题|theme/i.test(message)) args.category = 'theme';
      else if (/剧情|场景|scenario/i.test(message)) args.category = 'scenario';
      else if (/片段|脚本|代码|snippet/i.test(message)) args.category = 'snippet';
      else if (/节点|node|预设/i.test(message)) args.category = 'nodePreset';
      const qm = message.match(/(?:查找|搜索|query)[：:\s]*([\u4e00-\u9fa5A-Za-z0-9_\- ]{1,40})/);
      if (qm) args.query = qm[1].trim();
    }

    return args;
  }

  _extractRecentGameId(history) {
    if (!Array.isArray(history) || !history.length) return null;
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg?.meta?.currentGameId) return msg.meta.currentGameId;
      const content = String(msg?.content || '');
      const m = content.match(/ID[：:\s]*([a-zA-Z0-9_-]{6,})/i);
      if (m) return m[1];
    }
    return null;
  }
}

function extractTweakInline(message) {
  const args = {};
  const msg = String(message || '');
  const near = `.{0,4}?`; // at most 4 intermediary chars between keyword and number to avoid cross-keyword mis-match
  const speedMatch = msg.match(new RegExp(`(?:玩家)?(?:速度)${near}(\\d+(?:\\.\\d+)?)`));
  if (speedMatch && !/(伤害|damage|atk|攻击力|血量|hp|生命|敌人)/i.test(speedMatch[0].replace(speedMatch[1],''))) args.speed = Number(speedMatch[1]);
  const hpMatch = msg.match(new RegExp(`(?:玩家)?(?:血量|生命|hp)${near}(\\d+(?:\\.\\d+)?)`, 'i'));
  if (hpMatch && !/(速度|speed|伤害|damage|atk|攻击力|敌人)/i.test(hpMatch[0].replace(hpMatch[1],''))) args.hp = Number(hpMatch[1]);
  const diffMatch = msg.match(/难度.{0,6}?(简单|普通|困难|地狱|easy|normal|hard|hell)/i);
  if (diffMatch) args.difficulty = diffMatch[1];
  const dmgMatch = msg.match(new RegExp(`(?:伤害|攻击力|atk|damage)${near}(\\d+(?:\\.\\d+)?)`, 'i'));
  if (dmgMatch && !/(速度|speed|血量|hp|生命|敌人)/i.test(dmgMatch[0].replace(dmgMatch[1],''))) args.damage = Number(dmgMatch[1]);
  const enemyHpMatch = msg.match(/敌人(?:血量|生命|hp).{0,8}?(\d+(?:\.\d+)?|加倍|翻倍|乘[2-9]|[2-9]倍)/i);
  if (enemyHpMatch) {
    const v = enemyHpMatch[1];
    if (/加倍|翻倍|乘2|2倍/.test(v)) args.enemyHp = 2;
    else if (/乘([2-9])|([2-9])倍/.test(v)) {
      const m = v.match(/乘([2-9])|([2-9])倍/);
      args.enemyHp = Number(m[1] || m[2]);
    } else args.enemyHp = Number(v);
  }
  const enemySpdMatch = msg.match(/敌人(?:速度|移速|speed).{0,8}?(\d+(?:\.\d+)?|加倍|翻倍|乘[2-9]|[2-9]倍|加快|减慢)/i);
  if (enemySpdMatch) {
    const v = enemySpdMatch[1];
    if (/加倍|翻倍|乘2|2倍/.test(v)) args.enemySpeed = 2;
    else if (/乘([2-9])|([2-9])倍/.test(v)) {
      const m = v.match(/乘([2-9])|([2-9])倍/);
      args.enemySpeed = Number(m[1] || m[2]);
    } else if (/加快/.test(v)) args.enemySpeed = 1.3;
    else if (/减慢/.test(v)) args.enemySpeed = 0.7;
    else args.enemySpeed = Number(v);
  }
  return args;
}

function detectThemeInline(msg) {
  if (/赛博|cyberpunk|neon/i.test(msg)) return 'cyberpunk';
  if (/像素|复古|retro|pixel|8.?bit/i.test(msg)) return 'retro_pixel';
  if (/樱花|sakura|粉/i.test(msg)) return 'sakura';
  if (/街机|arcade/i.test(msg)) return 'arcade';
  if (/日落|sunset|橙红/i.test(msg)) return 'sunset';
  if (/深海|海洋|ocean|蓝/i.test(msg)) return 'ocean';
  if (/森林|forest|绿|自然|绿林/i.test(msg)) return 'forest';
  return '';
}

function detectScenarioInline(msg) {
  if (/太空|星|宇宙|方舟|space/i.test(msg)) return 'space';
  if (/魔幻|魔|剑|勇者|fantasy|奇幻/i.test(msg)) return 'fantasy';
  if (/赛博|黑客|霓虹|都市|未来|cyber/i.test(msg)) return 'cyber';
  return '';
}
