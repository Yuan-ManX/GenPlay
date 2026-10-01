/**
 * compose_music - Procedurally generate background music for a game.
 * Uses a built-in composition engine (agent/music/composer.js) to produce
 * multi-track music (melody + bass + drums) tailored to a mood. Unlike
 * manage_audio (which manages existing audio entries), this tool CREATES
 * original music data and stores it on game.audio.composed.
 *
 * AI-native: when LLM is available, asks the model to suggest mood presets
 * and a track title; otherwise uses genre-aware defaults.
 */

import { composeAlbum, composeTrack } from '../music/composer.js';
import { MOOD_PRESETS, GENRE_MOOD_DEFAULTS } from '../music/theory.js';

// Root key per genre (C4=60 baseline). Transposes the whole track.
const GENRE_ROOTS = {
  shooter: 62, platformer: 60, rpg: 57, puzzle: 64,
  tower: 55, racing: 62, rhythm: 60, roguelike: 57,
  adventure: 60, battle: 58, snake: 64, breakout: 62,
  maze: 59, deckbuilder: 57, metroidvania: 56, idle: 60,
  sandbox: 60, visual_novel: 60, auto_battler: 55,
};

export function composeMusicTool({ gameService, provider }) {
  return {
    name: 'compose_music',
    description: 'Procedurally compose background music for a game. Generates multi-track music (melody + bass + drums) tailored to mood (calm, intense, boss, menu, victory). Creates original music data — distinct from manage_audio which manages existing audio entries.',
    parameters: {
      type: 'object',
      properties: {
        gameId: { type: 'string', description: 'Target game id' },
        moods: { type: 'array', description: 'Moods to compose: calm | intense | boss | menu | victory. Defaults to genre-appropriate set.', items: { type: 'string' } },
        mood: { type: 'string', description: 'Single mood (alternative to moods array)' },
        seed: { type: 'number', description: 'Random seed for deterministic output (default: random)' },
        bars: { type: 'number', description: 'Bars per track (default 4)' },
        rootMidi: { type: 'number', description: 'Root note as MIDI number (default: genre-based)' },
      },
      required: ['gameId'],
    },
    async execute({ gameId, moods, mood, seed, bars, rootMidi, sessionId }) {
      if (!gameService) return { ok: false, error: 'Game service not ready' };
      if (!gameId) return { ok: false, error: 'gameId is required' };

      const game = await gameService.getById(gameId);
      if (!game) return { ok: false, error: `Game not found: ${gameId}` };

      // Determine moods to compose.
      let moodList = [];
      if (Array.isArray(moods) && moods.length) moodList = moods;
      else if (mood) moodList = [mood];
      else {
        // Default: compose a 3-track album based on genre.
        const genreDefault = GENRE_MOOD_DEFAULTS[game.genre] || 'calm';
        moodList = ['menu', genreDefault, 'victory'];
      }

      // Validate moods.
      const validMoods = Object.keys(MOOD_PRESETS);
      const invalid = moodList.filter((m) => !validMoods.includes(m));
      if (invalid.length) return { ok: false, error: `Unknown mood(s): ${invalid.join(', ')}. Valid: ${validMoods.join(', ')}` };

      const useSeed = typeof seed === 'number' ? seed : Math.floor(Math.random() * 100000);
      const useBars = typeof bars === 'number' && bars > 0 ? Math.min(16, bars) : 4;
      const useRoot = typeof rootMidi === 'number' ? rootMidi : (GENRE_ROOTS[game.genre] || 60);

      // LLM: suggest track titles for personalization.
      let llmTitles = null;
      if (provider?.enabled && provider.chat) {
        try {
          const prompt = `For a ${game.genre} game with theme "${game.theme || 'default'}", suggest 3 short Chinese track names (max 4 chars each) for moods: ${moodList.join(', ')}. Format: name1, name2, name3`;
          const resp = await provider.chat([{ role: 'user', content: prompt }], { maxTokens: 60 });
          if (resp?.content) {
            llmTitles = resp.content.split(/[,，]/).map((s) => s.trim()).filter(Boolean).slice(0, moodList.length);
          }
        } catch (_) { /* fall back to default names */ }
      }

      // Compose tracks.
      const tracks = moodList.map((m, i) => {
        const track = composeTrack({
          mood: m,
          seed: useSeed + i * 1000,
          bars: useBars,
          rootMidi: useRoot,
        });
        if (llmTitles && llmTitles[i]) track.name = llmTitles[i];
        return track;
      });

      // Persist to game.audio.composed (separate from playlist managed by manage_audio).
      const audio = game.audio || {};
      audio.composed = tracks;
      const updated = await gameService.update(gameId, { audio });

      const moodLabels = moodList.map((m) => MOOD_PRESETS[m] ? m : m);
      return {
        ok: true,
        game: updated,
        tracks,
        trackCount: tracks.length,
        seed: useSeed,
        llmNamed: !!llmTitles,
        summary: `已为「${game.name}」作曲 ${tracks.length} 首（${moodList.join(' / ')}）${llmTitles ? '，AI 命名' : ''}`,
        editorActions: [{ type: 'studio:patch-music', gameId, payload: { tracks, action: 'compose' } }],
      };
    },
  };
}
