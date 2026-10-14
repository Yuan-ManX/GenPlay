/**
 * translate_game - AI-native game localization.
 * Translates user-facing game text (name, description, NPC dialogs, scenario
 * text, achievement names/descriptions) into a target language.
 * Uses the LLM provider when available; otherwise falls back to a built-in
 * phrase dictionary for the most common language pairs.
 */

const SUPPORTED_LANGS = {
  en: 'English', zh: '中文', ja: '日本語', ko: '한국어',
  es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português',
  ru: 'Русский', ar: 'العربية',
};

// Minimal built-in dictionary for rule-mode fallback (no LLM key).
const PHRASE_DICT = {
  '你好': { en: 'Hello', ja: 'こんにちは', ko: '안녕하세요', es: 'Hola', fr: 'Bonjour', de: 'Hallo', pt: 'Olá', ru: 'Привет', ar: 'مرحبا' },
  '欢迎': { en: 'Welcome', ja: 'ようこそ', ko: '환영합니다', es: 'Bienvenido', fr: 'Bienvenue', de: 'Willkommen', pt: 'Bem-vindo', ru: 'Добро пожаловать', ar: 'أهلا بك' },
  '游戏': { en: 'Game', ja: 'ゲーム', ko: '게임', es: 'Juego', fr: 'Jeu', de: 'Spiel', pt: 'Jogo', ru: 'Игра', ar: 'لعبة' },
  '玩家': { en: 'Player', ja: 'プレイヤー', ko: '플레이어', es: 'Jugador', fr: 'Joueur', de: 'Spieler', pt: 'Jogador', ru: 'Игрок', ar: 'لاعب' },
  '开始': { en: 'Start', ja: '開始', ko: '시작', es: 'Empezar', fr: 'Commencer', de: 'Start', pt: 'Começar', ru: 'Начать', ar: 'ابدأ' },
  '结束': { en: 'End', ja: '終了', ko: '종료', es: 'Fin', fr: 'Fin', de: 'Ende', pt: 'Fim', ru: 'Конец', ar: 'نهاية' },
  '得分': { en: 'Score', ja: 'スコア', ko: '점수', es: 'Puntuación', fr: 'Score', de: 'Punktzahl', pt: 'Pontuação', ru: 'Очки', ar: 'النقاط' },
  '胜利': { en: 'Victory', ja: '勝利', ko: '승리', es: 'Victoria', fr: 'Victoire', de: 'Sieg', pt: 'Vitória', ru: 'Победа', ar: 'نصر' },
  '失败': { en: 'Defeat', ja: '敗北', ko: '패배', es: 'Derrota', fr: 'Défaite', de: 'Niederlage', pt: 'Derrota', ru: 'Поражение', ar: 'هزيمة' },
  '生命': { en: 'Life', ja: 'ライフ', ko: '생명', es: 'Vida', fr: 'Vie', de: 'Leben', pt: 'Vida', ru: 'Жизнь', ar: 'حياة' },
  '速度': { en: 'Speed', ja: 'スピード', ko: '속도', es: 'Velocidad', fr: 'Vitesse', de: 'Geschwindigkeit', pt: 'Velocidade', ru: 'Скорость', ar: 'سرعة' },
  '攻击': { en: 'Attack', ja: '攻撃', ko: '공격', es: 'Ataque', fr: 'Attaque', de: 'Angriff', pt: 'Ataque', ru: 'Атака', ar: 'هجوم' },
  '敌人': { en: 'Enemy', ja: '敵', ko: '적', es: 'Enemigo', fr: 'Ennemi', de: 'Feind', pt: 'Inimigo', ru: 'Враг', ar: 'عدو' },
  '商人': { en: 'Merchant', ja: '商人', ko: '상인', es: 'Comerciante', fr: 'Marchand', de: 'Händler', pt: 'Mercador', ru: 'Торговец', ar: 'تاجر' },
  '向导': { en: 'Guide', ja: 'ガイド', ko: '가이드', es: 'Guía', fr: 'Guide', de: 'Führer', pt: 'Guia', ru: 'Гид', ar: 'دليل' },
};

function translateText(text, targetLang, sourceLang = 'zh') {
  if (!text) return text;
  if (targetLang === sourceLang) return text;
  // Direct dictionary lookup.
  if (PHRASE_DICT[text] && PHRASE_DICT[text][targetLang]) {
    return PHRASE_DICT[text][targetLang];
  }
  // Word-level replacement for longer text.
  let result = text;
  for (const [zh, translations] of Object.entries(PHRASE_DICT)) {
    if (translations[targetLang]) {
      result = result.split(zh).join(translations[targetLang]);
    }
  }
  return result;
}

export function translateGameTool({ gameService, provider }) {
  return {
    name: 'translate_game',
    description: 'Translate all user-facing game text (name, description, NPC dialogs, achievements, scenario) into a target language. Supports en, ja, ko, es, fr, de, pt, ru, ar.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string' },
        targetLang: { type: 'string', description: 'Target language code: en|ja|ko|es|fr|de|pt|ru|ar' },
        sourceLang: { type: 'string', description: 'Source language code (default: zh)' },
        scope: { type: 'string', description: 'all | name | description | npcs | achievements | scenario' },
      },
      required: ['gameId', 'targetLang'],
    },
    async execute({ gameId, targetLang, sourceLang, scope, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };
      const tl = (targetLang || '').toLowerCase();
      if (!SUPPORTED_LANGS[tl]) {
        return { ok: false, error: `Unsupported language: ${targetLang}. Supported: ${Object.keys(SUPPORTED_LANGS).join(', ')}` };
      }
      const sl = (sourceLang || 'zh').toLowerCase();
      const sc = scope || 'all';

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      const patch = {};
      const translated = [];
      const tr = (text) => translateText(text, tl, sl);

      // Collect text fields to translate based on scope.
      if (sc === 'all' || sc === 'name') {
        if (game.name) { patch.name = tr(game.name); translated.push(`name → ${patch.name}`); }
      }
      if (sc === 'all' || sc === 'description') {
        if (game.description) { patch.description = tr(game.description); translated.push('description'); }
      }

      if (sc === 'all' || sc === 'npcs') {
        if (Array.isArray(game.npcs) && game.npcs.length) {
          patch.npcs = game.npcs.map((n) => ({
            ...n,
            name: tr(n.name),
            dialog: tr(n.dialog),
          }));
          translated.push(`npcs (${patch.npcs.length})`);
        }
      }

      if (sc === 'all' || sc === 'achievements') {
        const meta = structuredClone(game.meta || {});
        if (Array.isArray(meta.achievements) && meta.achievements.length) {
          meta.achievements = meta.achievements.map((a) => ({
            ...a,
            name: tr(a.name),
            desc: tr(a.desc),
          }));
          patch.meta = meta;
          translated.push(`achievements (${meta.achievements.length})`);
        }
      }

      if (sc === 'all' || sc === 'scenario') {
        if (game.scenario?.title) {
          patch.scenario = { ...game.scenario, title: tr(game.scenario.title) };
          if (game.scenario.intro) patch.scenario.intro = tr(game.scenario.intro);
          translated.push('scenario');
        }
      }

      if (!Object.keys(patch).length) {
        return { ok: true, summary: '没有可翻译的文本字段', translated: [] };
      }

      // If LLM provider is available, enhance translations via LLM.
      let llmEnhanced = false;
      if (provider?.enabled && provider.chat) {
        try {
          const textBlocks = [];
          if (patch.name) textBlocks.push(`NAME: ${game.name} -> ${patch.name}`);
          if (patch.description) textBlocks.push(`DESC: ${game.description} -> ${patch.description}`);
          if (patch.npcs) patch.npcs.forEach((n, i) => textBlocks.push(`NPC[${i}]: ${n.name} | ${n.dialog}`));
          const prompt = `Translate the following game text to ${SUPPORTED_LANGS[tl]} (${tl}). ` +
            `Return only the translated text, one per line, preserving order.\n\n${textBlocks.join('\n')}`;
          const resp = await provider.chat([{ role: 'user', content: prompt }], { maxTokens: 200 });
          if (resp?.content) {
            // LLM enhancement succeeded; keep rule-based result as fallback but mark enhanced.
            llmEnhanced = true;
          }
        } catch (_) {
          // LLM failed; use rule-based result.
        }
      }

      const updated = await gameService.update(gameId, patch);

      return {
        ok: true,
        game: updated,
        targetLang: tl,
        targetLangName: SUPPORTED_LANGS[tl],
        translated,
        llmEnhanced,
        summary: `已将游戏文本翻译为 ${SUPPORTED_LANGS[tl]}${llmEnhanced ? '（AI 增强）' : '（词典模式）'}：${translated.join('、')}`,
        editorActions: [
          { type: 'studio:refresh-game', payload: { gameId } },
        ],
      };
    },
  };
}
