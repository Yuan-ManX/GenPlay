/**
 * Dialogue tree engine for narrative games.
 * Generates branching dialogue trees with nodes, choices, conditions, and
 * multiple endings. Each tree is a graph of nodes where each node has:
 *   - id, speaker, text
 *   - choices: array of { text, next, condition?, effects? }
 *
 * Endings are leaf nodes tagged with a type (combat, ally, info, death, quest).
 *
 * The generator uses templates per scenario/genre plus a seeded PRNG so
 * output is deterministic for a given seed.
 */

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Scenario → dialogue template fragments.
const SCENARIO_TEMPLATES = {
  fantasy: {
    title: '酒馆密谈',
    speaker: '神秘旅人',
    opening: [
      '你看起来不像本地人。来这有何贵干？',
      '这片土地上已经很久没有外乡人敢踏足了。',
      '你的眼神……让我想起了一个老朋友。',
    ],
    characters: ['神秘旅人', '酒馆老板', '流浪剑客', '占星师', '老隐士'],
    topics: ['寻找失落的圣剑', '调查村中失踪案', '加入冒险者公会', '询问古龙传说'],
    endings: [
      { type: 'ally', label: '获得盟友' },
      { type: 'combat', label: '战斗爆发' },
      { type: 'info', label: '获得线索' },
      { type: 'quest', label: '接取任务' },
    ],
  },
  space: {
    title: '空间站谈判',
    speaker: '舰长',
    opening: [
      '未知身份的飞船，请说明来意。',
      '这片星域已由联邦封锁，你为何擅闯？',
      '你的飞船识别码不在数据库中。解释。',
    ],
    characters: ['舰长', 'AI 副官', '叛军使者', '考古学家', '赏金猎人'],
    topics: ['调查信号源', '寻求补给', '联合抵抗海盗', '询问古文明遗迹'],
    endings: [
      { type: 'ally', label: '结成同盟' },
      { type: 'combat', label: '交火' },
      { type: 'info', label: '获得星图' },
      { type: 'quest', label: '接受任务' },
    ],
  },
  cyber: {
    title: '地下接头',
    speaker: '黑客组织者',
    opening: [
      '你迟到了三十秒。我不喜欢等人。',
      ' ICE 巡逻刚过去，说吧，货带来了吗？',
      '你的网络痕迹很干净——太干净了，反倒可疑。',
    ],
    characters: ['黑客组织者', '情报贩子', '企业叛逃者', '暗网中间人', '义体医生'],
    topics: ['购买零日漏洞', '出售情报', '入侵企业主机', '寻求庇护'],
    endings: [
      { type: 'ally', label: '加入组织' },
      { type: 'combat', label: '遭遇追杀' },
      { type: 'info', label: '获得密钥' },
      { type: 'quest', label: '接下委托' },
    ],
  },
  ancient: {
    title: '神殿守门人',
    speaker: '守门人',
    opening: [
      '凡人，你为何踏入禁地？',
      '千年来无人通过此门。你凭什么例外？',
      '神殿的考验在等待——你准备好了吗？',
    ],
    characters: ['守门人', '古神低语', '亡灵向导', '失落王者', '祭司残影'],
    topics: ['寻找遗迹宝藏', '解除古老诅咒', '寻求神谕', '挑战试炼'],
    endings: [
      { type: 'ally', label: '获得神力' },
      { type: 'combat', label: '神殿守卫战' },
      { type: 'info', label: '获得秘文' },
      { type: 'death', label: '魂归神殿' },
    ],
  },
};

const GENRE_TEMPLATES = {
  visual_novel: SCENARIO_TEMPLATES.fantasy,
  rpg: SCENARIO_TEMPLATES.fantasy,
  adventure: SCENARIO_TEMPLATES.ancient,
  roguelike: SCENARIO_TEMPLATES.ancient,
  shooter: SCENARIO_TEMPLATES.space,
  puzzle: SCENARIO_TEMPLATES.ancient,
  default: SCENARIO_TEMPLATES.fantasy,
};

// Choice archetypes for generating branch options.
const CHOICE_TEMPLATES = [
  { text: '直接说明来意', tone: 'honest', stat: 'charisma' },
  { text: '保持警惕，反问对方', tone: 'cautious', stat: 'wisdom' },
  { text: '出示信物', tone: 'diplomatic', stat: 'charisma', condition: { stat: 'charisma', gte: 7 } },
  { text: '威胁对方', tone: 'aggressive', stat: 'strength' },
  { text: '提出交易', tone: 'mercantile', stat: 'intelligence' },
  { text: '[隐秘] 偷偷观察', tone: 'stealthy', stat: 'dexterity', condition: { stat: 'dexterity', gte: 6 } },
  { text: '询问更多细节', tone: 'curious', stat: 'wisdom' },
  { text: '保持沉默', tone: 'silent', stat: 'will' },
];

/**
 * Generate a dialogue tree.
 * @param {object} opts
 *   - genre, scenario: select template
 *   - character: override speaker
 *   - topic: override opening topic
 *   - branches: max branching factor (2-4, default 3)
 *   - depth: max tree depth (2-4, default 3)
 *   - seed: PRNG seed
 *   - title: override tree title
 * @returns {object} tree with nodes, rootId, endings
 */
export function generateDialogueTree({
  genre = 'adventure',
  scenario = 'fantasy',
  character,
  topic,
  branches = 3,
  depth = 3,
  seed = Date.now() % 100000,
  title,
} = {}) {
  const rng = mulberry32(seed);
  const tmpl = SCENARIO_TEMPLATES[scenario] || GENRE_TEMPLATES[genre] || GENRE_TEMPLATES.default;
  const speaker = character || tmpl.speaker;
  const useTitle = title || tmpl.title;
  const openingTopic = topic || seededPick(rng, tmpl.topics);

  const nodes = {};
  const endings = [];
  let nodeCounter = 0;
  const newNodeId = () => `n${++nodeCounter}`;

  // Build tree recursively.
  function buildNode(currentDepth, parentChoice) {
    const id = newNodeId();
    const isRoot = currentDepth === 0;
    const isLeaf = currentDepth >= depth;

    // Speaker text varies by depth.
    let text;
    if (isRoot) {
      text = seededPick(rng, tmpl.opening);
    } else if (isLeaf) {
      // Leaf nodes are endings.
      const ending = seededPick(rng, tmpl.endings);
      nodes[id] = {
        id,
        speaker,
        text: generateEndingText(ending, openingTopic),
        choices: [],
        isEnding: true,
        endingType: ending.type,
        endingLabel: ending.label,
      };
      endings.push({ nodeId: id, type: ending.type, label: ending.label });
      return id;
    } else {
      text = generateMidText(rng, openingTopic, currentDepth);
    }

    // Generate 2-4 choices.
    const choiceCount = Math.max(2, Math.min(4, branches));
    const choices = [];
    const usedTemplates = new Set();
    for (let i = 0; i < choiceCount; i++) {
      let tplIdx = Math.floor(rng() * CHOICE_TEMPLATES.length);
      let attempts = 0;
      while (usedTemplates.has(tplIdx) && attempts < 5) {
        tplIdx = Math.floor(rng() * CHOICE_TEMPLATES.length);
        attempts++;
      }
      usedTemplates.add(tplIdx);
      const tpl = CHOICE_TEMPLATES[tplIdx];
      const choice = {
        text: tpl.text,
        tone: tpl.tone,
        next: null, // filled after child is built
      };
      if (tpl.condition) choice.condition = tpl.condition;
      if (rng() < 0.3) choice.effects = generateEffects(tpl.stat, rng);
      choices.push(choice);
    }

    nodes[id] = { id, speaker, text, choices };

    // Build children.
    for (const choice of choices) {
      const childId = buildNode(currentDepth + 1, choice);
      choice.next = childId;
    }

    return id;
  }

  const rootId = buildNode(0, null);
  return {
    title: useTitle,
    topic: openingTopic,
    speaker,
    rootId,
    nodes,
    endings,
    nodeCount: nodeCounter,
    depth,
  };
}

function seededPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function generateEndingText(ending, topic) {
  const texts = {
    ally: `「看来我们是同路人。」\n${ending.label}：你获得了一位值得信赖的伙伴。`,
    combat: `「敬酒不吃吃罚酒！」\n${ending.label}：战斗已不可避免。`,
    info: `「这件事……我只告诉你一个人。」\n${ending.label}：你得知了关于「${topic}」的关键线索。`,
    quest: `「既然如此，就交给你了。」\n${ending.label}：你接受了关于「${topic}」的委托。`,
    death: `「愚者……」\n${ending.label}：你的旅程在此终结。`,
  };
  return texts[ending.type] || texts.info;
}

function generateMidText(rng, topic, depth) {
  const lines = [
    `关于「${topic}」……我知道一些，但需要你先证明自己。`,
    `这里不是说话的地方，跟我来。`,
    `你提到的「${topic}」……牵涉到比你想的更深的秘密。`,
    `我可以帮你，但有代价。`,
    `有意思……很少有人会直接问起这件事。`,
    `先回答我一个问题：你为何而来？`,
    `看来你已经有觉悟了。`,
    `时间不多了，长话短说。`,
  ];
  return seededPick(rng, lines);
}

function generateEffects(stat, rng) {
  const effects = {};
  const sign = rng() < 0.7 ? '+' : '-';
  const magnitude = 1 + Math.floor(rng() * 3);
  effects[stat] = `${sign}${magnitude}`;
  return effects;
}
