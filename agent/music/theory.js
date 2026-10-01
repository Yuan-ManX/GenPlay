/**
 * Music theory primitives for procedural composition.
 * Provides scales, chord progressions, and rhythm patterns keyed by mood and
 * genre. All values are MIDI note numbers for easy transposition.
 */

// Note name → MIDI number (octave 4 baseline).
const NOTE_OFFSETS = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function noteToMidi(note, octave) {
  return 12 * (octave + 1) + (NOTE_OFFSETS[note] ?? 0);
}

// Scale interval patterns (semitones from root).
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

// Chord progressions by mood (Roman numerals → scale degrees, 0-indexed).
export const PROGRESSIONS = {
  calm: [[0, 4, 7], [5, 9, 12], [3, 7, 10], [4, 8, 11]], // I-vi-IV-V (soft)
  intense: [[0, 4, 7], [8, 12, 15], [5, 9, 12], [7, 11, 14]], // i-VI-iv-v
  boss: [[0, 4, 7, 10], [3, 7, 10, 13], [5, 9, 12, 15], [7, 11, 14, 17]], // dim + 7ths
  menu: [[0, 4, 7], [4, 8, 11], [5, 9, 12], [3, 7, 10]], // I-IV-vi-IV
  victory: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], // I-IV-V-I
};

// Drum patterns: 16-step sequences. 1 = hit, 0 = rest.
export const DRUM_PATTERNS = {
  calm: {
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
  intense: {
    kick:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
  },
  boss: {
    kick:  [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0],
    hihat: [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
  },
  menu: {
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hihat: [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
  },
  victory: {
    kick:  [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0],
    hihat: [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
};

// Mood → tempo (BPM), scale, energy.
export const MOOD_PRESETS = {
  calm:    { tempo: 72,  scale: 'pentatonic_major', energy: 0.3 },
  intense: { tempo: 160, scale: 'minor',            energy: 0.85 },
  boss:    { tempo: 180, scale: 'harmonic_minor',   energy: 1.0 },
  menu:    { tempo: 96,  scale: 'major',            energy: 0.4 },
  victory: { tempo: 128, scale: 'major',            energy: 0.7 },
};

// Genre → default mood mapping.
export const GENRE_MOOD_DEFAULTS = {
  shooter: 'intense', platformer: 'calm', rpg: 'menu',
  puzzle: 'calm', tower: 'intense', racing: 'intense',
  rhythm: 'menu', roguelike: 'boss', adventure: 'calm',
  battle: 'boss', snake: 'calm', breakout: 'intense',
  maze: 'calm', deckbuilder: 'menu', metroidvania: 'intense',
  idle: 'calm', sandbox: 'calm', visual_novel: 'calm',
  auto_battler: 'boss',
};

// Note name labels for display.
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert a MIDI number to a note name + octave string.
 */
export function midiToNoteName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}

/**
 * Build a scale starting from a root MIDI note.
 * Returns an array of MIDI numbers spanning ~2 octaves.
 */
export function buildScale(rootMidi, scaleName, octaves = 2) {
  const intervals = SCALES[scaleName] || SCALES.major;
  const notes = [];
  for (let o = 0; o < octaves; o++) {
    for (const iv of intervals) notes.push(rootMidi + o * 12 + iv);
  }
  notes.push(rootMidi + octaves * 12); // octave root
  return notes;
}

/**
 * Map a scale degree (0-6) to a MIDI note within the scale array.
 * Handles octave wrapping when degree exceeds scale length.
 */
export function scaleDegreeToNote(scale, degree) {
  if (!scale.length) return scale[0];
  const idx = ((degree % scale.length) + scale.length) % scale.length;
  const octaveShift = Math.floor(degree / scale.length) * 12;
  return scale[idx] + octaveShift;
}

/**
 * Pick a pseudo-random index from an array using a seed.
 */
export function seededPick(seed, arr) {
  if (!arr.length) return null;
  const x = Math.sin(seed) * 10000;
  const r = x - Math.floor(x);
  return arr[Math.floor(r * arr.length)];
}
