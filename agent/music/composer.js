/**
 * Procedural music composer engine.
 * Generates multi-track music (melody + bass + drums) from a mood preset.
 * Uses a seeded PRNG for deterministic output so the same seed + mood always
 * produces the same track — useful for replay and version consistency.
 *
 * Output note format: { note: 'C4', start: 0.5, duration: 0.25, velocity: 0.8 }
 * Drum hit format:    { hit: 'kick', start: 0.5, duration: 0.125 }
 */

import {
  MOOD_PRESETS, DRUM_PATTERNS, PROGRESSIONS,
  buildScale, scaleDegreeToNote, midiToNoteName, seededPick,
} from './theory.js';

// Deterministic PRNG: mulberry32.
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a melody line over a chord progression.
 * Uses a random-walk over the scale with occasional leaps for interest.
 */
function generateMelody(scale, progression, rng, bars, beatsPerBar) {
  const notes = [];
  let degree = 0; // start on root
  const totalBeats = bars * beatsPerBar;
  for (let beat = 0; beat < totalBeats; beat++) {
    const restChance = rng();
    if (restChance < 0.2) continue; // 20% rest for breathing room
    // Random walk: step up/down/skip/stay.
    const move = rng();
    if (move < 0.35) degree += 1;
    else if (move < 0.55) degree -= 1;
    else if (move < 0.7) degree += 2;
    else if (move < 0.8) degree -= 2;
    // Clamp to reasonable range.
    if (degree < 0) degree = 0;
    if (degree > 10) degree = 10;
    const midi = scaleDegreeToNote(scale, degree);
    const dur = rng() < 0.3 ? 0.5 : 0.25;
    notes.push({
      note: midiToNoteName(midi),
      start: beat * 0.25,
      duration: dur,
      velocity: 0.6 + rng() * 0.3,
    });
  }
  return notes;
}

/**
 * Generate a bass line following the chord progression roots.
 * Plays one note per bar (or two for faster tempos).
 */
function generateBass(progression, rootMidi, rng, bars) {
  const notes = [];
  const bassMidi = rootMidi - 24; // two octaves down
  for (let bar = 0; bar < bars; bar++) {
    const chord = progression[bar % progression.length];
    const bassNote = bassMidi + chord[0];
    notes.push({
      note: midiToNoteName(bassNote),
      start: bar * 4 * 0.25,
      duration: 1.0,
      velocity: 0.7,
    });
    // Add a fifth on beat 3 for movement.
    if (rng() < 0.6) {
      const fifth = bassMidi + chord[2] || bassMidi + 7;
      notes.push({
        note: midiToNoteName(fifth),
        start: bar * 4 * 0.25 + 2 * 0.25,
        duration: 1.0,
        velocity: 0.6,
      });
    }
  }
  return notes;
}

/**
 * Generate drum hits from a 16-step pattern, looped over bars.
 */
function generateDrums(pattern, bars, rng) {
  const hits = [];
  const stepDur = 0.25; // each 16th note = 0.25 beat
  for (let bar = 0; bar < bars; bar++) {
    const barOffset = bar * 16 * stepDur;
    for (const [voice, steps] of Object.entries(pattern)) {
      for (let i = 0; i < steps.length; i++) {
        if (steps[i]) {
          hits.push({
            hit: voice,
            start: barOffset + i * stepDur,
            duration: 0.125,
            velocity: 0.5 + rng() * 0.3,
          });
        }
      }
    }
  }
  return hits;
}

/**
 * Compose a single track.
 * @param {object} opts - { mood, seed, bars, rootMidi }
 * @returns {object} - { name, mood, tempo, key, scaleName, bars, duration, tracks }
 */
export function composeTrack({ mood = 'calm', seed = 42, bars = 4, rootMidi = 60 }) {
  const preset = MOOD_PRESETS[mood] || MOOD_PRESETS.calm;
  const scaleName = preset.scale;
  const scale = buildScale(rootMidi, scaleName, 2);
  const progression = PROGRESSIONS[mood] || PROGRESSIONS.calm;
  const drumPattern = DRUM_PATTERNS[mood] || DRUM_PATTERNS.calm;
  const rng = mulberry32(seed);
  const beatsPerBar = 4;

  const melody = generateMelody(scale, progression, rng, bars, beatsPerBar);
  const bass = generateBass(progression, rootMidi, rng, bars);
  const drums = generateDrums(drumPattern, bars, rng);

  const tempo = preset.tempo;
  const totalBeats = bars * beatsPerBar;
  const durationSec = Math.round((totalBeats / tempo) * 60);

  const keyName = `${midiToNoteName(rootMidi).replace(/\d+$/, '')}_${scaleName}`;

  return {
    name: MOOD_NAMES[mood] || `${mood} 主题`,
    mood,
    tempo,
    key: keyName,
    scaleName,
    bars,
    duration: durationSec,
    tracks: {
      melody,
      bass,
      drums,
    },
  };
}

const MOOD_NAMES = {
  calm: '宁静探索',
  intense: '激战时刻',
  boss: '终焉之战',
  menu: '主菜单',
  victory: '凯旋',
};

/**
 * Compose a multi-track album covering several moods for one game.
 * Generates one track per mood in the list, all sharing the same root key
 * so the album feels cohesive.
 */
export function composeAlbum({ moods = ['calm', 'intense', 'victory'], seed = 42, rootMidi = 60, barsPerTrack = 4 }) {
  return moods.map((mood, i) => composeTrack({
    mood,
    seed: seed + i * 1000,
    bars: barsPerTrack,
    rootMidi,
  }));
}
