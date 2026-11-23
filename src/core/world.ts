import { computeReachableMask, computeReachableWithDist, isReachableTerrainSquare } from './reachability';
import { ArtifactDef, CellType, LevelDefinition, WorldStats } from './types';

export interface WorldSnapshot {
  v: 1;
  levelId: string;
  width: number;
  height: number;
  nestX: number;
  nestY: number;
  sugarX: number;
  sugarY: number;
  sugarExposed: boolean;
  artifactId: string | null;
  artifactX: number;
  artifactY: number;
  artifactExposed: boolean;
  stats: WorldStats;
  cellsRle: string;
  revealedRle: string;
  artExposedRle: string;
  damagedHp: [number, number][];
}

const HEX = '0123456789abcdef';

/** Ultra-compact RLE encoder for 0..15 nibble arrays: single hex char + base36 run length separated by ',' */
function encodeNibbleRle(arr: Uint8Array, shiftRight = 0): string {
  const n = arr.length;
  if (n === 0) return '';
  const parts: string[] = [];
  let cur = (arr[0] >> shiftRight) & 15;
  let run = 1;
  for (let i = 1; i < n; i++) {
    const v = (arr[i] >> shiftRight) & 15;
    if (v === cur) {
      run++;
    } else {
      parts.push(run === 1 ? HEX[cur] : HEX[cur] + run.toString(36));
      cur = v;
      run = 1;
    }
  }
  parts.push(run === 1 ? HEX[cur] : HEX[cur] + run.toString(36));
  return parts.join(',');
}

function decodeNibbleRle(rle: string, target: Uint8Array, expandToByte = false): boolean {
  const parts = rle.split(',');
  let pos = 0;
  const maxLen = target.length;
  for (let i = 0; i < parts.length; i++) {
    const token = parts[i];
    if (!token) continue;
    const val = parseInt(token[0], 16);
    if (Number.isNaN(val)) return false;
    const run = token.length === 1 ? 1 : parseInt(token.slice(1), 36);
    if (!Number.isFinite(run) || run <= 0) return false;
    const outVal = expandToByte ? (val << 4) | val : val;
    const end = Math.min(maxLen, pos + run);
    target.fill(outVal, pos, end);
    pos = end;
    if (pos >= maxLen) break;
  }
  return pos === maxLen;
}

export interface DigResult {
  hitSolid: boolean;
  hitIndestructible: boolean;
  dugCount: number;
  damagedCount: number;
  crystalsBroken: number;
  sugarHit: boolean;
  artifactFound: ArtifactDef | null;
  artRevealed: number;
  sporeBlasts: { x: number; y: number }[];
  sugarDustHits: { x: number; y: number }[];
  cocoonHatches: { x: number; y: number }[];
}

export const BLOCK_HP: Record<number, number> = {
  [CellType.Empty]: 0,
  [CellType.SoftSoil]: 3,
  [CellType.Clay]: 8,
  [CellType.Stone]: 18,
  [CellType.Obsidian]: 36,
  [CellType.HiddenArt]: 255,
  [CellType.SkillCrystal]: 10,
  [CellType.Sugar]: 1,
  [CellType.Artifact]: 6,
  [CellType.ExplosiveSpore]: 5,
  [CellType.SugarDust]: 6,
  [CellType.AncientCocoon]: 7
};

export class World {
  readonly width: number;
  readonly height: number;
  readonly level: LevelDefinition;
  readonly revealRadius: number;

  cells: Uint8Array;
  hp: Uint8Array;
  maxHp: Uint8Array;
  /** 1 if this pixel is adjacent to at least one Empty pixel (for calm rim shading) */
  isEdge: Uint8Array;
  /** 1 if this pixel is within tunnel vision radius (reveals SkillCrystals!) */
  revealedMask: Uint8Array;
  /** 1 if this HiddenArt pixel has been exposed to Empty space */
  artExposed: Uint8Array;
  /** 1 if this cell is genuinely reachable by ants from the nest (BFS flood-fill!) */
  reachableMask: Uint8Array;
  /** 1 if this cell is currently corroded by Scout acid poison */
  poisonMask: Uint8Array;
  private poisonEntries = new Map<number, { timeLeft: number; dps: number; accum: number }>();
  noise: Uint8Array;

  nestX: number;
  nestY: number;
  sugarX: number;
  sugarY: number;
  sugarExposed = false;

  artifactDef: ArtifactDef | null = null;
  artifactX = -1;
  artifactY = -1;
  artifactExposed = false;

  stats: WorldStats;
  /** Incremented whenever cells, HP, exposure or fog change (used by renderer to skip redundant pixel rebuilds!) */
  visualVersion = 1;

  constructor(
    level: LevelDefinition,
    farSenseMutation = false,
    artifactToSpawn: ArtifactDef | null = null,
    skipGenerate = false
  ) {
    this.level = level;
    this.width = level.width;
    this.height = level.height;
    this.revealRadius = farSenseMutation ? 36 : 22;
    this.artifactDef = artifactToSpawn;

    const size = this.width * this.height;
    this.cells = new Uint8Array(size);
    this.hp = new Uint8Array(size);
    this.maxHp = new Uint8Array(size);
    this.isEdge = new Uint8Array(size);
    this.revealedMask = new Uint8Array(size);
    this.artExposed = new Uint8Array(size);
    this.reachableMask = new Uint8Array(size);
    this.poisonMask = new Uint8Array(size);
    this.noise = new Uint8Array(size);

    this.nestX = Math.floor(this.width * 0.5);
    this.nestY = Math.floor(this.height * 0.5);
    this.sugarX = Math.floor(this.width * 0.28);
    this.sugarY = Math.floor(this.height * 0.28);

    this.stats = {
      totalBreakable: 0,
      dugBreakable: 0,
      totalArt: 0,
      revealedArt: 0,
      sugarFound: false,
      mapCleared: false,
      artifactCollected: false,
      crystalsCollected: 0,
      totalCrystals: 0
    };

    if (!skipGenerate) {
      this.generate();
    }
  }

  /** Exports a compact (~12-25 KB) pixel-exact snapshot for mid-map progress persistence! */
  exportSnapshot(): WorldSnapshot {
    const damagedHp: [number, number][] = [];
    const total = this.width * this.height;
    for (let i = 0; i < total; i++) {
      const c = this.cells[i];
      if (c === CellType.Empty || c === CellType.HiddenArt || c === CellType.Sugar) continue;
      const base = BLOCK_HP[c] ?? 1;
      if (this.hp[i] !== base) {
        damagedHp.push([i, this.hp[i]]);
      }
    }

    return {
      v: 1,
      levelId: this.level.id,
      width: this.width,
      height: this.height,
      nestX: this.nestX,
      nestY: this.nestY,
      sugarX: this.sugarX,
      sugarY: this.sugarY,
      sugarExposed: this.sugarExposed,
      artifactId: this.artifactDef ? this.artifactDef.id : null,
      artifactX: this.artifactX,
      artifactY: this.artifactY,
      artifactExposed: this.artifactExposed,
      stats: { ...this.stats },
      cellsRle: encodeNibbleRle(this.cells, 0),
      revealedRle: encodeNibbleRle(this.revealedMask, 4),
      artExposedRle: encodeNibbleRle(this.artExposed, 0),
      damagedHp
    };
  }

  /** Restores a previously saved mid-map World pixel-for-pixel! */
  static fromSnapshot(
    snap: WorldSnapshot,
    level: LevelDefinition,
    farSenseMutation: boolean,
    artifactDef: ArtifactDef | null
  ): World | null {
    if (snap.v !== 1 || snap.width !== level.width || snap.height !== level.height) {
      return null;
    }

    const w = new World(level, farSenseMutation, artifactDef, true);
    if (!decodeNibbleRle(snap.cellsRle, w.cells, false)) return null;
    if (!decodeNibbleRle(snap.revealedRle, w.revealedMask, true)) return null;
    if (!decodeNibbleRle(snap.artExposedRle, w.artExposed, false)) return null;

    w.nestX = snap.nestX;
    w.nestY = snap.nestY;
    w.sugarX = snap.sugarX;
    w.sugarY = snap.sugarY;
    w.sugarExposed = Boolean(snap.sugarExposed);
    w.artifactX = snap.artifactX;
    w.artifactY = snap.artifactY;
    w.artifactExposed = Boolean(snap.artifactExposed);
    w.stats = { ...snap.stats };

    const width = w.width;
    const height = w.height;
    // Recompute deterministic noise & default HP per cell
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const idx = row + x;
        const hash = ((x * 374761393 + y * 668265263) ^ (x * y * 1274126177)) >>> 0;
        w.noise[idx] = hash & 255;

        let c = w.cells[idx] as CellType;
        // If artifact was already collected permanently elsewhere, replace leftover artifact pixels cleanly
        if (c === CellType.Artifact && (!artifactDef || w.stats.artifactCollected)) {
          c = CellType.SoftSoil;
          w.cells[idx] = c;
        }
        const baseHp = BLOCK_HP[c] ?? 1;
        w.hp[idx] = baseHp;
        w.maxHp[idx] = baseHp;
      }
    }

    // Apply sparse damaged HP values
    if (Array.isArray(snap.damagedHp)) {
      for (let i = 0; i < snap.damagedHp.length; i++) {
        const [idx, val] = snap.damagedHp[i];
        if (idx >= 0 && idx < w.hp.length && val > 0 && val <= w.maxHp[idx]) {
          w.hp[idx] = val;
        }
      }
    }

    // Derive 8-connected exposed edges (matching updateNeighbors!) & reachable mask cleanly
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const idx = row + x;
        if (w.cells[idx] === CellType.Empty) continue;
        let adjEmpty = false;
        for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1) && !adjEmpty; ny++) {
          const nRow = ny * width;
          for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
            if (w.cells[nRow + nx] === CellType.Empty) {
              adjEmpty = true;
              break;
            }
          }
        }
        if (adjEmpty) w.isEdge[idx] = 1;
      }
    }
    w.reachableMask = computeReachableMask(w.cells, width, height, [{ x: w.nestX, y: w.nestY }]);
    w.visualVersion++;
    return w;
  }

  private setBlock(idx: number, type: CellType) {
    this.cells[idx] = type;
    const baseHp = BLOCK_HP[type] ?? 1;
    this.hp[idx] = baseHp;
    this.maxHp[idx] = baseHp;
  }

  private generate() {
    const { width: w, height: h } = this;
    // Start right in the heart of the hidden artwork so details progressively unfold outward!
    this.nestX = Math.floor(w * 0.5);
    this.nestY = Math.floor(h * 0.5);

    const diff = this.level.difficulty ?? 1.0;
    const softPocket = Math.max(22, 30 - (diff - 1) * 6);

    // 1. Layered geological terrain: SoftSoil -> Clay -> Stone -> Obsidian (scaled by map difficulty!)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const hash = ((x * 374761393 + y * 668265263) ^ (x * y * 1274126177)) >>> 0;
        this.noise[idx] = hash & 255;

        const distFromNest = Math.hypot(x - this.nestX, y - this.nestY);
        const n1 =
          Math.sin(x * 0.045 + Math.cos(y * 0.04) * 2.1) +
          Math.cos(y * 0.055 - Math.sin(x * 0.035) * 2.0);
        const n2 =
          Math.sin(x * 0.11 - y * 0.09) * 0.65 +
          Math.cos((x + y) * 0.07) * 0.45;
        // Progressive geological depth: soft soil near nest -> dense Stone & Obsidian in far outer reaches!
        const depthFactor = distFromNest / (Math.min(w, h) * 0.5);
        const hardness =
          n1 * 0.55 +
          n2 * 0.45 +
          depthFactor * (1.15 + (diff - 1) * 0.35) +
          (diff - 1) * 0.42;

        if (distFromNest < softPocket) {
          this.setBlock(idx, CellType.SoftSoil);
        } else if (hardness > 1.75) {
          this.setBlock(idx, CellType.Obsidian);
        } else if (hardness > 1.05) {
          this.setBlock(idx, CellType.Stone);
        } else if (hardness > 0.35) {
          this.setBlock(idx, CellType.Clay);
        } else {
          this.setBlock(idx, CellType.SoftSoil);
        }
      }
    }

    // 2. Carve Hidden Indestructible Art (including outer organic/geometric frame!)
    const artMask = this.level.generateArt(w, h);
    for (let i = 0; i < w * h; i++) {
      if (artMask[i] === 1) {
        this.setBlock(i, CellType.HiddenArt);
        this.stats.totalArt++;
      }
    }

    // 3. Starting nest clearing (intimate organic central pocket right beside Layer 1 details!)
    const nestRadius = 9;
    for (let dy = -nestRadius; dy <= nestRadius; dy++) {
      for (let dx = -nestRadius; dx <= nestRadius; dx++) {
        const nx = this.nestX + dx;
        const ny = this.nestY + dy;
        if (!this.inBounds(nx, ny)) continue;
        const dist = Math.hypot(dx, dy);
        const jitter = (this.noise[ny * w + nx] / 255) * 2.4;
        if (dist + jitter < nestRadius) {
          const idx = ny * w + nx;
          if (this.cells[idx] !== CellType.HiddenArt) {
            this.setBlock(idx, CellType.Empty);
          }
        }
      }
    }

    // Reveal vision around initial nest
    this.revealCircle(this.nestX, this.nestY, nestRadius + this.revealRadius);

    // 3b. BFS Flood-Fill Reachability + Exact Path Distance from Nest:
    // Guarantees Sugar, Artifacts & Crystals NEVER spawn inside sealed HiddenArt loops!
    const reach = computeReachableWithDist(this.cells, w, h, [{ x: this.nestX, y: this.nestY }]);
    this.reachableMask = reach.reachable;
    const distMap = reach.dist;

    // 4. Place the Sugar Cube DEEP in the far outer reaches (top 22% BFS path distance & far from nest!)
    // so levels require genuine colony growth & exploration instead of being beaten in 5 minutes!
    const validSugarSpots: { x: number; y: number; bfsDist: number; euclid: number }[] = [];
    let maxSpotBfs = 0;
    for (let y = 8; y < h - 8; y += 2) {
      for (let x = 8; x < w - 8; x += 2) {
        if (!isReachableTerrainSquare(this.cells, this.reachableMask, w, h, x, y, 4)) continue;
        const bd = distMap[y * w + x];
        if (bd <= 0) continue;
        const euclid = Math.hypot(x - this.nestX, y - this.nestY);
        if (bd > maxSpotBfs) maxSpotBfs = bd;
        validSugarSpots.push({ x, y, bfsDist: bd, euclid });
      }
    }

    const minEuclid = Math.min(w, h) * 0.48; // >= 134px straight-line on 440x280
    let deepPool = validSugarSpots.filter((p) => p.bfsDist >= maxSpotBfs * 0.78 && p.euclid >= minEuclid);
    if (deepPool.length === 0) {
      deepPool = validSugarSpots.filter((p) => p.bfsDist >= maxSpotBfs * 0.68);
    }

    if (deepPool.length > 0) {
      const pick = deepPool[Math.floor(Math.random() * deepPool.length)];
      this.sugarX = pick.x;
      this.sugarY = pick.y;
    } else if (validSugarSpots.length > 0) {
      validSugarSpots.sort((a, b) => b.bfsDist - a.bfsDist);
      this.sugarX = validSugarSpots[0].x;
      this.sugarY = validSugarSpots[0].y;
    } else {
      // Absolute last-resort reachable fallback
      let bestX = this.nestX;
      let bestY = Math.max(12, this.nestY - 40);
      let bestDist = -1;
      for (let y = 8; y < h - 8; y += 2) {
        for (let x = 8; x < w - 8; x += 2) {
          if (!isReachableTerrainSquare(this.cells, this.reachableMask, w, h, x, y, 2)) continue;
          const d = distMap[y * w + x];
          if (d > bestDist) {
            bestDist = d;
            bestX = x;
            bestY = y;
          }
        }
      }
      this.sugarX = bestX;
      this.sugarY = bestY;
    }

    // Encase Sugar inside a natural dense Stone/Obsidian geode vault (thicker on Hard/Extreme maps!)
    const vaultR = Math.round(14 + (diff - 1) * 4);
    const obsR = 9.5 + (diff - 1) * 3.2;
    const stoneR = vaultR + 0.5;
    for (let dy = -vaultR; dy <= vaultR; dy++) {
      for (let dx = -vaultR; dx <= vaultR; dx++) {
        const sx = this.sugarX + dx;
        const sy = this.sugarY + dy;
        if (!this.inBounds(sx, sy)) continue;
        const idx = sy * w + sx;
        const cur = this.cells[idx] as CellType;
        if (cur === CellType.HiddenArt || cur === CellType.Empty) continue;
        const d = Math.hypot(dx, dy) + (this.noise[idx] / 255) * 2.2;
        if (d < obsR) {
          this.setBlock(idx, CellType.Obsidian);
        } else if (d < stoneR && (cur === CellType.SoftSoil || cur === CellType.Clay)) {
          this.setBlock(idx, CellType.Stone);
        }
      }
    }

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const idx = (this.sugarY + dy) * w + (this.sugarX + dx);
        if (this.cells[idx] !== CellType.HiddenArt) {
          this.setBlock(idx, CellType.Sugar);
        }
      }
    }

    // 4b. Place Secret Collectible Artifact (e.g. Креветочка Руся on Map 1!) strictly inside BFS-reachable territory!
    if (this.artifactDef) {
      let placedArt = false;
      for (let attempt = 0; attempt < 900; attempt++) {
        const ax = Math.floor(w * 0.1 + Math.random() * (w * 0.8));
        const ay = Math.floor(h * 0.1 + Math.random() * (h * 0.78));
        if (Math.hypot(ax - this.nestX, ay - this.nestY) < 36) continue;
        if (Math.hypot(ax - this.sugarX, ay - this.sugarY) < 24) continue;
        if (!isReachableTerrainSquare(this.cells, this.reachableMask, w, h, ax, ay, 4)) continue;
        this.artifactX = ax;
        this.artifactY = ay;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            this.setBlock((ay + dy) * w + (ax + dx), CellType.Artifact);
          }
        }
        placedArt = true;
        break;
      }
      if (!placedArt) {
        for (let y = 10; y < h - 10 && !placedArt; y += 3) {
          for (let x = 10; x < w - 10; x += 3) {
            if (Math.hypot(x - this.nestX, y - this.nestY) < 26) continue;
            if (Math.hypot(x - this.sugarX, y - this.sugarY) < 16) continue;
            if (!isReachableTerrainSquare(this.cells, this.reachableMask, w, h, x, y, 2)) continue;
            this.artifactX = x;
            this.artifactY = y;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                this.setBlock((y + dy) * w + (x + dx), CellType.Artifact);
              }
            }
            placedArt = true;
            break;
          }
        }
      }
    }

    // 5. Place Skill Point Crystals (2 nearby within initial sight in any direction around center!)
    let placedCrystals = 0;
    const nearBands = [
      { rMin: 15, rMax: 24 },
      { rMin: 18, rMax: 27 }
    ];
    for (const band of nearBands) {
      for (let attempt = 0; attempt < 240; attempt++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = band.rMin + Math.random() * (band.rMax - band.rMin);
        const cx = Math.round(this.nestX + Math.cos(ang) * dist);
        const cy = Math.round(this.nestY + Math.sin(ang) * dist);
        if (this.tryPlaceCrystal(cx, cy)) {
          placedCrystals++;
          break;
        }
      }
    }

    for (let attempt = 0; attempt < 2400 && placedCrystals < this.level.crystalCount; attempt++) {
      const cx = Math.floor(w * 0.08 + Math.random() * (w * 0.84));
      const cy = Math.floor(h * 0.08 + Math.random() * (h * 0.84));
      if (this.reachableMask[cy * w + cx] !== 1) continue;
      if (Math.hypot(cx - this.nestX, cy - this.nestY) < 24) continue;
      if (Math.hypot(cx - this.sugarX, cy - this.sugarY) < 15) continue;
      if (this.tryPlaceCrystal(cx, cy)) {
        placedCrystals++;
      }
    }
    this.stats.totalCrystals = placedCrystals;

    // 5b. Place Hidden Underground Finds (scaled gently on larger high-difficulty maps!)
    const extraFinds = Math.round((diff - 1) * 3.5);
    this.placeSpecialFinds(CellType.ExplosiveSpore, 9 + extraFinds, 24);
    this.placeSpecialFinds(CellType.SugarDust, 7 + Math.floor(extraFinds * 0.8), 26);
    this.placeSpecialFinds(CellType.AncientCocoon, 6 + Math.floor(extraFinds * 0.8), 28);

    // 6. Count reachable breakable blocks & mark initial border edges
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const cell = this.cells[idx] as CellType;
        if (this.isTerrain(cell) && this.reachableMask[idx] === 1) {
          this.stats.totalBreakable++;
        }
        if (cell !== CellType.Empty && this.hasEmptyNeighbor(x, y)) {
          this.isEdge[idx] = 1;
          if (cell === CellType.HiddenArt && !this.artExposed[idx]) {
            this.artExposed[idx] = 1;
            this.stats.revealedArt++;
          }
        }
      }
    }
  }

  private tryPlaceCrystal(cx: number, cy: number): boolean {
    return this.tryPlaceCluster2x2(cx, cy, CellType.SkillCrystal);
  }

  private tryPlaceCluster2x2(cx: number, cy: number, type: CellType): boolean {
    const w = this.width;
    const h = this.height;
    if (cx < 8 || cx > w - 10 || cy < 8 || cy > h - 10) return false;
    if (this.reachableMask[cy * w + cx] !== 1) return false;

    for (let dy = -2; dy <= 3; dy++) {
      for (let dx = -2; dx <= 3; dx++) {
        const idx = (cy + dy) * w + (cx + dx);
        const c = this.cells[idx] as CellType;
        if (!this.isTerrain(c)) return false;
        if (dy >= 0 && dy <= 1 && dx >= 0 && dx <= 1 && this.reachableMask[idx] !== 1) return false;
      }
    }
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        this.setBlock((cy + dy) * w + (cx + dx), type);
      }
    }
    return true;
  }

  private placeSpecialFinds(type: CellType, targetCount: number, minNestDist: number) {
    const w = this.width;
    const h = this.height;
    let placed = 0;
    for (let attempt = 0; attempt < targetCount * 160 && placed < targetCount; attempt++) {
      const cx = Math.floor(w * 0.08 + Math.random() * (w * 0.84));
      const cy = Math.floor(h * 0.08 + Math.random() * (h * 0.84));
      if (this.reachableMask[cy * w + cx] !== 1) continue;
      if (Math.hypot(cx - this.nestX, cy - this.nestY) < minNestDist) continue;
      if (Math.hypot(cx - this.sugarX, cy - this.sugarY) < 18) continue;
      if (this.tryPlaceCluster2x2(cx, cy, type)) {
        placed++;
      }
    }
  }

  revealCircle(cx: number, cy: number, radius: number) {
    const rCeil = Math.ceil(radius);
    const rSq = radius * radius;
    const innerR = radius * 0.55;
    const w = this.width;
    const h = this.height;
    const x0 = Math.max(0, Math.floor(cx - rCeil));
    const x1 = Math.min(w - 1, Math.ceil(cx + rCeil));
    const y0 = Math.max(0, Math.floor(cy - rCeil));
    const y1 = Math.min(h - 1, Math.ceil(cy + rCeil));

    let changed = false;
    for (let y = y0; y <= y1; y++) {
      const dy = y - cy;
      const dySq = dy * dy;
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dSq = dx * dx + dySq;
        if (dSq <= rSq) {
          const d = Math.sqrt(dSq);
          let val = 255;
          if (d > innerR) {
            const t = 1 - (d - innerR) / Math.max(1, radius - innerR);
            val = Math.round(Math.max(0, Math.min(1, t * t)) * 255);
          }
          const idx = row + x;
          if (val > this.revealedMask[idx]) {
            this.revealedMask[idx] = val;
            changed = true;
          }
        }
      }
    }
    if (changed) this.visualVersion++;
  }

  isTerrain(cell: CellType): boolean {
    return (
      cell === CellType.SoftSoil ||
      cell === CellType.Clay ||
      cell === CellType.Stone ||
      cell === CellType.Obsidian
    );
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getCell(x: number, y: number): CellType {
    if (!this.inBounds(x, y)) return CellType.HiddenArt;
    return this.cells[y * this.width + x] as CellType;
  }

  hasEmptyNeighbor(x: number, y: number): boolean {
    const w = this.width;
    const h = this.height;
    if (x > 0 && this.cells[y * w + (x - 1)] === CellType.Empty) return true;
    if (x < w - 1 && this.cells[y * w + (x + 1)] === CellType.Empty) return true;
    if (y > 0 && this.cells[(y - 1) * w + x] === CellType.Empty) return true;
    if (y < h - 1 && this.cells[(y + 1) * w + x] === CellType.Empty) return true;
    return false;
  }

  dig(cx: number, cy: number, radius: number, damage: number): DigResult {
    const result: DigResult = {
      hitSolid: false,
      hitIndestructible: false,
      dugCount: 0,
      damagedCount: 0,
      crystalsBroken: 0,
      sugarHit: false,
      artifactFound: null,
      artRevealed: 0,
      sporeBlasts: [],
      sugarDustHits: [],
      cocoonHatches: []
    };

    const rCeil = Math.ceil(radius);
    const rSq = radius * radius;
    const w = this.width;
    let revealedNewTunnel = false;

    for (let dy = -rCeil; dy <= rCeil; dy++) {
      for (let dx = -rCeil; dx <= rCeil; dx++) {
        if (dx * dx + dy * dy > rSq) continue;
        const x = Math.round(cx + dx);
        const y = Math.round(cy + dy);
        if (!this.inBounds(x, y)) {
          result.hitIndestructible = true;
          continue;
        }

        const idx = y * w + x;
        const cell = this.cells[idx] as CellType;
        if (cell === CellType.Empty) continue;

        if (cell === CellType.HiddenArt) {
          result.hitIndestructible = true;
          if (!this.artExposed[idx]) {
            this.artExposed[idx] = 1;
            this.stats.revealedArt++;
            result.artRevealed++;
          }
          continue;
        }

        if (cell === CellType.Sugar) {
          this.sugarExposed = true;
          if (!this.stats.sugarFound) {
            this.stats.sugarFound = true;
            result.sugarHit = true;
          }
          continue;
        }

        result.hitSolid = true;

        if (this.hp[idx] > damage) {
          this.hp[idx] -= damage;
          result.damagedCount++;
        } else {
          revealedNewTunnel = true;
          this.breakCellByType(x, y, cell, result);
        }
      }
    }

    if (revealedNewTunnel) {
      this.revealCircle(cx, cy, this.revealRadius);
    }
    if (result.dugCount > 0 || result.damagedCount > 0 || result.artRevealed > 0 || result.sugarHit) {
      this.visualVersion++;
    }

    return result;
  }

  /** Applies Scout acid corrosion to nearby breakable blocks so they keep melting over 4.5s! */
  applyPoison(cx: number, cy: number, radius: number, dps: number, duration = 4.5) {
    const rCeil = Math.ceil(radius);
    const rSq = radius * radius;
    const w = this.width;
    let touched = false;
    for (let dy = -rCeil; dy <= rCeil; dy++) {
      for (let dx = -rCeil; dx <= rCeil; dx++) {
        if (dx * dx + dy * dy > rSq) continue;
        const x = Math.round(cx + dx);
        const y = Math.round(cy + dy);
        if (!this.inBounds(x, y)) continue;
        const idx = y * w + x;
        const c = this.cells[idx] as CellType;
        if (c === CellType.Empty || c === CellType.HiddenArt || c === CellType.Sugar) continue;
        const prev = this.poisonEntries.get(idx);
        if (prev) {
          prev.timeLeft = Math.max(prev.timeLeft, duration);
          prev.dps = Math.max(prev.dps, dps);
        } else {
          this.poisonEntries.set(idx, { timeLeft: duration, dps, accum: 0 });
          this.poisonMask[idx] = 1;
          touched = true;
        }
      }
    }
    if (touched) this.visualVersion++;
  }

  /** Ticks all currently poisoned blocks (O(poisoned count), 0 cost when empty!) */
  updatePoison(dt: number): DigResult {
    const result: DigResult = {
      hitSolid: false,
      hitIndestructible: false,
      dugCount: 0,
      damagedCount: 0,
      crystalsBroken: 0,
      sugarHit: false,
      artifactFound: null,
      artRevealed: 0,
      sporeBlasts: [],
      sugarDustHits: [],
      cocoonHatches: []
    };
    if (this.poisonEntries.size === 0) return result;

    const w = this.width;
    let changed = false;

    for (const [idx, entry] of this.poisonEntries) {
      const cell = this.cells[idx] as CellType;
      if (cell === CellType.Empty || cell === CellType.HiddenArt || cell === CellType.Sugar) {
        this.poisonEntries.delete(idx);
        this.poisonMask[idx] = 0;
        changed = true;
        continue;
      }

      entry.timeLeft -= dt;
      entry.accum += entry.dps * dt;

      if (entry.accum >= 1) {
        const dmg = Math.floor(entry.accum);
        entry.accum -= dmg;
        if (this.hp[idx] > dmg) {
          this.hp[idx] -= dmg;
          result.damagedCount++;
          changed = true;
        } else {
          const x = idx % w;
          const y = Math.floor(idx / w);
          this.poisonEntries.delete(idx);
          this.poisonMask[idx] = 0;
          this.breakCellByType(x, y, cell, result);
          this.revealCircle(x, y, this.revealRadius);
          changed = true;
          continue;
        }
      }

      if (entry.timeLeft <= 0) {
        this.poisonEntries.delete(idx);
        this.poisonMask[idx] = 0;
        changed = true;
      }
    }

    if (changed) this.visualVersion++;
    return result;
  }

  private breakCellByType(x: number, y: number, cell: CellType, result: DigResult) {
    if (cell === CellType.SkillCrystal) {
      this.breakCrystalCluster(x, y, result);
    } else if (cell === CellType.Artifact) {
      this.breakArtifactCluster(x, y, result);
    } else if (cell === CellType.ExplosiveSpore) {
      this.breakSporeCluster(x, y, result);
    } else if (cell === CellType.SugarDust) {
      this.breakSugarDustCluster(x, y, result);
    } else if (cell === CellType.AncientCocoon) {
      this.breakCocoonCluster(x, y, result);
    } else {
      this.destroyCell(x, y, result);
    }
  }

  private clearCluster(sx: number, sy: number, targetType: CellType, result: DigResult): boolean {
    const queue: [number, number][] = [[sx, sy]];
    let brokeAny = false;
    while (queue.length > 0) {
      const [x, y] = queue.pop()!;
      if (!this.inBounds(x, y)) continue;
      const idx = y * this.width + x;
      if (this.cells[idx] !== targetType) continue;

      this.cells[idx] = CellType.Empty;
      this.hp[idx] = 0;
      this.maxHp[idx] = 0;
      this.isEdge[idx] = 0;
      if (this.poisonMask[idx]) {
        this.poisonMask[idx] = 0;
        this.poisonEntries.delete(idx);
      }
      result.dugCount++;
      brokeAny = true;

      this.updateNeighbors(x, y, result);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return brokeAny;
  }

  private destroyCell(x: number, y: number, result: DigResult) {
    const idx = y * this.width + x;
    const cell = this.cells[idx] as CellType;
    if (cell === CellType.Empty) return;

    this.cells[idx] = CellType.Empty;
    this.hp[idx] = 0;
    this.maxHp[idx] = 0;
    this.isEdge[idx] = 0;
    if (this.poisonMask[idx]) {
      this.poisonMask[idx] = 0;
      this.poisonEntries.delete(idx);
    }
    result.dugCount++;

    if (this.isTerrain(cell)) {
      this.stats.dugBreakable++;
    }

    this.updateNeighbors(x, y, result);
  }

  private breakCrystalCluster(sx: number, sy: number, result: DigResult) {
    if (this.clearCluster(sx, sy, CellType.SkillCrystal, result)) {
      this.stats.crystalsCollected++;
      result.crystalsBroken++;
    }
  }

  private breakArtifactCluster(sx: number, sy: number, result: DigResult) {
    if (this.clearCluster(sx, sy, CellType.Artifact, result) && this.artifactDef && !this.stats.artifactCollected) {
      this.stats.artifactCollected = true;
      this.artifactExposed = true;
      result.artifactFound = this.artifactDef;
    }
  }

  private breakSporeCluster(sx: number, sy: number, result: DigResult) {
    if (!this.clearCluster(sx, sy, CellType.ExplosiveSpore, result)) return;
    result.sporeBlasts.push({ x: sx, y: sy });

    // Organic cavern blast (radius ~9.2px) that safely skips HiddenArt and exposes Sugar!
    const blastR = 9.2;
    const rCeil = Math.ceil(blastR);
    for (let dy = -rCeil; dy <= rCeil; dy++) {
      for (let dx = -rCeil; dx <= rCeil; dx++) {
        const x = sx + dx;
        const y = sy + dy;
        if (!this.inBounds(x, y)) continue;
        const idx = y * this.width + x;
        const jitter = (this.noise[idx] / 255) * 2.1;
        if (Math.hypot(dx, dy) + jitter > blastR) continue;
        const c = this.cells[idx] as CellType;
        if (c === CellType.Empty) continue;
        if (c === CellType.HiddenArt) {
          if (!this.artExposed[idx]) {
            this.artExposed[idx] = 1;
            this.stats.revealedArt++;
            result.artRevealed++;
          }
          continue;
        }
        if (c === CellType.Sugar) {
          this.sugarExposed = true;
          if (!this.stats.sugarFound) {
            this.stats.sugarFound = true;
            result.sugarHit = true;
          }
          continue;
        }
        this.breakCellByType(x, y, c, result);
      }
    }
    this.revealCircle(sx, sy, this.revealRadius + 10);
  }

  private breakSugarDustCluster(sx: number, sy: number, result: DigResult) {
    if (this.clearCluster(sx, sy, CellType.SugarDust, result)) {
      result.sugarDustHits.push({ x: sx, y: sy });
    }
  }

  private breakCocoonCluster(sx: number, sy: number, result: DigResult) {
    if (this.clearCluster(sx, sy, CellType.AncientCocoon, result)) {
      result.cocoonHatches.push({ x: sx, y: sy });
    }
  }

  /**
   * When >=99% (or <=18 pixels left) of reachable terrain is cleared, sweeps the last few stray pixels,
   * reveals 100% of the HiddenArt masterpiece, and enables the iridescent shimmer finale!
   */
  checkAndFinishClear(): boolean {
    if (this.stats.mapCleared || this.stats.totalBreakable < 100) return false;
    const rem = this.stats.totalBreakable - this.stats.dugBreakable;
    if (this.stats.dugBreakable < this.stats.totalBreakable * 0.99 && rem > 18) {
      return false;
    }

    this.stats.mapCleared = true;
    this.poisonEntries.clear();
    this.poisonMask.fill(0);
    const total = this.width * this.height;
    for (let i = 0; i < total; i++) {
      const c = this.cells[i] as CellType;
      if (this.isTerrain(c) && this.reachableMask[i] === 1) {
        this.cells[i] = CellType.Empty;
        this.hp[i] = 0;
        this.maxHp[i] = 0;
        this.isEdge[i] = 0;
      } else if (c === CellType.HiddenArt) {
        this.artExposed[i] = 1;
      }
      if (this.reachableMask[i] === 1) {
        this.revealedMask[i] = 255;
      }
    }
    this.stats.dugBreakable = this.stats.totalBreakable;
    this.stats.revealedArt = this.stats.totalArt;
    this.visualVersion++;
    return true;
  }

  private updateNeighbors(x: number, y: number, result: DigResult) {
    const w = this.width;
    const h = this.height;
    for (let ny = y - 1; ny <= y + 1; ny++) {
      if (ny < 0 || ny >= h) continue;
      for (let nx = x - 1; nx <= x + 1; nx++) {
        if (nx < 0 || nx >= w || (nx === x && ny === y)) continue;
        const nIdx = ny * w + nx;
        const nCell = this.cells[nIdx] as CellType;
        if (nCell === CellType.Empty) continue;

        this.isEdge[nIdx] = 1;
        if (nCell === CellType.HiddenArt) {
          if (!this.artExposed[nIdx]) {
            this.artExposed[nIdx] = 1;
            this.stats.revealedArt++;
            result.artRevealed++;
          }
        } else if (nCell === CellType.Sugar) {
          this.sugarExposed = true;
          if (!this.stats.sugarFound) {
            this.stats.sugarFound = true;
            result.sugarHit = true;
          }
        } else if (nCell === CellType.Artifact) {
          this.artifactExposed = true;
        }
      }
    }
  }

  findNearestEmpty(tx: number, ty: number, maxRadius = 26): { x: number; y: number } | null {
    const ix = Math.round(tx);
    const iy = Math.round(ty);
    if (this.inBounds(ix, iy) && this.getCell(ix, iy) === CellType.Empty) {
      return { x: ix, y: iy };
    }
    for (let r = 1; r <= maxRadius; r++) {
      const steps = r * 8;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = Math.round(ix + Math.cos(a) * r);
        const y = Math.round(iy + Math.sin(a) * r);
        if (this.inBounds(x, y) && this.getCell(x, y) === CellType.Empty) {
          return { x, y };
        }
      }
    }
    return null;
  }
}
