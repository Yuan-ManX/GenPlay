import { createGameTool } from './createGame.js';
import { editGameTool } from './editGame.js';
import { runGameTool } from './runGame.js';
import { listGamesTool } from './listGames.js';
import { generateConfigTool } from './generateConfig.js';
import { debugGameTool } from './debugGame.js';
import { publishGameTool } from './publishGame.js';
import { describeGameTool } from './describeGame.js';

/**
 * ToolRegistry - GenPlay 工具链注册中心
 * 通过注入的外部服务（gameService）访问数据层。
 */
export class ToolRegistry {
  constructor(services = {}) {
    this.services = services;
    this.tools = new Map();
    this.registerDefaults();
  }

  registerDefaults() {
    this.register(createGameTool(this.services));
    this.register(editGameTool(this.services));
    this.register(runGameTool(this.services));
    this.register(listGamesTool(this.services));
    this.register(generateConfigTool(this.services));
    this.register(debugGameTool(this.services));
    this.register(publishGameTool(this.services));
    this.register(describeGameTool(this.services));
  }

  register(tool) {
    this.tools.set(tool.name, tool);
  }

  has(name) {
    return this.tools.has(name);
  }

  async invoke(name, args, context = {}) {
    const tool = this.tools.get(name);
    if (!tool) return { ok: false, error: `未知工具: ${name}` };
    try {
      return await tool.execute({ ...context, ...args });
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  describe() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }
}
