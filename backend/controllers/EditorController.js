/**
 * EditorController - 面向前端工作室面板的 Agent 工具代理
 * 前端通过此接口以工具签名方式直接调用 Agent 的能力（主题、剧情、调参、代码、调试），
 * 返回的 editorActions 会驱动前端刷新视图。
 */
export class EditorController {
  constructor(agentService) {
    this.service = agentService;
  }

  listTools = async (req, res, next) => {
    try {
      res.json({ ok: true, tools: this.service.listTools() });
    } catch (err) { next(err); }
  };

  runAction = async (req, res, next) => {
    try {
      const { tool, args = {}, sessionId } = req.body;
      if (!tool) return res.status(400).json({ ok: false, error: '缺少 tool 名称' });
      const data = await this.service.runTool({ toolName: tool, args, sessionId });
      res.json({ ok: true, ...data });
    } catch (err) { next(err); }
  };
}
