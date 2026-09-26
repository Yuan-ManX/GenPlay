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
      // Version snapshot timeline & rollback (before list_games so "列出历史版本"
      // is not misrouted to the generic list command).
      { name: 'version_history', pattern: /(版本|快照|snapshot|历史版本|回滚|restore|时光机|timeline|版本对比|版本历史|对比|diff|差异)/i, args: ['gameId', 'action', 'snapshotId', 'label'] },
      { name: 'list_games', pattern: /(有哪些游戏|列出|查看列表|list|show|我的游戏|作品列表).{0,12}(游戏|game|作品|$)/i, args: [] },
      { name: 'save_game', pattern: /(保存|存档|持久化|写入|commit|flush|sync|保存游戏|同步保存)/i, args: ['gameId'] },
      { name: 'update_basic_info', pattern: /(重命名|改名字|改.*名称|切换.*类型|变更.*类型|把.*类型改为|更新.*(基础|信息|描述|名称|分类))/i, args: ['gameId', 'name', 'description', 'genre'] },
      // Remix / fork a community game into a fresh editable draft
      { name: 'remix_game', pattern: /(复刻|remix|fork.*game|二创|改编|基于.*做.*|参照.*创作|clone.*game)/i, args: ['shareCode', 'sourceGameId', 'name', 'tweak'] },
      // Multi-agent specialist crew: coordinated creative brainstorm
      { name: 'dispatch_crew', pattern: /(创作团|专家团|多智能体|协同构思|团队.*设计|crew|specialist|brainstorm.*team|一起.*构思|企划)/i, args: ['brief', 'genre', 'autoApply'] },
      // Portable bundle export / import for backup, sharing, migration
      { name: 'export_game', pattern: /(导出|export|备份|打包|下载.*游戏|归档|迁移出去)/i, args: ['gameId'] },
      { name: 'import_game', pattern: /(导入|import|恢复.*游戏|上传.*游戏包|加载.*bundle|从.*包.*创建)/i, args: ['bundle', 'newName'] },
      // Preview snapshot capture for gallery / cover art
      { name: 'screenshot_game', pattern: /(截图|截个图|截.图|预览图|封面|缩略图|screenshot|snapshot|poster|cover|海报)/i, args: ['gameId', 'label'] },
      // Performance profiling (before game_analytics so "性能分析" matches here)
      { name: 'profile_game', pattern: /(性能|performance|profile|帧率|fps|瓶颈|优化建议|性能分析|性能测试|内存|draw.?call)/i, args: ['gameId', 'duration'] },
      // AI-native player behavior simulation & telemetry
      { name: 'game_analytics', pattern: /(分析|analytics|留存|retention|流失|玩家行为|funnel|漏斗|会话时长|难度曲线|drop.?off|玩家数据)/i, args: ['gameId', 'seed', 'useLlm'] },
      // Agent introspection: explain last decision & reasoning
      { name: 'agent_explain', pattern: /(为什么|why did you|解释|explain|推理过程|reasoning|你是怎么|如何决策|你为什么|刚才.*决策|你.*怎么.*想|能力|工具列表|capabilities|有哪些工具|你能做什么)/i, args: ['sessionId', 'scope'] },
      // Headless gameplay simulation with issue reporting
      { name: 'play_test', pattern: /(模拟运行|模拟测试|模拟|跑.*测试|play.?test|试运行|试跑|自动测试|压测)/i, args: ['gameId', 'duration', 'seed'] },
      // Proactive improvement suggestions with one-click follow-ups
      { name: 'ai_suggest', pattern: /(改进建议|优化建议|给.*建议|suggestions?|有什么.*改进|怎么.*优化|提升.*建议|给我.*点子.*改进)/i, args: ['gameId', 'category'] },
      // Granular config field read/write by dotted path (before tweak_params so
      // "把 player.speed 改成 7" routes here instead of the bulk tweak tool)
      { name: 'edit_config_field', pattern: /(把.{0,12}(?:改成|改为|调成|设为)|设置.{0,8}为|config\.|修改.*(?:字段|值|属性)|读取.*(?:配置|字段))/i, args: ['gameId', 'path', 'value'] },
      // Natural-language game script section generation
      { name: 'edit_script', pattern: /(生成.*脚本|写.*脚本|添加.*脚本|脚本.*(?:让|使|实现)|update.*函数|render.*函数|init.*函数|生成.*代码|写.*逻辑|script)/i, args: ['gameId', 'section', 'description'] },
      // Individual NPC add/update/remove
      { name: 'manage_npc', pattern: /(加(?:一个|个).*(?:npc|角色|人物)|添加.*npc|新增.*npc|修改.*(?:npc|角色).*(?:对话|属性|名字)|删除.*(?:npc|角色)|移除.*(?:npc|角色))/i, args: ['gameId', 'action', 'npcId', 'name', 'role', 'dialog'] },
      // Individual asset add/update/remove
      { name: 'manage_asset', pattern: /(加(?:一个|个).*(?:资产|素材|精灵|ui)|添加.*(?:资产|素材)|新增.*(?:资产|素材)|修改.*(?:资产|素材).*(?:描述|名字)|删除.*(?:资产|素材)|移除.*(?:资产|素材))/i, args: ['gameId', 'action', 'assetId', 'name', 'assetType', 'description'] },
      // Achievement CRUD
      { name: 'manage_achievements', pattern: /(成就|achievement|解锁条件|奖杯|勋章|加.*成就|添加.*成就|修改.*成就|删除.*成就|移除.*成就|成就列表)/i, args: ['gameId', 'action', 'achievementId', 'name', 'desc', 'condition', 'icon', 'unlocked'] },
      // Multi-scene / level management
      { name: 'manage_scenes', pattern: /(场景|关卡|scene|level|多场景|多关卡|加.*场景|添加.*场景|修改.*场景|删除.*场景|移除.*场景|重排.*场景|场景列表)/i, args: ['gameId', 'action', 'sceneId', 'name', 'sceneType', 'background', 'order'] },
      // Leaderboard board management (action verbs required to avoid
      // colliding with explore_community's generic "排行榜" keyword).
      { name: 'manage_leaderboard', pattern: /(加(?:一个|个).*(?:排行榜|榜单|leaderboard)|添加.*(?:排行榜|榜单)|新增.*(?:排行榜|榜单)|修改.*(?:排行榜|榜单)|删除.*(?:排行榜|榜单)|移除.*(?:排行榜|榜单)|排行榜列表|榜单列表)/i, args: ['gameId', 'action', 'boardId', 'label', 'scoring', 'order'] },
      // AI-native game localization
      { name: 'translate_game', pattern: /(翻译|translate|本地化|localization|多语言|语言切换|英文|日语|韩语|法语|德语|西班牙语|葡萄牙语|俄语|阿拉伯语|i18n)/i, args: ['gameId', 'targetLang', 'sourceLang', 'scope'] },
      // Auto-balance using playtest feedback
      { name: 'balance_game', pattern: /(平衡|balance|调平衡|自动平衡|难度平衡|数值平衡|平衡测试|平衡调整)/i, args: ['gameId', 'duration', 'seed', 'targetDifficulty'] },
      // Audio / music / sfx management
      { name: 'manage_audio', pattern: /(音乐|music|音效|sfx|sound|audio|bgm|背景音乐|加.*音乐|添加.*音乐|加.*音效|添加.*音效|播放.*音乐|播放.*音效)/i, args: ['gameId', 'kind', 'action', 'entryId', 'name', 'mood', 'trigger', 'volume', 'loop', 'order'] },
      // Story / narrative generation
      { name: 'generate_story', pattern: /(剧情|故事|story|narrative|叙事|生成.*剧情|生成.*故事|写.*剧情|写.*故事|编.*剧情|编.*故事|剧情大纲)/i, args: ['gameId', 'genre', 'title', 'tone', 'chapters'] },
      // Script linting / validation
      { name: 'lint_scripts', pattern: /(检查脚本|lint|脚本检查|代码检查|脚本错误|语法检查|脚本验证|检查.*代码|检查.*脚本)/i, args: ['gameId', 'scope'] },
      // Runtime preview control
      { name: 'control_runtime', pattern: /(重启游戏|重新开始|restart|暂停|pause|继续|resume|调速|speed|无敌|god.?mode|上帝模式|生成敌人|spawn.*enemy|触发胜利|触发失败|win|lose)/i, args: ['gameId', 'command', 'speed', 'entity', 'count', 'enabled'] },

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
      // Split on punctuation/whitespace first
      name = name.split(/[，。！？、,.!?;:：；\s]/).filter(Boolean)[0] || name;
      // Then split on compound-intent boundary markers so a name like
      // "星海遗迹的银河恶魔城游戏并应用赛博朋克主题" truncates to "星海遗迹"
      // when the user is chaining create + theme/scenario/snippet in one message.
      const boundaryRe = /(并(?:且|应用|添加|加)?|然后|接着|和|与|及|以及|同时|并且|应用|添加|加上|附带|配合|再来|加上|之后|之后加|再应用|再添加|再生成|再来个|再给|再设)/;
      const boundaryHit = name.match(boundaryRe);
      if (boundaryHit) name = name.slice(0, boundaryHit.index).trim();
      // Strip trailing "游戏"/"game" descriptor users commonly append to a title.
      name = name.replace(/(?:游戏|game)$/i, '').trim();
      // Strip trailing "的+GENRE" descriptor (e.g. "星海遗迹的银河恶魔城" -> "星海遗迹").
      // Require the "的" marker so proper names like "跳跃冒险" keep their suffix
      // instead of clobbering "冒险" which is part of the intended title.
      name = name.replace(/的(?:射击|冒险|角色扮演|解谜|对战|格斗|赛车|模拟|平台跳跃?|塔防|贪吃蛇|打砖块|迷宫|节奏|肉鸽|卡牌构筑?|银河恶魔城|放置挂机?|沙盒|视觉小说|自走棋|游戏|game)$/i, '').trim();
      // Drop a dangling trailing "的" if any remains after the strips above.
      name = name.replace(/的$/, '').trim();
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
      'remix_game', 'export_game', 'screenshot_game',
      'game_analytics', 'version_history',
      'edit_config_field', 'edit_script', 'manage_npc', 'manage_asset',
      'play_test', 'ai_suggest',
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
      else if (/下层|楼梯.*下一层|地牢.*下层|floor[ _-]?descent/i.test(message)) args.snippetKey = 'roguelike_floor_descent';
      else if (/抽牌|抽卡.*回合|card[ _-]?draw/i.test(message)) args.snippetKey = 'deckbuilder_card_draw';
      else if (/能力门|能力锁定|ability[ _-]?gate/i.test(message)) args.snippetKey = 'metroidvania_ability_gate';
      else if (/转生|放置.*转生|prestige[ _-]?loop/i.test(message)) args.snippetKey = 'idle_prestige_loop';
      else if (/合成.*配方|craft.*recipe/i.test(message)) args.snippetKey = 'sandbox_craft_recipe';
      else if (/分支.*剧情|视觉小说.*分支|visual[ _-]?novel.*branch/i.test(message)) args.snippetKey = 'visual_novel_branch';
      else if (/商店刷新|shop[ _-]?refresh/i.test(message)) args.snippetKey = 'auto_battler_shop_refresh';
      // Regex fallback for any remaining known keys
      if (!args.snippetKey) {
        const known = ['double_jump', 'dash_attack', 'collectible_coin', 'boss_wave',
                       'checkpoint', 'dialogue_tree', 'achievement_trigger', 'invincible_blink',
                       'score_combo', 'time_limit', 'roguelike_floor_descent', 'deckbuilder_card_draw',
                       'metroidvania_ability_gate', 'idle_prestige_loop', 'sandbox_craft_recipe',
                       'visual_novel_branch', 'auto_battler_shop_refresh'];
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

    if (intentName === 'remix_game') {
      // Share code: gp_xxxx / mt9j... / #code
      const sc = message.match(/(gp_[a-z0-9]{4,}|#[a-z0-9]{4,}|\bshare[:\s]*([a-z0-9_-]{4,}))/i);
      if (sc) args.shareCode = (sc[2] || sc[1]).replace(/^#/, '');
      // Source game id reference (game#xxx) falls back via generic id extractor below.
      // Inline difficulty tweak for the remix copy
      if (/地狱|hell|极难/i.test(message)) args.tweak = 'hell';
      else if (/困难|hard/i.test(message)) args.tweak = 'hard';
      else if (/简单|easy/i.test(message)) args.tweak = 'easy';
      else if (/普通|normal/i.test(message)) args.tweak = 'normal';
      // Optional explicit new name after 叫/名为
      const nm = message.match(/(?:叫|名为|新名字|改名)\s*["'「]?\s*([\u4e00-\u9fa5A-Za-z0-9 _\-·]{1,40})/);
      if (nm) args.name = nm[1].trim();
    }

    if (intentName === 'dispatch_crew') {
      // The whole user message (minus the trigger verb) acts as the brief.
      args.brief = message.replace(/创作团|专家团|多智能体|协同构思|团队.*设计|crew|specialist|brainstorm.*team|一起.*构思|企划|帮我|给我/g, '').trim() || message;
      if (/落地|自动|创建|应用|auto/i.test(message)) args.autoApply = true;
    }

    if (intentName === 'search_asset_library') {
      if (/主题|theme/i.test(message)) args.category = 'theme';
      else if (/剧情|场景|scenario/i.test(message)) args.category = 'scenario';
      else if (/片段|脚本|代码|snippet/i.test(message)) args.category = 'snippet';
      else if (/节点|node|预设/i.test(message)) args.category = 'nodePreset';
      const qm = message.match(/(?:查找|搜索|query)[：:\s]*([\u4e00-\u9fa5A-Za-z0-9_\- ]{1,40})/);
      if (qm) args.query = qm[1].trim();
    }

    if (intentName === 'game_analytics') {
      const sm = message.match(/seed[:=\s]*(\d+)|种子[:为\s]*(\d+)/i);
      if (sm) args.seed = Number(sm[1] || sm[2]);
      // Allow user to opt out of LLM suggestions explicitly.
      if (/不使用.*llm|纯规则|no llm|rule only/i.test(message)) args.useLlm = false;
    }

    if (intentName === 'version_history') {
      // Default to snapshot action when none specified.
      if (/列出|list|查看.*版本|历史|timeline/i.test(message)) args.action = 'list';
      else if (/回滚|恢复|restore|还原/i.test(message)) args.action = 'restore';
      else if (/对比|diff|差异/i.test(message)) args.action = 'diff';
      else args.action = 'snapshot';
      // Extract snapshot id when present (v_xxx).
      const sm = message.match(/(v_[a-z0-9_]{4,})/i);
      if (sm) args.snapshotId = sm[1];
      // Extract label after "标签" / "叫" / quoted string for snapshot naming.
      const lm = message.match(/(?:标签|叫|名为|label)[:：\s]*["'「]?\s*([\u4e00-\u9fa5A-Za-z0-9 _\-·]{1,40})/);
      if (lm) args.label = lm[1].trim();
    }

    if (intentName === 'agent_explain') {
      if (/能力|工具列表|capabilities|你能做什么|有哪些工具/i.test(message)) args.scope = 'capabilities';
      else args.scope = 'last';
    }

    if (intentName === 'edit_config_field') {
      // Explicit dotted path like config.player.speed
      const dottedMatch = message.match(/(?:config\.)?([a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)+)/i);
      if (dottedMatch) args.path = dottedMatch[1];
      else {
        // Inline Chinese field mapping
        if (/玩家.*速度|速度/.test(message)) args.path = 'player.speed';
        else if (/玩家.*(?:血量|生命|hp)/i.test(message)) args.path = 'player.hp';
        else if (/玩家.*(?:伤害|攻击|atk)/i.test(message)) args.path = 'player.atk';
        else if (/敌人.*速度/.test(message)) args.path = 'enemy.speed';
        else if (/敌人.*(?:血量|生命|hp)/i.test(message)) args.path = 'enemy.hp';
        else if (/敌人.*(?:数量|个数|count)/i.test(message)) args.path = 'enemy.count';
        else if (/重力|gravity/.test(message)) args.path = 'world.gravity';
      }
      // Extract numeric value after 改成/改为/调成/设为/为
      const valMatch = message.match(/(?:改成|改为|调成|设为|设置.*为|为)\s*["']?(-?\d+(?:\.\d+)?)/);
      if (valMatch) args.value = Number(valMatch[1]);
    }

    if (intentName === 'edit_script') {
      if (/update/i.test(message)) args.section = 'update';
      else if (/render/i.test(message)) args.section = 'render';
      else if (/init/i.test(message)) args.section = 'init';
      else if (/input|按键|输入/i.test(message)) args.section = 'onInput';
      else if (/collision|碰撞/i.test(message)) args.section = 'onCollision';
      else args.section = 'update';
      // The whole message (minus trigger words) becomes the description.
      args.description = message.replace(/(生成|写|添加).*?(脚本|代码|逻辑|函数)|script|让|使|实现/gi, '').trim() || message;
    }

    if (intentName === 'manage_npc') {
      if (/删除|移除/i.test(message)) args.action = 'remove';
      else if (/修改|改/i.test(message)) args.action = 'update';
      else args.action = 'add';
      const nm = message.match(/(?:叫|名为|名字)[：:\s]*["'「]?\s*([\u4e00-\u9fa5A-Za-z0-9 _\-·]{1,20})/);
      if (nm) {
        let name = nm[1].trim();
        // Strip the appended " game#id" scoping marker first, then strip
        // trailing classifier like "的NPC" / "的角色" / "的人物".
        name = name.replace(/\s+game.*$/i, '').trim();
        name = name.replace(/的?(?:NPC|角色|人物)$/i, '').trim();
        if (name) args.name = name;
      }
      const roleMatch = message.match(/(商人|铁匠|向导|治疗师|对手|吟游诗人|守卫|小孩|长老|店主|merchant|blacksmith|guide|healer|rival|bard|guard|child|elder|innkeeper)/i);
      if (roleMatch) args.role = roleMatch[1];
    }

    if (intentName === 'manage_asset') {
      if (/删除|移除/i.test(message)) args.action = 'remove';
      else if (/修改|改/i.test(message)) args.action = 'update';
      else args.action = 'add';
      if (/精灵|sprite|图/i.test(message)) args.assetType = 'sprite';
      else if (/音效|sound|sfx/i.test(message)) args.assetType = 'sound';
      else if (/音乐|配乐|bgm|music/i.test(message)) args.assetType = 'music';
      else if (/界面|ui|hud/i.test(message)) args.assetType = 'ui';
      const nm = message.match(/(?:叫|名为|名字)[：:\s]*["'「]?\s*([\u4e00-\u9fa5A-Za-z0-9 _\-·]{1,20})/);
      if (nm) args.name = nm[1].trim();
    }

    if (intentName === 'play_test') {
      const dm = message.match(/(\d+)\s*(?:秒|s|second)/i);
      if (dm) args.duration = Math.max(1, Math.min(120, Number(dm[1])));
      const sm = message.match(/seed[:=\s]*(\d+)|种子[:为\s]*(\d+)/i);
      if (sm) args.seed = Number(sm[1] || sm[2]);
    }

    if (intentName === 'ai_suggest') {
      if (/平衡|数值|balance/i.test(message)) args.category = 'balance';
      else if (/内容|content/i.test(message)) args.category = 'content';
      else if (/打磨|品质|polish/i.test(message)) args.category = 'polish';
      else if (/无障碍|accessibility/i.test(message)) args.category = 'accessibility';
    }

    // ---- manage_achievements ----
    if (intentName === 'manage_achievements') {
      if (/列表|列出|查看|有哪些/i.test(message)) args.action = 'list';
      else if (/删除|移除/i.test(message)) args.action = 'remove';
      else if (/修改|更新|改/i.test(message)) args.action = 'update';
      else args.action = 'add';
      const nm = message.match(/(?:叫|名为|名字|成就名)[：:\s]*["'「]?\s*([\u4e00-\u9fa5A-Za-z0-9 _\-·]{1,20})/);
      if (nm) {
        let name = nm[1].trim();
        // Strip the appended " game#id" scoping marker first, then strip
        // trailing classifier like "的成就" / "的奖杯" / "的勋章".
        name = name.replace(/\s+game.*$/i, '').trim();
        name = name.replace(/的?(?:成就|奖杯|勋章)$/i, '').trim();
        if (name) args.name = name;
      }
      const descM = message.match(/(?:描述|说明|desc)[：:\s]*(.+?)(?:[，。；\n]|$)/);
      if (descM) args.desc = descM[1].trim();
      const condM = message.match(/(?:条件|condition)[：:\s]*(.+?)(?:[，。；\n]|$)/);
      if (condM) args.condition = condM[1].trim();
      if (/解锁|unlocked|已达成/i.test(message)) args.unlocked = true;
    }

    // ---- manage_scenes ----
    if (intentName === 'manage_scenes') {
      if (/列表|列出|查看|有哪些/i.test(message)) args.action = 'list';
      else if (/重排|排序|reorder/i.test(message)) args.action = 'reorder';
      else if (/删除|移除/i.test(message)) args.action = 'remove';
      else if (/修改|更新|改/i.test(message)) args.action = 'update';
      else args.action = 'add';
      const nm = message.match(/(?:场景|关卡)(?:名|名字|名称)?[：:\s]*["'「]?\s*([\u4e00-\u9fa5A-Za-z0-9 _\-·]{1,20})/);
      if (nm) {
        let name = nm[1].trim().replace(/\s+game.*$/i, '').trim();
        if (name) args.name = name;
      }
      if (/菜单|menu/i.test(message)) args.sceneType = 'menu';
      else if (/boss|首领/i.test(message)) args.sceneType = 'boss';
      else if (/过场|剧情|cutscene/i.test(message)) args.sceneType = 'cutscene';
      else if (/商店|shop/i.test(message)) args.sceneType = 'shop';
      else if (/胜利|victory/i.test(message)) args.sceneType = 'victory';
      else if (/结束|game.?over/i.test(message)) args.sceneType = 'gameover';
      else if (args.action === 'add') args.sceneType = 'level';
    }

    // ---- manage_leaderboard ----
    if (intentName === 'manage_leaderboard') {
      if (/列表|列出|查看|有哪些/i.test(message)) args.action = 'list';
      else if (/删除|移除/i.test(message)) args.action = 'remove';
      else if (/修改|更新|改/i.test(message)) args.action = 'update';
      else args.action = 'add';
      const lb = message.match(/(?:排行榜|榜单)(?:名|名字|名称)?[：:\s]*["'「]?\s*([\u4e00-\u9fa5A-Za-z0-9 _\-·]{1,20})/);
      if (lb) {
        let label = lb[1].trim().replace(/\s+game.*$/i, '').trim();
        if (label) args.label = label;
      }
      if (/时间|time|用时/i.test(message)) args.scoring = 'time';
      else if (/胜利|胜场|wins/i.test(message)) args.scoring = 'wins';
      else args.scoring = 'score';
    }

    // ---- translate_game ----
    if (intentName === 'translate_game') {
      const langMap = {
        '英文': 'en', '英语': 'en', 'english': 'en',
        '日文': 'ja', '日语': 'ja', '日本語': 'ja', 'japanese': 'ja',
        '韩文': 'ko', '韩语': 'ko', '한국어': 'ko', 'korean': 'ko',
        '西班牙': 'es', '西班牙语': 'es', 'spanish': 'es',
        '法文': 'fr', '法语': 'fr', 'french': 'fr',
        '德文': 'de', '德语': 'de', 'german': 'de',
        '葡萄牙': 'pt', '葡萄牙语': 'pt', 'portuguese': 'pt',
        '俄文': 'ru', '俄语': 'ru', 'russian': 'ru',
        '阿拉伯': 'ar', '阿拉伯语': 'ar', 'arabic': 'ar',
      };
      for (const [kw, code] of Object.entries(langMap)) {
        if (new RegExp(kw, 'i').test(message)) { args.targetLang = code; break; }
      }
      if (!args.targetLang && /英文|英语|english/i.test(message)) args.targetLang = 'en';
      if (/全部|所有|all/i.test(message)) args.scope = 'all';
      else if (/名称|名字|name/i.test(message)) args.scope = 'name';
      else if (/描述|description/i.test(message)) args.scope = 'description';
      else if (/npc|角色/i.test(message)) args.scope = 'npcs';
      else if (/成就|achievement/i.test(message)) args.scope = 'achievements';
      else if (/剧情|场景|scenario/i.test(message)) args.scope = 'scenario';
    }

    // ---- balance_game ----
    if (intentName === 'balance_game') {
      const dm = message.match(/(\d+)\s*(?:秒|s|second)/i);
      if (dm) args.duration = Math.max(1, Math.min(120, Number(dm[1])));
      if (/简单|easy/i.test(message)) args.targetDifficulty = 'easy';
      else if (/困难|hard/i.test(message)) args.targetDifficulty = 'hard';
      else args.targetDifficulty = 'normal';
    }

    // ---- manage_audio ----
    if (intentName === 'manage_audio') {
      if (/音效|sfx|sound\b/i.test(message) && !/背景音乐|bgm|music/i.test(message)) args.kind = 'sfx';
      else args.kind = 'music';
      if (/列表|列出|查看/i.test(message)) args.action = 'list';
      else if (/重排|排序/i.test(message)) args.action = 'reorder';
      else if (/播放|play/i.test(message)) args.action = 'play';
      else if (/删除|移除/i.test(message)) args.action = 'remove';
      else if (/修改|更新|改\s*(?:音量|名字|描述)/i.test(message)) args.action = 'update';
      else args.action = 'add';
      const nm = message.match(/(?:音乐|音效|曲目|声音)(?:名|名字|名称)?[：:\s]*["'「]?\s*([\u4e00-\u9fa5A-Za-z0-9 _\-·]{1,20})/);
      if (nm) {
        let name = nm[1].trim().replace(/\s+game.*$/i, '').trim();
        if (name) args.name = name;
      }
      const moodMap = { '史诗': 'epic', '平静': 'calm', '紧张': 'tense', '欢快': 'happy', '悲伤': 'sad', '神秘': 'mysterious', '战斗': 'battle' };
      for (const [kw, v] of Object.entries(moodMap)) if (new RegExp(kw, 'i').test(message)) { args.mood = v; break; }
      const volM = message.match(/音量[：:\s]*(\d+(?:\.\d+)?)/);
      if (volM) args.volume = Number(volM[1]);
      if (/循环|loop/i.test(message)) args.loop = true;
    }

    // ---- generate_story ----
    if (intentName === 'generate_story') {
      const chM = message.match(/(\d+)\s*(?:章|章节|chapter)/i);
      if (chM) args.chapters = Math.max(1, Math.min(8, Number(chM[1])));
      const toneMap = { '史诗': 'epic', '黑暗': 'dark', '轻松': 'light', '神秘': 'mysterious', '幽默': 'humorous' };
      for (const [kw, v] of Object.entries(toneMap)) if (new RegExp(kw, 'i').test(message)) { args.tone = v; break; }
      const titleM = message.match(/(?:标题|题目|title)[：:\s]*["'「]?\s*([^\n，。；]{2,30})/);
      if (titleM) args.title = titleM[1].trim();
    }

    // ---- profile_game ----
    if (intentName === 'profile_game') {
      const dm = message.match(/(\d+)\s*(?:秒|s|second)/i);
      if (dm) args.duration = Math.max(1, Math.min(120, Number(dm[1])));
    }

    // ---- lint_scripts ----
    if (intentName === 'lint_scripts') {
      if (/dsl|指令|模板/i.test(message)) args.scope = 'dsl';
      else if (/section|代码段|生成/i.test(message)) args.scope = 'sections';
      else args.scope = 'all';
    }

    // ---- control_runtime ----
    if (intentName === 'control_runtime') {
      if (/重启|重新开始|restart/i.test(message)) args.command = 'restart';
      else if (/暂停|pause/i.test(message)) args.command = 'pause';
      else if (/继续|resume/i.test(message)) args.command = 'resume';
      else if (/调速|速度|speed/i.test(message)) {
        args.command = 'speed';
        const sm = message.match(/(\d+(?:\.\d+)?)\s*x/i);
        if (sm) args.speed = Number(sm[1]);
      } else if (/生成|spawn/i.test(message)) {
        args.command = 'spawn';
        if (/boss/i.test(message)) args.entity = 'boss';
        else if (/道具|powerup|补给/i.test(message)) args.entity = 'powerup';
        else if (/障碍|obstacle/i.test(message)) args.entity = 'obstacle';
        else args.entity = 'enemy';
        const cm = message.match(/(\d+)\s*(?:个|只)/);
        if (cm) args.count = Number(cm[1]);
      } else if (/无敌|invincible/i.test(message)) {
        args.command = 'invincible';
        args.enabled = !/关闭|取消|关/i.test(message);
      } else if (/上帝|god.?mode/i.test(message)) {
        args.command = 'godmode';
        args.enabled = !/关闭|取消|关/i.test(message);
      } else if (/胜利|win/i.test(message)) args.command = 'win';
      else if (/失败|lose/i.test(message)) args.command = 'lose';
      else args.command = 'restart';
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
