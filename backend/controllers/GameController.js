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
      const { search, status, genre, owner } = req.query;
      const games = await this.service.list({ search, status, genre, owner });
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
      if (!game) return res.status(404).json({ ok: false, error: 'Game not found' });
      res.json({ ok: true, game });
    } catch (err) { next(err); }
  };

  update = async (req, res, next) => {
    try {
      const game = await this.service.update(req.params.id, req.body);
      if (!game) return res.status(404).json({ ok: false, error: 'Game not found' });
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

  publish = async (req, res, next) => {
    try {
      const id = req.params.id;
      const { title, description, author } = req.body || {};
      const game = await this.service.getById(id);
      if (!game) return res.status(404).json({ ok: false, error: 'Game not found' });
      if (!(game.scripts || '').trim()) {
        return res.status(400).json({ ok: false, error: 'Cannot publish without scripts / logic' });
      }
      const result = await this.service.publish(id, { title, description, author });
      if (!result) return res.status(500).json({ ok: false, error: 'Publish failed' });
      res.json({
        ok: true,
        shareCode: result.shareCode,
        shareLink: `#/play/${result.shareCode}`,
        publishedAt: result.publishedAt,
        title: result.title,
        author: result.author,
        game: { ...game, status: 'published', shareCode: result.shareCode },
      });
    } catch (err) { next(err); }
  };

  remove = async (req, res, next) => {
    try {
      const existed = await this.service.remove(req.params.id);
      if (!existed) return res.status(404).json({ ok: false, error: 'Game not found' });
      res.json({ ok: true });
    } catch (err) { next(err); }
  };

  // ---- Multiplayer meta toggles ----
  setMultiplayer = async (req, res, next) => {
    try {
      const r = await this.service.setMultiplayer(req.params.id, req.body || {});
      if (!r.ok) return res.status(404).json(r);
      res.json(r);
    } catch (err) { next(err); }
  };

  // ---- Community published listing ----
  listPublished = async (req, res, next) => {
    try {
      const { genre, sort, search, limit } = req.query;
      const rows = await this.service.listPublished({ genre, sort, search, limit: Number(limit) || undefined });
      res.json({ ok: true, published: rows, total: rows.length });
    } catch (err) { next(err); }
  };

  getPublished = async (req, res, next) => {
    try {
      const row = await this.service.getPublished(req.params.shareCode);
      if (!row) return res.status(404).json({ ok: false, error: 'Share code not found' });
      res.json({ ok: true, published: row });
    } catch (err) { next(err); }
  };

  playPublished = async (req, res, next) => {
    try {
      await this.service.bumpPlay(req.params.shareCode);
      const row = await this.service.getPublished(req.params.shareCode);
      if (!row) return res.status(404).json({ ok: false, error: 'Share code not found' });
      res.json({ ok: true, play: row.data });
    } catch (err) { next(err); }
  };

  likePublished = async (req, res, next) => {
    try {
      await this.service.likePublished(req.params.shareCode);
      res.json({ ok: true });
    } catch (err) { next(err); }
  };

  // ---- Asset library endpoints ----
  listThemes = async (_req, res, next) => {
    try { res.json({ ok: true, themes: this.service.listThemes() }); } catch (err) { next(err); }
  };
  listScenarios = async (_req, res, next) => {
    try { res.json({ ok: true, scenarios: this.service.listScenarios() }); } catch (err) { next(err); }
  };
  listSnippets = async (_req, res, next) => {
    try { res.json({ ok: true, snippets: this.service.listSnippets() }); } catch (err) { next(err); }
  };
  listNodePresets = async (_req, res, next) => {
    try { res.json({ ok: true, nodePresets: this.service.listNodePresets() }); } catch (err) { next(err); }
  };
  searchAssetLibrary = async (req, res, next) => {
    try {
      const { text, tag, kind, limit } = req.query;
      const q = { text, tag, kind, limit: Number(limit) || undefined };
      res.json(this.service.searchAssetsLibrary(q));
    } catch (err) { next(err); }
  };
  installSnippet = async (req, res, next) => {
    try {
      const { gameId, snippetKey } = req.body || {};
      if (!gameId || !snippetKey) return res.status(400).json({ ok: false, error: 'gameId and snippetKey required' });
      const r = await this.service.installSnippet(gameId, snippetKey);
      res.status(r.ok ? 200 : 400).json(r);
    } catch (err) { next(err); }
  };

  listAssets = async (req, res, next) => {
    try {
      const { kind, tag, search } = req.query;
      const rows = await this.service.listAssets({ kind, tag, search });
      res.json({ ok: true, assets: rows, total: rows.length });
    } catch (err) { next(err); }
  };
  createAsset = async (req, res, next) => {
    try {
      const asset = req.body || {};
      const r = await this.service.addAsset(asset);
      res.status(201).json({ ok: true, ...r });
    } catch (err) { next(err); }
  };
  installAsset = async (req, res, next) => {
    try {
      await this.service.installAsset(req.params.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  };
}
