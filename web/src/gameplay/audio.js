/**
 * Runtime audio layer: procedural soundtrack playback and synthesized SFX.
 *
 * Shared by the studio preview and the exported single-file playable build
 * (the builder concatenates this module into the exported script scope), so a
 * game sounds identical in both places.
 *
 * Pure helpers (noteToFreq / buildTrackEvents / pickTrackForPhase / SFX_PATTERNS)
 * contain no DOM or WebAudio access and run in Node for unit tests. The
 * createAudioRuntime() factory no-ops when AudioContext is unavailable.
 */

const NOTE_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function fxClamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/** Convert a scientific note name (e.g. "A4", "F#5") to a frequency in Hz. */
export function noteToFreq(note) {
  const m = String(note || '').match(/^([A-G])([#b]?)(\d+)?$/);
  if (!m) return 0;
  const base = NOTE_SEMITONES[m[1]];
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const octave = m[3] !== undefined ? Number(m[3]) : 4;
  const midi = (octave + 1) * 12 + base + accidental;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Sound-effect recipes triggered by gameplay events.
 * Types: blip (single tone), sweep (pitch glide), noise (percussive burst),
 * arp (ascending note run).
 */
export const SFX_PATTERNS = {
  onJump: { type: 'sweep', from: 330, to: 720, dur: 0.14, gain: 0.32 },
  onShoot: { type: 'blip', freq: 900, dur: 0.08, gain: 0.26 },
  onHit: { type: 'noise', dur: 0.14, gain: 0.42 },
  onPickup: { type: 'arp', notes: ['G5', 'B5', 'D6'], step: 0.05, gain: 0.34 },
  onWin: { type: 'arp', notes: ['C5', 'E5', 'G5', 'C6'], step: 0.12, gain: 0.45 },
  onLose: { type: 'sweep', from: 420, to: 130, dur: 0.5, gain: 0.36 },
  onButton: { type: 'blip', freq: 660, dur: 0.06, gain: 0.22 },
};

export const SUPPORTED_SFX = Object.keys(SFX_PATTERNS);

/**
 * Flatten a composed track (see agent/music/composer.js) into timed note
 * events. Composer note `start`/`duration` are expressed in beats, so the
 * tempo converts them to seconds. Returns { events, duration }.
 */
export function buildTrackEvents(track, options = {}) {
  if (!track || !track.tracks) return { events: [], duration: 0 };
  const tempo = fxClamp(Number(track.tempo) || 100, 30, 260);
  const speed = fxClamp(Number(options.speed) || 1, 0.2, 4);
  const secPerBeat = 60 / tempo / speed;
  const events = [];

  const pushNotes = (notes, voice) => {
    for (const n of notes || []) {
      const freq = noteToFreq(n.note);
      if (!freq) continue;
      events.push({
        time: Math.max(0, Number(n.start) || 0) * secPerBeat,
        dur: Math.max(0.04, (Number(n.duration) || 0.25) * secPerBeat),
        freq,
        gain: fxClamp(Number(n.velocity ?? 0.7), 0, 1) * 0.55,
        voice,
      });
    }
  };
  pushNotes(track.tracks.melody, 'melody');
  pushNotes(track.tracks.bass, 'bass');

  for (const h of track.tracks.drums || []) {
    events.push({
      time: Math.max(0, Number(h.start) || 0) * secPerBeat,
      dur: Math.max(0.03, (Number(h.duration) || 0.125) * secPerBeat),
      drum: h.hit === 'snare' || h.hit === 'hihat' ? h.hit : 'kick',
      gain: fxClamp(Number(h.velocity ?? 0.6), 0, 1) * 0.5,
      voice: 'drum',
    });
  }

  events.sort((a, b) => a.time - b.time);
  const duration = events.reduce((max, e) => Math.max(max, e.time + e.dur), 0);
  return { events, duration };
}

/**
 * Pick a composed track for a gameplay phase.
 * start -> menu/calm, battle -> intense/boss, victory -> victory/menu.
 */
export function pickTrackForPhase(composed, phase = 'start') {
  const list = Array.isArray(composed) ? composed.filter((t) => t && t.tracks) : [];
  if (!list.length) return null;
  const wanted = phase === 'victory'
    ? ['victory', 'menu']
    : phase === 'battle'
      ? ['intense', 'boss', 'menu']
      : ['menu', 'calm', 'intense'];
  for (const mood of wanted) {
    const found = list.find((t) => (t.mood || '') === mood);
    if (found) return found;
  }
  return list[0];
}

/** Choose the track whose mood best matches a genre default. */
export function pickTrackForGenre(composed, genre) {
  const list = Array.isArray(composed) ? composed.filter((t) => t && t.tracks) : [];
  if (!list.length) return null;
  const battle = ['shooter', 'tower', 'racing', 'battle', 'roguelike', 'auto_battler', 'breakout'];
  return pickTrackForPhase(list, battle.includes(String(genre || '').toLowerCase()) ? 'battle' : 'start');
}

/**
 * Create a WebAudio-backed runtime. Every method is safe to call when no
 * AudioContext exists (Node tests, unsupported browsers).
 */
export function createAudioRuntime() {
  const AC = typeof window !== 'undefined'
    ? (window.AudioContext || window.webkitAudioContext)
    : null;

  let ctx = null;
  let master = null;
  let volume = 0.7;
  let muted = false;
  let loopTimer = null;
  let activeNodes = [];

  const ensure = () => {
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
    return ctx;
  };

  const clearNodes = () => {
    for (const node of activeNodes) {
      try { node.stop ? node.stop() : node.disconnect(); } catch (_) { /* already stopped */ }
    }
    activeNodes = [];
    if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
  };

  const tone = ({ freq, dur, gain, when = 0, slideTo, type = 'sine' }) => {
    const c = ensure();
    if (!c) return;
    const start = c.currentTime + Math.max(0, when);
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + dur);
    env.gain.setValueAtTime(0, start);
    env.gain.linearRampToValueAtTime(Math.max(0.0001, gain), start + Math.min(0.03, dur * 0.4));
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(env);
    env.connect(master);
    osc.start(start);
    osc.stop(start + dur + 0.02);
    activeNodes.push(osc);
  };

  const noise = ({ dur, gain, when = 0 }) => {
    const c = ensure();
    if (!c) return;
    const length = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = c.createBufferSource();
    const env = c.createGain();
    src.buffer = buffer;
    env.gain.value = gain;
    src.connect(env);
    env.connect(master);
    src.start(c.currentTime + Math.max(0, when));
    activeNodes.push(src);
  };

  const drum = (kind, when, gain) => {
    if (kind === 'kick') {
      tone({ freq: 120, slideTo: 45, dur: 0.16, gain: gain * 1.3, when, type: 'triangle' });
    } else if (kind === 'snare') {
      noise({ dur: 0.09, gain: gain * 0.9, when });
      tone({ freq: 220, dur: 0.05, gain: gain * 0.35, when });
    } else {
      noise({ dur: 0.045, gain: gain * 0.32, when });
    }
  };

  /** Schedule a full composed track. Loops by re-scheduling after it ends. */
  const playTrack = (track, options = {}) => {
    const c = ensure();
    if (!c || !track) return;
    clearNodes();
    const speed = Number(options.speed) || 1;
    const loop = options.loop !== false;
    const { events, duration } = buildTrackEvents(track, { speed });
    for (const e of events) {
      if (e.voice === 'drum') drum(e.drum, e.time, e.gain);
      else if (e.voice === 'bass') tone({ freq: e.freq, dur: e.dur, gain: e.gain, when: e.time, type: 'triangle' });
      else tone({ freq: e.freq, dur: Math.min(e.dur, 0.6), gain: e.gain, when: e.time, type: 'sine' });
    }
    if (loop && duration > 0.6) {
      const reloop = () => { playTrack(track, { speed, loop }); };
      loopTimer = setTimeout(reloop, Math.max(600, duration * 1000));
    }
  };

  /** Fire a synthesized sound effect by trigger name. */
  const playSfx = (trigger) => {
    const c = ensure();
    if (!c) return;
    const pat = SFX_PATTERNS[trigger] || SFX_PATTERNS.onButton;
    if (pat.type === 'blip') {
      tone({ freq: pat.freq, dur: pat.dur, gain: pat.gain, type: 'square' });
    } else if (pat.type === 'sweep') {
      tone({ freq: pat.from, slideTo: pat.to, dur: pat.dur, gain: pat.gain, type: 'sawtooth' });
    } else if (pat.type === 'noise') {
      noise({ dur: pat.dur, gain: pat.gain });
    } else if (pat.type === 'arp') {
      pat.notes.forEach((n, i) => {
        tone({ freq: noteToFreq(n), dur: pat.step * 1.8, gain: pat.gain, when: i * pat.step, type: 'triangle' });
      });
    }
  };

  const setVolume = (v) => {
    volume = fxClamp(Number(v) || 0, 0, 1);
    if (master) master.gain.value = muted ? 0 : volume;
  };
  const setMuted = (v) => {
    muted = Boolean(v);
    if (master) master.gain.value = muted ? 0 : volume;
  };
  const stop = () => clearNodes();

  return {
    unlock: ensure,
    playTrack,
    playSfx,
    setVolume,
    setMuted,
    isMuted: () => muted,
    getVolume: () => volume,
    stop,
  };
}
