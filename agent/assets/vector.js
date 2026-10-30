/**
 * Vector asset synthesis.
 *
 * Turns an asset specification (type + palette + theme) into a real, renderable
 * SVG illustration. Everything is generated locally and deterministically from
 * a seed, so the same asset always redraws identically while different variants
 * stay visually distinct.
 */

const DEFAULTS = ['#6d28d9', '#a78bfa', '#facc15', '#f8fafc'];

function hashSeed(input) {
  const text = String(input || 'genplay');
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.,%\s]+\))$/;

function paletteOf(spec) {
  const palette = Array.isArray(spec?.palette)
    ? spec.palette.filter((c) => typeof c === 'string' && COLOR_RE.test(c.trim())).map((c) => c.trim())
    : [];
  return palette.length >= 2 ? palette : DEFAULTS;
}

function wrap(viewBox, body, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%" role="img"${extra}>${body}</svg>`;
}

/* ---------------- sprites ---------------- */

function spriteSvg(rng, palette) {
  const [a, b, c, d] = palette;
  const width = 8 + Math.round(rng() * 6);
  const nose = 4 + Math.round(rng() * 4);
  const wing = 12 + Math.round(rng() * 8);
  const bits = [];
  const accents = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < accents; i++) {
    const x = 18 + rng() * 28;
    const y = 24 + rng() * 26;
    bits.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(2 + rng() * 3).toFixed(1)}" height="${(2 + rng() * 3).toFixed(1)}" rx="1" fill="${c}" opacity="0.85"/>`);
  }
  return wrap('0 0 64 64', `
    <defs>
      <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${b}"/>
        <stop offset="100%" stop-color="${a}"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${c}" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="32" cy="58" rx="14" ry="6" fill="url(#glow)"/>
    <polygon points="32,${nose} ${32 + width},26 ${32 + width - 4},48 32,56 ${32 - width + 4},48 ${32 - width},26" fill="url(#hull)" stroke="${b}" stroke-width="1.4"/>
    <polygon points="${32 - width},30 ${32 - width - wing / 2},44 32 - width + 2,44" fill="${a}" opacity="0.85"/>
    <polygon points="${32 + width},30 ${32 + width + wing / 2},44 32 + width - 2,44" fill="${a}" opacity="0.85"/>
    <circle cx="32" cy="27" r="5.5" fill="${d}" opacity="0.92"/>
    <circle cx="32" cy="27" r="2.6" fill="${a}"/>
    <rect x="29" y="49" width="6" height="7" rx="2" fill="${c}"/>
    ${bits.join('')}
  `);
}

function characterSvg(rng, palette) {
  const [a, b, c, d] = palette;
  const headR = 12 + Math.round(rng() * 3);
  const hairStyle = Math.floor(rng() * 3);
  const hair = hairStyle === 0
    ? `<path d="M${32 - headR},18 C${32 - headR},4 ${32 + headR},4 ${32 + headR},18 Z" fill="${a}"/>`
    : hairStyle === 1
      ? `<path d="M${32 - headR},16 Q32,2 ${32 + headR},16 L${32 + headR - 3},22 Q32,10 ${32 - headR + 3},22 Z" fill="${b}"/>`
      : `<path d="M${32 - headR - 2},20 Q32,0 ${32 + headR + 2},20 L${32 + headR - 2},18 Q32,6 ${32 - headR + 2},18 Z" fill="${a}" opacity="0.9"/>`;
  const accessory = rng() > 0.55
    ? `<rect x="${32 - headR + 2}" y="${20 - headR}" width="${headR * 2 - 4}" height="5" rx="2.5" fill="${c}" opacity="0.9"/>`
    : '';
  return wrap('0 0 64 64', `
    <defs>
      <linearGradient id="cloth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${b}"/>
        <stop offset="100%" stop-color="${a}"/>
      </linearGradient>
    </defs>
    <ellipse cx="32" cy="60" rx="18" ry="4" fill="${a}" opacity="0.25"/>
    <path d="M32,34 C22,34 16,40 15,58 L49,58 C48,40 42,34 32,34 Z" fill="url(#cloth)"/>
    <path d="M32,38 L26,58 L38,58 Z" fill="${d}" opacity="0.22"/>
    <circle cx="32" cy="${20}" r="${headR}" fill="${d}" opacity="0.96"/>
    ${hair}
    ${accessory}
    <circle cx="${32 - 4.5}" cy="${21}" r="1.7" fill="${a}"/>
    <circle cx="${32 + 4.5}" cy="${21}" r="1.7" fill="${a}"/>
    <path d="M${32 - 4},${26} Q32,${29} ${32 + 4},${26}" stroke="${a}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
    <rect x="${32 - headR - 4}" y="44" width="7" height="7" rx="2" fill="${c}" opacity="0.85"/>
  `);
}

function itemSvg(rng, palette) {
  const [a, b, c, d] = palette;
  const kind = Math.floor(rng() * 2);
  if (kind === 0) {
    return wrap('0 0 64 64', `
      <defs>
        <linearGradient id="gem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${c}"/>
          <stop offset="100%" stop-color="${a}"/>
        </linearGradient>
      </defs>
      <ellipse cx="32" cy="55" rx="14" ry="5" fill="${a}" opacity="0.25"/>
      <polygon points="32,8 50,26 40,54 24,54 14,26" fill="url(#gem)" stroke="${b}" stroke-width="1.6" stroke-linejoin="round"/>
      <polygon points="32,8 38,26 26,26" fill="${d}" opacity="0.35"/>
      <polygon points="14,26 26,26 24,54 22,54" fill="${d}" opacity="0.16"/>
      <polygon points="50,26 38,26 38,44" fill="${b}" opacity="0.35"/>
      <circle cx="27" cy="20" r="2" fill="${d}" opacity="0.9"/>
    `);
  }
  return wrap('0 0 64 64', `
    <ellipse cx="32" cy="56" rx="13" ry="4" fill="${a}" opacity="0.25"/>
    <rect x="22" y="12" width="20" height="8" rx="3" fill="${c}"/>
    <path d="M18,22 L46,22 L42,40 Q32,50 22,40 Z" fill="${b}" opacity="0.9"/>
    <path d="M24,40 Q32,47 40,40 L42,40 Q32,52 22,40 Z" fill="${a}" opacity="0.55"/>
    <rect x="26" y="26" width="12" height="6" rx="2" fill="${d}" opacity="0.4"/>
  `);
}

function tileSvg(rng, palette) {
  const [a, b, c, d] = palette;
  const marks = [];
  for (let i = 0; i < 5; i++) {
    const x = Math.round(rng() * 52) + 4;
    const y = Math.round(rng() * 52) + 4;
    marks.push(`<rect x="${x}" y="${y}" width="${3 + Math.round(rng() * 6)}" height="2" rx="1" fill="${c}" opacity="${(0.35 + rng() * 0.5).toFixed(2)}"/>`);
  }
  return wrap('0 0 64 64', `
    <rect width="64" height="64" rx="6" fill="${a}"/>
    <rect x="2" y="2" width="60" height="60" rx="5" fill="${b}" opacity="0.55"/>
    <path d="M2,32 H62 M32,2 V62" stroke="${a}" stroke-width="1" opacity="0.25"/>
    <rect x="8" y="8" width="20" height="14" rx="3" fill="${d}" opacity="0.18"/>
    ${marks.join('')}
  `);
}

function backgroundSvg(rng, palette) {
  const [a, b, c, d] = palette;
  const stars = [];
  for (let i = 0; i < 18; i++) {
    stars.push(`<circle cx="${(rng() * 160).toFixed(1)}" cy="${(rng() * 60).toFixed(1)}" r="${(0.5 + rng() * 1.2).toFixed(2)}" fill="${d}" opacity="${(0.3 + rng() * 0.6).toFixed(2)}"/>`);
  }
  return wrap('0 0 160 100', `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${a}"/>
        <stop offset="100%" stop-color="${b}"/>
      </linearGradient>
    </defs>
    <rect width="160" height="100" fill="url(#sky)"/>
    ${stars.join('')}
    <circle cx="${(60 + rng() * 60).toFixed(1)}" cy="34" r="13" fill="${c}" opacity="0.85"/>
    <path d="M0,74 Q34,58 68,74 T160,72 V100 H0 Z" fill="${b}" opacity="0.85"/>
    <path d="M0,84 Q46,70 92,84 T160,82 V100 H0 Z" fill="${a}" opacity="0.9"/>
    <rect y="94" width="160" height="6" fill="${a}"/>
  `, '');
}

function musicSvg(rng, palette) {
  const [a, b, c, d] = palette;
  const bars = [];
  for (let i = 0; i < 9; i++) {
    const h = 8 + Math.round(rng() * 30);
    bars.push(`<rect x="${8 + i * 6}" y="${44 - h}" width="3.4" height="${h}" rx="1.6" fill="${i % 2 ? b : c}" opacity="0.9"/>`);
  }
  return wrap('0 0 64 64', `
    <rect width="64" height="64" rx="12" fill="${a}" opacity="0.16"/>
    <circle cx="32" cy="32" r="26" fill="none" stroke="${b}" stroke-width="1" opacity="0.4"/>
    ${bars.join('')}
    <circle cx="16" cy="47" r="3" fill="${d}"/>
    <path d="M19,47 V22 L30,19 V44" stroke="${c}" stroke-width="1.5" fill="none"/>
    <circle cx="27" cy="44" r="3" fill="${d}"/>
  `);
}

function sfxSvg(rng, palette) {
  const [a, b, c, d] = palette;
  const rings = 2 + Math.floor(rng() * 2);
  const out = [];
  for (let i = 0; i < rings; i++) {
    out.push(`<circle cx="24" cy="32" r="${8 + i * 7}" fill="none" stroke="${i % 2 ? b : c}" stroke-width="2.2" opacity="${(0.85 - i * 0.2).toFixed(2)}"/>`);
  }
  return wrap('0 0 64 64', `
    <rect width="64" height="64" rx="12" fill="${a}" opacity="0.16"/>
    <circle cx="24" cy="32" r="4.5" fill="${d}"/>
    ${out.join('')}
    <path d="M44,22 L56,16 L56,48 L44,42 Z" fill="${b}" opacity="0.7"/>
  `);
}

function uiSvg(rng, palette) {
  const [a, b, c, d] = palette;
  const slots = [];
  for (let i = 0; i < 3; i++) {
    slots.push(`<rect x="${10 + i * 15}" y="36" width="12" height="12" rx="3" fill="${d}" opacity="0.25" stroke="${c}" stroke-width="1"/>`);
  }
  return wrap('0 0 64 64', `
    <rect width="64" height="64" rx="10" fill="${a}" opacity="0.2"/>
    <rect x="4" y="4" width="56" height="56" rx="8" fill="none" stroke="${b}" stroke-width="1.4" opacity="0.8"/>
    <rect x="10" y="12" width="24" height="5" rx="2.5" fill="${c}"/>
    <rect x="10" y="22" width="44" height="3" rx="1.5" fill="${d}" opacity="0.35"/>
    <rect x="10" y="28" width="30" height="3" rx="1.5" fill="${d}" opacity="0.22"/>
    ${slots.join('')}
  `);
}

const BUILDERS = {
  sprite: spriteSvg,
  character: characterSvg,
  item: itemSvg,
  tile: tileSvg,
  background: backgroundSvg,
  music: musicSvg,
  sfx: sfxSvg,
  ui: uiSvg,
};

/**
 * Render an SVG illustration for an asset spec.
 * @param {string} type one of sprite|character|item|tile|background|music|sfx|ui
 * @param {object} spec asset spec containing at least `palette`
 * @param {string} seed deterministic seed (name + variant)
 */
export function svgForAsset(type, spec = {}, seed = '') {
  const builder = BUILDERS[type] || BUILDERS.sprite;
  const rng = mulberry32(hashSeed(`${type}:${seed}`));
  return builder(rng, paletteOf(spec));
}
