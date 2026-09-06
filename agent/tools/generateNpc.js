/**
 * generateNpc tool - Design NPCs with personality, dialogue trees,
 * routines, trades, quests and AI behaviors. Works for sandbox, RPG,
 * visual novel, roguelike and metroidvania genres. Produces structured
 * data that can be injected into game config, plus a "voice" field for
 * future LLM dialogue.
 */
const TEMPLATES = {
  merchant: { role: 'Merchant', trades: ['potion_hp', 'sword+1', 'shield+1', 'torch'], routine: ['day:market_stall', 'night:inn'] },
  blacksmith: { role: 'Blacksmith', trades: ['weapon_upgrade', 'armor_repair'], routine: ['all_day:forge'] },
  guide: { role: 'Guide', quests: true, routine: ['day:town_gate', 'night:tavern'] },
  healer: { role: 'Healer', services: ['heal_party', 'cure_poison'], routine: ['day:temple', 'night:home'] },
  rival: { role: 'Rival', personality: 'arrogant', combat: true, routine: ['day:training_ground', 'night:tavern_brawl'] },
  bard: { role: 'Bard', services: ['play_song', 'give_hint'], routine: ['night:tavern'] },
  guard: { role: 'Guard', combat: true, routine: ['all_day:patrol'] },
  child: { role: 'Villager Child', quests: true, personality: 'curious', routine: ['day:plaza', 'night:home'] },
  elder: { role: 'Town Elder', quests: true, personality: 'wise', routine: ['day:council', 'night:home'] },
  innkeeper: { role: 'Innkeeper', services: ['rest', 'save_point'], routine: ['all_day:inn'] },
};

const PERSONALITIES = ['cheerful', 'grumpy', 'mysterious', 'shy', 'arrogant', 'wise', 'nervous', 'jolly', 'cunning', 'noble'];

export function generateNpcTool(services = {}) {
  const { provider, artifactMemory } = services;
  return {
    name: 'generate_npc',
    description: 'Design NPC characters with personality, dialogue trees, daily routines, trades, quests and combat AI. Produces injectable game config.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        count: { type: 'integer', description: 'Number of NPCs (default 3)' },
        archetype: { type: 'string', description: 'Optional specific archetype: merchant, blacksmith, guide, healer, rival, bard, guard, child, elder, innkeeper' },
        genre: { type: 'string', description: 'Game genre for flavor alignment' },
        themeKey: { type: 'string', description: 'Theme for tone matching' },
      },
    },
    async execute({ gameId, count = 3, archetype, genre, themeKey, sessionId }) {
      const list = [];
      for (let i = 0; i < count; i++) {
        const arche = archetype && i === 0 ? archetype : pickWeightedArchetype(archetype ? [archetype] : null);
        const tpl = TEMPLATES[arche] || TEMPLATES.guide;
        list.push(buildNpc(arche, tpl, i, genre, themeKey));
      }

      // LLM enrich if available
      if (provider?.enabled && list.length) {
        try {
          const enriched = await llmEnrich(provider, list, genre, themeKey);
          for (let i = 0; i < enriched.length && i < list.length; i++) {
            list[i] = { ...list[i], ...enriched[i] };
          }
        } catch (_) { /* keep rule defaults */ }
      }

      // Write artifact memory
      for (const n of list) artifactMemory?.recordAsset?.(`npc_${n.id}`, { type: 'npc', name: n.name, tags: [n.archetype, genre].filter(Boolean), spec: n });

      const actions = [
        {
          type: 'studio:add-npc',
          payload: { gameId, npcs: list, npc: list[0] },
        },
        {
          type: 'studio:patch-config',
          payload: { gameId, after: { npcs: list }, changes: [`添加 ${list.length} 位 NPC`] },
        },
      ];

      return {
        ok: true,
        summary: `生成了 ${list.length} 位 NPC 角色`,
        npcs: list,
        npc: list[0],
        editorActions: actions,
      };
    },
  };
}

function pickWeightedArchetype(forceList) {
  const pool = forceList?.length ? forceList : Object.keys(TEMPLATES);
  const weights = pool.map((k) => ({ key: k, w: (k === 'merchant' || k === 'guide') ? 1.3 : 1 }));
  const sum = weights.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * sum;
  for (const x of weights) {
    if ((r -= x.w) <= 0) return x.key;
  }
  return pool[0];
}

const FIRST_NAMES = ['Luna', 'Kael', 'Lyra', 'Rex', 'Nova', 'Orin', 'Sable', 'Mira', 'Torin', 'Zara', 'Fen', 'Ivy', 'Cai', 'Nora', 'Pax'];
const LAST_NAMES = ['Silverwind', 'Ironforge', 'Shadowveil', 'Brightwater', 'Stormborn', 'Emberglow', 'Ravenwood', 'Mossheart'];

function buildNpc(archetype, tpl, index, genre, themeKey) {
  const id = `npc_${Date.now().toString(36)}_${index}`;
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
  const palette = themePalette(themeKey);
  const dialogue = buildDialogueTree(archetype, personality, genre);
  return {
    id,
    name: `${first} ${last}`,
    shortName: first,
    archetype,
    role: tpl.role,
    personality,
    palette,
    sprite: { baseColor: palette[0], accent: palette[1], outfit: tpl.role },
    routine: tpl.routine,
    trades: tpl.trades || [],
    services: tpl.services || [],
    combat: !!tpl.combat,
    quests: !!tpl.quests,
    dialogue,
    voice: `${personality} ${tpl.role}`,
    affinity: 0,
  };
}

function themePalette(key) {
  const p = {
    cyberpunk: ['#ff2a6d', '#05d9e8', '#d1f7ff'],
    retro_pixel: ['#7a3e00', '#ffe6c0', '#005f99'],
    sakura: ['#ffd6e0', '#c96b8a', '#6b4e71'],
    sunset: ['#ff512f', '#dd2476', '#fdbb2d'],
    ocean: ['#00c9ff', '#028090', '#00f260'],
    forest: ['#134e5e', '#71b280', '#a8e063'],
    arcade: ['#ff0080', '#00ffea', '#faff00'],
  };
  return p[key] || p.retro_pixel;
}

function buildDialogueTree(archetype, personality, genre) {
  const opener = openerLine(archetype, personality);
  const branches = [];
  branches.push({ key: 'trade', label: '交易', leads: archetype === 'merchant' || archetype === 'blacksmith' ? 'open_shop' : 'sorry_no_trade' });
  branches.push({ key: 'info', label: '打听消息', leads: 'hint' });
  if (archetype === 'guide' || archetype === 'elder' || archetype === 'child') {
    branches.push({ key: 'quest', label: '接受任务', leads: 'quest_offer' });
  }
  branches.push({ key: 'bye', label: '再见', leads: 'farewell' });
  const nodes = {
    root: { text: opener, branches },
    open_shop: { text: `看看我的 ${genre ? genre : '宝贝'}吧！`, action: 'open_shop' },
    sorry_no_trade: { text: '今日无货。', action: null },
    hint: { text: hintLine(archetype, genre), action: 'grant_hint' },
    quest_offer: { text: questLine(archetype, genre), action: 'grant_quest', reward: { gold: 50, xp: 20, item: 'trinket' } },
    farewell: { text: '一路平安！', action: 'close' },
  };
  return { tree: nodes, entry: 'root' };
}

function openerLine(a, p) {
  if (p === 'grumpy') return `哼，又是你。${a === 'merchant' ? '买东西就快，别浪费时间。' : '说。'}`;
  if (p === 'cheerful') return `嘿，欢迎光临！我是${TEMPLATES[a]?.role || '老朋友'}！`;
  if (p === 'mysterious') return '……你终于来了。命运指引你到此。';
  if (p === 'wise') return '年轻的冒险者，请讲。';
  if (p === 'shy') return '啊……你、你好。请问有什么事？';
  if (p === 'arrogant') return '哦？你也配跟我说话？……说吧。';
  return '欢迎，有什么可以帮你的？';
}

function hintLine(a, genre) {
  if (genre === 'roguelike') return '地城第三层向东有秘室，但要小心陷阱。';
  if (genre === 'metroidvania') return '据说瀑布后面有双重跳能力石。';
  if (genre === 'sandbox') return '西山脚下的矿洞昨天塌了一块，里面说不定有新矿。';
  if (a === 'bard') return '我昨晚新编了一首歌，讲的是古代王的宝藏。';
  return '森林深处的老橡树下埋着东西。';
}

function questLine(a, genre) {
  if (a === 'child') return '我的猫跑进树林里了，能帮我找回来吗？';
  if (a === 'elder') return '村东的水井被污染了，需要三株圣水苔净化。';
  if (a === 'guide') return '商队久未归来，请去山口查看情况。';
  return '需要你把这个包裹送到下一个镇子。';
}

async function llmEnrich(provider, npcs, genre, themeKey) {
  const schema = {
    type: 'object',
    properties: {
      npcs: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            backstory: { type: 'string' },
            voice_sample: { type: 'string' },
            secret: { type: 'string' },
          },
        },
      },
    },
    required: ['npcs'],
  };
  const sys = 'You are GenPlay NPC writer. Give each NPC a unique short backstory, a 1-line voice sample matching their personality, and one optional secret.';
  const input = JSON.stringify({
    genre: genre || 'fantasy',
    theme: themeKey || 'medieval',
    npcs: npcs.map((n) => ({ archetype: n.archetype, personality: n.personality, shortName: n.shortName })),
  });
  const res = await provider.json({ systemPrompt: sys, userMessage: input, schema, temperature: 0.8 });
  return res?.npcs || [];
}
