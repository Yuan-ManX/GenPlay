/**
 * EditorController - Frontend studio panel agent-tool proxy.
 * Frontend calls agent tools by signature; returned editorActions drive
 * the studio refresh. Supports:
 *   - GET  /tools          : list all registered tools
 *   - POST /action         : execute a single tool (JSON response)
 *   - POST /action/stream  : execute a single tool as SSE (start/result)
 *   - POST /batch          : execute an array of tools sequentially
 *   - GET  /suggestions/:gameId : run ai_suggest and return suggestions
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

  /**
   * SSE streaming variant of runAction. Emits:
   *   event: start  -> { tool, args }
   *   event: result -> { tool, ok, summary, editorActions, ...result }
   * Mirrors the chat stream contract so the frontend reuses its SSE parser.
   */
  runActionStream = async (req, res, next) => {
    try {
      const { tool, args = {}, sessionId } = req.body;
      if (!tool) {
        res.status(400).json({ ok: false, error: '缺少 tool 名称' });
        return;
      }
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const send = (event, data) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      send('start', { tool, args });
      try {
        const data = await this.service.runTool({ toolName: tool, args, sessionId });
        send('result', data);
      } catch (err) {
        send('error', { tool, error: err.message || String(err) });
      }
      res.end();
    } catch (err) { next(err); }
  };

  /**
   * Execute an array of { tool, args } sequentially. Returns an array of
   * results and merges all editorActions so the frontend can apply them
   * in one refresh cycle.
   */
  runBatch = async (req, res, next) => {
    try {
      const { actions = [], sessionId } = req.body;
      if (!Array.isArray(actions) || actions.length === 0) {
        return res.status(400).json({ ok: false, error: 'actions 必须是非空数组' });
      }
      const results = [];
      const allEditorActions = [];
      for (const act of actions) {
        const { tool, args = {} } = act;
        if (!tool) {
          results.push({ ok: false, error: '缺少 tool 名称' });
          continue;
        }
        const data = await this.service.runTool({ toolName: tool, args, sessionId });
        results.push(data);
        if (data.editorActions) allEditorActions.push(...data.editorActions);
      }
      res.json({ ok: true, results, editorActions: allEditorActions });
    } catch (err) { next(err); }
  };

  /**
   * Run ai_suggest for a game and return the suggestion list.
   * Convenience endpoint for the studio AI-suggestions panel.
   */
  suggestions = async (req, res, next) => {
    try {
      const { gameId } = req.params;
      if (!gameId) return res.status(400).json({ ok: false, error: '缺少 gameId' });
      const data = await this.service.runTool({ toolName: 'ai_suggest', args: { gameId } });
      res.json({ ok: true, suggestions: data.result?.suggestions || [] });
    } catch (err) { next(err); }
  };
}
