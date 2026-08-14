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
}
