import { computeReachableMask, isReachableTerrainSquare } from './reachability';
import { ArtifactDef, CellType, LevelDefinition, WorldStats } from './types';

export interface DigResult {
  hitSolid: boolean;
  hitIndestructible: boolean;
  dugCount: number;
  damagedCount: number;
  crystalsBroken: number;
  sugarHit: boolean;
  artifactFound: ArtifactDef | null;
  artRevealed: number;
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
  [CellType.Artifact]: 6
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

  constructor(level: LevelDefinition, farSenseMutation = false, artifactToSpawn: ArtifactDef | null = null) {
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

    this.generate();
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

    // 1. Layered geological terrain: SoftSoil -> Clay -> Stone -> Obsidian
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
        const hardness = n1 * 0.65 + n2 * 0.55 + (distFromNest / Math.max(w, h)) * 0.8;

        if (distFromNest < 34) {
          this.setBlock(idx, CellType.SoftSoil);
        } else if (hardness > 1.75) {
          this.setBlock(idx, CellType.Obsidian);
        } else if (hardness > 1.1) {
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

    // 3b. BFS Flood-Fill Reachability from Nest: guarantees Sugar, Artifacts & Crystals NEVER spawn inside sealed HiddenArt loops!
    this.reachableMask = computeReachableMask(this.cells, w, h, [{ x: this.nestX, y: this.nestY }]);

    // 4. Place the Sugar Cube strictly inside the BFS-reachable territory (360° outward from center!)
    let placedSugar = false;
    for (let attempt = 0; attempt < 900; attempt++) {
      const sx = Math.floor(w * 0.08 + Math.random() * (w * 0.84));
      const sy = Math.floor(h * 0.08 + Math.random() * (h * 0.84));
      const distFromNest = Math.hypot(sx - this.nestX, sy - this.nestY);
      if (distFromNest < Math.min(w, h) * 0.3) continue;
      if (!isReachableTerrainSquare(this.cells, this.reachableMask, w, h, sx, sy, 4)) continue;

      this.sugarX = sx;
      this.sugarY = sy;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          this.setBlock((sy + dy) * w + (sx + dx), CellType.Sugar);
        }
      }
      placedSugar = true;
      break;
    }

    // Deterministic guaranteed-reachable fallback: pick the farthest reachable terrain square from the nest!
    if (!placedSugar) {
      let bestX = this.nestX;
      let bestY = Math.max(12, this.nestY - 40);
      let bestDist = -1;
      for (const margin of [3, 2]) {
        for (let y = 8; y < h - 8; y += 2) {
          for (let x = 8; x < w - 8; x += 2) {
            if (!isReachableTerrainSquare(this.cells, this.reachableMask, w, h, x, y, margin)) continue;
            const d = Math.hypot(x - this.nestX, y - this.nestY);
            if (d > bestDist) {
              bestDist = d;
              bestX = x;
              bestY = y;
            }
          }
        }
        if (bestDist > 0) break;
      }
      this.sugarX = bestX;
      this.sugarY = bestY;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const idx = (this.sugarY + dy) * w + (this.sugarX + dx);
          if (this.cells[idx] !== CellType.HiddenArt) {
            this.setBlock(idx, CellType.Sugar);
          }
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
        this.setBlock((cy + dy) * w + (cx + dx), CellType.SkillCrystal);
      }
    }
    return true;
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
          }
        }
      }
    }
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
      artRevealed: 0
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
          if (cell === CellType.SkillCrystal) {
            this.breakCrystalCluster(x, y, result);
          } else if (cell === CellType.Artifact) {
            this.breakArtifactCluster(x, y, result);
          } else {
            this.destroyCell(x, y, result);
          }
        }
      }
    }

    if (revealedNewTunnel) {
      this.revealCircle(cx, cy, this.revealRadius);
    }

    return result;
  }

  private destroyCell(x: number, y: number, result: DigResult) {
    const idx = y * this.width + x;
    const cell = this.cells[idx] as CellType;
    if (cell === CellType.Empty) return;

    this.cells[idx] = CellType.Empty;
    this.hp[idx] = 0;
    this.maxHp[idx] = 0;
    this.isEdge[idx] = 0;
    result.dugCount++;

    if (this.isTerrain(cell)) {
      this.stats.dugBreakable++;
    }

    this.updateNeighbors(x, y, result);
  }

  private breakCrystalCluster(sx: number, sy: number, result: DigResult) {
    const queue: [number, number][] = [[sx, sy]];
    let brokeAny = false;

    while (queue.length > 0) {
      const [x, y] = queue.pop()!;
      if (!this.inBounds(x, y)) continue;
      const idx = y * this.width + x;
      if (this.cells[idx] !== CellType.SkillCrystal) continue;

      this.cells[idx] = CellType.Empty;
      this.hp[idx] = 0;
      this.maxHp[idx] = 0;
      this.isEdge[idx] = 0;
      result.dugCount++;
      brokeAny = true;

      this.updateNeighbors(x, y, result);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    if (brokeAny) {
      this.stats.crystalsCollected++;
      result.crystalsBroken++;
    }
  }

  private breakArtifactCluster(sx: number, sy: number, result: DigResult) {
    const queue: [number, number][] = [[sx, sy]];
    let brokeAny = false;

    while (queue.length > 0) {
      const [x, y] = queue.pop()!;
      if (!this.inBounds(x, y)) continue;
      const idx = y * this.width + x;
      if (this.cells[idx] !== CellType.Artifact) continue;

      this.cells[idx] = CellType.Empty;
      this.hp[idx] = 0;
      this.maxHp[idx] = 0;
      this.isEdge[idx] = 0;
      result.dugCount++;
      brokeAny = true;

      this.updateNeighbors(x, y, result);
      queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    if (brokeAny && this.artifactDef && !this.stats.artifactCollected) {
      this.stats.artifactCollected = true;
      this.artifactExposed = true;
      result.artifactFound = this.artifactDef;
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
