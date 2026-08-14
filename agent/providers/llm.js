/**
 * LLMProvider - LLM 调用抽象
 * 兼容 OpenAI 接口。未配置 Key 时启用回退策略（本地模拟），
 * 保证工程可一键启动、直接运行。
 */
export class LLMProvider {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseURL = config.baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.model = config.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  get enabled() {
    return Boolean(this.apiKey);
  }

  async chat({ systemPrompt, history, userMessage, tools }) {
    if (!this.enabled) {
      return this.fallbackReply(userMessage);
    }
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
      ];
      const body = { model: this.model, messages, temperature: 0.7 };
      if (tools && tools.length) {
        body.tools = tools.map((t) => ({ type: 'function', function: t }));
      }
      const res = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`LLM API ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      // 网络或鉴权失败时回退，保证不崩溃
      return this.fallbackReply(userMessage);
    }
  }

  fallbackReply(userMessage) {
    const lower = String(userMessage).toLowerCase();
    if (/(创建|生成|create|build)/.test(lower)) {
      return '已为你规划一个游戏创作任务。我将帮你从零构建游戏世界、角色与玩法。当前为本地回退模式（未配置 LLM Key），请提供更具体的游戏名或类型，例如「创建一个叫星空冒险的射击游戏」。';
    }
    if (/(编辑|修改|edit)/.test(lower)) {
      return '好的，我可以帮你编辑游戏逻辑。请指定要修改的游戏 ID 及具体改动，例如「修改游戏 #abc123 的跳跃高度」。';
    }
    if (/(运行|调试|run|test)/.test(lower)) {
      return '我将为你运行并调试游戏。请提供游戏 ID，即可输出运行结果与排错建议。';
    }
    return '你好，我是 GenPlay 创作 Agent。你可以让我：创建游戏、编辑玩法、运行调试、生成配置。请告诉我你想做什么？';
  }
}
