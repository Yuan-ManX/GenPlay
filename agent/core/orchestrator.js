import { LLMProvider } from '../providers/llm.js';

/**
 * AgentOrchestrator
 * 编排一次对话/任务的完整链路：
 * 解析意图 -> 上下文记忆 -> 任务拆解 -> 工具调用 -> 生成回复
 */
export class AgentOrchestrator {
  constructor({ memory, tools, planner, provider, systemPrompt } = {}) {
    this.memory = memory;
    this.tools = tools;
    this.planner = planner;
    this.provider = provider || new LLMProvider();
    this.systemPrompt = systemPrompt || this.defaultSystemPrompt();
  }

  defaultSystemPrompt() {
    return [
      '你是 GenPlay，一个 AI 原生的游戏创作与编辑 Agent。',
      '你可以帮助用户：从零创建游戏、编辑游戏逻辑、调试运行、生成配置。',
      '你具备工具调用能力，会根据需要调用合适的工具完成任务。',
      '回复要求：专业、简洁、结构清晰，优先使用可执行的工具结果。',
    ].join('\n');
  }

  /**
   * 处理用户消息，返回结构化响应
   * @param {object} opts { sessionId, message, context }
   */
  async handleMessage({ sessionId, message, context = {} }) {
    const history = this.memory.get(sessionId);
    const intent = this.planner.detectIntent(message, history);

    // 1. 若检测到明确工具意图，直接执行工具
    const toolName = intent.tool || intent.name;
    if (this.tools.has(toolName)) {
      const toolResult = await this.tools.invoke(toolName, intent.args, context);
      const reply = this.buildToolReply(toolName, toolResult);
      this.memory.push(sessionId, { role: 'user', content: message });
      this.memory.push(sessionId, { role: 'assistant', content: reply, meta: { intent } });
      return { sessionId, reply, intent, toolResult, done: true };
    }

    // 2. 否则走 LLM 生成（携带会话摘要，支撑多轮上下文）
    const session = this.memory.getSession(sessionId);
    const contextHint = session.summary ? `\n[会话记忆] ${session.summary}\n` : '';
    const reply = await this.provider.chat({
      systemPrompt: this.systemPrompt + contextHint,
      history,
      userMessage: message,
      tools: this.tools.describe(),
    });

    this.memory.push(sessionId, { role: 'user', content: message });
    this.memory.push(sessionId, { role: 'assistant', content: reply, meta: { intent } });

    return { sessionId, reply, intent, done: true };
  }

  buildToolReply(tool, result) {
    if (result.ok) {
      return `已完成「${tool}」操作。${result.summary || ''}`;
    }
    return `「${tool}」操作遇到问题：${result.error || '未知错误'}`;
  }

  reset(sessionId) {
    this.memory.clear(sessionId);
  }
}
