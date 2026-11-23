import { LevelDefinition } from './types';

function setPixel(mask: Uint8Array, w: number, h: number, x: number, y: number) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix >= 2 && ix < w - 2 && iy >= 2 && iy < h - 2) {
    mask[iy * w + ix] = 1;
  }
}

function drawLine(
  mask: Uint8Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thickness = 1.5
) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 1.5;
  const r = Math.ceil(thickness);
  const rSq = thickness * thickness;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= rSq) {
          setPixel(mask, w, h, x + dx, y + dy);
        }
      }
    }
  }
}

function drawCircle(
  mask: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  r: number,
  thickness = 1.6
) {
  const steps = Math.max(96, Math.floor(r * 8));
  const tr = Math.ceil(thickness);
  const tSq = thickness * thickness;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    for (let dy = -tr; dy <= tr; dy++) {
      for (let dx = -tr; dx <= tr; dx++) {
        if (dx * dx + dy * dy <= tSq) {
          setPixel(mask, w, h, x + dx, y + dy);
        }
      }
    }
  }
}

/** Stamps a compact ASCII pixel-art easter egg (scale = 2px per char) onto the HiddenArt mask! */
function drawSprite(mask: Uint8Array, w: number, h: number, cx: number, cy: number, rows: string[], scale = 1) {
  const sh = rows.length;
  const sw = rows[0]?.length || 0;
  const startX = Math.round(cx - (sw * scale) / 2);
  const startY = Math.round(cy - (sh * scale) / 2);
  for (let ry = 0; ry < sh; ry++) {
    const row = rows[ry];
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] === '#') {
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            setPixel(mask, w, h, startX + rx * scale + sx, startY + ry * scale + sy);
          }
        }
      }
    }
  }
}

// Hidden pixel-art Easter Eggs!
const SPRITE_UFO = [
  '....####....',
  '...#....#...',
  '..########..',
  '.##########.',
  '..#.#..#.#..',
  '...#....#...'
];

const SPRITE_HEART = [
  '.##...##.',
  '####.####',
  '#########',
  '.#######.',
  '..#####..',
  '...###...',
  '....#....'
];

const SPRITE_HOURGLASS = [
  '#######',
  '.#...#.',
  '..#.#..',
  '...#...',
  '..#.#..',
  '.#...#.',
  '#######'
];

const SPRITE_ROCKET = [
  '...#...',
  '..###..',
  '..#.#..',
  '.#####.',
  '.##.##.',
  '#..#..#'
];

const SPRITE_SATURN = [
  '....###....',
  '...#####...',
  '.#########.',
  '###.###.###',
  '...#####...',
  '....###....'
];

const SPRITE_SUGAR_EMBLEM = [
  '..#####..',
  '.#....##.',
  '######.#.',
  '#....#.#.',
  '#....##..',
  '######...'
];

const SPRITE_OWL = [
  '.#.....#.',
  '.#######.',
  '#.##.##.#',
  '#########',
  '.#######.',
  '..#...#..'
];

const SPRITE_MUSHROOM = [
  '..#####..',
  '.###.###.',
  '#########',
  '...###...',
  '...###...',
  '..#####..'
];

const SPRITE_BUTTERFLY = [
  '##.....##',
  '###...###',
  '.#######.',
  '..#####..',
  '.###.###.',
  '##.....##'
];

function drawPolygonFrame(
  mask: Uint8Array,
  w: number,
  h: number,
  vertices: [number, number][],
  thickness = 2.2
) {
  for (let i = 0; i < vertices.length; i++) {
    const [x0, y0] = vertices[i];
    const [x1, y1] = vertices[(i + 1) % vertices.length];
    drawLine(mask, w, h, x0, y0, x1, y1, thickness);
  }
}

function drawEllipseFrame(
  mask: Uint8Array,
  w: number,
  h: number,
  rx: number,
  ry: number,
  wobbleAmp = 0,
  wobbleFreq = 6,
  thickness = 2.2
) {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const steps = 640;
  const tr = Math.ceil(thickness);
  const tSq = thickness * thickness;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const wob = wobbleAmp ? Math.sin(a * wobbleFreq) * wobbleAmp : 0;
    const x = cx + Math.cos(a) * (rx + wob);
    const y = cy + Math.sin(a) * (ry + wob * 0.7);
    for (let dy = -tr; dy <= tr; dy++) {
      for (let dx = -tr; dx <= tr; dx++) {
        if (dx * dx + dy * dy <= tSq) {
          setPixel(mask, w, h, x + dx, y + dy);
        }
      }
    }
  }
}

/** Level 1: Striped Glowing Pyramid + Easter Eggs (UFO, Hourglass, Heart) */
function generatePrismArt(w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const cx = Math.floor(w * 0.5);
  const topY = Math.floor(h * 0.14);
  const baseY = Math.floor(h * 0.5);
  const halfBase = Math.floor(w * 0.15);

  drawPolygonFrame(
    mask,
    w,
    h,
    [
      [w * 0.22, h * 0.05],
      [w * 0.78, h * 0.05],
      [w * 0.95, h * 0.28],
      [w * 0.95, h * 0.72],
      [w * 0.78, h * 0.95],
      [w * 0.22, h * 0.95],
      [w * 0.05, h * 0.72],
      [w * 0.05, h * 0.28]
    ],
    2.2
  );

  for (let y = topY; y <= baseY; y++) {
    const progress = (y - topY) / (baseY - topY);
    const halfW = Math.floor(progress * halfBase);
    const rowInStripe = (y - topY) % 5;
    if (rowInStripe >= 3 && progress > 0.14) continue;

    const eyeCy = topY + (baseY - topY) * 0.66;
    const eyeRx = halfBase * 0.44;
    const eyeRy = (baseY - topY) * 0.23;

    for (let x = cx - halfW; x <= cx + halfW; x++) {
      const dx = (x - cx) / eyeRx;
      const dy = (y - eyeCy) / eyeRy;
      const inHollow = dx * dx + dy * dy < 1.0;
      const onBorder = Math.abs(x - (cx - halfW)) <= 3 || Math.abs(x - (cx + halfW)) <= 3;
      if (!inHollow || onBorder) {
        setPixel(mask, w, h, x, y);
      }
    }
  }

  const rayOffsets = [-0.95, -0.74, -0.52, -0.3, 0.3, 0.52, 0.74, 0.95];
  for (const frac of rayOffsets) {
    drawLine(mask, w, h, cx + frac * halfBase * 0.96, baseY + 6, cx + frac * w * 0.32, h * 0.87, 1.5);
  }

  // Easter eggs hidden in the flanks!
  drawSprite(mask, w, h, w * 0.18, h * 0.34, SPRITE_UFO, 2);
  drawSprite(mask, w, h, w * 0.82, h * 0.36, SPRITE_HOURGLASS, 2);
  drawSprite(mask, w, h, w * 0.16, h * 0.68, SPRITE_HEART, 2);
  drawSprite(mask, w, h, w * 0.84, h * 0.68, SPRITE_SUGAR_EMBLEM, 2);

  return mask;
}

/** Level 2: Twin Spiral Galaxy + Saturn & Rocket Easter Eggs */
function generateGalaxyArt(w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const cx = w * 0.5;
  const cy = h * 0.5;
  const maxR = Math.min(w, h) * 0.36;

  drawEllipseFrame(mask, w, h, w * 0.45, h * 0.45, 0, 0, 2.2);
  drawCircle(mask, w, h, cx, cy, 13, 1.9);
  drawCircle(mask, w, h, cx, cy, 6, 1.5);

  for (let arm = 0; arm < 2; arm++) {
    const baseAngle = arm * Math.PI;
    for (let i = 0; i < 620; i++) {
      const t = i / 620;
      const angle = baseAngle + t * Math.PI * 3.1;
      const r = 15 + t * maxR;
      const x = cx + Math.cos(angle) * r * 1.18;
      const y = cy + Math.sin(angle) * r * 0.85;
      const thick = t < 0.45 ? 2.3 : 1.4;
      const tr = Math.ceil(thick);
      for (let dy = -tr; dy <= tr; dy++) {
        for (let dx = -tr; dx <= tr; dx++) {
          if (dx * dx + dy * dy <= thick * thick) {
            setPixel(mask, w, h, x + dx, y + dy);
          }
        }
      }
    }
  }

  // Space easter eggs
  drawSprite(mask, w, h, w * 0.2, h * 0.28, SPRITE_SATURN, 2);
  drawSprite(mask, w, h, w * 0.8, h * 0.3, SPRITE_ROCKET, 2);
  drawSprite(mask, w, h, w * 0.78, h * 0.72, SPRITE_UFO, 2);

  return mask;
}

/** Level 3: Sacred Geometric Ant Crest + Sugar & Heart Easter Eggs */
function generateAntCrownArt(w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const cx = w * 0.5;
  const cy = h * 0.5;
  const s = Math.min(w, h) / 165;

  drawPolygonFrame(
    mask,
    w,
    h,
    [
      [w * 0.25, h * 0.05],
      [w * 0.75, h * 0.05],
      [w * 0.95, h * 0.5],
      [w * 0.75, h * 0.95],
      [w * 0.25, h * 0.95],
      [w * 0.05, h * 0.5]
    ],
    2.2
  );

  drawCircle(mask, w, h, cx, cy, Math.min(w, h) * 0.38, 1.6);
  drawCircle(mask, w, h, cx, cy - 26 * s, 9 * s, 1.8);
  drawCircle(mask, w, h, cx, cy - 6 * s, 7 * s, 1.8);
  drawCircle(mask, w, h, cx, cy + 20 * s, 14 * s, 2.0);

  drawLine(mask, w, h, cx - 5 * s, cy - 34 * s, cx - 18 * s, cy - 48 * s, 1.5);
  drawLine(mask, w, h, cx - 18 * s, cy - 48 * s, cx - 28 * s, cy - 44 * s, 1.5);
  drawLine(mask, w, h, cx + 5 * s, cy - 34 * s, cx + 18 * s, cy - 48 * s, 1.5);
  drawLine(mask, w, h, cx + 18 * s, cy - 48 * s, cx + 28 * s, cy - 44 * s, 1.5);

  const legPairs = [
    [-12, -32, -24],
    [-4, -36, 0],
    [6, -34, 28]
  ];
  for (const [sy, kneeX, footY] of legPairs) {
    drawLine(mask, w, h, cx - 6 * s, cy + sy * s, cx + kneeX * s, cy + (sy - 4) * s, 1.5);
    drawLine(mask, w, h, cx + kneeX * s, cy + (sy - 4) * s, cx + (kneeX - 14) * s, cy + footY * s, 1.5);
    drawLine(mask, w, h, cx + 6 * s, cy + sy * s, cx - kneeX * s, cy + (sy - 4) * s, 1.5);
    drawLine(mask, w, h, cx - kneeX * s, cy + (sy - 4) * s, cx - (kneeX - 14) * s, cy + footY * s, 1.5);
  }

  drawLine(mask, w, h, cx - 14 * s, cy - 42 * s, cx - 8 * s, cy - 54 * s, 1.5);
  drawLine(mask, w, h, cx - 8 * s, cy - 54 * s, cx, cy - 46 * s, 1.5);
  drawLine(mask, w, h, cx, cy - 46 * s, cx + 8 * s, cy - 54 * s, 1.5);
  drawLine(mask, w, h, cx + 8 * s, cy - 54 * s, cx + 14 * s, cy - 42 * s, 1.5);

  drawSprite(mask, w, h, w * 0.2, h * 0.45, SPRITE_SUGAR_EMBLEM, 2);
  drawSprite(mask, w, h, w * 0.8, h * 0.45, SPRITE_HEART, 2);
  drawSprite(mask, w, h, w * 0.22, h * 0.72, SPRITE_HOURGLASS, 2);

  return mask;
}

/** Level 4: Crescent Moon Temple + Owl & Stars Easter Eggs */
function generateMoonTempleArt(w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const cx = w * 0.5;
  const moonCy = h * 0.31;
  const rOuter = Math.min(w, h) * 0.15;
  const rInner = rOuter * 0.85;

  drawEllipseFrame(mask, w, h, w * 0.44, h * 0.44, 5, 8, 2.2);

  for (let y = Math.floor(moonCy - rOuter - 2); y <= Math.ceil(moonCy + rOuter + 2); y++) {
    for (let x = Math.floor(cx - rOuter - 2); x <= Math.ceil(cx + rOuter + 2); x++) {
      const d1 = Math.hypot(x - cx, y - moonCy);
      const d2 = Math.hypot(x - (cx + rOuter * 0.42), y - (moonCy - rOuter * 0.15));
      if (d1 <= rOuter && d2 >= rInner) {
        setPixel(mask, w, h, x, y);
      }
    }
  }

  const s = Math.min(w, h) / 165;
  const baseY = h * 0.72;
  const topArchY = h * 0.49;
  drawLine(mask, w, h, cx - 64 * s, baseY, cx + 64 * s, baseY, 2.1);
  drawLine(mask, w, h, cx - 54 * s, baseY - 7 * s, cx + 54 * s, baseY - 7 * s, 1.5);

  for (const offset of [-44, -22, 22, 44]) {
    drawLine(mask, w, h, cx + offset * s, baseY - 7 * s, cx + offset * s, topArchY, 1.8);
  }

  for (let a = Math.PI; a <= Math.PI * 2; a += 0.025) {
    const ax = cx + Math.cos(a) * 22 * s;
    const ay = topArchY + Math.sin(a) * 16 * s;
    drawLine(mask, w, h, ax, ay, ax, ay + 2, 1.4);
  }

  drawSprite(mask, w, h, w * 0.2, h * 0.34, SPRITE_OWL, 2);
  drawSprite(mask, w, h, w * 0.8, h * 0.34, SPRITE_HOURGLASS, 2);
  drawSprite(mask, w, h, w * 0.82, h * 0.66, SPRITE_HEART, 2);

  return mask;
}

/** Level 5: Geometric Tree of Life + Mushroom & Butterfly Easter Eggs */
function generateTreeArt(w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const cx = w * 0.5;
  const trunkTop = h * 0.44;
  const trunkBot = h * 0.64;

  drawEllipseFrame(mask, w, h, w * 0.44, h * 0.44, 6, 10, 2.2);

  drawLine(mask, w, h, cx - 4, trunkTop, cx - 8, trunkBot, 1.9);
  drawLine(mask, w, h, cx + 4, trunkTop, cx + 8, trunkBot, 1.9);

  const branch = (x: number, y: number, len: number, angle: number, depth: number) => {
    if (depth <= 0) return;
    const nx = x + Math.cos(angle) * len;
    const ny = y + Math.sin(angle) * len;
    drawLine(mask, w, h, x, y, nx, ny, depth > 2 ? 1.8 : 1.2);
    branch(nx, ny, len * 0.72, angle - 0.46, depth - 1);
    branch(nx, ny, len * 0.72, angle + 0.46, depth - 1);
  };

  branch(cx, trunkTop, Math.min(w, h) * 0.145, -Math.PI / 2, 4);

  // Roots spread cleanly above the nest at h * 0.78 so the entire inner circle is wide open!
  drawLine(mask, w, h, cx - 8, trunkBot, cx - 44, h * 0.72, 1.7);
  drawLine(mask, w, h, cx - 3, trunkBot, cx - 18, h * 0.74, 1.5);
  drawLine(mask, w, h, cx + 3, trunkBot, cx + 18, h * 0.74, 1.5);
  drawLine(mask, w, h, cx + 8, trunkBot, cx + 44, h * 0.72, 1.7);

  drawCircle(mask, w, h, cx, h * 0.5, Math.min(w, h) * 0.37, 1.5);

  drawSprite(mask, w, h, w * 0.2, h * 0.68, SPRITE_MUSHROOM, 2);
  drawSprite(mask, w, h, w * 0.8, h * 0.34, SPRITE_BUTTERFLY, 2);
  drawSprite(mask, w, h, w * 0.2, h * 0.34, SPRITE_OWL, 2);

  return mask;
}

export const LEVELS: LevelDefinition[] = [
  {
    id: 'prism',
    name: 'Призма Света',
    subtitle: 'Древний сияющий монолит в изумрудном святилище',
    width: 400,
    height: 250,
    crystalCount: 45, // +50%
    palette: {
      bgHex: '#0b1d13',
      bgRgb: [11, 29, 19],
      emptyRgb: [4, 7, 9],
      softRgb: [13, 33, 22],
      clayRgb: [19, 46, 40],
      stoneRgb: [28, 42, 58],
      obsidianRgb: [38, 23, 56],
      artGlowRgb: [235, 250, 255],
      accentHex: '#3ce87a'
    },
    generateArt: generatePrismArt
  },
  {
    id: 'galaxy',
    name: 'Спиральная Галактика',
    subtitle: 'Два рукава звёздного света в глубинах космического индиго',
    width: 400,
    height: 250,
    crystalCount: 51, // +50%
    palette: {
      bgHex: '#0b1224',
      bgRgb: [11, 18, 36],
      emptyRgb: [4, 5, 11],
      softRgb: [14, 23, 44],
      clayRgb: [22, 34, 62],
      stoneRgb: [35, 44, 74],
      obsidianRgb: [54, 24, 68],
      artGlowRgb: [215, 235, 255],
      accentHex: '#35d6ff'
    },
    generateArt: generateGalaxyArt
  },
  {
    id: 'ant-crown',
    name: 'Корона Колонии',
    subtitle: 'Символ первых муравьёв в тёплых янтарных катакомбах',
    width: 400,
    height: 250,
    crystalCount: 54, // +50%
    palette: {
      bgHex: '#1c130b',
      bgRgb: [28, 19, 11],
      emptyRgb: [8, 5, 4],
      softRgb: [36, 24, 14],
      clayRgb: [52, 35, 20],
      stoneRgb: [62, 46, 36],
      obsidianRgb: [58, 22, 28],
      artGlowRgb: [255, 240, 210],
      accentHex: '#ff9d42'
    },
    generateArt: generateAntCrownArt
  },
  {
    id: 'moon-temple',
    name: 'Лунный Храм',
    subtitle: 'Тихие колонны в сумеречном аметистовом тумане',
    width: 400,
    height: 250,
    crystalCount: 57, // +50%
    palette: {
      bgHex: '#160e21',
      bgRgb: [22, 14, 33],
      emptyRgb: [6, 4, 10],
      softRgb: [29, 19, 43],
      clayRgb: [42, 28, 60],
      stoneRgb: [48, 42, 72],
      obsidianRgb: [66, 24, 52],
      artGlowRgb: [240, 225, 255],
      accentHex: '#e04bff'
    },
    generateArt: generateMoonTempleArt
  },
  {
    id: 'tree-of-life',
    name: 'Древо Жизни',
    subtitle: 'Корни и ветви в нефритово-золотом лесу',
    width: 400,
    height: 250,
    crystalCount: 63, // +50%
    palette: {
      bgHex: '#0c1e1c',
      bgRgb: [12, 30, 28],
      emptyRgb: [4, 9, 9],
      softRgb: [16, 38, 35],
      clayRgb: [26, 52, 42],
      stoneRgb: [46, 48, 34],
      obsidianRgb: [54, 38, 20],
      artGlowRgb: [230, 255, 242],
      accentHex: '#42f5c5'
    },
    generateArt: generateTreeArt
  }
];
