import { AgentOrchestrator } from './core/orchestrator.js';
import { MemoryStore } from './core/memory.js';
import { TaskPlanner } from './core/planner.js';
import { ToolRegistry } from './tools/registry.js';
import { LLMProvider } from './providers/llm.js';

export { AgentOrchestrator, MemoryStore, TaskPlanner, ToolRegistry, LLMProvider };

/**
 * GenPlay Agent Core
 * - orchestrator: 编排对话、任务执行、工具调用
 * - memory:       会话上下文记忆
 * - planner:      任务拆解
 * - tools:        工具链（生成/编辑/调试/配置）
 */

export function createAgent(config = {}) {
  const memory = config.memory || new MemoryStore();
  const tools = config.tools || new ToolRegistry(config);
  const planner = config.planner || new TaskPlanner();
  const provider = config.provider instanceof LLMProvider
    ? config.provider
    : new LLMProvider(config.provider || {});
  return new AgentOrchestrator({ memory, tools, planner, provider, systemPrompt: config.systemPrompt });
}

export default { createAgent };
