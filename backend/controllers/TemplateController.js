/**
 * TemplateController - REST endpoints for game templates.
 * Lists available genre templates and applies one to create a new game.
 * Wraps the generate_game_template agent tool.
 */

export class TemplateController {
  constructor(agentService) {
    this.agent = agentService;
  }

  list = async (req, res) => {
    try {
      // Return the template catalog from the tool's description.
      const tools = this.agent.listTools();
      const tmpl = tools.find((t) => t.name === 'generate_game_template');
      const genres = ['shooter', 'platformer', 'rpg', 'puzzle', 'tower', 'roguelike', 'racing', 'rhythm',
        'adventure', 'battle', 'snake', 'breakout', 'maze', 'deckbuilder', 'metroidvania',
        'idle', 'sandbox', 'visual_novel', 'auto_battler'];
      res.json({
        ok: true,
        genres: genres.map((g) => ({ key: g, label: g })),
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
