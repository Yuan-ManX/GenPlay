/**
 * TemplateController - REST endpoints for game templates.
 * Lists the live genre catalog (Chinese label + icon + tagline) straight
 * from the agent template engine, and applies one to create a new game.
 * Wraps the generate_game_template agent tool.
 */
import { listGenres } from '../../agent/templates/gameTemplates.js';

export class TemplateController {
  constructor(agentService) {
    this.agent = agentService;
  }

  list = async (req, res) => {
    try {
      // Catalog comes from the single source of truth (agent/templates) so a
      // newly added genre shows up in the gallery without touching this route.
      const tools = this.agent.listTools();
      const tmpl = tools.find((t) => t.name === 'generate_game_template');
      res.json({
        ok: true,
        genres: listGenres(),
        description: tmpl?.description || 'Create a fully-featured starter game from a genre template.',
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };

  apply = async (req, res) => {
    try {
      const { genre } = req.params;
      const { name, difficulty } = req.body || {};
      const result = await this.agent.runTool({
        toolName: 'generate_game_template',
        args: { genre, name, difficulty },
        sessionId: req.body?.sessionId,
      });
      res.json(result.result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}
