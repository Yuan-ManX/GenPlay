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
  ],
  snippets: [
    { key: 'double_jump', label: '二段跳', tags: ['platformer', 'movement'], dsl: 'on input.jump and jumps < maxJumps: genplay::jump player', nodes: NodeDSLEngine.fromDslScript('on input.jump and jumps < maxJumps: genplay::jump player', 'dj') },
    { key: 'coin_loop', label: '金币拾取循环', tags: ['adventure', 'scoring'], dsl: 'on frame % coin.spawnEvery == 0: genplay::spawn coin\non hit(player, coin): genplay::score coin, genplay::despawn coin', nodes: NodeDSLEngine.fromDslScript('on frame % coin.spawnEvery == 0: genplay::spawn coin\non hit(player, coin): genplay::score coin, genplay::despawn coin', 'coin') },
    { key: 'hp_pickup', label: '拾取回血', tags: ['rpg', 'items'], dsl: 'on hit(player, potion): genplay::heal player = 25, genplay::despawn potion', nodes: NodeDSLEngine.fromDslScript('on hit(player, potion): genplay::heal player = 25, genplay::despawn potion', 'hp') },
    { key: 'wave_spawner', label: '波次生成器', tags: ['shooter', 'tower'], dsl: 'on frame % enemy.spawnEvery == 0 and wave.active: genplay::spawn enemy', nodes: NodeDSLEngine.fromDslScript('on frame % enemy.spawnEvery == 0 and wave.active: genplay::spawn enemy', 'wave') },
    { key: 'boss_banner', label: 'Boss出场横幅', tags: ['rpg', 'cinematic'], dsl: 'on enter(boss_room): genplay::shake_camera, genplay::play_bgm boss_theme', nodes: NodeDSLEngine.fromDslScript('on enter(boss_room): genplay::shake_camera, genplay::play_bgm boss_theme', 'boss') },
  ],
  nodePresets: [
    { key: 'permadeath', label: 'Roguelike永久死亡', tags: ['roguelike', 'hardcore'], description: '死亡后清空存档并重置地城' },
    { key: 'card_draw_turn', label: '卡组抽牌回合', tags: ['deckbuilder'], description: '回合开始抽牌并重置能量' },
    { key: 'shop_refresh', label: '商店刷新', tags: ['auto_battler', 'economics'], description: '花金币刷新商店可购单位池' },
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
