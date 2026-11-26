import { LevelDefinition } from './types';

/* =========================================================
   HIGH-CRAFT 1PX PIXEL ART PRIMITIVES (CRISP BRESENHAM & BEZIER)
   ========================================================= */

function px(mask: Uint8Array, w: number, h: number, x: number, y: number) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix >= 3 && ix < w - 3 && iy >= 3 && iy < h - 3) {
    mask[iy * w + ix] = 1;
  }
}

function eraseCircle(mask: Uint8Array, w: number, h: number, cx: number, cy: number, r: number) {
  const rCeil = Math.ceil(r);
  const rSq = r * r;
  for (let dy = -rCeil; dy <= rCeil; dy++) {
    for (let dx = -rCeil; dx <= rCeil; dx++) {
      if (dx * dx + dy * dy > rSq) continue;
      const ix = Math.round(cx + dx);
      const iy = Math.round(cy + dy);
      if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
        mask[iy * w + ix] = 0;
      }
    }
  }
}

/** Crisp 1px (or optional bold) integer Bresenham line */
function drawCrispLine(
  mask: Uint8Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  bold = false
) {
  let ix0 = Math.round(x0);
  let iy0 = Math.round(y0);
  const ix1 = Math.round(x1);
  const iy1 = Math.round(y1);
  const dx = Math.abs(ix1 - ix0);
  const dy = Math.abs(iy1 - iy0);
  const sx = ix0 < ix1 ? 1 : -1;
  const sy = iy0 < iy1 ? 1 : -1;
  let err = dx - dy;

  for (let guard = 0; guard < 2000; guard++) {
    px(mask, w, h, ix0, iy0);
    if (bold) {
      px(mask, w, h, ix0 + 1, iy0);
      px(mask, w, h, ix0, iy0 + 1);
    }
    if (ix0 === ix1 && iy0 === iy1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      ix0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      iy0 += sy;
    }
  }
}

/** Delicate dotted vertical/diagonal string (signature mystery detail!) */
function drawDottedLine(
  mask: Uint8Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  spacing = 3.5
) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.floor(dist / spacing));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    px(mask, w, h, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
  }
}

/** Razor-sharp cubic Bezier curve */
function drawBezier(
  mask: Uint8Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  cx0: number,
  cy0: number,
  cx1: number,
  cy1: number,
  x1: number,
  y1: number,
  bold = false
) {
  const approxLen =
    Math.hypot(cx0 - x0, cy0 - y0) +
    Math.hypot(cx1 - cx0, cy1 - cy0) +
    Math.hypot(x1 - cx1, y1 - cy1);
  const steps = Math.max(18, Math.ceil(approxLen * 1.4));
  let prevX = x0;
  let prevY = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const bx =
      mt * mt * mt * x0 +
      3 * mt * mt * t * cx0 +
      3 * mt * t * t * cx1 +
      t * t * t * x1;
    const by =
      mt * mt * mt * y0 +
      3 * mt * mt * t * cy0 +
      3 * mt * t * t * cy1 +
      t * t * t * y1;
    drawCrispLine(mask, w, h, prevX, prevY, bx, by, bold);
    prevX = bx;
    prevY = by;
  }
}

/** Symmetric mirrored cubic Bezier around center cx */
function drawMirrorBezier(
  mask: Uint8Array,
  w: number,
  h: number,
  cx: number,
  x0: number,
  y0: number,
  c0x: number,
  c0y: number,
  c1x: number,
  c1y: number,
  x1: number,
  y1: number,
  bold = false
) {
  drawBezier(mask, w, h, cx + x0, y0, cx + c0x, c0y, cx + c1x, c1y, cx + x1, y1, bold);
  drawBezier(mask, w, h, cx - x0, y0, cx - c0x, c0y, cx - c1x, c1y, cx - x1, y1, bold);
}

/** Crisp 1px elliptic arc with optional dotted style */
function drawArc(
  mask: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  aStart: number,
  aEnd: number,
  bold = false,
  dottedStep = 0
) {
  const arcLen = Math.abs(aEnd - aStart) * Math.max(rx, ry);
  if (dottedStep > 0) {
    const count = Math.max(2, Math.floor(arcLen / dottedStep));
    for (let i = 0; i <= count; i++) {
      const a = aStart + ((aEnd - aStart) * i) / count;
      px(mask, w, h, cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    }
    return;
  }
  const steps = Math.max(24, Math.ceil(arcLen * 1.4));
  let prevX = cx + Math.cos(aStart) * rx;
  let prevY = cy + Math.sin(aStart) * ry;
  for (let i = 1; i <= steps; i++) {
    const a = aStart + ((aEnd - aStart) * i) / steps;
    const nx = cx + Math.cos(a) * rx;
    const ny = cy + Math.sin(a) * ry;
    drawCrispLine(mask, w, h, prevX, prevY, nx, ny, bold);
    prevX = nx;
    prevY = ny;
  }
}

/** Crisp pixel polyline */
function drawPolyline(
  mask: Uint8Array,
  w: number,
  h: number,
  pts: [number, number][],
  closed = false,
  bold = false
) {
  for (let i = 0; i < pts.length - 1; i++) {
    drawCrispLine(mask, w, h, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], bold);
  }
  if (closed && pts.length > 2) {
    drawCrispLine(
      mask,
      w,
      h,
      pts[pts.length - 1][0],
      pts[pts.length - 1][1],
      pts[0][0],
      pts[0][1],
      bold
    );
  }
}

/** Tiny crisp 4-point sparkle star */
function drawStar(mask: Uint8Array, w: number, h: number, cx: number, cy: number, r = 3) {
  drawCrispLine(mask, w, h, cx - r, cy, cx + r, cy);
  drawCrispLine(mask, w, h, cx, cy - r, cx, cy + r);
  if (r >= 4) {
    px(mask, w, h, cx - 1, cy - 1);
    px(mask, w, h, cx + 1, cy - 1);
    px(mask, w, h, cx - 1, cy + 1);
    px(mask, w, h, cx + 1, cy + 1);
  }
}

/** Delicate notched outer medallion frame with wide interior sanctuary (100% 4-connected watertight at any map scale!) */
function drawNotchedMedallion(
  mask: Uint8Array,
  w: number,
  h: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  notchBottom = true,
  notchTop = false
) {
  const degToRad = (d: number) => (d * Math.PI) / 180;
  const drawRimArc = (degStart: number, degEnd: number) => {
    const aStart = degToRad(degStart);
    const aEnd = degToRad(degEnd);
    const arcLen = Math.abs(aEnd - aStart) * Math.max(rx, ry);
    const steps = Math.max(64, Math.ceil(arcLen * 1.4));
    let prevX = cx + Math.cos(aStart) * rx;
    let prevY = cy + Math.sin(aStart) * ry;
    for (let i = 1; i <= steps; i++) {
      const a = aStart + ((aEnd - aStart) * i) / steps;
      const nx = cx + Math.cos(a) * rx;
      const ny = cy + Math.sin(a) * ry;
      drawCrispLine(mask, w, h, prevX, prevY, nx, ny, true);
      prevX = nx;
      prevY = ny;
    }
  };

  if (notchBottom && notchTop) {
    drawRimArc(0, 74);
    drawRimArc(106, 256);
    drawRimArc(284, 360);
  } else if (notchBottom) {
    drawRimArc(0, 74);
    drawRimArc(106, 360);
  } else if (notchTop) {
    drawRimArc(0, 256);
    drawRimArc(284, 360);
  } else {
    drawRimArc(0, 360);
  }

  if (notchBottom) {
    const aL = degToRad(106);
    const aR = degToRad(74);
    const lx = cx + Math.cos(aL) * rx;
    const ly = cy + Math.sin(aL) * ry;
    const rxP = cx + Math.cos(aR) * rx;
    const ryP = cy + Math.sin(aR) * ry;
    drawCrispLine(mask, w, h, lx, ly, cx, cy + ry * 0.8, true);
    drawCrispLine(mask, w, h, cx, cy + ry * 0.8, rxP, ryP, true);
  }
  if (notchTop) {
    const aL = degToRad(256);
    const aR = degToRad(284);
    const lx = cx + Math.cos(aL) * rx;
    const ly = cy + Math.sin(aL) * ry;
    const rxP = cx + Math.cos(aR) * rx;
    const ryP = cy + Math.sin(aR) * ry;
    drawCrispLine(mask, w, h, lx, ly, cx, cy - ry * 0.82, true);
    drawCrispLine(mask, w, h, cx, cy - ry * 0.82, rxP, ryP, true);
  }
}

/* =========================================================
   LEVEL 1: «Призма Света» — Лунный Мотылёк и Фонарь Ключа
   Unfolds outward from center:
   1) Hanging mystery key & crystal diamond right by nest
   2) Ornate glass lantern chamber with open upper/lower arches
   3) Giant sweeping Celestial Luna-Moth wings with eyespots, veins & tails
   4) Notched sacred botanical medallion + corner constellations
   ========================================================= */
function generatePrismArt(w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const cx = Math.floor(w * 0.5);
  const cy = Math.floor(h * 0.5);
  const s = Math.min(w / 440, h / 280);

  // LAYER 4: Grand notched outer medallion
  drawNotchedMedallion(mask, w, h, cx, cy, w * 0.445, h * 0.445, true, false);

  // LAYER 1 (Immediate Center Discovery — right above & below nest!):
  // Dotted silk thread hanging down to a delicate antique key (cleanly above nest!)
  drawDottedLine(mask, w, h, cx, cy - 66 * s, cx, cy - 30 * s, 3.2 * s);
  drawArc(mask, w, h, cx, cy - 25 * s, 5 * s, 5 * s, 0, Math.PI * 2, true);
  drawCrispLine(mask, w, h, cx, cy - 20 * s, cx, cy - 11.5 * s, true);
  drawCrispLine(mask, w, h, cx, cy - 15.5 * s, cx + 4.5 * s, cy - 15.5 * s);
  drawCrispLine(mask, w, h, cx, cy - 12.5 * s, cx + 3.5 * s, cy - 12.5 * s);

  // Faceted glowing prism-heart right below the nest!
  drawPolyline(
    mask,
    w,
    h,
    [
      [cx, cy + 16 * s],
      [cx + 14 * s, cy + 31 * s],
      [cx, cy + 50 * s],
      [cx - 14 * s, cy + 31 * s]
    ],
    true,
    true
  );
  // Crisp inner prism facets
  drawCrispLine(mask, w, h, cx - 14 * s, cy + 31 * s, cx + 14 * s, cy + 31 * s);
  drawCrispLine(mask, w, h, cx, cy + 16 * s, cx - 5 * s, cy + 31 * s);
  drawCrispLine(mask, w, h, cx, cy + 16 * s, cx + 5 * s, cy + 31 * s);
  drawCrispLine(mask, w, h, cx - 5 * s, cy + 31 * s, cx, cy + 50 * s);
  drawCrispLine(mask, w, h, cx + 5 * s, cy + 31 * s, cx, cy + 50 * s);

  // LAYER 2 (Inner Lantern Chamber — with WIDE OPEN gateways at top & bottom!):
  // Left & right lantern glass curves
  drawMirrorBezier(
    mask, w, h, cx,
    18 * s, cy - 56 * s,
    46 * s, cy - 34 * s,
    48 * s, cy + 34 * s,
    16 * s, cy + 62 * s,
    true
  );
  // Ornate upper crown cap of the moth/lantern (open below so ants exit easily!)
  drawMirrorBezier(
    mask, w, h, cx,
    0, cy - 92 * s,
    12 * s, cy - 84 * s,
    16 * s, cy - 72 * s,
    10 * s, cy - 64 * s,
    true
  );
  // Feathered Luna-Moth antennae curving gracefully at top!
  drawMirrorBezier(
    mask, w, h, cx,
    9 * s, cy - 74 * s,
    24 * s, cy - 98 * s,
    48 * s, cy - 102 * s,
    60 * s, cy - 86 * s,
    false
  );
  for (let i = 1; i <= 5; i++) {
    const t = i / 6;
    const ax = 12 * s + t * 44 * s;
    const ay = cy - (78 + Math.sin(t * Math.PI) * 19) * s;
    drawCrispLine(mask, w, h, cx + ax, ay, cx + ax + 4 * s, ay - 6 * s);
    drawCrispLine(mask, w, h, cx - ax, ay, cx - ax - 4 * s, ay - 6 * s);
  }

  // LAYER 3 (Epic Outer Reveal — Giant Sweeping Luna-Moth Wings!):
  // Upper sweeping forewings (open passage between body & wing root!)
  drawMirrorBezier(
    mask, w, h, cx,
    40 * s, cy - 42 * s,
    84 * s, cy - 96 * s,
    144 * s, cy - 78 * s,
    158 * s, cy - 26 * s,
    true
  );
  drawMirrorBezier(
    mask, w, h, cx,
    158 * s, cy - 26 * s,
    146 * s, cy + 8 * s,
    96 * s, cy + 12 * s,
    54 * s, cy + 4 * s,
    true
  );
  // Delicate interior wing veins radiating outward
  drawMirrorBezier(mask, w, h, cx, 56 * s, cy - 26 * s, 94 * s, cy - 58 * s, 124 * s, cy - 50 * s, 146 * s, cy - 24 * s);
  drawMirrorBezier(mask, w, h, cx, 56 * s, cy - 12 * s, 96 * s, cy - 24 * s, 120 * s, cy - 16 * s, 144 * s, cy - 8 * s);
  // Wing eyespots (double crescent ocelli!)
  for (const dir of [-1, 1]) {
    const ex = cx + dir * 102 * s;
    const ey = cy - 30 * s;
    drawArc(mask, w, h, ex, ey, 14 * s, 10 * s, 0, Math.PI * 2);
    drawArc(mask, w, h, ex + dir * 2 * s, ey, 6 * s, 5 * s, 0, Math.PI * 2);
    // Tiny sparkle inside eyespot
    px(mask, w, h, ex - dir * 3 * s, ey - 2 * s);
  }

  // Lower swallowtail hindwings with flowing curled ribbon tails!
  drawMirrorBezier(
    mask, w, h, cx,
    50 * s, cy + 16 * s,
    112 * s, cy + 20 * s,
    132 * s, cy + 54 * s,
    92 * s, cy + 84 * s,
    true
  );
  drawMirrorBezier(
    mask, w, h, cx,
    92 * s, cy + 84 * s,
    72 * s, cy + 98 * s,
    60 * s, cy + 92 * s,
    68 * s, cy + 72 * s,
    true
  );
  drawMirrorBezier(
    mask, w, h, cx,
    68 * s, cy + 72 * s,
    54 * s, cy + 68 * s,
    40 * s, cy + 62 * s,
    34 * s, cy + 46 * s,
    true
  );
  // Dotted starlight trails drifting below the swallowtails
  drawDottedLine(mask, w, h, cx - 72 * s, cy + 94 * s, cx - 54 * s, cy + 108 * s, 3.6 * s);
  drawDottedLine(mask, w, h, cx + 72 * s, cy + 94 * s, cx + 54 * s, cy + 108 * s, 3.6 * s);

  // Subtle celestial stars in outer flanks
  drawStar(mask, w, h, cx - 142 * s, cy - 68 * s, 4);
  drawStar(mask, w, h, cx + 142 * s, cy - 68 * s, 4);
  drawStar(mask, w, h, cx - 140 * s, cy + 52 * s, 3);
  drawStar(mask, w, h, cx + 140 * s, cy + 52 * s, 3);
  drawStar(mask, w, h, cx - 86 * s, cy - 86 * s, 3);
  drawStar(mask, w, h, cx + 86 * s, cy - 86 * s, 3);

  // Guarantee central nest chamber is 100% open & clean
  eraseCircle(mask, w, h, cx, cy, 11 * s);
  return mask;
}

/* =========================================================
   LEVEL 2: «Спиральная Галактика» — Космический Кит и Астролябия
   Unfolds outward from center:
   1) Suspended crescent moon & compass star right beside nest
   2) Dotted planetary orbits & open astrolabe arcs
   3) Giant graceful Cosmic Whale curling around the entire galaxy with ribbed belly & flukes
   4) Outer celestial medallion + tiny rocket & ringed Saturn
   ========================================================= */
function generateGalaxyArt(w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const cx = Math.floor(w * 0.5);
  const cy = Math.floor(h * 0.5);
  const s = Math.min(w / 440, h / 280);

  // LAYER 4: Outer celestial medallion with top & bottom solstice notches
  drawNotchedMedallion(mask, w, h, cx, cy, w * 0.45, h * 0.445, true, true);

  // LAYER 1 (Immediate Center Discovery):
  // Delicate crescent moon right above nest on a dotted starlight line!
  drawDottedLine(mask, w, h, cx, cy - 62 * s, cx, cy - 26 * s, 3.4 * s);
  drawArc(mask, w, h, cx, cy - 18 * s, 9 * s, 9 * s, 0.35, Math.PI * 1.65, true);
  drawArc(mask, w, h, cx + 4 * s, cy - 19 * s, 7.5 * s, 7.5 * s, 0.6, Math.PI * 1.45, false);

  // Crisp 4-point navigational star just below the nest
  drawStar(mask, w, h, cx, cy + 24 * s, Math.round(8 * s));
  drawCrispLine(mask, w, h, cx - 4 * s, cy + 20 * s, cx + 4 * s, cy + 28 * s);
  drawCrispLine(mask, w, h, cx + 4 * s, cy + 20 * s, cx - 4 * s, cy + 28 * s);

  // LAYER 2 (Inner Astrolabe Chamber — wide open gateways on 4 sides!):
  drawArc(mask, w, h, cx, cy, 52 * s, 44 * s, -0.55, 0.55, true);
  drawArc(mask, w, h, cx, cy, 52 * s, 44 * s, Math.PI - 0.55, Math.PI + 0.55, true);
  drawArc(mask, w, h, cx, cy, 62 * s, 52 * s, 0.72, Math.PI - 0.72, false, 4.2 * s);
  drawArc(mask, w, h, cx, cy, 62 * s, 52 * s, Math.PI + 0.72, Math.PI * 2 - 0.72, false, 4.2 * s);

  // Tilted planetary orbital ring with tiny ringed planet
  drawArc(mask, w, h, cx + 74 * s, cy - 42 * s, 10 * s, 10 * s, 0, Math.PI * 2, true);
  drawArc(mask, w, h, cx + 74 * s, cy - 42 * s, 21 * s, 6 * s, -0.3, Math.PI + 0.3, false);

  // LAYER 3 (Epic Outer Reveal — Giant Graceful Cosmic Whale with open celestial passages!):
  // Sweeping upper back arching from right brow over the top (leaving an open stardust passage on right & left!)
  drawBezier(
    mask, w, h,
    cx + 132 * s, cy - 12 * s,
    cx + 126 * s, cy - 82 * s,
    cx + 14 * s, cy - 108 * s,
    cx - 88 * s, cy - 62 * s,
    true
  );
  // Tail peduncle curving cleanly toward left-bottom flukes (open passage at upper-left!)
  drawBezier(
    mask, w, h,
    cx - 106 * s, cy - 44 * s,
    cx - 134 * s, cy - 18 * s,
    cx - 136 * s, cy + 18 * s,
    cx - 114 * s, cy + 48 * s,
    true
  );
  // Whale sweeping tail flukes (two crisp winged blades!)
  drawBezier(
    mask, w, h,
    cx - 114 * s, cy + 48 * s,
    cx - 144 * s, cy + 46 * s,
    cx - 160 * s, cy + 68 * s,
    cx - 138 * s, cy + 82 * s,
    true
  );
  drawBezier(
    mask, w, h,
    cx - 138 * s, cy + 82 * s,
    cx - 118 * s, cy + 72 * s,
    cx - 106 * s, cy + 66 * s,
    cx - 96 * s, cy + 64 * s,
    true
  );
  drawBezier(
    mask, w, h,
    cx - 96 * s, cy + 64 * s,
    cx - 90 * s, cy + 82 * s,
    cx - 72 * s, cy + 90 * s,
    cx - 58 * s, cy + 78 * s,
    true
  );
  drawBezier(
    mask, w, h,
    cx - 58 * s, cy + 78 * s,
    cx - 74 * s, cy + 62 * s,
    cx - 84 * s, cy + 50 * s,
    cx - 88 * s, cy + 36 * s,
    true
  );

  // Whale lower jaw & curved smiling mouthline (on right, with clean throat pleats!)
  drawBezier(
    mask, w, h,
    cx + 138 * s, cy + 12 * s,
    cx + 120 * s, cy + 48 * s,
    cx + 76 * s, cy + 74 * s,
    cx + 38 * s, cy + 74 * s,
    true
  );
  for (let i = 1; i <= 4; i++) {
    const t = i * 4.5 * s;
    drawBezier(
      mask, w, h,
      cx + (132 - t * 0.7) * s, cy + (14 + t * 0.55) * s,
      cx + (112 - t * 0.8) * s, cy + (38 + t * 0.65) * s,
      cx + (78 - t * 0.6) * s, cy + (58 + t * 0.45) * s,
      cx + (46 - t * 0.3) * s, cy + (62 + t * 0.25) * s,
      false
    );
  }
  // Sweeping pectoral fin cleanly separated below belly!
  drawBezier(
    mask, w, h,
    cx + 22 * s, cy + 54 * s,
    cx + 16 * s, cy + 82 * s,
    cx - 4 * s, cy + 98 * s,
    cx - 22 * s, cy + 90 * s,
    true
  );
  drawBezier(
    mask, w, h,
    cx - 22 * s, cy + 90 * s,
    cx - 6 * s, cy + 74 * s,
    cx + 2 * s, cy + 62 * s,
    cx + 4 * s, cy + 48 * s,
    true
  );
  // Calm glowing whale eye + curved dotted stardust fountain spout!
  drawArc(mask, w, h, cx + 114 * s, cy + 2 * s, 4 * s, 4 * s, 0, Math.PI * 2);
  drawDottedLine(mask, w, h, cx + 98 * s, cy - 68 * s, cx + 122 * s, cy - 92 * s, 4 * s);
  drawDottedLine(mask, w, h, cx + 98 * s, cy - 68 * s, cx + 78 * s, cy - 96 * s, 4 * s);

  // Outer starry constellations
  drawStar(mask, w, h, cx - 134 * s, cy - 68 * s, 4);
  drawStar(mask, w, h, cx + 150 * s, cy - 52 * s, 4);
  drawStar(mask, w, h, cx - 34 * s, cy - 82 * s, 3);
  drawStar(mask, w, h, cx + 124 * s, cy + 66 * s, 4);
  drawStar(mask, w, h, cx - 150 * s, cy + 10 * s, 3);
  drawStar(mask, w, h, cx + 156 * s, cy + 24 * s, 3);

  eraseCircle(mask, w, h, cx, cy, 11 * s);
  return mask;
}

/* =========================================================
   LEVEL 3: «Корона Колонии» — Солнечный Скарабей и Королевская Печать
   100% ORIGINAL insect-kingdom progressive masterpiece!
   Unfolds outward from center:
   1) Hanging royal crown & stylized colony ant emblem right by nest
   2) Open split-elytra sacred Scarab carapace framing the central chamber
   3) Sweeping stag-beetle mandibles cradling a radiant Solar Crown Orb + unfurled geometric wings + 6 articulated legs!
   4) Notched heraldic outer medallion
   ========================================================= */
function generateAntCrownArt(w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const cx = Math.floor(w * 0.5);
  const cy = Math.floor(h * 0.5);
  const s = Math.min(w / 440, h / 280);

  // LAYER 4: Grand notched outer medallion
  drawNotchedMedallion(mask, w, h, cx, cy, w * 0.445, h * 0.445, true, false);

  // LAYER 1 (Immediate Center Discovery right next to nest!):
  // Dotted royal silk thread + ornate tiny crown above nest
  drawDottedLine(mask, w, h, cx, cy - 68 * s, cx, cy - 28 * s, 3.2 * s);
  drawPolyline(
    mask, w, h,
    [
      [cx - 11 * s, cy - 16 * s],
      [cx - 8 * s, cy - 27 * s],
      [cx, cy - 21 * s],
      [cx + 8 * s, cy - 27 * s],
      [cx + 11 * s, cy - 16 * s]
    ],
    true,
    true
  );

  // Crisp stylized pixel Ant Emblem right below nest!
  drawArc(mask, w, h, cx + 21 * s, cy + 28 * s, 6.5 * s, 5.5 * s, 0, Math.PI * 2, true);
  drawArc(mask, w, h, cx + 4 * s, cy + 28 * s, 7.5 * s, 4.8 * s, 0, Math.PI * 2, true);
  drawArc(mask, w, h, cx - 19 * s, cy + 28 * s, 13 * s, 8.5 * s, 0, Math.PI * 2, true);
  drawCrispLine(mask, w, h, cx - 24 * s, cy + 21 * s, cx - 24 * s, cy + 35 * s);
  drawCrispLine(mask, w, h, cx - 16 * s, cy + 20 * s, cx - 16 * s, cy + 36 * s);
  drawPolyline(mask, w, h, [[cx + 27 * s, cy + 25 * s], [cx + 34 * s, cy + 18 * s], [cx + 40 * s, cy + 20 * s]]);
  drawPolyline(mask, w, h, [[cx + 27 * s, cy + 31 * s], [cx + 34 * s, cy + 38 * s], [cx + 40 * s, cy + 36 * s]]);
  for (const [lx, kx, fx] of [[9, 15, 22], [4, 2, -2], [-4, -14, -24]]) {
    drawPolyline(mask, w, h, [[cx + lx * s, cy + 23 * s], [cx + kx * s, cy + 14 * s], [cx + fx * s, cy + 11 * s]]);
    drawPolyline(mask, w, h, [[cx + lx * s, cy + 33 * s], [cx + kx * s, cy + 42 * s], [cx + fx * s, cy + 45 * s]]);
  }

  // LAYER 2 (Inner Sacred Scarab Carapace — open top, bottom & sides!):
  drawMirrorBezier(
    mask, w, h, cx,
    18 * s, cy - 58 * s,
    62 * s, cy - 42 * s,
    66 * s, cy + 40 * s,
    24 * s, cy + 72 * s,
    true
  );
  // Subtle ribbed inner carapace filigree lines
  drawMirrorBezier(mask, w, h, cx, 44 * s, cy - 34 * s, 56 * s, cy - 10 * s, 56 * s, cy + 24 * s, 32 * s, cy + 56 * s);

  // LAYER 3A (Sweeping Horned Stag-Scarab Mandibles cradling a Radiant Solar Orb at top!):
  // Floating Solar Orb & rays above center
  drawArc(mask, w, h, cx, cy - 86 * s, 14 * s, 14 * s, 0, Math.PI * 2, true);
  drawArc(mask, w, h, cx, cy - 86 * s, 6 * s, 6 * s, 0, Math.PI * 2, false);
  // Giant curving antlered mandibles embracing the sun orb!
  drawMirrorBezier(
    mask, w, h, cx,
    24 * s, cy - 62 * s,
    46 * s, cy - 86 * s,
    40 * s, cy - 106 * s,
    22 * s, cy - 102 * s,
    true
  );
  drawMirrorBezier(
    mask, w, h, cx,
    36 * s, cy - 76 * s,
    54 * s, cy - 88 * s,
    56 * s, cy - 104 * s,
    44 * s, cy - 108 * s,
    false
  );

  // LAYER 3B (Epic Unfurled Ceremonial Scarab Wings & Articulated Royal Legs!):
  // Upper geometric armored wing cases (elytra raised outward!)
  drawMirrorBezier(
    mask, w, h, cx,
    62 * s, cy - 44 * s,
    108 * s, cy - 88 * s,
    154 * s, cy - 64 * s,
    162 * s, cy - 22 * s,
    true
  );
  drawMirrorBezier(
    mask, w, h, cx,
    162 * s, cy - 22 * s,
    144 * s, cy + 4 * s,
    102 * s, cy + 8 * s,
    72 * s, cy - 4 * s,
    true
  );
  // Translucent ribbed lower flight wings unfurling downward!
  drawMirrorBezier(
    mask, w, h, cx,
    72 * s, cy + 12 * s,
    132 * s, cy + 12 * s,
    152 * s, cy + 46 * s,
    114 * s, cy + 72 * s,
    true
  );
  drawMirrorBezier(
    mask, w, h, cx,
    114 * s, cy + 72 * s,
    88 * s, cy + 74 * s,
    68 * s, cy + 62 * s,
    56 * s, cy + 48 * s,
    true
  );
  // Crisp geometric wing vein struts (Egyptian-royal symmetry!)
  drawMirrorBezier(mask, w, h, cx, 78 * s, cy - 28 * s, 114 * s, cy - 52 * s, 136 * s, cy - 40 * s, 150 * s, cy - 22 * s);
  drawMirrorBezier(mask, w, h, cx, 78 * s, cy - 14 * s, 114 * s, cy - 22 * s, 132 * s, cy - 14 * s, 148 * s, cy - 10 * s);
  drawMirrorBezier(mask, w, h, cx, 76 * s, cy + 26 * s, 108 * s, cy + 32 * s, 126 * s, cy + 44 * s, 122 * s, cy + 58 * s);

  // Articulated Scarab forelegs & hindlegs reaching gracefully out
  drawPolyline(mask, w, h, [[cx - 52 * s, cy - 54 * s], [cx - 76 * s, cy - 86 * s], [cx - 102 * s, cy - 84 * s]], false, true);
  drawPolyline(mask, w, h, [[cx + 52 * s, cy - 54 * s], [cx + 76 * s, cy - 86 * s], [cx + 102 * s, cy - 84 * s]], false, true);
  drawPolyline(mask, w, h, [[cx - 48 * s, cy + 56 * s], [cx - 72 * s, cy + 88 * s], [cx - 96 * s, cy + 92 * s]], false, true);
  drawPolyline(mask, w, h, [[cx + 48 * s, cy + 56 * s], [cx + 72 * s, cy + 88 * s], [cx + 96 * s, cy + 92 * s]], false, true);

  // Hanging dotted incense chains & stars
  drawDottedLine(mask, w, h, cx - 24 * s, cy + 78 * s, cx - 24 * s, cy + 104 * s, 3.6 * s);
  drawDottedLine(mask, w, h, cx + 24 * s, cy + 78 * s, cx + 24 * s, cy + 104 * s, 3.6 * s);
  drawStar(mask, w, h, cx - 120 * s, cy - 80 * s, 4);
  drawStar(mask, w, h, cx + 120 * s, cy - 80 * s, 4);
  drawStar(mask, w, h, cx - 144 * s, cy + 62 * s, 3);
  drawStar(mask, w, h, cx + 144 * s, cy + 62 * s, 3);

  eraseCircle(mask, w, h, cx, cy, 11 * s);
  return mask;
}

/* =========================================================
   LEVEL 4: «Лунный Храм» — Полуночная Сова и Песочные Часы
   Unfolds outward from center:
   1) Falling dotted stream of glowing sand right through center into a crescent eye
   2) Delicate glass Hourglass curves with wide open arches
   3) Majestic Midnight Owl with layered sweeping feathered wings, sharp eyes & ear tufts
   4) Mystical arched lunar medallion with hanging starlight charms
   ========================================================= */
function generateMoonTempleArt(w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const cx = Math.floor(w * 0.5);
  const cy = Math.floor(h * 0.5);
  const s = Math.min(w / 440, h / 280);

  // LAYER 4: Grand outer lunar medallion
  drawNotchedMedallion(mask, w, h, cx, cy, w * 0.445, h * 0.445, true, false);

  // LAYER 1 (Immediate Center Discovery):
  // Dotted sand stream pouring from top bulb down to a crescent pool right below nest!
  drawDottedLine(mask, w, h, cx, cy - 52 * s, cx, cy - 16 * s, 3.2 * s);
  drawDottedLine(mask, w, h, cx, cy + 15 * s, cx, cy + 44 * s, 3.2 * s);
  // Crisp miniature crescent below center
  drawArc(mask, w, h, cx, cy + 46 * s, 12 * s, 8 * s, 0.25, Math.PI - 0.25, true);
  drawArc(mask, w, h, cx, cy + 42 * s, 10 * s, 6 * s, 0.4, Math.PI - 0.4, false);

  // LAYER 2 (Inner Hourglass / Owl Chest — open gateways on sides & bottom!):
  drawMirrorBezier(
    mask, w, h, cx,
    28 * s, cy - 58 * s,
    30 * s, cy - 26 * s,
    14 * s, cy - 12 * s,
    14 * s, cy - 2 * s,
    true
  );
  drawMirrorBezier(
    mask, w, h, cx,
    14 * s, cy + 6 * s,
    14 * s, cy + 18 * s,
    34 * s, cy + 32 * s,
    32 * s, cy + 60 * s,
    true
  );
  // Top & bottom hourglass rims (split cleanly with open central gateways + owl talons!)
  drawCrispLine(mask, w, h, cx - 32 * s, cy - 58 * s, cx - 10 * s, cy - 58 * s, true);
  drawCrispLine(mask, w, h, cx + 10 * s, cy - 58 * s, cx + 32 * s, cy - 58 * s, true);
  drawCrispLine(mask, w, h, cx - 34 * s, cy + 60 * s, cx - 12 * s, cy + 60 * s, true);
  drawCrispLine(mask, w, h, cx + 12 * s, cy + 60 * s, cx + 34 * s, cy + 60 * s, true);
  // Delicate curled owl talons gripping the hourglass base
  for (const dir of [-1, 1]) {
    drawPolyline(mask, w, h, [[cx + dir * 24 * s, cy + 56 * s], [cx + dir * 20 * s, cy + 64 * s], [cx + dir * 16 * s, cy + 60 * s]]);
    drawPolyline(mask, w, h, [[cx + dir * 32 * s, cy + 56 * s], [cx + dir * 28 * s, cy + 65 * s], [cx + dir * 24 * s, cy + 61 * s]]);
  }

  // LAYER 3 (Epic Outer Reveal — Majestic Spread-Winged Midnight Owl!):
  // Owl head crest & sharp feathery ear tufts above the hourglass!
  drawMirrorBezier(
    mask, w, h, cx,
    0, cy - 86 * s,
    18 * s, cy - 86 * s,
    30 * s, cy - 94 * s,
    40 * s, cy - 102 * s, // ear tuft tip!
    true
  );
  drawMirrorBezier(
    mask, w, h, cx,
    40 * s, cy - 102 * s,
    42 * s, cy - 84 * s,
    42 * s, cy - 72 * s,
    36 * s, cy - 64 * s,
    true
  );
  // Expressive circular owl eyes + sharp hooked beak!
  for (const dir of [-1, 1]) {
    drawArc(mask, w, h, cx + dir * 18 * s, cy - 74 * s, 8 * s, 8 * s, 0, Math.PI * 2, true);
    drawArc(mask, w, h, cx + dir * 18 * s, cy - 74 * s, 3 * s, 3 * s, 0, Math.PI * 2, false);
  }
  drawPolyline(
    mask, w, h,
    [
      [cx - 4 * s, cy - 68 * s],
      [cx, cy - 60 * s],
      [cx + 4 * s, cy - 68 * s]
    ],
    false,
    true
  );

  // Sweeping layered outstretched owl wings (3 tiers of crisp scalloped feathers!)
  drawMirrorBezier(
    mask, w, h, cx,
    42 * s, cy - 56 * s,
    92 * s, cy - 84 * s,
    144 * s, cy - 62 * s,
    164 * s, cy - 16 * s,
    true
  );
  // Primary flight feather tips cascading gracefully inward
  const featherTips: [number, number, number, number][] = [
    [164, -16, 140, 8],
    [146, 2, 120, 26],
    [126, 20, 98, 42],
    [104, 38, 76, 54],
    [82, 50, 54, 62]
  ];
  for (const [x0, y0, x1, y1] of featherTips) {
    drawMirrorBezier(
      mask, w, h, cx,
      x0 * s, cy + y0 * s,
      (x0 + 2) * s, cy + (y0 + 18) * s,
      (x1 + 8) * s, cy + (y1 + 6) * s,
      x1 * s, cy + y1 * s,
      true
    );
  }
  // Inner covert feather arcs
  drawMirrorBezier(mask, w, h, cx, 50 * s, cy - 38 * s, 96 * s, cy - 52 * s, 126 * s, cy - 32 * s, 140 * s, cy - 10 * s);
  drawMirrorBezier(mask, w, h, cx, 48 * s, cy - 18 * s, 86 * s, cy - 26 * s, 110 * s, cy - 8 * s, 120 * s, cy + 12 * s);

  // Tail feathers fanning gracefully beneath the hourglass
  for (const tx of [-22, -11, 0, 11, 22]) {
    drawCrispLine(mask, w, h, cx + tx * 0.7 * s, cy + 68 * s, cx + tx * 1.3 * s, cy + 94 * s, tx === 0);
  }
  drawArc(mask, w, h, cx, cy + 72 * s, 32 * s, 26 * s, 0.35, Math.PI - 0.35, true);

  // Hanging dotted starlight charms from both wingtips!
  drawDottedLine(mask, w, h, cx - 144 * s, cy + 16 * s, cx - 144 * s, cy + 56 * s, 4 * s);
  drawDottedLine(mask, w, h, cx + 144 * s, cy + 16 * s, cx + 144 * s, cy + 56 * s, 4 * s);
  drawStar(mask, w, h, cx - 144 * s, cy + 62 * s, 4);
  drawStar(mask, w, h, cx + 144 * s, cy + 62 * s, 4);
  drawStar(mask, w, h, cx - 98 * s, cy - 84 * s, 3);
  drawStar(mask, w, h, cx + 98 * s, cy - 84 * s, 3);

  eraseCircle(mask, w, h, cx, cy, 11 * s);
  return mask;
}

/* =========================================================
   LEVEL 5: «Древо Жизни» — Храм Мирового Древа и Ладони Защиты
   Unfolds outward from center:
   1) Glowing sprouting seed & tiny floating leaf right beside nest
   2) Hollow ancient trunk heart with wide arched root & bough openings
   3) Two graceful sculpted cupped Hands cradling the tree + sprawling fractal boughs, hanging lanterns & twin birds!
   4) Sacred circular medallion with twin sun & moon crests
   ========================================================= */
function generateTreeArt(w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const cx = Math.floor(w * 0.5);
  const cy = Math.floor(h * 0.5);
  const s = Math.min(w / 440, h / 280);

  // LAYER 4: Grand outer notched medallion
  drawNotchedMedallion(mask, w, h, cx, cy, w * 0.45, h * 0.445, true, true);

  // LAYER 1 (Immediate Center Discovery):
  // Delicate glowing seed & twin curled sprout leaves right beside the nest!
  drawDottedLine(mask, w, h, cx, cy - 38 * s, cx, cy - 16 * s, 3.2 * s);
  drawBezier(mask, w, h, cx, cy + 14 * s, cx - 14 * s, cy + 10 * s, cx - 18 * s, cy + 24 * s, cx - 4 * s, cy + 28 * s, true);
  drawBezier(mask, w, h, cx, cy + 14 * s, cx + 14 * s, cy + 10 * s, cx + 18 * s, cy + 24 * s, cx + 4 * s, cy + 28 * s, true);
  drawCrispLine(mask, w, h, cx, cy + 14 * s, cx, cy + 36 * s, true);

  // LAYER 2 (Ancient Gnarled Trunk — wide open center hollow & canopy arch!):
  drawMirrorBezier(
    mask, w, h, cx,
    18 * s, cy - 28 * s,
    24 * s, cy + 4 * s,
    26 * s, cy + 38 * s,
    44 * s, cy + 64 * s,
    true
  );
  // Subtle curved bark grain lines
  drawMirrorBezier(mask, w, h, cx, 13 * s, cy - 16 * s, 17 * s, cy + 8 * s, 19 * s, cy + 34 * s, 30 * s, cy + 54 * s);

  // LAYER 3A (Sweeping Fractal Canopy of Boughs curving overhead!):
  const branch = (x: number, y: number, len: number, angle: number, depth: number) => {
    if (depth <= 0) return;
    const nx = x + Math.cos(angle) * len;
    const ny = y + Math.sin(angle) * len;
    drawCrispLine(mask, w, h, x, y, nx, ny, depth >= 3);
    branch(nx, ny, len * 0.72, angle - 0.44, depth - 1);
    branch(nx, ny, len * 0.72, angle + 0.44, depth - 1);
  };
  // Left & right main bough crowns springing from the trunk top (leaving center wide open!)
  branch(cx - 18 * s, cy - 28 * s, 36 * s, -Math.PI * 0.72, 4);
  branch(cx + 18 * s, cy - 28 * s, 36 * s, -Math.PI * 0.28, 4);
  branch(cx, cy - 42 * s, 26 * s, -Math.PI * 0.5, 3);

  // Hanging dotted lantern-fruits beneath the sweeping boughs!
  for (const [lx, ly0, ly1] of [[-86, -42, -8], [-124, -22, 12], [86, -42, -8], [124, -22, 12]]) {
    drawDottedLine(mask, w, h, cx + lx * s, cy + ly0 * s, cx + lx * s, cy + ly1 * s, 3.6 * s);
    drawArc(mask, w, h, cx + lx * s, cy + (ly1 + 5) * s, 4.5 * s, 5.5 * s, 0, Math.PI * 2, true);
  }

  // LAYER 3B (Epic Outer Reveal — Two Graceful Cupped Hands cradling the World-Tree from below!):
  // Outer sweeping palm & wrist curve
  drawMirrorBezier(
    mask, w, h, cx,
    144 * s, cy + 20 * s,
    136 * s, cy + 70 * s,
    84 * s, cy + 96 * s,
    24 * s, cy + 96 * s,
    true
  );
  // Sculpted graceful finger tips curling around the canopy flanks (3 cascading fingers!)
  drawMirrorBezier(mask, w, h, cx, 144 * s, cy + 20 * s, 152 * s, cy + 4 * s, 142 * s, cy - 4 * s, 134 * s, cy + 8 * s, true);
  drawMirrorBezier(mask, w, h, cx, 134 * s, cy + 8 * s, 132 * s, cy - 2 * s, 122 * s, cy + 2 * s, 120 * s, cy + 18 * s, true);
  drawMirrorBezier(mask, w, h, cx, 120 * s, cy + 18 * s, 114 * s, cy + 32 * s, 108 * s, cy + 44 * s, 98 * s, cy + 54 * s, true);
  // Inner thumb & palm cradle curve
  drawMirrorBezier(
    mask, w, h, cx,
    98 * s, cy + 54 * s,
    82 * s, cy + 70 * s,
    58 * s, cy + 78 * s,
    26 * s, cy + 78 * s,
    true
  );
  // Tiny floating forest fireflies around canopy
  drawStar(mask, w, h, cx - 64 * s, cy - 78 * s, 3);
  drawStar(mask, w, h, cx + 64 * s, cy - 78 * s, 3);
  drawStar(mask, w, h, cx - 106 * s, cy - 58 * s, 3);
  drawStar(mask, w, h, cx + 106 * s, cy - 58 * s, 3);

  // Flowing roots descending softly into the cupped palms
  drawMirrorBezier(mask, w, h, cx, 44 * s, cy + 64 * s, 68 * s, cy + 64 * s, 88 * s, cy + 54 * s, 98 * s, cy + 44 * s);
  drawMirrorBezier(mask, w, h, cx, 26 * s, cy + 60 * s, 42 * s, cy + 72 * s, 58 * s, cy + 76 * s, 74 * s, cy + 72 * s);

  // Twin tiny celestial emblems: Sun on left, Crescent Moon on right
  drawArc(mask, w, h, cx - 144 * s, cy - 52 * s, 8 * s, 8 * s, 0, Math.PI * 2, true);
  drawStar(mask, w, h, cx - 144 * s, cy - 52 * s, 13);
  drawArc(mask, w, h, cx + 144 * s, cy - 52 * s, 9 * s, 9 * s, 0.4, Math.PI * 1.6, true);
  drawArc(mask, w, h, cx + 148 * s, cy - 54 * s, 7.5 * s, 7.5 * s, 0.65, Math.PI * 1.4, false);

  eraseCircle(mask, w, h, cx, cy, 11 * s);
  return mask;
}

/* =========================================================
   LEVEL 6 (HARD): «Хрустальная Гидра» — Трёхглавый Ледяной Дракон
   Unfolds outward from center:
   1) Floating faceted frost-crystal heart & suspended icicle droplets around nest
   2) Ornate sculpted crystalline chalice & three graceful open serpentine necks
   3) Three horned Dragon-Hydra heads exhaling dotted frost-star breath + fractal crystal antlers!
   4) Grand sapphire notched medallion with twin snowflake crests
   ========================================================= */
function generateHydraArt(w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const cx = Math.floor(w * 0.5);
  const cy = Math.floor(h * 0.5);
  const s = Math.min(w / 480, h / 300);

  // LAYER 4: Grand outer sapphire medallion (notched bottom & top)
  drawNotchedMedallion(mask, w, h, cx, cy, w * 0.455, h * 0.45, true, true);

  // LAYER 1 (Immediate Center Discovery — Floating Faceted Frost Heart & Droplets!):
  drawDottedLine(mask, w, h, cx, cy - 36 * s, cx, cy - 16 * s, 3.2 * s);
  drawPolyline(
    mask, w, h,
    [
      [cx, cy + 15 * s],
      [cx + 12 * s, cy + 27 * s],
      [cx, cy + 40 * s],
      [cx - 12 * s, cy + 27 * s]
    ],
    true,
    true
  );
  drawCrispLine(mask, w, h, cx, cy + 19 * s, cx, cy + 36 * s);
  drawCrispLine(mask, w, h, cx - 7 * s, cy + 27 * s, cx + 7 * s, cy + 27 * s);

  // LAYER 2 (Wide Open Glacial Body Crest & Coiled Tail Plume below!):
  // Sweeping open chest plates framing the nest (generous gaps so ants pass freely!)
  drawMirrorBezier(
    mask, w, h, cx,
    24 * s, cy + 16 * s,
    40 * s, cy + 40 * s,
    38 * s, cy + 68 * s,
    18 * s, cy + 88 * s,
    true
  );
  // Decorative layered ice-scale ribs on lower torso
  for (let k = 0; k < 3; k++) {
    const ry = cy + (48 + k * 12) * s;
    const rx = (28 - k * 4) * s;
    drawArc(mask, w, h, cx, ry, rx, 7 * s, 0.25, Math.PI - 0.25, false);
  }
  // Sweeping bifurcated crystalline tail fins below
  drawMirrorBezier(mask, w, h, cx, 18 * s, cy + 88 * s, 42 * s, cy + 96 * s, 68 * s, cy + 92 * s, 84 * s, cy + 78 * s, true);
  drawMirrorBezier(mask, w, h, cx, 84 * s, cy + 78 * s, 68 * s, cy + 76 * s, 54 * s, cy + 78 * s, 40 * s, cy + 70 * s);

  // LAYER 3A (Three Graceful Open Serpentine Dragon-Hydra Necks & Horned Heads!):
  // Center Crown Neck (open dotted spine up to the regal central head!)
  drawMirrorBezier(mask, w, h, cx, 14 * s, cy - 22 * s, 10 * s, cy - 42 * s, 12 * s, cy - 58 * s, 8 * s, cy - 72 * s, true);
  // Central Dragon Head (bold sculpted diamond snout, swept horns & glowing crest!)
  drawMirrorBezier(mask, w, h, cx, 8 * s, cy - 72 * s, 18 * s, cy - 82 * s, 14 * s, cy - 98 * s, 0, cy - 106 * s, true);
  // Central sweeping ice horns
  drawMirrorBezier(mask, w, h, cx, 13 * s, cy - 88 * s, 26 * s, cy - 100 * s, 32 * s, cy - 110 * s, 40 * s, cy - 108 * s, true);
  drawMirrorBezier(mask, w, h, cx, 10 * s, cy - 94 * s, 16 * s, cy - 106 * s, 18 * s, cy - 114 * s, 22 * s, cy - 116 * s);
  // Eyes of central hydra head
  drawStar(mask, w, h, cx - 5 * s, cy - 86 * s, 2);
  drawStar(mask, w, h, cx + 5 * s, cy - 86 * s, 2);

  // Left & Right Sinuous Hydra Necks sweeping majestically outward!
  drawMirrorBezier(
    mask, w, h, cx,
    30 * s, cy + 10 * s,
    66 * s, cy + 2 * s,
    92 * s, cy - 22 * s,
    98 * s, cy - 52 * s,
    true
  );
  drawMirrorBezier(
    mask, w, h, cx,
    26 * s, cy - 12 * s,
    54 * s, cy - 14 * s,
    74 * s, cy - 34 * s,
    82 * s, cy - 56 * s,
    true
  );
  // Side Hydra Heads (open snarling jaws, glowing eyes & crystal horns!)
  drawMirrorBezier(mask, w, h, cx, 98 * s, cy - 52 * s, 114 * s, cy - 62 * s, 126 * s, cy - 60 * s, 134 * s, cy - 48 * s, true);
  drawMirrorBezier(mask, w, h, cx, 82 * s, cy - 56 * s, 96 * s, cy - 72 * s, 116 * s, cy - 76 * s, 132 * s, cy - 66 * s, true);
  // Fierce eyes on side dragon heads
  drawStar(mask, w, h, cx - 110 * s, cy - 62 * s, 2);
  drawStar(mask, w, h, cx + 110 * s, cy - 62 * s, 2);
  // Lower jaw & frost fangs
  drawMirrorBezier(mask, w, h, cx, 102 * s, cy - 48 * s, 116 * s, cy - 44 * s, 124 * s, cy - 40 * s, 128 * s, cy - 34 * s);
  // Swept horns on flanking heads
  drawMirrorBezier(mask, w, h, cx, 92 * s, cy - 68 * s, 88 * s, cy - 86 * s, 82 * s, cy - 96 * s, 72 * s, cy - 102 * s, true);
  drawMirrorBezier(mask, w, h, cx, 104 * s, cy - 72 * s, 110 * s, cy - 90 * s, 118 * s, cy - 98 * s, 128 * s, cy - 98 * s);
  // Dotted crystalline ice-breath arcing outward from flanking jaws
  drawDottedLine(mask, w, h, cx - 134 * s, cy - 54 * s, cx - 172 * s, cy - 34 * s, 4.2 * s);
  drawDottedLine(mask, w, h, cx + 134 * s, cy - 54 * s, cx + 172 * s, cy - 34 * s, 4.2 * s);
  drawDottedLine(mask, w, h, cx - 132 * s, cy - 44 * s, cx - 166 * s, cy - 16 * s, 4.4 * s);
  drawDottedLine(mask, w, h, cx + 132 * s, cy - 44 * s, cx + 166 * s, cy - 16 * s, 4.4 * s);

  // LAYER 3B (Epic Outer Glacial Crystal Wing-Spikes & Twin Snowflake Sigils!):
  drawMirrorBezier(mask, w, h, cx, 56 * s, cy + 28 * s, 104 * s, cy + 16 * s, 146 * s, cy + 18 * s, 174 * s, cy + 6 * s, true);
  drawMirrorBezier(mask, w, h, cx, 52 * s, cy + 44 * s, 96 * s, cy + 38 * s, 134 * s, cy + 44 * s, 158 * s, cy + 34 * s, true);
  drawMirrorBezier(mask, w, h, cx, 46 * s, cy + 60 * s, 84 * s, cy + 58 * s, 112 * s, cy + 66 * s, 132 * s, cy + 60 * s);

  // Twin geometric 6-ray Snowflakes flanking the flanks
  for (const side of [-1, 1]) {
    const sx = cx + side * 156 * s;
    const sy = cy - 62 * s;
    for (let a = 0; a < 3; a++) {
      const ang = (a * Math.PI) / 3;
      drawCrispLine(mask, w, h, sx - Math.cos(ang) * 11 * s, sy - Math.sin(ang) * 11 * s, sx + Math.cos(ang) * 11 * s, sy + Math.sin(ang) * 11 * s);
    }
    drawStar(mask, w, h, cx + side * 168 * s, cy + 64 * s, 4);
    drawStar(mask, w, h, cx + side * 56 * s, cy - 92 * s, 3);
  }

  eraseCircle(mask, w, h, cx, cy, 12 * s);
  return mask;
}

/* =========================================================
   LEVEL 7 (HARD): «Пепельный Феникс» — Восставшая Птица Пламени
   Unfolds outward from center:
   1) Glowing suspended cinder-egg & rising ember sparks right beside the nest
   2) Regal sculpted phoenix breast-crest & soaring sweeping tail-plumes below
   3) Magnificent wide layered feathered wings + crowned firebird head + radiant solar halo!
   4) Grand volcanic caldera medallion with twin flame sigils
   ========================================================= */
function generatePhoenixArt(w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const cx = Math.floor(w * 0.5);
  const cy = Math.floor(h * 0.5);
  const s = Math.min(w / 500, h / 320);

  // LAYER 4: Grand volcanic caldera medallion
  drawNotchedMedallion(mask, w, h, cx, cy, w * 0.455, h * 0.45, true, false);

  // LAYER 1 (Immediate Center Discovery — Floating Ember Cinder & Rising Sparks!):
  drawDottedLine(mask, w, h, cx, cy - 38 * s, cx, cy - 16 * s, 3.2 * s);
  drawArc(mask, w, h, cx, cy + 24 * s, 9 * s, 12 * s, 0, Math.PI * 2, true);
  drawDottedLine(mask, w, h, cx, cy + 38 * s, cx, cy + 54 * s, 3.5 * s);
  drawStar(mask, w, h, cx - 18 * s, cy + 18 * s, 3);
  drawStar(mask, w, h, cx + 18 * s, cy + 18 * s, 3);

  // LAYER 2 (Sculpted Phoenix Neck, Regal Crested Head & Solar Halo above!):
  // Wide open chest shoulder arcs
  drawMirrorBezier(mask, w, h, cx, 16 * s, cy - 20 * s, 26 * s, cy - 2 * s, 24 * s, cy + 28 * s, 14 * s, cy + 48 * s, true);
  // Rising graceful neck up to proud crowned Phoenix Head
  drawMirrorBezier(mask, w, h, cx, 14 * s, cy - 24 * s, 12 * s, cy - 46 * s, 10 * s, cy - 64 * s, 6 * s, cy - 78 * s, true);
  // Phoenix head profile looking slightly right + fierce hooked beak + flowing crest plumes!
  drawBezier(mask, w, h, cx - 6 * s, cy - 78 * s, cx - 14 * s, cy - 90 * s, cx - 2 * s, cy - 102 * s, cx + 12 * s, cy - 94 * s, true);
  drawBezier(mask, w, h, cx + 12 * s, cy - 94 * s, cx + 22 * s, cy - 90 * s, cx + 24 * s, cy - 82 * s, cx + 14 * s, cy - 78 * s, true);
  drawCrispLine(mask, w, h, cx + 10 * s, cy - 84 * s, cx + 20 * s, cy - 84 * s);
  drawStar(mask, w, h, cx + 3 * s, cy - 89 * s, 2);
  // Three sweeping fiery crown plumes streaming back from the head!
  drawBezier(mask, w, h, cx - 6 * s, cy - 96 * s, cx - 24 * s, cy - 110 * s, cx - 44 * s, cy - 112 * s, cx - 60 * s, cy - 102 * s, true);
  drawBezier(mask, w, h, cx - 4 * s, cy - 98 * s, cx - 16 * s, cy - 116 * s, cx - 32 * s, cy - 122 * s, cx - 48 * s, cy - 116 * s);
  drawBezier(mask, w, h, cx + 4 * s, cy - 98 * s, cx + 14 * s, cy - 114 * s, cx + 28 * s, cy - 118 * s, cx + 42 * s, cy - 112 * s);

  // Dotted radiant solar halo behind the phoenix head
  drawArc(mask, w, h, cx, cy - 82 * s, 32 * s, 32 * s, -Math.PI * 0.92, -Math.PI * 0.08, false, 4.2 * s);

  // LAYER 3A (Magnificent Sweeping Layered Feathered Wings!):
  // Main bold upper leading wing edge soaring skyward on both sides (clean breathing gap inside medallion!)
  drawMirrorBezier(
    mask, w, h, cx,
    24 * s, cy - 16 * s,
    76 * s, cy - 74 * s,
    136 * s, cy - 90 * s,
    180 * s, cy - 70 * s,
    true
  );
  // Upper secondary wing ridge
  drawMirrorBezier(
    mask, w, h, cx,
    28 * s, cy - 4 * s,
    74 * s, cy - 48 * s,
    128 * s, cy - 62 * s,
    168 * s, cy - 44 * s,
    true
  );
  // 5 bold tiered cascading primary flight feathers fanning out gracefully (open passages between feathers!)
  const featherTips: [number, number, number, number][] = [
    [180, -70, 166, -52],
    [174, -50, 154, -30],
    [164, -28, 140, -10],
    [150, -6, 124, 12],
    [134, 16, 106, 30]
  ];
  for (const [fx0, fy0, fx1, fy1] of featherTips) {
    drawMirrorBezier(
      mask, w, h, cx,
      fx0 * s, cy + fy0 * s,
      (fx0 - 11) * s, cy + (fy0 + 15) * s,
      (fx1 + 8) * s, cy + (fy1 + 4) * s,
      fx1 * s, cy + fy1 * s,
      true
    );
  }
  // Inner secondary plumage ribs curving down toward the waist
  drawMirrorBezier(mask, w, h, cx, 32 * s, cy + 8 * s, 70 * s, cy - 16 * s, 112 * s, cy - 18 * s, 146 * s, cy - 6 * s);
  drawMirrorBezier(mask, w, h, cx, 30 * s, cy + 20 * s, 64 * s, cy + 6 * s, 98 * s, cy + 12 * s, 126 * s, cy + 22 * s);
  drawMirrorBezier(mask, w, h, cx, 26 * s, cy + 32 * s, 56 * s, cy + 28 * s, 82 * s, cy + 36 * s, 102 * s, cy + 44 * s);

  // LAYER 3B (Flowing Blazing Phoenix Tail Plumes & Twin Flame Emblems!):
  // Central sweeping flame ribbon tail (clears bottom notch neatly!)
  drawBezier(mask, w, h, cx, cy + 56 * s, cx - 16 * s, cy + 74 * s, cx + 16 * s, cy + 92 * s, cx, cy + 112 * s, true);
  // Twin symmetrical outer ribbon tail feathers with ornate eye-tips
  drawMirrorBezier(mask, w, h, cx, 14 * s, cy + 48 * s, 46 * s, cy + 68 * s, 74 * s, cy + 92 * s, 66 * s, cy + 116 * s, true);
  drawMirrorBezier(mask, w, h, cx, 10 * s, cy + 54 * s, 30 * s, cy + 78 * s, 42 * s, cy + 100 * s, 32 * s, cy + 120 * s);
  // Glowing feather-eye rings at tail tips
  drawArc(mask, w, h, cx - 66 * s, cy + 116 * s, 6 * s, 6 * s, 0, Math.PI * 2, true);
  drawArc(mask, w, h, cx + 66 * s, cy + 116 * s, 6 * s, 6 * s, 0, Math.PI * 2, true);

  // Twin rising flame sigils & floating cinders in lower flanks
  for (const side of [-1, 1]) {
    const fx = cx + side * 144 * s;
    const fy = cy + 66 * s;
    drawBezier(mask, w, h, fx, fy + 16 * s, fx - 12 * s, fy + 4 * s, fx - 8 * s, fy - 10 * s, fx, fy - 20 * s, true);
    drawBezier(mask, w, h, fx, fy + 16 * s, fx + 12 * s, fy + 4 * s, fx + 8 * s, fy - 10 * s, fx, fy - 20 * s, true);
    drawDottedLine(mask, w, h, fx, fy - 26 * s, fx, fy - 42 * s, 4 * s);
    drawStar(mask, w, h, cx + side * 116 * s, cy - 100 * s, 4);
    drawStar(mask, w, h, cx + side * 168 * s, cy + 36 * s, 3);
  }

  eraseCircle(mask, w, h, cx, cy, 12 * s);
  return mask;
}

/* =========================================================
   LEVEL 8 (EXTREME): «Бездна Левиафана» — Древний Космический Змей
   Unfolds outward from center:
   1) Glowing Abyssal Compass-Eye & suspended astral pearl right beside nest
   2) Wide sweeping arched leviathan rib-cathedral framing the abyssal portal
   3) Colossal crowned Void-Serpent head above + twin coiling bioluminescent tentacles with hanging lantern-lures!
   4) Grand cosmic eclipse medallion with twin ringed moons & astral constellations
   ========================================================= */
function generateLeviathanArt(w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const cx = Math.floor(w * 0.5);
  const cy = Math.floor(h * 0.5);
  const s = Math.min(w / 520, h / 340);

  // LAYER 4: Grand outer cosmic eclipse medallion (double top-notched astral ring!)
  drawNotchedMedallion(mask, w, h, cx, cy, w * 0.46, h * 0.455, true, true);
  // Subtle inner dotted constellation arcs tucked neatly inside the notched flanks!
  drawArc(mask, w, h, cx, cy, w * 0.425, h * 0.415, -Math.PI * 0.85, -Math.PI * 0.62, false, 6.5 * s);
  drawArc(mask, w, h, cx, cy, w * 0.425, h * 0.415, -Math.PI * 0.38, -Math.PI * 0.15, false, 6.5 * s);
  drawArc(mask, w, h, cx, cy, w * 0.425, h * 0.415, Math.PI * 0.15, Math.PI * 0.38, false, 6.5 * s);
  drawArc(mask, w, h, cx, cy, w * 0.425, h * 0.415, Math.PI * 0.62, Math.PI * 0.85, false, 6.5 * s);

  // LAYER 1 (Immediate Center Discovery — Floating Astral Pearl & Abyssal Needle!):
  drawDottedLine(mask, w, h, cx, cy - 42 * s, cx, cy - 16 * s, 3.2 * s);
  drawDottedLine(mask, w, h, cx, cy + 16 * s, cx, cy + 40 * s, 3.2 * s);
  drawArc(mask, w, h, cx, cy + 48 * s, 7 * s, 7 * s, 0, Math.PI * 2, true);
  drawStar(mask, w, h, cx - 22 * s, cy, 3);
  drawStar(mask, w, h, cx + 22 * s, cy, 3);

  // LAYER 2 (Wide Open Abyssal Leviathan Rib-Cathedral framing the central sanctuary!):
  for (let i = 0; i < 5; i++) {
    const ry = cy + (-44 + i * 24) * s;
    const spread = (34 + Math.sin((i / 4) * Math.PI) * 32) * s;
    drawMirrorBezier(
      mask, w, h, cx,
      spread * 0.65, ry - 6 * s,
      spread * 1.15, ry - 2 * s,
      spread * 1.28, ry + 12 * s,
      spread * 0.92, ry + 20 * s,
      i === 1 || i === 2
    );
  }

  // LAYER 3A (Colossal Crowned Void-Leviathan Head & Astral Mandibles rising above!):
  // Sculpted horned serpent skull silhouette (open center throat!)
  drawMirrorBezier(mask, w, h, cx, 16 * s, cy - 58 * s, 38 * s, cy - 68 * s, 44 * s, cy - 92 * s, 26 * s, cy - 114 * s, true);
  drawMirrorBezier(mask, w, h, cx, 26 * s, cy - 114 * s, 14 * s, cy - 126 * s, 6 * s, cy - 128 * s, 0, cy - 122 * s, true);
  // Sweeping jagged cosmic crown antlers flaring outward!
  drawMirrorBezier(mask, w, h, cx, 32 * s, cy - 98 * s, 64 * s, cy - 114 * s, 96 * s, cy - 118 * s, 124 * s, cy - 102 * s, true);
  drawMirrorBezier(mask, w, h, cx, 42 * s, cy - 86 * s, 72 * s, cy - 94 * s, 98 * s, cy - 92 * s, 118 * s, cy - 78 * s);
  // Fierce abyssal glowing triple-eyes!
  drawMirrorBezier(mask, w, h, cx, 12 * s, cy - 88 * s, 18 * s, cy - 92 * s, 24 * s, cy - 90 * s, 28 * s, cy - 84 * s, true);
  drawStar(mask, w, h, cx - 18 * s, cy - 88 * s, 3);
  drawStar(mask, w, h, cx + 18 * s, cy - 88 * s, 3);
  drawStar(mask, w, h, cx, cy - 104 * s, 4);
  // Hanging curved abyssal fangs / mandibles
  drawMirrorBezier(mask, w, h, cx, 28 * s, cy - 66 * s, 36 * s, cy - 52 * s, 32 * s, cy - 40 * s, 22 * s, cy - 34 * s, true);

  // LAYER 3B (Twin Sweeping Coiling Abyssal Tentacles + Hanging Bioluminescent Lantern-Lures!):
  // Upper colossal tentacles curling outward across both wings of the map
  drawMirrorBezier(
    mask, w, h, cx,
    78 * s, cy - 28 * s,
    126 * s, cy - 66 * s,
    176 * s, cy - 56 * s,
    194 * s, cy - 18 * s,
    true
  );
  drawMirrorBezier(
    mask, w, h, cx,
    194 * s, cy - 18 * s,
    202 * s, cy + 10 * s,
    180 * s, cy + 32 * s,
    156 * s, cy + 20 * s,
    true
  );
  // Lower counter-spiraling tentacles curving along the bottom depths
  drawMirrorBezier(
    mask, w, h, cx,
    68 * s, cy + 44 * s,
    118 * s, cy + 54 * s,
    166 * s, cy + 78 * s,
    182 * s, cy + 52 * s,
    true
  );
  drawMirrorBezier(
    mask, w, h, cx,
    40 * s, cy + 76 * s,
    78 * s, cy + 94 * s,
    118 * s, cy + 108 * s,
    144 * s, cy + 94 * s,
    true
  );
  // Twin lower tail fluke arches embracing the bottom notch
  drawMirrorBezier(mask, w, h, cx, 8 * s, cy + 80 * s, 26 * s, cy + 104 * s, 48 * s, cy + 118 * s, 72 * s, cy + 124 * s, true);

  // Hanging bioluminescent lantern-lures dangling beneath the upper tentacles!
  for (const side of [-1, 1]) {
    const lx = cx + side * 144 * s;
    drawDottedLine(mask, w, h, lx, cy - 42 * s, lx, cy - 6 * s, 3.8 * s);
    drawArc(mask, w, h, lx, cy + 2 * s, 6 * s, 8 * s, 0, Math.PI * 2, true);
    drawStar(mask, w, h, lx, cy + 2 * s, 3);

    // Twin ringed cosmic moons flanking the abyssal crown
    const mx = cx + side * 158 * s;
    const my = cy - 76 * s;
    drawArc(mask, w, h, mx, my, 10 * s, 10 * s, 0, Math.PI * 2, true);
    drawArc(mask, w, h, mx, my, 18 * s, 5.5 * s, -0.3, Math.PI + 0.3, false);

    // Extra deep-space constellation stars
    drawStar(mask, w, h, cx + side * 116 * s, cy + 24 * s, 4);
    drawStar(mask, w, h, cx + side * 178 * s, cy + 82 * s, 3);
    drawStar(mask, w, h, cx + side * 78 * s, cy - 118 * s, 3);
  }

  eraseCircle(mask, w, h, cx, cy, 12 * s);
  return mask;
}

export const LEVELS: LevelDefinition[] = [
  {
    id: 'prism',
    name: 'Призма Света',
    nameEn: 'Prism of Light',
    subtitle: 'Тайный ключ в крыльях Лунного Мотылька',
    subtitleEn: 'A secret key cradled within the Lunar Moth wings',
    width: 440,
    height: 280,
    crystalCount: 48,
    palette: {
      bgHex: '#0b1d13',
      bgRgb: [11, 29, 19],
      emptyRgb: [4, 7, 9],
      softRgb: [16, 44, 28],
      clayRgb: [28, 66, 48],
      stoneRgb: [42, 56, 74],
      obsidianRgb: [58, 28, 72],
      artGlowRgb: [235, 252, 255],
      accentHex: '#3ce87a'
    },
    generateArt: generatePrismArt
  },
  {
    id: 'galaxy',
    name: 'Спиральная Галактика',
    nameEn: 'Spiral Galaxy',
    subtitle: 'Космический Кит, плывущий сквозь звёздную астролябию',
    subtitleEn: 'A Cosmic Whale gliding through a celestial astrolabe',
    width: 484,
    height: 306,
    crystalCount: 62,
    palette: {
      bgHex: '#0b1224',
      bgRgb: [11, 18, 36],
      emptyRgb: [4, 5, 11],
      softRgb: [18, 30, 56],
      clayRgb: [28, 46, 82],
      stoneRgb: [46, 56, 92],
      obsidianRgb: [72, 30, 88],
      artGlowRgb: [220, 240, 255],
      accentHex: '#35d6ff'
    },
    generateArt: generateGalaxyArt
  },
  {
    id: 'ant-crown',
    name: 'Корона Колонии',
    nameEn: 'Colony Crown',
    subtitle: 'Солнечный Скарабей с распахнутыми крыльями вокруг печати колонии',
    subtitleEn: 'The Solar Scarab spreading golden wings around the royal seal',
    width: 540,
    height: 342,
    crystalCount: 74,
    palette: {
      bgHex: '#1c130b',
      bgRgb: [28, 19, 11],
      emptyRgb: [8, 5, 4],
      softRgb: [46, 30, 16],
      clayRgb: [68, 44, 24],
      stoneRgb: [78, 58, 44],
      obsidianRgb: [76, 28, 36],
      artGlowRgb: [255, 244, 218],
      accentHex: '#ff9d42'
    },
    generateArt: generateAntCrownArt
  },
  {
    id: 'moon-temple',
    name: 'Лунный Храм',
    nameEn: 'Moon Temple',
    subtitle: 'Полуночная Сова, хранящая песочные часы времени',
    subtitleEn: 'The Midnight Owl guarding the hourglass of eternity',
    width: 622,
    height: 396,
    crystalCount: 92,
    palette: {
      bgHex: '#160e21',
      bgRgb: [22, 14, 33],
      emptyRgb: [6, 4, 10],
      softRgb: [36, 24, 54],
      clayRgb: [54, 36, 78],
      stoneRgb: [62, 54, 92],
      obsidianRgb: [86, 32, 68],
      artGlowRgb: [242, 228, 255],
      accentHex: '#e04bff'
    },
    generateArt: generateMoonTempleArt
  },
  {
    id: 'tree-of-life',
    name: 'Древо Жизни',
    nameEn: 'Tree of Life',
    subtitle: 'Мировое Древо, бережно укрытое в ладонях земли',
    subtitleEn: 'The World Tree gently cradled within earthly palms',
    width: 622,
    height: 396,
    crystalCount: 96,
    palette: {
      bgHex: '#0c1e1c',
      bgRgb: [12, 30, 28],
      emptyRgb: [4, 9, 9],
      softRgb: [20, 48, 44],
      clayRgb: [34, 68, 54],
      stoneRgb: [60, 62, 42],
      obsidianRgb: [72, 48, 26],
      artGlowRgb: [232, 255, 244],
      accentHex: '#42f5c5'
    },
    generateArt: generateTreeArt
  },
  {
    id: 'crystal-hydra',
    name: 'Хрустальная Гидра',
    nameEn: 'Crystal Hydra',
    subtitle: 'Трёхглавый ледяной дракон в толще плотного гранита',
    subtitleEn: 'Three-headed glacial dragon encased in dense sapphire rock',
    width: 860,
    height: 536,
    crystalCount: 145,
    difficulty: 1.35,
    difficultyLabel: 'hard',
    palette: {
      bgHex: '#081926',
      bgRgb: [8, 25, 38],
      emptyRgb: [3, 8, 14],
      softRgb: [14, 38, 58],
      clayRgb: [22, 54, 82],
      stoneRgb: [36, 68, 98],
      obsidianRgb: [42, 32, 92],
      artGlowRgb: [210, 248, 255],
      accentHex: '#52e5ff'
    },
    generateArt: generateHydraArt
  },
  {
    id: 'ember-phoenix',
    name: 'Пепельный Феникс',
    nameEn: 'Ember Phoenix',
    subtitle: 'Огненная птица в вулканической породе и базальте',
    subtitleEn: 'Risen firebird sealed inside volcanic basalt and ember stone',
    width: 896,
    height: 572,
    crystalCount: 160,
    difficulty: 1.65,
    difficultyLabel: 'hard',
    rockHpMult: 1.5,
    palette: {
      bgHex: '#1f0d0a',
      bgRgb: [31, 13, 10],
      emptyRgb: [9, 4, 4],
      softRgb: [52, 22, 16],
      clayRgb: [74, 32, 22],
      stoneRgb: [86, 44, 38],
      obsidianRgb: [94, 24, 42],
      artGlowRgb: [255, 232, 206],
      accentHex: '#ff6b35'
    },
    generateArt: generatePhoenixArt
  },
  {
    id: 'void-leviathan',
    name: 'Бездна Левиафана',
    nameEn: 'Void Leviathan',
    subtitle: 'Древний змей бездны — предельное испытание для колонии',
    subtitleEn: 'Ancient serpent of the astral abyss — the ultimate colony trial',
    width: 930,
    height: 608,
    crystalCount: 175,
    difficulty: 1.95,
    difficultyLabel: 'extreme',
    rockHpMult: 1.5,
    palette: {
      bgHex: '#0e0a20',
      bgRgb: [14, 10, 32],
      emptyRgb: [4, 3, 11],
      softRgb: [24, 18, 54],
      clayRgb: [38, 26, 78],
      stoneRgb: [54, 36, 94],
      obsidianRgb: [78, 22, 86],
      artGlowRgb: [236, 218, 255],
      accentHex: '#c77dff'
    },
    generateArt: generateLeviathanArt
  }
];
