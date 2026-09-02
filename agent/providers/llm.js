/**
 * LLMProvider - Unified interface for AI chat, structured JSON, and tool use.
 *
 * Capabilities:
 *   1. Native OpenAI function-calling when API key is configured (reliable
 *      tool selection without fragile text-to-JSON parsing).
 *   2. Token-level streaming via chatStream() so the frontend can render
 *      the assistant reply progressively.
 *   3. Structured JSON output with schema enforcement and retry.
 *   4. Deterministic rule-based fallbacks so the project boots and runs
 *      the full creative pipeline even without an external key.
 */
export class LLMProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseURL = config.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.model = config.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.maxRetries = config.maxRetries ?? 2;
    this.requestTimeoutMs = config.requestTimeoutMs ?? 30000;
  }

  get enabled() {
    return Boolean(this.apiKey);
  }

  /**
   * Return a raw text response.
   * When tools are provided and the API key is set, the provider prefers
   * native function calling and surfaces any tool-call decision so the
   * caller can act on it without re-parsing free text.
   */
  async chat({ systemPrompt, history = [], userMessage, temperature = 0.7, tools }) {
    if (!this.enabled) return this.fallbackReply(userMessage);
    const messages = this._messages(systemPrompt, history, userMessage);
    if (tools?.length) {
      const fn = await this._functionCall(messages, tools, temperature);
      if (fn) return fn;
    }
    return this._request({ messages, temperature });
  }

  /**
   * Token-streaming chat. Calls onToken(chunkText) as content arrives.
   * Returns the full assembled text when the stream closes. When no API
   * key is configured, the fallback reply is delivered as a single token
   * so callers can reuse the same UI pipeline.
   */
  async chatStream({ systemPrompt, history = [], userMessage, temperature = 0.7, onToken }) {
    if (!this.enabled) {
      const text = this.fallbackReply(userMessage);
      if (typeof onToken === 'function') onToken(text);
      return text;
    }
    const messages = this._messages(systemPrompt, history, userMessage);
    const data = await this._rawStream({
      model: this.model,
      messages,
      temperature,
      stream: true,
    }, onToken);
    return data.fullText;
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
   *
   * When the API key is set this prefers OpenAI's native tool-calling
   * format (function declarations + tool_calls in the response), which is
   * far more reliable than prompting for JSON. The text-JSON path remains
   * as a secondary fallback for endpoints that lack function-calling.
   */
  async pickTool({ systemPrompt, history = [], userMessage, toolSchemas }) {
    const tools = toolSchemas.map((t) => ({
      name: t.name,
      description: t.description || '',
      parameters: t.parameters || { type: 'object', properties: {} },
    }));
    if (!this.enabled) return this.fallbackPickTool(userMessage, tools);

    // Primary path: native function calling.
    try {
      const fn = await this._functionCall(
        this._messages(systemPrompt, history, userMessage),
        tools,
        0.2,
      );
      if (fn) return fn;
    } catch (_) { /* fall through to text-based pick */ }

    // Secondary path: prompt the model for a JSON tool decision.
    const sys = [
      systemPrompt || 'You are a tool-calling assistant.',
      'You must decide which SINGLE tool to invoke and return strict JSON.',
      'Return exactly one JSON object: { tool: "<name>", args: { ... } }. If no tool fits, return { tool: null, args: {} }.',
      'Available tools: ' + JSON.stringify(tools),
    ].join('\n');
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
      return '我已规划游戏创建任务。请提供具体名称和类型，例如"创建一个叫星空冒险的射击游戏"，我会立即搭建可玩项目。支持 20 种玩法：射击/冒险/RPG/解谜/对战/赛车/模拟/平台跳跃/塔防/贪吃蛇/打砖块/迷宫/节奏/肉鸽/卡牌构筑/银河恶魔城/放置挂机/沙盒/视觉小说/自走棋。';
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
    if (/(创意|灵感|ideate|脑暴|混搭)/.test(lower)) {
      return '我可以为你生成原创游戏概念与玩法混搭灵感。告诉我想要的方向或风格，例如"给我 3 个原创游戏创意"。';
    }
    if (/(社区|探索|热门|community|explore)/.test(lower)) {
      return '我可以带你浏览社区作品，按热门或最新排序，按玩法类型筛选。告诉我你感兴趣的玩法方向。';
    }
    if (/(资产库|素材库|snippet|片段|预设)/.test(lower)) {
      return '共享资产库收录主题、剧情、代码片段、节点预设，可直接安装到你的游戏。告诉我你想查找哪类资源。';
    }
    if (/(节点|node|graph|可视化)/.test(lower)) {
      return '我可以打开节点可视化编辑器，用连线方式编排游戏逻辑，也支持从 DSL 脚本导入。';
    }
    if (/(帮助|help|你能做什么|功能|怎么用)/i.test(lower)) {
      return [
        '我是 GenPlay AI 游戏创作助手，可以帮你完成以下工作：',
        '  💡 创意灵感："给我 3 个原创游戏概念"',
        '  🎮 创建游戏："创建一个叫星空冒险的射击游戏"（支持 20 种玩法）',
        '  ✏️  编辑游戏："修改 game#xxx 把玩家速度调高"',
        '  🎨 主题风格："对 game#xxx 应用赛博朋克风格"',
        '  📝 场景剧情："给 game#xxx 加一个太空站关卡剧情"',
        '  🧱 生成关卡/NPC/资源："给 game#xxx 生成地城关卡" / "做 3 个角色"',
        '  🔧 安装片段："给 game#xxx 加二段跳" / "加Boss波次"',
        '  🕸️ 节点编辑："打开节点图" / "从DSL导入"',
        '  🔍 资产库："搜索像素风主题"',
        '  🌍 社区探索："看看热门作品"',
        '  🔧 一键打磨："优化 game#xxx" 快速迭代润色',
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
    return '你好，这里是 GenPlay Agent。我可以创建游戏、编辑规则参数、运行试玩、调试排错、应用主题、生成关卡/NPC/资源、安装代码片段、节点图编辑、资产库搜索、社区探索、一键打磨和发布上线。告诉我你想创作什么。';
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

    // High-specificity creation-adjacent tools first
    if (/(创意|灵感|构思|brainstorm|mashup|混搭|想一个|脑暴|脑洞|给点主意)/.test(msg) && names.includes('creative_ideate')) {
      const cm = msg.match(/(\d+)\s*(个|款|种|条|组)/);
      return { tool: 'creative_ideate', args: cm ? { count: Number(cm[1]) } : {} };
    }
    if (/(快速迭代|一键优化|做得更好|润色|打磨|polish|improve|iterate|再优化|整体优化)/.test(msg) && names.includes('rapid_iterate')) {
      return { tool: 'rapid_iterate', args: {} };
    }
    if (/(生成.*关卡|程序化|地图|地牢|地形|level|procedural|map)/.test(msg) && names.includes('procedural_level')) {
      return { tool: 'procedural_level', args: {} };
    }
    if (/(生成.*资源|精灵图|音效|配乐|ui界面|sprite|sound|music|asset|美术资源)/.test(msg) && names.includes('generate_asset')) {
      return { tool: 'generate_asset', args: {} };
    }
    if (/(设计.*角色|生成.*npc|新角色|配角|队友|npc|character|persona)/.test(msg) && names.includes('generate_npc')) {
      const cm = msg.match(/(\d+)\s*(个|位|名|组)/);
      return { tool: 'generate_npc', args: cm ? { count: Number(cm[1]) } : {} };
    }
    if (/(多人|联机|协作|成就|排行榜|存档|无障碍|变现|广告|内购|multiplayer|achievement|leaderboard|accessibility)/.test(msg) && names.includes('configure_game_meta')) {
      return { tool: 'configure_game_meta', args: {} };
    }
    if (/(安装|引入|导入.*片段|snippet|二段跳|双段跳|冲刺|突进|dash|收集品|金币|boss|首领|检查点|对话树|成就触发|无敌闪烁|连击|限时|倒计时)/.test(msg) && names.includes('install_snippet')) {
      return { tool: 'install_snippet', args: {} };
    }
    if (/(节点图|逻辑图|可视化.*节点|node.*graph|连线|导入.*dsl|导出.*dsl)/.test(msg) && names.includes('edit_node_graph')) {
      return { tool: 'edit_node_graph', args: {} };
    }
    if (/(资产库|素材库|共享库|搜索.*(素材|资产|主题|预设|片段)|asset.*library|查找.*(主题|片段|脚本))/.test(msg) && names.includes('search_asset_library')) {
      return { tool: 'search_asset_library', args: {} };
    }
    if (/(社区|探索|浏览|热门|新作|精选|community|explore|排行榜|大家的)/.test(msg) && names.includes('explore_community')) {
      return { tool: 'explore_community', args: {} };
    }
    if (/(删除.*游戏|移除|destroy|delete|remove|drop|清空.*作品|不要了|删掉.*游戏)/.test(msg) && names.includes('delete_game')) {
      return { tool: 'delete_game', args: {} };
    }
    if (/(保存|存档|持久化|写入|commit|flush|sync|保存游戏|同步保存)/.test(msg) && names.includes('save_game')) {
      return { tool: 'save_game', args: {} };
    }
    if (/(重命名|改名字|改.*名称|改.*描述|切换.*类型|变更.*类型|更新.*(基础|信息|描述|名称|分类))/.test(msg) && names.includes('update_basic_info')) {
      return { tool: 'update_basic_info', args: {} };
    }
    if (/(复刻|remix|fork.*game|二创|改编|基于.*做|参照.*创作|clone.*game)/.test(msg) && names.includes('remix_game')) {
      const out = {};
      const sc = msg.match(/(gp_[a-z0-9]{4,}|#[a-z0-9]{4,})/i);
      if (sc) out.shareCode = sc[1].replace(/^#/, '');
      return { tool: 'remix_game', args: out };
    }
    if (/(创作团|专家团|多智能体|协同构思|团队.*设计|crew|specialist|一起.*构思|企划)/.test(msg) && names.includes('dispatch_crew')) {
      return { tool: 'dispatch_crew', args: { brief: msg, autoApply: /落地|自动|创建|应用/.test(msg) } };
    }

    // Theme / scenario / code / tweak tools (higher specificity than generic CRUD)
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
    if (/(diff|差异|对比|前后|变更|修复.*代码|深度调试|自动修复)/.test(msg) && names.includes('debug_with_diffs')) {
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
  // Native function-calling
  // ------------------------------------------------------------------
  /**
   * Send messages with OpenAI-style function declarations and parse the
   * tool_calls response. Returns { tool, args } when the model picks a
   * tool, or null when it replies with plain text. Throws on transport
   * errors so callers can fall back to text-based tool picking.
   */
  async _functionCall(messages, tools, temperature = 0.4) {
    const payload = {
      model: this.model,
      messages,
      temperature,
      tools: tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description || t.name,
          parameters: t.parameters || { type: 'object', properties: {} },
        },
      })),
      tool_choice: 'auto',
    };
    const data = await this._rawJson(payload);
    const choice = data?.choices?.[0];
    if (!choice) return null;

    // Prefer tool_calls (OpenAI native), then function_call (legacy v1).
    const toolCalls = choice.message?.tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length) {
      const call = toolCalls[0];
      const fnName = call.function?.name || call.function?.function?.name;
      let fnArgs = {};
      try {
        fnArgs = JSON.parse(call.function?.arguments || '{}');
      } catch (_) { fnArgs = {}; }
      return { tool: fnName || null, args: fnArgs, text: choice.message?.content || '' };
    }
    const legacy = choice.message?.function_call;
    if (legacy?.name) {
      let fnArgs = {};
      try { fnArgs = JSON.parse(legacy.arguments || '{}'); } catch (_) { fnArgs = {}; }
      return { tool: legacy.name, args: fnArgs, text: choice.message?.content || '' };
    }
    return null;
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
        const data = await this._rawJson(payload);
        const content = data?.choices?.[0]?.message?.content ?? '';
        return content;
      } catch (err) {
        if (attempt > this.maxRetries) throw err;
        await sleep(150 * attempt);
      }
    }
  }

  /**
   * Single non-streaming JSON request with timeout. Returns the parsed
   * response body so both _request (text) and _functionCall (tool_calls)
   * can share transport + auth + timeout logic.
   */
  async _rawJson(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const res = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Streaming request. Parses SSE chunks, invoking onToken(chunkText)
   * for each delta. Returns { fullText } with the concatenated content.
   * Used by chatStream() so the frontend can render tokens live.
   */
  async _rawStream(payload, onToken) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs * 4);
    let fullText = '';
    try {
      const res = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line || !line.startsWith('data:')) continue;
          const payloadStr = line.slice(5).trim();
          if (payloadStr === '[DONE]') continue;
          try {
            const json = JSON.parse(payloadStr);
            const delta = json?.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              if (typeof onToken === 'function') onToken(delta);
            }
          } catch (_) { /* keep draining */ }
        }
      }
    } finally {
      clearTimeout(timer);
    }
    return { fullText };
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
