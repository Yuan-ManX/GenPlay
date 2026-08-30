/**
 * SharedAssetLibrary - A cross-project, reusable asset/component store.
 * Holds themes, scenarios, node-graph fragments, snippets, and asset specs
 * (sprite/music/SFX) that can be searched and copied into new games.
 *
 * Designed so the studio panel has an "Asset Library" tab where creators
 * can drag-and-drop pre-made pieces, and the Agent can browse via tools
 * like searchAssets / applySnippet / installPreset.
 */
import NodeDSLEngine from './nodeDsl.js';

const BUILT_IN = {
  themes: [
    { key: 'retro_pixel', name: '像素复古', palette: ['#fc5603', '#00d9ff', '#ffeb00', '#8bff00', '#2d1b00'], tags: ['8bit', 'classic', 'casual'], description: '温暖明亮的 8-bit 街机风' },
    { key: 'cyberpunk',   name: '赛博朋克', palette: ['#0ff0fc', '#ff2a6d', '#05d9e8', '#d1f7ff', '#01012b'], tags: ['neon', 'scifi', 'future'], description: '霓虹夜色与机甲未来' },
    { key: 'sakura',      name: '樱花物语', palette: ['#ffb7c5', '#ffd6e0', '#ffffff', '#c96b8a', '#6b4e71'], tags: ['pink', 'romantic', 'japanese'], description: '粉色樱花与日系少女' },
    { key: 'arcade',      name: '黄金街机', palette: ['#ff0080', '#00ffea', '#faff00', '#8338ec', '#3a86ff'], tags: ['arcade', 'high-contrast', 'retro'], description: '高对比霓虹CRT街机' },
    { key: 'sunset',      name: '日落狂想', palette: ['#ff512f', '#f09819', '#dd2476', '#ff5858', '#ffc371'], tags: ['warm', 'orange', 'cozy'], description: '暖橙日落剪影氛围' },
    { key: 'ocean',       name: '深海秘境', palette: ['#00c9ff', '#0575e6', '#00f260', '#028090', '#00a8e8'], tags: ['blue', 'ocean', 'calm'], description: '深海蓝色与气泡光效' },
    { key: 'forest',      name: '绿林深处', palette: ['#134e5e', '#71b280', '#a8e063', '#56ab2f', '#3a1c71'], tags: ['green', 'nature', 'fantasy'], description: '森林绿意与阳光树叶' },
  ],
  scenarios: [
    { key: 'fantasy', title: '魔幻·黎明之剑', tags: ['fantasy', 'medieval', 'epic'], chapters: 3, description: '勇者踏上寻剑之旅，穿越古战场、精灵森林与深渊。' },
    { key: 'space',   title: '星际·远征方舟', tags: ['space', 'scifi'], chapters: 5, description: '人类驾驶方舟穿越虫洞，在陌生星系寻找新家园。' },
    { key: 'cyber',   title: '霓虹·回路黑客', tags: ['cyberpunk', 'thriller'], chapters: 4, description: '地下黑客组织对抗垄断企业AI，在数据洪流中争夺真相。' },
    { key: 'horror',  title: '暗夜·低语庄园', tags: ['horror', 'mystery'], chapters: 4, description: '老宅深处藏着失落的家族秘辛，每一步都伴随着低语回响。' },
    { key: 'wuxia',   title: '江湖·残剑录', tags: ['wuxia', 'martial'], chapters: 5, description: '一把残剑牵动武林旧案，侠客在门派纷争间追寻真相。' },
    { key: 'post_apoc', title: '废土·余烬行商', tags: ['postapocalyptic', 'survival'], chapters: 4, description: '余烬纪元里，行商车队穿越辐射荒原，换得一线生机。' },
  ],
  snippets: [
    { key: 'double_jump', label: '二段跳', tags: ['platformer', 'movement'], dsl: 'on input.jump and jumps < maxJumps: genplay::jump player', nodes: NodeDSLEngine.fromDslScript('on input.jump and jumps < maxJumps: genplay::jump player', 'dj') },
    { key: 'coin_loop', label: '金币拾取循环', tags: ['adventure', 'scoring'], dsl: 'on frame % coin.spawnEvery == 0: genplay::spawn coin\non hit(player, coin): genplay::score coin, genplay::despawn coin', nodes: NodeDSLEngine.fromDslScript('on frame % coin.spawnEvery == 0: genplay::spawn coin\non hit(player, coin): genplay::score coin, genplay::despawn coin', 'coin') },
    { key: 'hp_pickup', label: '拾取回血', tags: ['rpg', 'items'], dsl: 'on hit(player, potion): genplay::heal player = 25, genplay::despawn potion', nodes: NodeDSLEngine.fromDslScript('on hit(player, potion): genplay::heal player = 25, genplay::despawn potion', 'hp') },
    { key: 'wave_spawner', label: '波次生成器', tags: ['shooter', 'tower'], dsl: 'on frame % enemy.spawnEvery == 0 and wave.active: genplay::spawn enemy', nodes: NodeDSLEngine.fromDslScript('on frame % enemy.spawnEvery == 0 and wave.active: genplay::spawn enemy', 'wave') },
    { key: 'boss_banner', label: 'Boss出场横幅', tags: ['rpg', 'cinematic'], dsl: 'on enter(boss_room): genplay::shake_camera, genplay::play_bgm boss_theme', nodes: NodeDSLEngine.fromDslScript('on enter(boss_room): genplay::shake_camera, genplay::play_bgm boss_theme', 'boss') },
    // ---- Genre-specific snippets for the 7 new genres ----
    { key: 'roguelike_floor_descent', label: 'Roguelike 下层机关', tags: ['roguelike', 'progression'], dsl: 'on hit(player, stairs): genplay::next_floor, genplay::regen_dungeon, genplay::spawn_enemies floor.difficulty', nodes: NodeDSLEngine.fromDslScript('on hit(player, stairs): genplay::next_floor, genplay::regen_dungeon, genplay::spawn_enemies floor.difficulty', 'rld') },
    { key: 'deckbuilder_card_draw', label: '卡组回合抽牌', tags: ['deckbuilder', 'turn'], dsl: 'on turn.start: genplay::reset energy, genplay::clear block, genplay::draw handSize', nodes: NodeDSLEngine.fromDslScript('on turn.start: genplay::reset energy, genplay::clear block, genplay::draw handSize', 'cdd') },
    { key: 'metroidvania_ability_gate', label: '能力门锁定', tags: ['metroidvania', 'progression'], dsl: 'on enter(gate) and not ability.gate: genplay::block_passage, genplay::hint ability_name', nodes: NodeDSLEngine.fromDslScript('on enter(gate) and not ability.gate: genplay::block_passage, genplay::hint ability_name', 'ag') },
    { key: 'idle_prestige_loop', label: '放置转生循环', tags: ['idle', 'prestige'], dsl: 'on coin >= prestige.threshold: genplay::offer_prestige, genplay::reset currency, genplay::grant gem + prestige_reward', nodes: NodeDSLEngine.fromDslScript('on coin >= prestige.threshold: genplay::offer_prestige, genplay::reset currency, genplay::grant gem + prestige_reward', 'ipl') },
    { key: 'sandbox_craft_recipe', label: '沙盒合成配方', tags: ['sandbox', 'crafting'], dsl: 'on craft(inputs) and match(recipe): genplay::consume inputs, genplay::unlock output', nodes: NodeDSLEngine.fromDslScript('on craft(inputs) and match(recipe): genplay::consume inputs, genplay::unlock output', 'scr') },
    { key: 'visual_novel_branch', label: '视觉小说分支', tags: ['visual_novel', 'narrative'], dsl: 'on choice(option): genplay::set flag(option.flag), genplay::add affection(option.target, option.value), genplay::route branch', nodes: NodeDSLEngine.fromDslScript('on choice(option): genplay::set flag(option.flag), genplay::add affection(option.target, option.value), genplay::route branch', 'vnb') },
    { key: 'auto_battler_shop_refresh', label: '自走棋商店刷新', tags: ['auto_battler', 'economy'], dsl: 'on refresh and gold >= cost: genplay::roll shop, genplay::cost gold', nodes: NodeDSLEngine.fromDslScript('on refresh and gold >= cost: genplay::roll shop, genplay::cost gold', 'abs') },
    { key: 'dash_attack', label: '冲刺突进', tags: ['metroidvania', 'platformer', 'movement'], dsl: 'on input.dash and cooldown == 0: genplay::dash player, genplay::set cooldown', nodes: NodeDSLEngine.fromDslScript('on input.dash and cooldown == 0: genplay::dash player, genplay::set cooldown', 'da') },
    { key: 'collectible_coin', label: '收集品循环', tags: ['adventure', 'scoring'], dsl: 'on frame % collectible.spawnEvery == 0: genplay::spawn collectible\non hit(player, collectible): genplay::score, genplay::despawn', nodes: NodeDSLEngine.fromDslScript('on frame % collectible.spawnEvery == 0: genplay::spawn collectible\non hit(player, collectible): genplay::score, genplay::despawn', 'cc') },
    { key: 'boss_wave', label: 'Boss波次', tags: ['shooter', 'tower', 'roguelike'], dsl: 'on wave.end and wave.num % boss.every == 0: genplay::spawn boss, genplay::play_bgm boss_theme', nodes: NodeDSLEngine.fromDslScript('on wave.end and wave.num % boss.every == 0: genplay::spawn boss, genplay::play_bgm boss_theme', 'bw') },
    { key: 'checkpoint', label: '检查点复活', tags: ['platformer', 'metroidvania'], dsl: 'on hit(player, checkpoint): genplay::set_spawn_point\non player.hp <= 0: genplay::respawn at last_checkpoint', nodes: NodeDSLEngine.fromDslScript('on hit(player, checkpoint): genplay::set_spawn_point\non player.hp <= 0: genplay::respawn at last_checkpoint', 'cp') },
    { key: 'dialogue_tree', label: '分支对话树', tags: ['rpg', 'visual_novel'], dsl: 'on talk(npc): genplay::open_dialogue tree\non choice(branch): genplay::jump node(branch.target), genplay::set flag(branch.flag)', nodes: NodeDSLEngine.fromDslScript('on talk(npc): genplay::open_dialogue tree\non choice(branch): genplay::jump node(branch.target), genplay::set flag(branch.flag)', 'dt') },
    { key: 'achievement_trigger', label: '成就触发器', tags: ['rpg', 'meta'], dsl: 'on condition(achievement.cond): genplay::unlock achievement, genplay::toast name', nodes: NodeDSLEngine.fromDslScript('on condition(achievement.cond): genplay::unlock achievement, genplay::toast name', 'at') },
    { key: 'invincible_blink', label: '无敌闪烁', tags: ['platformer', 'battle'], dsl: 'on player.hit: genplay::set invincible = 60f, genplay::blink sprite', nodes: NodeDSLEngine.fromDslScript('on player.hit: genplay::set invincible = 60f, genplay::blink sprite', 'ib') },
    { key: 'score_combo', label: '连击计分', tags: ['rhythm', 'shooter', 'scoring'], dsl: 'on hit.perfect: genplay::combo +1, genplay::multiplier = 1 + combo*0.1\non miss: genplay::combo = 0', nodes: NodeDSLEngine.fromDslScript('on hit.perfect: genplay::combo +1, genplay::multiplier = 1 + combo*0.1\non miss: genplay::combo = 0', 'sc') },
    { key: 'time_limit', label: '倒计时限制', tags: ['puzzle', 'racing', 'meta'], dsl: 'on start: genplay::set timer = limit\non tick: genplay::timer -1\non timer == 0: genplay::gameover', nodes: NodeDSLEngine.fromDslScript('on start: genplay::set timer = limit\non tick: genplay::timer -1\non timer == 0: genplay::gameover', 'tl') },
  ],
  nodePresets: [
    { key: 'permadeath', label: 'Roguelike永久死亡', tags: ['roguelike', 'hardcore'], description: '死亡后清空存档并重置地城，仅保留部分货币与解锁' },
    { key: 'card_draw_turn', label: '卡组抽牌回合', tags: ['deckbuilder'], description: '回合开始抽牌、重置能量、清空格挡' },
    { key: 'shop_refresh', label: '商店刷新', tags: ['auto_battler', 'economics'], description: '花金币刷新商店可购单位池，按等级解锁层级' },
    { key: 'ability_unlock', label: '能力解锁门', tags: ['metroidvania', 'progression'], description: '击败区域Boss后永久解锁新能力，打开通路' },
    { key: 'prestige_reset', label: '放置转生', tags: ['idle', 'prestige'], description: '达到阈值后转生，重置货币获取永久倍率' },
    { key: 'craft_recipe', label: '合成配方节点', tags: ['sandbox', 'crafting'], description: '输入材料匹配配方后产出新物品' },
    { key: 'affection_route', label: '好感度路线', tags: ['visual_novel', 'narrative'], description: '根据好感度与标志位路由到对应结局' },
    { key: 'auto_battle', label: '自动战斗节点', tags: ['auto_battler', 'combat'], description: '回合开始自动按优先级攻击，结算剩余单位伤害' },
    { key: 'patrol_ai', label: '巡逻AI', tags: ['platformer', 'metroidvania', 'ai'], description: '敌人沿指定路径巡逻，发现玩家后追击' },
    { key: 'procedural_spawn', label: '程序化生成节点', tags: ['roguelike', 'sandbox', 'procedural'], description: '按种子与规则程序化生成房间、地形或物品' },
  ],
};

export class SharedAssetLibrary {
  constructor() {
    this.themes = new Map(BUILT_IN.themes.map((t) => [t.key, { ...t, kind: 'theme' }]));
    this.scenarios = new Map(BUILT_IN.scenarios.map((s) => [s.key, { ...s, kind: 'scenario' }]));
    this.snippets = new Map(BUILT_IN.snippets.map((s) => [s.key, { ...s, kind: 'snippet' }]));
    this.nodePresets = new Map(BUILT_IN.nodePresets.map((n) => [n.key, { ...n, kind: 'node' }]));
    this.custom = new Map(); // user-uploaded assets keyed by id
    this.tags = new Map();
    this._reindexTags();
  }

  _reindexTags() {
    this.tags.clear();
    const sources = [this.themes, this.scenarios, this.snippets, this.nodePresets, this.custom];
    for (const src of sources) for (const [, v] of src) {
      for (const t of v.tags || []) {
        if (!this.tags.has(t)) this.tags.set(t, []);
        this.tags.get(t).push({ kind: v.kind || 'custom', key: v.key || v.id });
      }
    }
  }

  // ---- Queries ----
  listThemes() { return Array.from(this.themes.values()); }
  listScenarios() { return Array.from(this.scenarios.values()); }
  listSnippets() { return Array.from(this.snippets.values()); }
  listNodePresets() { return Array.from(this.nodePresets.values()); }

  getTheme(key) { return this.themes.get(key) || null; }
  getScenario(key) { return this.scenarios.get(key) || null; }
  getSnippet(key) { return this.snippets.get(key) || null; }

  search(query = {}) {
    const out = [];
    const text = (query.text || '').toLowerCase();
    const kind = query.kind;
    const tag = query.tag;
    const pools = [
      ...(kind === 'theme' || !kind ? this.listThemes() : []),
      ...(kind === 'scenario' || !kind ? this.listScenarios() : []),
      ...(kind === 'snippet' || !kind ? this.listSnippets() : []),
      ...(kind === 'node' || !kind ? this.listNodePresets() : []),
      ...(kind === 'custom' || !kind ? Array.from(this.custom.values()) : []),
    ];
    for (const item of pools) {
      if (tag && !(item.tags || []).includes(tag)) continue;
      if (text) {
        const hay = `${item.key || item.id} ${item.name || item.title || item.label || ''} ${item.description || ''} ${(item.tags || []).join(' ')}`.toLowerCase();
        if (!hay.includes(text)) continue;
      }
      out.push(item);
    }
    return out.slice(0, query.limit || 30);
  }

  // ---- Mutations ----
  addCustom(id, entry) {
    const saved = { id, ...entry, kind: 'custom', createdAt: Date.now() };
    this.custom.set(id, saved);
    this._reindexTags();
    return saved;
  }

  installSnippet(game, snippetKey) {
    const snip = this.snippets.get(snippetKey);
    if (!snip || !game) return null;
    const nextScripts = [game.scripts || '', `// [Asset] ${snip.label}\n${snip.dsl}`].filter(Boolean).join('\n');
    const existingGraph = game.config?.nodeGraph || { nodes: [], edges: [] };
    const mergedGraph = {
      nodes: [...existingGraph.nodes, ...(snip.nodes?.nodes || [])],
      edges: [...existingGraph.edges, ...(snip.nodes?.edges || [])],
    };
    return {
      scripts: nextScripts,
      config: { ...(game.config || {}), nodeGraph: mergedGraph },
    };
  }

  allTags() { return Array.from(this.tags.keys()).sort(); }

  export() {
    return {
      themes: Object.fromEntries(this.themes),
      scenarios: Object.fromEntries(this.scenarios),
      snippets: Object.fromEntries(this.snippets),
      nodePresets: Object.fromEntries(this.nodePresets),
      custom: Object.fromEntries(this.custom),
    };
  }
}

export default SharedAssetLibrary;
