/**
 * game_analytics - AI-native player behavior simulation & telemetry.
 *
 * Generates a synthetic but genre-aware analytics report for a game:
 *   - Retention curve (D1 / D7 / D30) modeled from genre baseline + config
 *   - Session length distribution (histogram buckets)
 *   - Difficulty heatmap across level/stage indices
 *   - Drop-off points (where players churn)
 *   - LLM-generated improvement suggestions (rule fallback when no key)
 *
 * The simulation is deterministic per gameId+seed so repeated runs are
 * comparable. The analytics payload is persisted into game.meta.analytics
 * so the studio's analytics tab can render charts without re-running.
 */

// Genre baselines drive the synthetic retention curve.
// Values are reasonable industry-shaped defaults, not scraped from any
// external product. They give the agent a sensible starting model that
// the LLM can later refine when an API key is configured.
const GENRE_BASELINES = {
  shooter:       { d1: 0.42, d7: 0.18, d30: 0.07, medianSessionMin: 14, difficultySlope: 1.15 },
  adventure:     { d1: 0.38, d7: 0.20, d30: 0.09, medianSessionMin: 22, difficultySlope: 1.05 },
  rpg:           { d1: 0.50, d7: 0.28, d30: 0.14, medianSessionMin: 35, difficultySlope: 1.08 },
  puzzle:        { d1: 0.35, d7: 0.15, d30: 0.05, medianSessionMin: 10, difficultySlope: 1.20 },
  battle:        { d1: 0.45, d7: 0.22, d30: 0.08, medianSessionMin: 12, difficultySlope: 1.18 },
  racing:        { d1: 0.40, d7: 0.17, d30: 0.06, medianSessionMin: 11, difficultySlope: 1.12 },
  simulation:    { d1: 0.48, d7: 0.26, d30: 0.12, medianSessionMin: 28, difficultySlope: 1.02 },
  platformer:    { d1: 0.36, d7: 0.16, d30: 0.05, medianSessionMin: 13, difficultySlope: 1.22 },
  tower:         { d1: 0.44, d7: 0.24, d30: 0.10, medianSessionMin: 19, difficultySlope: 1.10 },
  snake:         { d1: 0.30, d7: 0.10, d30: 0.03, medianSessionMin: 7,  difficultySlope: 1.30 },
  breakout:      { d1: 0.32, d7: 0.12, d30: 0.04, medianSessionMin: 8,  difficultySlope: 1.25 },
  maze:          { d1: 0.33, d7: 0.13, d30: 0.04, medianSessionMin: 9,  difficultySlope: 1.22 },
  rhythm:        { d1: 0.41, d7: 0.21, d30: 0.09, medianSessionMin: 16, difficultySlope: 1.15 },
  roguelike:     { d1: 0.52, d7: 0.31, d30: 0.16, medianSessionMin: 26, difficultySlope: 1.18 },
  deckbuilder:   { d1: 0.50, d7: 0.30, d30: 0.15, medianSessionMin: 24, difficultySlope: 1.12 },
  metroidvania:  { d1: 0.47, d7: 0.27, d30: 0.13, medianSessionMin: 30, difficultySlope: 1.08 },
  idle:          { d1: 0.55, d7: 0.34, d30: 0.20, medianSessionMin: 9,  difficultySlope: 1.01 },
  sandbox:       { d1: 0.46, d7: 0.25, d30: 0.11, medianSessionMin: 32, difficultySlope: 1.04 },
  visual_novel:  { d1: 0.49, d7: 0.26, d30: 0.10, medianSessionMin: 27, difficultySlope: 1.00 },
  auto_battler:  { d1: 0.43, d7: 0.22, d30: 0.08, medianSessionMin: 18, difficultySlope: 1.14 },
};

function hashSeed(str = '') {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function buildRetention(baseline, rng) {
  // Curve from D0 (100%) down to D30 using baseline anchor points with
  // light jitter so each game gets a distinct but reproducible shape.
  const jitter = (v) => clamp(v + (rng() - 0.5) * 0.04, 0.02, 0.98);
  const d1 = jitter(baseline.d1);
  const d7 = jitter(baseline.d7);
  const d30 = jitter(baseline.d30);
  const points = [{ day: 0, rate: 1.0 }];
  const sampleDays = [1, 2, 3, 7, 14, 21, 30];
  const anchors = { 1: d1, 7: d7, 30: d30 };
  for (const d of sampleDays) {
    if (anchors[d] != null) {
      points.push({ day: d, rate: +anchors[d].toFixed(4) });
    } else {
      // Interpolate on log scale between known anchors.
      const prev = [...points].reverse().find((p) => p.day < d);
      const nextDay = sampleDays.find((sd) => sd > d && anchors[sd] != null);
      const next = nextDay != null ? { day: nextDay, rate: anchors[nextDay] } : null;
      let rate;
      if (prev && next) {
        const t = (Math.log(d) - Math.log(prev.day)) / (Math.log(next.day) - Math.log(prev.day));
        rate = prev.rate * Math.pow(next.rate / prev.rate, t);
      } else if (prev) {
        rate = prev.rate * 0.85;
      } else {
        rate = d1;
      }
      points.push({ day: d, rate: +clamp(rate, 0.01, 1).toFixed(4) });
    }
  }
  return { d1: +d1.toFixed(4), d7: +d7.toFixed(4), d30: +d30.toFixed(4), points };
}

function buildSessionHistogram(medianMin, rng) {
  // Build 8 buckets around the median session length.
  const buckets = [];
  const lo = Math.max(1, Math.floor(medianMin * 0.25));
  const hi = Math.ceil(medianMin * 3);
  const step = Math.max(1, Math.round((hi - lo) / 7));
  let peak = -1, peakVal = -1;
  for (let i = 0; i < 8; i++) {
    const start = lo + i * step;
    const end = start + step;
    const dist = Math.abs((start + end) / 2 - medianMin);
    const val = Math.exp(-(dist * dist) / (2 * Math.pow(medianMin * 0.6, 2))) * (0.9 + rng() * 0.2);
    const pct = +clamp(val, 0.02, 0.6).toFixed(4);
    buckets.push({ rangeMin: start, rangeMax: end, share: pct });
    if (pct > peakVal) { peakVal = pct; peak = i; }
  }
  const total = buckets.reduce((s, b) => s + b.share, 0) || 1;
  for (const b of buckets) b.share = +(b.share / total).toFixed(4);
  return { buckets, peakRangeMin: buckets[peak]?.rangeMin || medianMin, medianMin };
}

function buildDifficultyHeatmap(game, baseline, rng) {
  // Use level count from config or default to 10 stages.
  const levelCount = Math.max(3, Math.min(40,
    game.config?.levels?.length ||
    game.config?.stages?.length ||
    game.config?.levelCount ||
    10));
  const cells = [];
  const slope = baseline.difficultySlope;
  for (let i = 0; i < levelCount; i++) {
    const t = levelCount > 1 ? i / (levelCount - 1) : 0;
    // Difficulty grows along the slope; mortality = 1 - retention^n.
    const difficulty = +clamp(Math.pow(t, 1.1) * slope, 0.05, 0.98).toFixed(3);
    const mortality = +clamp(0.15 + Math.pow(t, 1.4) * 0.7 + (rng() - 0.5) * 0.05, 0.02, 0.97).toFixed(3);
    cells.push({ level: i + 1, difficulty, mortality });
  }
  return { cells, levelCount };
}

function findDropOffs(heatmap, retention) {
  const drops = [];
  const cells = heatmap.cells;
  for (let i = 1; i < cells.length; i++) {
    const delta = cells[i].mortality - cells[i - 1].mortality;
    if (delta > 0.08) {
      drops.push({ level: cells[i].level, severity: +delta.toFixed(3), kind: 'mortality-spike' });
    }
  }
  // Add an overall D1 drop signal when retention collapses early.
  if (retention.d1 < 0.35) {
    drops.unshift({ level: 1, severity: +(1 - retention.d1).toFixed(3), kind: 'first-day-churn' });
  }
  return drops;
}

function ruleSuggestions(report) {
  const tips = [];
  if (report.retention.d1 < 0.35) {
    tips.push({ area: 'onboarding', severity: 'high', tip: '首日留存偏低，建议加强前 90 秒引导教程与首关爽感反馈。' });
  }
  if (report.retention.d7 < 0.15) {
    tips.push({ area: 'mid-term', severity: 'high', tip: '七日留存不足，考虑加入每日任务、连续登录奖励与解锁节奏曲线。' });
  }
  if (report.sessionHistogram.peakRangeMin < 5) {
    tips.push({ area: 'session-length', severity: 'medium', tip: '会话峰值过短，加入循环挑战或元进度系统延长单局。' });
  }
  for (const d of report.dropOffs) {
    if (d.severity > 0.15) {
      tips.push({ area: `level-${d.level}`, severity: d.severity > 0.25 ? 'high' : 'medium', tip: `第 ${d.level} 关流失激增，检查难度曲线与生命补给节奏。` });
    }
  }
  if (!tips.length) {
    tips.push({ area: 'overall', severity: 'low', tip: '当前指标健康，建议持续 A/B 测试新主题与场景以扩张受众。' });
  }
  return tips;
}

async function llmSuggestions(provider, game, report) {
  if (!provider?.enabled) return null;
  try {
    const schema = {
      type: 'object',
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              area: { type: 'string' },
              severity: { type: 'string', enum: ['low', 'medium', 'high'] },
              tip: { type: 'string' },
              expectedLift: { type: 'string', description: 'Estimated retention lift, e.g. "+3% D7"' },
            },
            required: ['area', 'severity', 'tip'],
          },
        },
        summary: { type: 'string' },
      },
      required: ['suggestions'],
    };
    const sys = [
      'You are GenPlay gameplay analyst. Given a synthetic telemetry report and game metadata,',
      'propose 3-6 concrete, prioritized improvements. Be specific to the genre and the numbers shown.',
      'Each suggestion must include area, severity (low/medium/high), a one-sentence tip, and expectedLift.',
    ].join('\n');
    const prompt = JSON.stringify({
      game: { name: game.name, genre: game.genre, description: game.description },
      report,
    });
    const llm = await provider.json({ systemPrompt: sys, userMessage: prompt, schema, temperature: 0.5 });
    if (Array.isArray(llm?.suggestions) && llm.suggestions.length) {
      return { suggestions: llm.suggestions, summary: llm.summary || 'LLM 分析完成' };
    }
    return null;
  } catch (_) {
    return null;
  }
}

export function gameAnalyticsTool(services = {}) {
  const { gameService, provider } = services;
  return {
    name: 'game_analytics',
    description:
      'Run AI-native player behavior simulation on a game: retention curve (D1/D7/D30), session length histogram, difficulty heatmap, drop-off points, and improvement suggestions. Persisted into game.meta.analytics.',
    parameters: {
      type: 'object',
      required: ['gameId'],
      properties: {
        gameId: { type: 'string', description: 'Target game ID' },
        seed: { type: 'integer', description: 'Optional deterministic seed for reproducible simulation' },
        useLlm: { type: 'boolean', description: 'Whether to use LLM for improvement suggestions (default true)' },
      },
    },
    async execute({ gameId, seed, useLlm = true }) {
      if (!gameService) return { ok: false, error: 'Game service unavailable' };
      if (!gameId) return { ok: false, error: 'gameId required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: 'Game not found', summary: '分析失败：游戏不存在' };

      const baseline = GENRE_BASELINES[game.genre] || GENRE_BASELINES.adventure;
      const seedNum = (seed != null && Number.isFinite(seed))
        ? (seed >>> 0)
        : hashSeed(gameId + '|' + (game.updatedAt || game.id || ''));
      const rng = mulberry32(seedNum);

      const retention = buildRetention(baseline, rng);
      const sessionHistogram = buildSessionHistogram(baseline.medianSessionMin, rng);
      const difficultyHeatmap = buildDifficultyHeatmap(game, baseline, rng);
      const dropOffs = findDropOffs(difficultyHeatmap, retention);

      const baseReport = {
        gameId,
        generatedAt: new Date().toISOString(),
        genre: game.genre,
        seed: seedNum,
        retention,
        sessionHistogram,
        difficultyHeatmap,
        dropOffs,
        baseline,
      };

      // Suggestions: prefer LLM, fall back to rule-based.
      let suggestions;
      let suggestionSource = 'rule';
      if (useLlm) {
        const llmRes = await llmSuggestions(provider, game, baseReport);
        if (llmRes) {
          suggestions = llmRes.suggestions;
          suggestionSource = 'llm';
          baseReport.summary = llmRes.summary;
        }
      }
      if (!suggestions) suggestions = ruleSuggestions(baseReport);
      baseReport.suggestions = suggestions;
      baseReport.suggestionSource = suggestionSource;

      // Persist into meta.analytics (keep latest 8 reports).
      const meta = { ...(game.meta || {}) };
      const history = (meta.analytics?.history || []).concat(baseReport).slice(-8);
      meta.analytics = { latest: baseReport, history };
      const updated = await gameService.update(gameId, { meta });

      return {
        ok: true,
        summary: `已为《${game.name}》生成玩家行为分析（D1 ${Math.round(retention.d1 * 100)}% / D7 ${Math.round(retention.d7 * 100)}% / D30 ${Math.round(retention.d30 * 100)}%），识别 ${dropOffs.length} 个流失点，提出 ${suggestions.length} 条改进建议`,
        report: baseReport,
        game: updated,
        editorActions: [
          { type: 'studio:analytics-ready', payload: { gameId, report: baseReport } },
          { type: 'studio:open-tab', payload: { tab: 'analytics' } },
        ],
      };
    },
  };
}
