export class GameController {
  constructor(gameService) {
    this.service = gameService;
  }

  create = async (req, res, next) => {
    try {
      const game = await this.service.create(req.body);
      res.status(201).json({ ok: true, game });
    } catch (err) { next(err); }
  };

  list = async (req, res, next) => {
    try {
      const { search, status, genre } = req.query;
      const games = await this.service.list({ search, status, genre });
      res.json({ ok: true, games, total: games.length });
    } catch (err) { next(err); }
  };

  stats = async (req, res, next) => {
    try {
      const stats = await this.service.stats();
      res.json({ ok: true, stats });
    } catch (err) { next(err); }
  };

  getById = async (req, res, next) => {
    try {
      const game = await this.service.getById(req.params.id);
      if (!game) return res.status(404).json({ ok: false, error: '游戏不存在' });
      res.json({ ok: true, game });
    } catch (err) { next(err); }
  };

  update = async (req, res, next) => {
    try {
      const game = await this.service.update(req.params.id, req.body);
      if (!game) return res.status(404).json({ ok: false, error: '游戏不存在' });
      res.json({ ok: true, game });
    } catch (err) { next(err); }
  };

  run = async (req, res, next) => {
    try {
      const result = await this.service.run(req.params.id);
      if (!result.ok && !result.result) return res.status(404).json(result);
      res.json(result);
    } catch (err) { next(err); }
  };

  remove = async (req, res, next) => {
    try {
      const existed = await this.service.remove(req.params.id);
      if (!existed) return res.status(404).json({ ok: false, error: '游戏不存在' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  };
}
