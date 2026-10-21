/**
 * CrewController - REST endpoint for multi-agent specialist crew dispatch.
 * Wraps the dispatch_crew agent tool so the frontend can trigger a
 * coordinated creative brainstorm via a direct REST call.
 */

export class CrewController {
  constructor(agentService) {
    this.agent = agentService;
  }

  dispatch = async (req, res) => {
    try {
      const { brief, genre, autoApply } = req.body || {};
      const result = await this.agent.runTool({
        toolName: 'dispatch_crew',
        args: { brief, genre, autoApply },
        sessionId: req.body?.sessionId,
      });
      res.json(result.result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}
