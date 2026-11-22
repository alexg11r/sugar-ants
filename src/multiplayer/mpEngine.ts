import { ANT_TYPES } from '../core/ants';
import { MeditativeAudio } from '../core/audio';
import { LEVELS } from '../core/levels';
import { ParticleSystem } from '../core/particles';
import { AimPreview, Camera, drawDetailedAnt } from '../core/renderer';
import { Ant, CellType, LevelDefinition, PlayableAntId } from '../core/types';
import { BLOCK_HP } from '../core/world';
import { MpMessage, MpMode, MpTransport } from './mpTransport';

interface MpAnt extends Ant {
  owner: 1 | 2;
}

export interface MpMatchState {
  mpMode: MpMode;
  vsBot: boolean;
  localPlayer: 1 | 2;
  level: LevelDefinition;
  p1Dug: number;
  p2Dug: number;
  p1Sp: number;
  p2Sp: number;
  winner: 0 | 1 | 2;
  selectedAnt: PlayableAntId;
  unlockedWarriors: boolean;
  unlockedScouts: boolean;
  unlockedQueens: boolean;
  dmgLevel: number;
  compassCd: number;
}

export interface MpCallbacks {
  onHudSync: () => void;
  onToast: (msg: string) => void;
  onMatchEnd: (winner: 1 | 2, isCoop: boolean) => void;
}

/** Deterministic PRNG so Host & Guest generate the exact same map from `seed`! */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MultiplayerEngine {
  readonly width = 400;
  readonly height = 250;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly audio: MeditativeAudio;
  readonly callbacks: MpCallbacks;

  transport: MpTransport | null = null;
  cells: Uint8Array;
  hp: Uint8Array;
  maxHp: Uint8Array;
  isEdge: Uint8Array;
  revealedMask: Uint8Array;
  artExposed: Uint8Array;
  noise: Uint8Array;

  nest1X = 82;
  nest1Y = 125;
  nest2X = 318;
  nest2Y = 125;
  sugarX = 200;
  sugarY = 125;
  sugarExposed = false;

  ants: MpAnt[] = [];
  particles = new ParticleSystem();
  camera: Camera = { x: 200, y: 125, zoom: 3.2 };
  state: MpMatchState;
  active = false;

  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private imgData: ImageData;
  private glowCanvas: HTMLCanvasElement;
  private glowCtx: CanvasRenderingContext2D;
  private glowImgData: ImageData;

  private viewW = 1;
  private viewH = 1;
  private rafId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private nextAntId = 1;
  private hudAccum = 0;
  private botTimer = 0;

  // Input
  private activePointers = new Map<number, { x: number; y: number }>();
  private isDraggingCam = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private isAiming = false;
  private aimOrigin: { x: number; y: number } | null = null;
  private aimClick: { x: number; y: number } | null = null;
  private aimDownScreen: { x: number; y: number } | null = null;
  private aimDragged = false;
  private aimPreview: AimPreview | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    audio: MeditativeAudio,
    callbacks: MpCallbacks
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.audio = audio;
    this.callbacks = callbacks;

    const size = this.width * this.height;
    this.cells = new Uint8Array(size);
    this.hp = new Uint8Array(size);
    this.maxHp = new Uint8Array(size);
    this.isEdge = new Uint8Array(size);
    this.revealedMask = new Uint8Array(size);
    this.artExposed = new Uint8Array(size);
    this.noise = new Uint8Array(size);

    this.offscreen = document.createElement('canvas');
    this.offscreen.width = this.width;
    this.offscreen.height = this.height;
    this.offCtx = this.offscreen.getContext('2d')!;
    this.imgData = this.offCtx.createImageData(this.width, this.height);

    this.glowCanvas = document.createElement('canvas');
    this.glowCanvas.width = this.width;
    this.glowCanvas.height = this.height;
    this.glowCtx = this.glowCanvas.getContext('2d')!;
    this.glowImgData = this.glowCtx.createImageData(this.width, this.height);

    this.state = this.createMatchState('versus', true, 1, LEVELS[0]);
    this.resize();
    this.bindEvents();
  }

  private createMatchState(
    mpMode: MpMode,
    vsBot: boolean,
    localPlayer: 1 | 2,
    level: LevelDefinition
  ): MpMatchState {
    return {
      mpMode,
      vsBot,
      localPlayer,
      level,
      p1Dug: 0,
      p2Dug: 0,
      p1Sp: 2,
      p2Sp: 2,
      winner: 0,
      selectedAnt: 'worker',
      unlockedWarriors: false,
      unlockedScouts: false,
      unlockedQueens: false,
      dmgLevel: 0,
      compassCd: 0
    };
  }

  startMatch(opts: {
    seed: number;
    levelId: string;
    mpMode: MpMode;
    vsBot: boolean;
    localPlayer: 1 | 2;
    transport: MpTransport | null;
  }) {
    this.transport = opts.transport;
    const level = LEVELS.find((l) => l.id === opts.levelId) || LEVELS[0];
    this.state = this.createMatchState(opts.mpMode, opts.vsBot, opts.localPlayer, level);
    this.ants = [];
    this.particles.particles = [];
    this.botTimer = 1.4;
    this.sugarExposed = false;

    this.generateSeededWorld(level, opts.seed);
    this.resetCamera();
    this.active = true;
    this.lastTime = performance.now();
    this.callbacks.onHudSync();

    const modeLabel =
      opts.mpMode === 'coop'
        ? '🤝 Совместные раскопки'
        : opts.vsBot
          ? '⚔ Гонка против ИИ-колонии'
          : '⚔ Онлайн 1 на 1 — Гонка за Сахаром';
    this.callbacks.onToast(`${modeLabel} • Карта: ${level.name}`);

    cancelAnimationFrame(this.rafId);
    const loop = (now: number) => {
      if (!this.active) return;
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.active = false;
    cancelAnimationFrame(this.rafId);
  }

  resetCamera() {
    const fitZoom = Math.min((this.viewW * 0.94) / this.width, (this.viewH * 0.86) / this.height);
    this.camera.zoom = Math.max(2.1, Math.min(5.2, fitZoom * 1.15));
    if (this.state.localPlayer === 1) {
      this.camera.x = this.width * 0.36;
    } else {
      this.camera.x = this.width * 0.64;
    }
    this.camera.y = this.height * 0.5;
  }

  handleRemoteMessage(msg: MpMessage) {
    if (msg.type === 'spawn') {
      this.spawnAntInternal(msg.owner, msg.antType, msg.x, msg.y, msg.angle);
    } else if (msg.type === 'dig') {
      this.digInternal(msg.x, msg.y, msg.radius, msg.damage, msg.owner, false);
    } else if (msg.type === 'sugar_win' && this.state.winner === 0) {
      this.state.winner = msg.winner;
      this.sugarExposed = true;
      this.audio.playSugarFound();
      this.callbacks.onHudSync();
      this.callbacks.onMatchEnd(msg.winner, this.state.mpMode === 'coop');
    } else if (msg.type === 'rematch') {
      this.startMatch({
        seed: msg.seed,
        levelId: msg.levelId,
        mpMode: msg.mpMode,
        vsBot: false,
        localPlayer: this.state.localPlayer,
        transport: this.transport
      });
    }
  }

  /* =========================================================
     IN-MATCH QUICK UPGRADES
     ========================================================= */
  private getLocalSp(): number {
    return this.state.localPlayer === 1 ? this.state.p1Sp : this.state.p2Sp;
  }

  private spendLocalSp(amount: number): boolean {
    if (this.getLocalSp() < amount) return false;
    if (this.state.localPlayer === 1) this.state.p1Sp -= amount;
    else this.state.p2Sp -= amount;
    return true;
  }

  buyInMatchUpgrade(kind: 'warrior' | 'scout' | 'queen' | 'dmg'): boolean {
    if (kind === 'warrior' && !this.state.unlockedWarriors && this.spendLocalSp(2)) {
      this.state.unlockedWarriors = true;
      this.state.selectedAnt = 'warrior';
      this.audio.playUpgrade();
      this.callbacks.onHudSync();
      return true;
    }
    if (kind === 'scout' && !this.state.unlockedScouts && this.spendLocalSp(2)) {
      this.state.unlockedScouts = true;
      this.state.selectedAnt = 'scout';
      this.audio.playUpgrade();
      this.callbacks.onHudSync();
      return true;
    }
    if (kind === 'queen' && !this.state.unlockedQueens && this.spendLocalSp(4)) {
      this.state.unlockedQueens = true;
      this.state.selectedAnt = 'queen';
      this.audio.playUpgrade();
      this.callbacks.onHudSync();
      return true;
    }
    if (kind === 'dmg') {
      const cost = 2 + this.state.dmgLevel * 2;
      if (this.spendLocalSp(cost)) {
        this.state.dmgLevel++;
        this.audio.playUpgrade();
        this.callbacks.onToast(`⚡ Урон колонии +${this.state.dmgLevel}`);
        this.callbacks.onHudSync();
        return true;
      }
    }
    return false;
  }

  selectAnt(type: PlayableAntId) {
    if (type === 'warrior' && !this.state.unlockedWarriors) {
      if (!this.buyInMatchUpgrade('warrior')) this.callbacks.onToast('Нужно ♦ 2 для Воина');
      return;
    }
    if (type === 'scout' && !this.state.unlockedScouts) {
      if (!this.buyInMatchUpgrade('scout')) this.callbacks.onToast('Нужно ♦ 2 для Разведчика');
      return;
    }
    if (type === 'queen' && !this.state.unlockedQueens) {
      if (!this.buyInMatchUpgrade('queen')) this.callbacks.onToast('Нужно ♦ 4 для Матки');
      return;
    }
    this.state.selectedAnt = type;
    this.callbacks.onHudSync();
  }

  /* =========================================================
     SEEDED WORLD GENERATION (2 OPPOSITE NESTS + CENTRAL SUGAR)
     ========================================================= */
  private setBlock(idx: number, type: CellType) {
    this.cells[idx] = type;
    const baseHp = BLOCK_HP[type] ?? 1;
    this.hp[idx] = baseHp;
    this.maxHp[idx] = baseHp;
  }

  private generateSeededWorld(level: LevelDefinition, seed: number) {
    const rng = mulberry32(seed);
    const { width: w, height: h } = this;

    this.cells.fill(0);
    this.hp.fill(0);
    this.maxHp.fill(0);
    this.isEdge.fill(0);
    this.revealedMask.fill(0);
    this.artExposed.fill(0);

    this.nest1X = 76;
    this.nest1Y = Math.floor(h * 0.5);
    this.nest2X = w - 76;
    this.nest2Y = Math.floor(h * 0.5);

    // 1. Seeded mineral layers
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const hash = ((x * 374761393 + y * 668265263 + seed) ^ (x * y * 1274126177)) >>> 0;
        this.noise[idx] = hash & 255;

        const d1 = Math.hypot(x - this.nest1X, y - this.nest1Y);
        const d2 = Math.hypot(x - this.nest2X, y - this.nest2Y);
        const dNest = Math.min(d1, d2);

        const n1 = Math.sin(x * 0.048 + Math.cos(y * 0.042) * 2.1) + Math.cos(y * 0.052 - Math.sin(x * 0.036) * 2.0);
        const hardness = n1 * 0.72 + (dNest / 180) * 0.55;

        if (dNest < 28) {
          this.setBlock(idx, CellType.SoftSoil);
        } else if (hardness > 1.65) {
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

    // 2. Hidden Art
    const artMask = level.generateArt(w, h);
    for (let i = 0; i < w * h; i++) {
      if (artMask[i] === 1) this.setBlock(i, CellType.HiddenArt);
    }

    // 3. Carve BOTH opposite nests
    const carveNest = (cx: number, cy: number) => {
      const r = 12;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const dist = Math.hypot(dx, dy);
          if (dist + (this.noise[ny * w + nx] / 255) * 2.8 < r) {
            const idx = ny * w + nx;
            if (this.cells[idx] !== CellType.HiddenArt) {
              this.setBlock(idx, CellType.Empty);
            }
          }
        }
      }
      this.revealCircle(cx, cy, 34);
    };
    carveNest(this.nest1X, this.nest1Y);
    carveNest(this.nest2X, this.nest2Y);

    // 4. Fairly place the Sugar Cube near the vertical center line (equidistant from both nests!)
    let placedSugar = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      const sx = Math.floor(w * 0.5 + (rng() - 0.5) * 34);
      const sy = Math.floor(h * 0.18 + rng() * (h * 0.64));
      let clear = true;
      for (let dy = -4; dy <= 4 && clear; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const c = this.cells[(sy + dy) * w + (sx + dx)];
          if (c === CellType.HiddenArt || c === CellType.Empty) clear = false;
        }
      }
      if (clear) {
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
    }
    if (!placedSugar) {
      this.sugarX = Math.floor(w * 0.5);
      this.sugarY = Math.floor(h * 0.28);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          this.setBlock((this.sugarY + dy) * w + (this.sugarX + dx), CellType.Sugar);
        }
      }
    }

    // 5. Symmetrically scatter Skill Crystals so both players have fair resources!
    for (let i = 0; i < 24; i++) {
      const lx = Math.floor(w * 0.14 + rng() * (w * 0.34));
      const ly = Math.floor(h * 0.14 + rng() * (h * 0.72));
      const rx = w - 1 - lx;
      this.tryPlaceCrystal(lx, ly);
      this.tryPlaceCrystal(rx, ly);
    }

    // 6. Mark initial edges
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (this.cells[idx] !== CellType.Empty) {
          if (
            this.cells[idx - 1] === CellType.Empty ||
            this.cells[idx + 1] === CellType.Empty ||
            this.cells[idx - w] === CellType.Empty ||
            this.cells[idx + w] === CellType.Empty
          ) {
            this.isEdge[idx] = 1;
          }
        }
      }
    }
  }

  private tryPlaceCrystal(cx: number, cy: number) {
    const w = this.width;
    const h = this.height;
    if (cx < 8 || cx > w - 10 || cy < 8 || cy > h - 10) return;
    if (Math.hypot(cx - this.sugarX, cy - this.sugarY) < 12) return;
    for (let dy = -2; dy <= 3; dy++) {
      for (let dx = -2; dx <= 3; dx++) {
        const c = this.cells[(cy + dy) * w + (cx + dx)] as CellType;
        if (c !== CellType.SoftSoil && c !== CellType.Clay && c !== CellType.Stone) return;
      }
    }
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        this.setBlock((cy + dy) * w + (cx + dx), CellType.SkillCrystal);
      }
    }
  }

  private revealCircle(cx: number, cy: number, radius: number) {
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
      const dySq = (y - cy) * (y - cy);
      const row = y * w;
      for (let x = x0; x <= x1; x++) {
        const dSq = (x - cx) * (x - cx) + dySq;
        if (dSq <= rSq) {
          const d = Math.sqrt(dSq);
          const val = d <= innerR ? 255 : Math.round(Math.pow(1 - (d - innerR) / (radius - innerR), 2) * 255);
          if (val > this.revealedMask[row + x]) this.revealedMask[row + x] = val;
        }
      }
    }
  }

  /* =========================================================
     SPAWNING & SIMULATION
     ========================================================= */
  private countAnts(owner: 1 | 2, type: PlayableAntId): number {
    let n = 0;
    for (const a of this.ants) if (a.owner === owner && a.type === type) n++;
    return n;
  }

  private getCap(type: PlayableAntId): number {
    if (type === 'worker') return 8;
    if (type === 'scout') return 5;
    if (type === 'warrior') return 3;
    if (type === 'queen') return 2;
    return 1;
  }

  private deployLocalAnt(wx: number, wy: number, angleOverride?: number) {
    if (this.state.winner !== 0) return;
    const type = this.state.selectedAnt;
    const owner = this.state.localPlayer;

    if (type === 'compass' && this.state.compassCd > 0) {
      const sec = Math.ceil(this.state.compassCd);
      this.callbacks.onToast(`Компас перезаряжается: ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
      return;
    }

    if (this.countAnts(owner, type) >= this.getCap(type)) {
      this.callbacks.onToast(`Лимит «${ANT_TYPES[type].name}» достигнут`);
      return;
    }

    const defNest = owner === 1 ? { x: this.nest1X, y: this.nest1Y } : { x: this.nest2X, y: this.nest2Y };
    const spawn = this.findNearestEmpty(wx, wy, 28) || defNest;
    const angle =
      angleOverride !== undefined
        ? angleOverride
        : Math.hypot(wx - spawn.x, wy - spawn.y) > 2
          ? Math.atan2(wy - spawn.y, wx - spawn.x)
          : owner === 1
            ? 0
            : Math.PI;

    if (type === 'compass') this.state.compassCd = 120;

    this.spawnAntInternal(owner, type, spawn.x, spawn.y, angle);
    this.transport?.send({ type: 'spawn', owner, antType: type, x: spawn.x, y: spawn.y, angle });

    this.audio.ensureStarted();
    if (type === 'compass') this.audio.playCompassLaunch();
    else this.audio.playSpawn();
    this.callbacks.onHudSync();
  }

  private spawnAntInternal(owner: 1 | 2, type: PlayableAntId | 'brood', x: number, y: number, angle: number) {
    const cfg = ANT_TYPES[type];
    this.ants.push({
      id: this.nextAntId++,
      owner,
      type,
      x,
      y,
      angle,
      fixedAngle: angle,
      age: 0,
      maxAge: type === 'compass' ? 5.0 : cfg.baseLifespan,
      biteTimer: 0,
      biteFlash: 0,
      turnTimer: 0.5,
      spawnTimer: 2.2,
      legPhase: Math.random() * Math.PI * 2,
      trailTimer: 0
    });
    this.particles.spawn(x, y, cfg.rgb[0], cfg.rgb[1], cfg.rgb[2], 4, 14, 0.45, 1.3);
  }

  private update(dt: number) {
    this.elapsed += dt;
    if (this.state.compassCd > 0) this.state.compassCd = Math.max(0, this.state.compassCd - dt);

    // AI Rival Colony (Player 2) when playing vs Bot
    if (this.state.vsBot && this.state.winner === 0) {
      this.botTimer -= dt;
      if (this.botTimer <= 0) {
        this.botTimer = 2.6 + Math.random() * 1.6;
        this.runBotStep();
      }
    }

    for (let i = this.ants.length - 1; i >= 0; i--) {
      const ant = this.ants[i];
      const cfg = ANT_TYPES[ant.type];
      ant.age += dt;
      if (ant.biteTimer > 0) ant.biteTimer -= dt;
      if (ant.biteFlash > 0) ant.biteFlash = Math.max(0, ant.biteFlash - dt * 5);
      ant.turnTimer -= dt;

      if (ant.age >= ant.maxAge) {
        this.ants.splice(i, 1);
        continue;
      }

      if (ant.type === 'queen') {
        ant.spawnTimer -= dt;
        if (ant.spawnTimer <= 0) {
          ant.spawnTimer = 2.8;
          this.spawnAntInternal(ant.owner, 'brood', ant.x, ant.y, Math.random() * Math.PI * 2);
        }
      }

      if (ant.type === 'compass' && ant.turnTimer <= 0) {
        ant.fixedAngle = Math.atan2(this.sugarY - ant.y, this.sugarX - ant.x) + (Math.random() - 0.5) * 0.6;
        ant.turnTimer = 0.45;
      }

      if (ant.type === 'compass') {
        let diff = ant.fixedAngle - ant.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ant.angle += diff * Math.min(1, dt * 6);
      } else if (ant.type === 'warrior') {
        ant.angle = ant.fixedAngle;
      } else if (ant.type !== 'scout' && ant.turnTimer <= 0) {
        ant.angle += (Math.random() - 0.5) * 1.1;
        ant.turnTimer = 0.6 + Math.random() * 0.7;
      }

      const speed = cfg.baseSpeed;
      const probeDist = ant.type === 'scout' ? Math.max(1.2, speed * dt) : 1.5;
      const nx = ant.x + Math.cos(ant.angle) * probeDist;
      const ny = ant.y + Math.sin(ant.angle) * probeDist;
      const ix = Math.round(nx);
      const iy = Math.round(ny);

      if (ix < 1 || ix >= this.width - 1 || iy < 1 || iy >= this.height - 1) {
        ant.angle += Math.PI * 0.8;
        if (ant.type === 'warrior') ant.fixedAngle = ant.angle;
        continue;
      }

      const ahead = this.cells[iy * this.width + ix] as CellType;
      if (ahead === CellType.Empty) {
        ant.x += Math.cos(ant.angle) * speed * dt;
        ant.y += Math.sin(ant.angle) * speed * dt;
        ant.legPhase += dt * speed * 1.4;
      } else if (ahead === CellType.HiddenArt) {
        this.digInternal(ix, iy, cfg.baseRadius, 1, ant.owner, false);
        ant.angle += (Math.random() < 0.5 ? 1 : -1) * 1.1;
        if (ant.type === 'warrior') ant.fixedAngle = ant.angle;
      } else {
        ant.legPhase += dt * 4.5;
        if (ant.biteTimer <= 0) {
          ant.biteTimer = cfg.baseBiteInterval;
          ant.biteFlash = 1;
          const dmgBonus = ant.owner === this.state.localPlayer ? this.state.dmgLevel : 0;
          const dmg = ant.type === 'compass' ? 1 : cfg.baseDamage + dmgBonus;
          const isLocalOwned = ant.owner === this.state.localPlayer;
          this.digInternal(nx, ny, cfg.baseRadius, dmg, ant.owner, isLocalOwned);
          if (ant.type === 'scout') {
            ant.angle += Math.PI * 0.75 + (Math.random() - 0.5) * 0.5;
          }
        }
      }
    }

    this.particles.update(dt);

    this.hudAccum += dt;
    if (this.hudAccum >= 0.3) {
      this.hudAccum = 0;
      this.callbacks.onHudSync();
    }
  }

  private runBotStep() {
    // AI Colony spawns Workers, Scouts, or Warriors aimed generally toward the center/Sugar
    const roll = Math.random();
    let type: PlayableAntId = 'worker';
    if (roll < 0.25 && this.countAnts(2, 'warrior') < 2) type = 'warrior';
    else if (roll < 0.55 && this.countAnts(2, 'scout') < 3) type = 'scout';
    else if (this.countAnts(2, 'worker') >= 6) return;

    const toCenter = Math.atan2(this.height * 0.5 - this.nest2Y + (Math.random() - 0.5) * 90, this.width * 0.5 - this.nest2X);
    this.spawnAntInternal(2, type, this.nest2X, this.nest2Y, toCenter);
  }

  private digInternal(
    cx: number,
    cy: number,
    radius: number,
    damage: number,
    owner: 1 | 2,
    broadcast: boolean
  ) {
    const rCeil = Math.ceil(radius);
    const rSq = radius * radius;
    const w = this.width;
    let dugAny = false;

    for (let dy = -rCeil; dy <= rCeil; dy++) {
      for (let dx = -rCeil; dx <= rCeil; dx++) {
        if (dx * dx + dy * dy > rSq) continue;
        const x = Math.round(cx + dx);
        const y = Math.round(cy + dy);
        if (x < 0 || x >= w || y < 0 || y >= this.height) continue;

        const idx = y * w + x;
        const c = this.cells[idx] as CellType;
        if (c === CellType.Empty) continue;

        if (c === CellType.HiddenArt) {
          this.artExposed[idx] = 1;
          continue;
        }

        if (c === CellType.Sugar) {
          this.sugarExposed = true;
          if (this.state.winner === 0) {
            this.state.winner = owner;
            this.audio.playSugarFound();
            this.particles.spawn(this.sugarX, this.sugarY, 255, 245, 175, 34, 42, 2.0, 2.4);
            if (broadcast) this.transport?.send({ type: 'sugar_win', winner: owner });
            this.callbacks.onHudSync();
            this.callbacks.onMatchEnd(owner, this.state.mpMode === 'coop');
          }
          continue;
        }

        if (this.hp[idx] > damage) {
          this.hp[idx] -= damage;
        } else {
          dugAny = true;
          this.hp[idx] = 0;
          this.maxHp[idx] = 0;
          this.cells[idx] = CellType.Empty;
          this.isEdge[idx] = 0;

          if (c === CellType.SkillCrystal) {
            if (owner === 1 || this.state.mpMode === 'coop') this.state.p1Sp++;
            if (owner === 2 || this.state.mpMode === 'coop') this.state.p2Sp++;
            this.audio.playCrystal();
            this.particles.spawn(x, y, 75, 235, 255, 10, 24, 1.0, 1.8);
          } else {
            if (owner === 1) this.state.p1Dug++;
            else this.state.p2Dug++;
          }

          // Mark neighbors
          for (let ny = y - 1; ny <= y + 1; ny++) {
            for (let nx = x - 1; nx <= x + 1; nx++) {
              if (nx < 0 || nx >= w || ny < 0 || ny >= this.height) continue;
              const nIdx = ny * w + nx;
              if (this.cells[nIdx] !== CellType.Empty) {
                this.isEdge[nIdx] = 1;
                if (this.cells[nIdx] === CellType.HiddenArt) this.artExposed[nIdx] = 1;
                if (this.cells[nIdx] === CellType.Sugar) this.sugarExposed = true;
              }
            }
          }
        }
      }
    }

    if (dugAny) {
      this.revealCircle(cx, cy, 24);
      if (broadcast) {
        this.transport?.send({ type: 'dig', x: cx, y: cy, radius, damage, owner });
      }
    }
  }

  private findNearestEmpty(tx: number, ty: number, maxR = 26): { x: number; y: number } | null {
    const ix = Math.round(tx);
    const iy = Math.round(ty);
    if (ix >= 0 && ix < this.width && iy >= 0 && iy < this.height && this.cells[iy * this.width + ix] === CellType.Empty) {
      return { x: ix, y: iy };
    }
    for (let r = 1; r <= maxR; r++) {
      const steps = r * 8;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = Math.round(ix + Math.cos(a) * r);
        const y = Math.round(iy + Math.sin(a) * r);
        if (x >= 0 && x < this.width && y >= 0 && y < this.height && this.cells[y * this.width + x] === CellType.Empty) {
          return { x, y };
        }
      }
    }
    return null;
  }

  /* =========================================================
     RENDERER (TEAM RINGS + SEAMLESS PALETTE)
     ========================================================= */
  private render() {
    const { width: w, height: h, cells, hp, maxHp, isEdge, revealedMask, artExposed, noise } = this;
    const data = this.imgData.data;
    const glow = this.glowImgData.data;
    const pal = this.state.level.palette;
    const [bR, bG, bB] = pal.bgRgb;
    const [eR, eG, eB] = pal.emptyRgb;
    const [sR, sG, sB] = pal.softRgb;
    const [cR, cG, cB] = pal.clayRgb;
    const [stR, stG, stB] = pal.stoneRgb;
    const [oR, oG, oB] = pal.obsidianRgb;
    const [agR, agG, agB] = pal.artGlowRgb;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const p = idx * 4;
        const c = cells[idx] as CellType;
        const n = noise[idx];
        const vis = revealedMask[idx] / 255;

        glow[p] = glow[p + 1] = glow[p + 2] = glow[p + 3] = 0;

        if (c === CellType.Empty) {
          data[p] = eR; data[p + 1] = eG; data[p + 2] = eB; data[p + 3] = 255;
          continue;
        }
        if (c === CellType.HiddenArt && artExposed[idx] === 1) {
          data[p] = 255; data[p + 1] = 255; data[p + 2] = 255; data[p + 3] = 255;
          glow[p] = agR; glow[p + 1] = agG; glow[p + 2] = agB; glow[p + 3] = 220;
          continue;
        }
        if (c === CellType.Sugar && this.sugarExposed) {
          data[p] = 255; data[p + 1] = 244; data[p + 2] = 170; data[p + 3] = 255;
          glow[p] = 255; glow[p + 1] = 230; glow[p + 2] = 120; glow[p + 3] = 255;
          continue;
        }
        if (c === CellType.SkillCrystal && vis > 0.14) {
          const alpha = Math.min(1, (vis - 0.14) / 0.55);
          data[p] = Math.round(bR + (75 - bR) * alpha);
          data[p + 1] = Math.round(bG + (235 - bG) * alpha);
          data[p + 2] = Math.round(bB + (255 - bB) * alpha);
          data[p + 3] = 255;
          glow[p] = 75; glow[p + 1] = 235; glow[p + 2] = 255; glow[p + 3] = Math.round(180 * alpha);
          continue;
        }
        if (vis <= 0.004) {
          data[p] = bR; data[p + 1] = bG; data[p + 2] = bB; data[p + 3] = 255;
          continue;
        }

        const shade = (n & 7) - 3;
        let tr = sR + shade;
        let tg = sG + shade;
        let tb = sB + shade;
        if (c === CellType.Clay) { tr = cR + shade; tg = cG + shade; tb = cB + shade; }
        else if (c === CellType.Stone) { tr = stR + shade; tg = stG + shade; tb = stB + shade; }
        else if (c === CellType.Obsidian) { tr = oR + shade; tg = oG + shade; tb = oB + shade; }

        let r = Math.round(bR + (tr - bR) * vis);
        let g = Math.round(bG + (tg - bG) * vis);
        let b = Math.round(bB + (tb - bB) * vis);
        if (isEdge[idx] === 1) { r = Math.min(255, r + 18); g = Math.min(255, g + 24); b = Math.min(255, b + 20); }

        const mHp = maxHp[idx] || 1;
        const dmgRatio = Math.max(0, (mHp - hp[idx]) / mHp);
        if (dmgRatio > 0) {
          r = Math.min(255, Math.round(r + dmgRatio * 185));
          g = Math.round(g + (dmgRatio < 0.5 ? dmgRatio * 140 : (1 - dmgRatio) * 140));
          b = Math.max(20, Math.round(b - dmgRatio * 15));
        }
        data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255;
      }
    }

    this.offCtx.putImageData(this.imgData, 0, 0);
    this.glowCtx.putImageData(this.glowImgData, 0, 0);

    const ctx = this.ctx;
    ctx.fillStyle = pal.bgHex;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    const drawW = w * this.camera.zoom;
    const drawH = h * this.camera.zoom;
    const drawX = this.viewW * 0.5 - this.camera.x * this.camera.zoom;
    const drawY = this.viewH * 0.5 - this.camera.y * this.camera.zoom;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.offscreen, drawX, drawY, drawW, drawH);

    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.filter = `blur(${Math.max(4, Math.min(10, this.camera.zoom * 1.5))}px)`;
    ctx.globalAlpha = 0.56;
    ctx.drawImage(this.glowCanvas, drawX, drawY, drawW, drawH);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // Draw Nest 1 (Emerald) & Nest 2 (Crimson) beacons
    const drawNestRing = (wx: number, wy: number, color: string, label: string) => {
      const sx = drawX + wx * this.camera.zoom;
      const sy = drawY + wy * this.camera.zoom;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(10, this.camera.zoom * 4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `700 ${Math.max(10, Math.round(this.camera.zoom * 2.4))}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label, sx, sy + Math.max(18, this.camera.zoom * 6));
    };

    drawNestRing(this.nest1X, this.nest1Y, '#3ce87a', this.state.localPlayer === 1 ? 'Вы (Изумруд)' : 'Игрок 1');
    drawNestRing(
      this.nest2X,
      this.nest2Y,
      '#ff4d6d',
      this.state.vsBot ? 'ИИ-колония' : this.state.localPlayer === 2 ? 'Вы (Алые)' : 'Игрок 2'
    );

    // Particles
    for (const pt of this.particles.particles) {
      const alpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
      ctx.fillStyle = `rgba(${pt.r}, ${pt.g}, ${pt.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(drawX + pt.x * this.camera.zoom, drawY + pt.y * this.camera.zoom, Math.max(1.4, pt.size * this.camera.zoom * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }

    // Ants with subtle team indicator rings
    for (const ant of this.ants) {
      const sx = drawX + ant.x * this.camera.zoom;
      const sy = drawY + ant.y * this.camera.zoom;
      ctx.strokeStyle = ant.owner === 1 ? 'rgba(60, 232, 122, 0.5)' : 'rgba(255, 77, 109, 0.65)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(4, this.camera.zoom * 2.1), 0, Math.PI * 2);
      ctx.stroke();
      drawDetailedAnt(ctx, ant.type, sx, sy, ant.angle, ant.legPhase, ant.biteFlash, this.camera.zoom);
    }

    // Aim arrow
    if (this.aimPreview) {
      const ax = drawX + this.aimPreview.fromX * this.camera.zoom;
      const ay = drawY + this.aimPreview.fromY * this.camera.zoom;
      const len = Math.max(36, this.camera.zoom * 14);
      const ex = ax + Math.cos(this.aimPreview.angle) * len;
      const ey = ay + Math.sin(this.aimPreview.angle) * len;
      ctx.strokeStyle = this.aimPreview.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = Math.floor(this.viewW * dpr);
    this.canvas.height = Math.floor(this.viewH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private screenToWorld(sx: number, sy: number) {
    return {
      x: (sx - this.viewW * 0.5) / this.camera.zoom + this.camera.x,
      y: (sy - this.viewH * 0.5) / this.camera.zoom + this.camera.y
    };
  }

  private bindEvents() {
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.active) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        const before = this.screenToWorld(e.clientX, e.clientY);
        this.camera.zoom = Math.max(1.2, Math.min(10, this.camera.zoom * factor));
        const after = this.screenToWorld(e.clientX, e.clientY);
        this.camera.x += before.x - after.x;
        this.camera.y += before.y - after.y;
      },
      { passive: false }
    );

    this.canvas.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      this.canvas.setPointerCapture(e.pointerId);
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 2) {
        this.isAiming = false;
        this.aimPreview = null;
        this.isDraggingCam = true;
        const pts = Array.from(this.activePointers.values());
        this.pinchStartDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        this.pinchStartZoom = this.camera.zoom;
        this.lastDragX = (pts[0].x + pts[1].x) * 0.5;
        this.lastDragY = (pts[0].y + pts[1].y) * 0.5;
        return;
      }

      if (e.button === 1 || e.button === 2) {
        this.isDraggingCam = true;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
        return;
      }

      const wPos = this.screenToWorld(e.clientX, e.clientY);
      const defNest = this.state.localPlayer === 1 ? { x: this.nest1X, y: this.nest1Y } : { x: this.nest2X, y: this.nest2Y };
      const spawn = this.findNearestEmpty(wPos.x, wPos.y, 28) || defNest;
      this.isAiming = true;
      this.aimOrigin = spawn;
      this.aimClick = wPos;
      this.aimDownScreen = { x: e.clientX, y: e.clientY };
      this.aimDragged = false;
      this.aimPreview = null;
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.active || !this.activePointers.has(e.pointerId)) return;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const midX = (pts[0].x + pts[1].x) * 0.5;
        const midY = (pts[0].y + pts[1].y) * 0.5;
        if (this.pinchStartDist > 0) {
          this.camera.zoom = Math.max(1.2, Math.min(10, this.pinchStartZoom * (dist / this.pinchStartDist)));
        }
        this.camera.x -= (midX - this.lastDragX) / this.camera.zoom;
        this.camera.y -= (midY - this.lastDragY) / this.camera.zoom;
        this.lastDragX = midX;
        this.lastDragY = midY;
        return;
      }

      if (this.isDraggingCam) {
        this.camera.x -= (e.clientX - this.lastDragX) / this.camera.zoom;
        this.camera.y -= (e.clientY - this.lastDragY) / this.camera.zoom;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
        return;
      }

      if (this.isAiming && this.aimOrigin && this.aimDownScreen) {
        if (Math.hypot(e.clientX - this.aimDownScreen.x, e.clientY - this.aimDownScreen.y) >= 8) {
          this.aimDragged = true;
          const wPos = this.screenToWorld(e.clientX, e.clientY);
          this.aimPreview = {
            fromX: this.aimOrigin.x,
            fromY: this.aimOrigin.y,
            angle: Math.atan2(wPos.y - this.aimOrigin.y, wPos.x - this.aimOrigin.x),
            color: ANT_TYPES[this.state.selectedAnt].color
          };
        }
      }
    });

    const endPtr = (e: PointerEvent) => {
      if (this.isAiming && this.aimOrigin) {
        if (this.aimDragged && this.aimPreview) {
          this.deployLocalAnt(this.aimOrigin.x, this.aimOrigin.y, this.aimPreview.angle);
        } else if (this.aimClick) {
          this.deployLocalAnt(this.aimClick.x, this.aimClick.y);
        }
        this.isAiming = false;
        this.aimOrigin = null;
        this.aimClick = null;
        this.aimDownScreen = null;
        this.aimDragged = false;
        this.aimPreview = null;
      }
      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size < 2) this.pinchStartDist = 0;
      if (this.activePointers.size === 0) this.isDraggingCam = false;
    };

    this.canvas.addEventListener('pointerup', endPtr);
    this.canvas.addEventListener('pointercancel', endPtr);
  }
}
