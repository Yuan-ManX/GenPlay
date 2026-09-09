export class ChatController {
  constructor(agentService) {
    this.service = agentService;
  }

  chat = async (req, res, next) => {
    try {
      const { message, sessionId } = req.body;
      const result = await this.service.chat({ sessionId, message });
      res.json({ ok: true, ...result });
    } catch (err) { next(err); }
  };

  /**
   * SSE streaming chat. Pushes lifecycle events (plan / tool_start / tool_end /
   * reply / done) to the client as they happen so the frontend can render the
   * agent's reasoning + tool trace in realtime, then closes the stream.
   */
  stream = async (req, res, next) => {
    try {
      const { message, sessionId } = req.body;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);
      const send = (type, data) => {
        try { res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`); } catch (_) {}
      };
      const result = await this.service.chatStream({
        sessionId,
        message,
        onEvent: (ev) => send(ev.type, ev),
      });
      // Final consolidated payload so non-SSE-aware clients still get the full result.
      send('result', { ok: true, ...result });
      res.write(`event: end\ndata: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (err) {
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ ok: false, error: err.message })}\n\n`);
      } catch (_) {}
      try { res.end(); } catch (_) {}
      if (!res.headersSent) next(err);
    }
  };

  listTools = async (req, res, next) => {
    try {
      res.json({ ok: true, tools: this.service.listTools() });
    } catch (err) { next(err); }
  };

  listSessions = async (req, res, next) => {
    try {
      res.json({ ok: true, sessions: this.service.listSessions() });
    } catch (err) { next(err); }
  };

  getSession = async (req, res, next) => {
    try {
      const session = this.service.getSession(req.params.id);
      if (!session) return res.status(404).json({ ok: false, error: '会话不存在' });
      res.json({ ok: true, session });
    } catch (err) { next(err); }
  };

  reset = async (req, res, next) => {
    try {
      this.service.reset(req.params.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  };

  deleteSession = async (req, res, next) => {
    try {
      this.service.reset(req.params.id);
      res.json({ ok: true, deleted: req.params.id });
    } catch (err) { next(err); }
  };
}
