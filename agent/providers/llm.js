/**
 * LLMProvider - Unified interface for AI chat, structured JSON, and tool use.
 * Supports OpenAI-compatible endpoints. When no API key configured, a
 * deterministic fallback is used so the project still boots and runs
 * through the full flow without an external key.
 */
export class LLMProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseURL = config.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.model = config.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.maxRetries = config.maxRetries ?? 2;
  }

  get enabled() {
    return Boolean(this.apiKey);
  }

  /**
   * Return a raw text response.
   */
  async chat({ systemPrompt, history = [], userMessage, temperature = 0.7, tools }) {
    if (!this.enabled) return this.fallbackReply(userMessage);
    return this._request({
      messages: this._messages(systemPrompt, history, userMessage),
      temperature,
      tools,
    });
  }

  /**
   * Synchronous chat fallback (used by orchestrator synthesizeReply).
   * Returns pure rule-based answer without LLM call.
   */
  chatSync({ userMessage }) {
    return this.fallbackReply(userMessage);
  }

  /**
   * Return a JSON object matching the provided schema object.
   */
  async json({ systemPrompt, history = [], userMessage, schema, temperature = 0.4 }) {
    const sys = [
      systemPrompt || 'You are a strict JSON generator.',
      schema
        ? `You must return a single JSON object that conforms to this schema: ${JSON.stringify(schema)}.`
        : 'You must return a single JSON object with no extra text.',
      'Do not include explanations, markdown code fences, or text outside the JSON braces.',
    ].filter(Boolean).join('\n');
    if (!this.enabled) return this.fallbackJson(userMessage, schema);
    const body = {
      model: this.model,
      messages: this._messages(sys, history, userMessage),
      temperature,
    };
    const tryFormat = async () => {
      const resp = await this._request(body);
      return this._parseJson(resp);
    };
    return this._retry(tryFormat, this.maxRetries, () => this.fallbackJson(userMessage, schema));
  }

  /**
   * Use LLM to pick a tool + arguments. Returns { tool, args } or null.
   */
  async pickTool({ systemPrompt, history = [], userMessage, toolSchemas }) {
    const tools = toolSchemas.map((t) => ({
      name: t.name,
      description: t.description || '',
      parameters: t.parameters || { type: 'object', properties: {} },
    }));
    const sys = [
      systemPrompt || 'You are a tool-calling assistant.',
      'You must decide which SINGLE tool to invoke and return strict JSON.',
      'Return exactly one JSON object: { tool: "<name>", args: { ... } }. If no tool fits, return { tool: null, args: {} }.',
      'Available tools: ' + JSON.stringify(tools),
    ].join('\n');
    if (!this.enabled) return this.fallbackPickTool(userMessage, tools);
    return this._retry(async () => {
      const text = await this._request({
        messages: this._messages(sys, history, userMessage),
        temperature: 0.2,
      });
      const obj = this._parseJson(text);
      if (!obj || typeof obj !== 'object') throw new Error('bad llm json');
      if (obj.tool === undefined) obj.tool = null;
      if (!obj.args || typeof obj.args !== 'object') obj.args = {};
      return obj;
    }, this.maxRetries, () => this.fallbackPickTool(userMessage, tools));
  }

  // ------------------------------------------------------------------
  // Fallbacks (no-API-key mode)
  // ------------------------------------------------------------------
  fallbackReply(userMessage) {
    const lower = String(userMessage || '').toLowerCase();
    if (/(创建|生成|create|build)/.test(lower)) {
      return '我已规划游戏创建任务。请提供具体名称和类型，例如"创建一个叫星空冒险的射击游戏"，我会立即搭建可玩项目。';
    }
    if (/(编辑|修改|edit|update|change|调整|调参)/.test(lower)) {
      return '我可以帮你修改游戏。告诉我游戏ID和目标改动，例如"修改游戏 #abc123 的跳跃高度"或"提升敌人强度"。';
    }
    if (/(调试|debug|排错|运行|测试|test|run|试玩)/.test(lower)) {
      return '我将运行并检查游戏。提供ID后，我会输出运行结果和修复建议。';
    }
    if (/(主题|风格|theme|style|配色)/.test(lower)) {
      return '我可以为游戏应用新主题：像素复古/赛博朋克/樱花/街机/日落/深海/霓虹森林。告诉我目标ID和主题名称。';
    }
    if (/(场景|剧情|scenario|story|关卡)/.test(lower)) {
      return '我可以为游戏添加剧情关卡或叙事场景。告诉我目标ID和故事背景。';
    }
    if (/(发布|分享|publish|deploy)/.test(lower)) {
      return '我可以发布游戏。发送游戏ID后，我会将其标记为已上线并返回分享链接。';
    }
    if (/(查看代码|代码|脚本|code|script|view)/.test(lower)) {
      return '我可以展示游戏的配置和脚本源码。告诉我目标游戏ID即可查看。';
    }
    if (/(帮助|help|你能做什么|功能|怎么用)/i.test(lower)) {
      return [
        '我是 GenPlay AI 游戏创作助手，可以帮你完成以下工作：',
        '  🎮 创建游戏："创建一个叫星空冒险的射击游戏"',
        '  ✏️  编辑游戏："修改 game#xxx 把玩家速度调高"',
        '  🎨 主题风格："对 game#xxx 应用赛博朋克风格"',
        '  📝 场景剧情："给 game#xxx 加一个太空站关卡剧情"',
        '  🐛 调试运行："运行 game#xxx" / "排查 game#xxx 的问题"',
        '  🚀 发布上线："发布 game#xxx"',
      ].join('\n');
    }
    if (/你好|hi|hello/i.test(lower)) {
      return '你好！我是 GenPlay AI 助手。告诉我你想做什么游戏，我会帮你从零创建、编辑、调试并发布上线 🎮';
    }
    if (/谢谢|thanks|thx/i.test(lower)) {
      return '不客气！随时可以告诉我下一步想调整什么，我们一起把游戏做好 ✨';
    }
    return '你好，这里是 GenPlay Agent。我可以创建游戏、编辑规则参数、运行试玩、调试排错、应用主题、生成配置、列出游戏、描述游戏和发布上线。告诉我你想创作什么。';
  }

  fallbackJson(userMessage, schema) {
    const keys = schema && typeof schema === 'object' ? Object.keys(schema.properties || {}) : [];
    const out = {};
    for (const k of keys) out[k] = defaultForType(schema.properties[k]);
    return out;
  }

  fallbackPickTool(userMessage, tools) {
    const names = tools.map((t) => t.name);
    const msg = String(userMessage || '').toLowerCase();

    // Theme / scenario / code / tweak tools first (higher specificity)
    if (/(主题|风格|theme|style|配色|赛博|像素|复古|樱花|街机)/.test(msg) && names.includes('apply_style_theme')) {
      const theme = matchTheme(msg);
      return { tool: 'apply_style_theme', args: theme ? { theme } : {} };
    }
    if (/(场景|剧情|story|scenario|关卡|叙事)/.test(msg) && names.includes('apply_scenario')) {
      return { tool: 'apply_scenario', args: {} };
    }
    if (/(参数|调参|修改|tweak|速度|血量|难度|伤害|强度)/.test(msg) && names.includes('tweak_params')) {
      return { tool: 'tweak_params', args: extractTweakArgs(msg) };
    }
    if (/(查看代码|代码|脚本|code|script|view.*source)/.test(msg) && names.includes('view_code')) {
      return { tool: 'view_code', args: {} };
    }
    if (/(diff|差异|对比|前后|变更|修复.*代码)/.test(msg) && names.includes('debug_with_diffs')) {
      return { tool: 'debug_with_diffs', args: {} };
    }

    // Standard CRUD tools
    if (/创建|生成|create|build|new|make/.test(msg) && names.includes('create_game')) return { tool: 'create_game', args: {} };
    if (/编辑|修改|edit|update/.test(msg) && names.includes('edit_game')) return { tool: 'edit_game', args: {} };
    if (/调试|debug|排错|bug|检查问题/.test(msg) && names.includes('debug_game')) return { tool: 'debug_game', args: {} };
    if (/运行|试玩|test|run|play/.test(msg) && names.includes('run_game')) return { tool: 'run_game', args: {} };
    if (/发布|分享|publish|deploy|上线/.test(msg) && names.includes('publish_game')) return { tool: 'publish_game', args: {} };
    if (/概览|介绍|详情|describe|details?|查看.*情况/.test(msg) && names.includes('describe_game')) return { tool: 'describe_game', args: {} };
    if (/列出|查看|list|show|有哪些游戏/.test(msg) && names.includes('list_games')) return { tool: 'list_games', args: {} };
    if (/配置|参数表|config|生成配置/.test(msg) && names.includes('generate_config')) return { tool: 'generate_config', args: {} };

    return { tool: null, args: {} };
  }

  // ------------------------------------------------------------------
  // HTTP primitives
  // ------------------------------------------------------------------
  _messages(systemPrompt, history, userMessage) {
    const msgs = [];
    if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt });
    for (const h of history || []) {
      if (h?.role && h?.content != null) msgs.push({ role: h.role, content: String(h.content) });
    }
    if (userMessage != null) msgs.push({ role: 'user', content: String(userMessage) });
    return msgs;
  }

  async _request(body) {
    const payload = { model: this.model, temperature: 0.7, ...body };
    let attempt = 0;
    while (true) {
      attempt++;
      try {
        const res = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content ?? '';
        return content;
      } catch (err) {
        if (attempt > this.maxRetries) throw err;
        await sleep(150 * attempt);
      }
    }
  }

  async _retry(fn, retries, fallback) {
    let lastErr;
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
      }
    }
    if (fallback) return fallback();
    throw lastErr;
  }

  _parseJson(text) {
    if (text == null) return null;
    const s = String(text).trim();
    const strip = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = strip.indexOf('{');
    const end = strip.lastIndexOf('}');
    if (start < 0 || end < 0) return null;
    try {
      return JSON.parse(strip.slice(start, end + 1));
    } catch (_) {
      return null;
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function defaultForType(schemaProp = {}) {
  switch (schemaProp.type) {
    case 'number': return 0;
    case 'integer': return 0;
    case 'boolean': return false;
    case 'array': return [];
    case 'object': return {};
    case 'string': return '';
    default: return '';
  }
}

function matchTheme(msg) {
  if (/赛博|cyberpunk|neon/i.test(msg)) return 'cyberpunk';
  if (/像素|复古|retro|pixel|8.?bit/i.test(msg)) return 'retro_pixel';
  if (/樱花|sakura|粉红|pink/i.test(msg)) return 'sakura';
  if (/街机|arcade/i.test(msg)) return 'arcade';
  if (/日落|sunset|橙红/i.test(msg)) return 'sunset';
  if (/深海|海洋|ocean|blue/i.test(msg)) return 'ocean';
  if (/森林|forest|green|自然/i.test(msg)) return 'forest';
  return '';
}

function extractTweakArgs(msg) {
  const args = {};
  const speedMatch = msg.match(/速度.{0,6}?(\d+(?:\.\d+)?)/);
  if (speedMatch) args.speed = Number(speedMatch[1]);
  const hpMatch = msg.match(/(?:血量|生命|hp).{0,6}?(\d+(?:\.\d+)?)/i);
  if (hpMatch) args.hp = Number(hpMatch[1]);
  const difficultyMatch = msg.match(/难度.{0,6}?(简单|普通|困难|地狱|easy|normal|hard|hell)/i);
  if (difficultyMatch) args.difficulty = difficultyMatch[1];
  const damageMatch = msg.match(/(?:伤害|攻击力|atk|damage).{0,6}?(\d+(?:\.\d+)?)/i);
  if (damageMatch) args.damage = Number(damageMatch[1]);
  return args;
}
