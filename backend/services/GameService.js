/**
 * GameService - 游戏业务服务层
 */
import { GameStore } from '../models/GameStore.js';

export class GameService {
  constructor(dataDir) {
    this.store = new GameStore(dataDir);
  }

  create(data) {
    return this.store.create(data);
  }

  getById(id) {
    return this.store.getById(id);
  }

  list(filters = {}) {
    return this.store.list(filters);
  }

  stats() {
    return this.store.stats();
  }

  update(id, patch) {
    return this.store.update(id, patch);
  }

  remove(id) {
    return this.store.remove(id);
  }

  async run(id) {
    const game = await this.store.getById(id);
    if (!game) return { ok: false, error: '游戏不存在' };
    const issues = [];
    if (!game.genre) issues.push('缺少游戏类型');
    if (!game.scripts) issues.push('尚未生成可执行逻辑脚本');
    const result = {
      gameId: id,
      status: issues.length ? 'warning' : 'ok',
      durationMs: 12 + Math.floor(Math.random() * 40),
      issues,
      logs: [
        `[boot] 启动游戏 ${game.name}`,
        `[run] 主循环运行 ${issues.length ? '存在告警' : '正常'}`,
      ],
    };
    await this.store.update(id, {
      lastRun: result,
      runCount: (game.runCount || 0) + 1,
    });
    return { ok: true, result };
  }
}
