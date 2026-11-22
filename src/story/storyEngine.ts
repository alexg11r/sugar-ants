import { ANT_TYPES } from '../core/ants';
import { MeditativeAudio } from '../core/audio';
import { subscribeBackgroundTick } from '../core/bgTicker';
import { ParticleSystem } from '../core/particles';
import { AimPreview, Camera, drawDetailedAnt } from '../core/renderer';
import { Ant, PlayableAntId } from '../core/types';

const enum StoryCell {
  Empty = 0,
  Sand = 1,      // HP 3  - warm golden-brown ant farm sand
  Loam = 2,      // HP 7  - rich dark earth
  Root = 3,      // HP 14 - woody roots
  Gravel = 4,    // HP 24 - tough pebbles in deeper layers
  Glass = 5,     // Indestructible glass wall of the ant farm
  Cork = 6,      // HP 16 - chewable cork/silicone lid plug to escape!
  Wood = 7,      // HP 18 - wooden windowsill / book / shelf outside the farm
  RoomAir = 8,   // Open cozy twilight room air above the farm
  Sugar = 9      // Goal: Sugar cube outside the farm!
}

export interface StoryLevelDef {
  id: string;
  chapter: number;
  name: string;
  intro: string;
  width: number;
  height: number;
  corkHp: number;
  sugarXFrac: number;
  sugarYFrac: number;
  shelfCount: number;
}

export const STORY_LEVELS: StoryLevelDef[] = [
  {
    id: 'story_1',
    chapter: 1,
    name: 'Глава 1: Стеклянная ферма',
    intro: 'День 14. Хозяин забыл о ферме. Выращивай тлей, расти личинок и прогрызай пробку на подоконник!',
    width: 260,
    height: 175,
    corkHp: 15,
    sugarXFrac: 0.83,
    sugarYFrac: 0.2,
    shelfCount: 1
  },
  {
    id: 'story_2',
    chapter: 2,
    name: 'Глава 2: Кухонный лабиринт',
    intro: 'День 21. Ферма глубже, в почве появился гравий, а сахар спрятан за стопкой книг на верхней полке!',
    width: 300,
    height: 200,
    corkHp: 24,
    sugarXFrac: 0.18,
    sugarYFrac: 0.14,
    shelfCount: 2
  },
  {
    id: 'story_3',
    chapter: 3,
    name: 'Глава 3: Большая кладовая',
    intro: 'День 30. Глубочайшие слои, твёрдые корни и деревянная перегородка перед заветной сахарницей!',
    width: 320,
    height: 215,
    corkHp: 34,
    sugarXFrac: 0.86,
    sugarYFrac: 0.12,
    shelfCount: 3
  }
];

export interface StoryState {
  levelIndex: number;
  nectar: number;
  larvae: number;
  minerals: number;
  satiety: number; // 0..100%
  aphidHerders: number;
  nurses: number;
  pantryLevel: number;
  jawLevel: number;
  pheromoneLevel: number;
  warriorUnlocked: boolean;
  scoutUnlocked: boolean;
  queenUnlocked: boolean;
  escapedFarm: boolean;
  sugarFound: boolean;
  selectedDigger: 'worker' | 'warrior' | 'scout' | 'queen';
}

export interface StoryCallbacks {
  onHudSync: () => void;
  onToast: (msg: string) => void;
  onVictory: (level: StoryLevelDef, hasNext: boolean) => void;
}

export class StoryEngine {
  width = 260;
  height = 175;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly audio: MeditativeAudio;
  readonly callbacks: StoryCallbacks;

  cells: Uint8Array = new Uint8Array(1);
  hp: Uint8Array = new Uint8Array(1);
  maxHp: Uint8Array = new Uint8Array(1);
  noise: Uint8Array = new Uint8Array(1);

  ants: Ant[] = [];
  particles = new ParticleSystem();
  camera: Camera = { x: 130, y: 90, zoom: 4 };
  state: StoryState;
  active = false;

  // Farm geometry (recomputed per level)
  farmLeft = 56;
  farmRight = 204;
  farmTop = 64;
  farmBottom = 164;
  nestX = 130;
  nestY = 136;
  aphidX = 94;
  aphidY = 138;
  nurseryX = 166;
  nurseryY = 138;
  sugarX = 216;
  sugarY = 34;

  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private imgData: ImageData;
  private viewW = 1;
  private viewH = 1;
  private rafId = 0;
  private unsubBgTick: (() => void) | null = null;
  private lastWallMs = 0;
  private elapsed = 0;
  private nextAntId = 1;
  private hudAccum = 0;

  // Input state
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
    callbacks: StoryCallbacks
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.audio = audio;
    this.callbacks = callbacks;

    this.offscreen = document.createElement('canvas');
    this.offCtx = this.offscreen.getContext('2d')!;
    this.imgData = this.offCtx.createImageData(1, 1);

    this.state = this.createInitialState(0);
    this.resize();
    this.bindEvents();
  }

  getCurrentLevel(): StoryLevelDef {
    return STORY_LEVELS[this.state.levelIndex] || STORY_LEVELS[0];
  }

  private createInitialState(levelIndex: number): StoryState {
    return {
      levelIndex,
      nectar: 18,
      larvae: 6,
      minerals: 0,
      satiety: 76,
      aphidHerders: 1,
      nurses: 1,
      pantryLevel: 0,
      jawLevel: 0,
      pheromoneLevel: 0,
      warriorUnlocked: false,
      scoutUnlocked: false,
      queenUnlocked: false,
      escapedFarm: false,
      sugarFound: false,
      selectedDigger: 'worker'
    };
  }

  startLevel(levelIndex = 0) {
    const idx = Math.max(0, Math.min(STORY_LEVELS.length - 1, levelIndex));
    const lvl = STORY_LEVELS[idx];
    this.width = lvl.width;
    this.height = lvl.height;

    const size = this.width * this.height;
    this.cells = new Uint8Array(size);
    this.hp = new Uint8Array(size);
    this.maxHp = new Uint8Array(size);
    this.noise = new Uint8Array(size);

    this.offscreen.width = this.width;
    this.offscreen.height = this.height;
    this.imgData = this.offCtx.createImageData(this.width, this.height);

    this.state = this.createInitialState(idx);
    this.ants = [];
    this.particles.particles = [];
    this.generateFarmWorld(lvl);
    this.resetCamera();
    this.active = true;
    this.lastWallMs = Date.now();
    this.callbacks.onHudSync();
    this.callbacks.onToast(lvl.intro);

    const stepWallClock = () => {
      const now = Date.now();
      const rawDt = Math.max(0, (now - this.lastWallMs) / 1000);
      this.lastWallMs = now;
      if (!this.active || rawDt <= 0) return;
      let rem = Math.min(rawDt, 60);
      while (rem > 0) {
        const step = Math.min(0.05, rem);
        this.update(step);
        rem -= step;
      }
    };

    if (this.unsubBgTick) this.unsubBgTick();
    this.unsubBgTick = subscribeBackgroundTick(() => {
      if (this.active && document.hidden) stepWallClock();
    });

    cancelAnimationFrame(this.rafId);
    const loop = () => {
      if (!this.active) return;
      stepWallClock();
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.active = false;
    cancelAnimationFrame(this.rafId);
    if (this.unsubBgTick) {
      this.unsubBgTick();
      this.unsubBgTick = null;
    }
  }

  resetCamera() {
    const fitZoom = Math.min((this.viewW * 0.94) / this.width, (this.viewH * 0.84) / this.height);
    this.camera.zoom = Math.max(2.0, Math.min(6, fitZoom));
    this.camera.x = this.width * 0.5;
    this.camera.y = this.height * 0.52;
  }

  private setCell(x: number, y: number, type: StoryCell, hp = 0) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = y * this.width + x;
    this.cells[idx] = type;
    this.hp[idx] = hp;
    this.maxHp[idx] = hp;
  }

  private generateFarmWorld(lvl: StoryLevelDef) {
    const { width: w, height: h } = this;

    this.farmLeft = Math.floor(w * 0.2);
    this.farmRight = Math.floor(w * 0.8);
    this.farmTop = Math.floor(h * 0.37);
    this.farmBottom = Math.floor(h * 0.92);
    this.nestX = Math.floor(w * 0.5);
    this.nestY = Math.floor(this.farmTop + (this.farmBottom - this.farmTop) * 0.72);
    this.aphidX = Math.floor(this.nestX - (this.farmRight - this.farmLeft) * 0.26);
    this.aphidY = this.nestY + 2;
    this.nurseryX = Math.floor(this.nestX + (this.farmRight - this.farmLeft) * 0.26);
    this.nurseryY = this.nestY + 2;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const hash = ((x * 374761393 + y * 668265263) ^ (x * y * 1274126177)) >>> 0;
        this.noise[idx] = hash & 255;
        if (y >= this.farmBottom) {
          this.setCell(x, y, StoryCell.Wood, 18);
        } else {
          this.setCell(x, y, StoryCell.RoomAir, 0);
        }
      }
    }

    // Interior of the Glass Ant Farm with rich depth layers!
    for (let y = this.farmTop; y <= this.farmBottom; y++) {
      for (let x = this.farmLeft; x <= this.farmRight; x++) {
        const isBorder =
          x <= this.farmLeft + 2 ||
          x >= this.farmRight - 2 ||
          y <= this.farmTop + 2 ||
          y >= this.farmBottom - 2;

        if (isBorder) {
          const inPlug = y <= this.farmTop + 2 && Math.abs(x - this.nestX) <= 11;
          if (inPlug) {
            this.setCell(x, y, StoryCell.Cork, lvl.corkHp);
          } else {
            this.setCell(x, y, StoryCell.Glass, 255);
          }
        } else {
          const depth = (y - this.farmTop) / (this.farmBottom - this.farmTop);
          const wave = Math.sin(x * 0.08 + y * 0.06) + Math.cos(x * 0.05 - y * 0.1);
          if (lvl.chapter >= 2 && wave > 1.48) {
            this.setCell(x, y, StoryCell.Gravel, 24);
          } else if (wave > 1.15) {
            this.setCell(x, y, StoryCell.Root, 14);
          } else if (depth > 0.35 && wave > 0.05) {
            this.setCell(x, y, StoryCell.Loam, 7);
          } else {
            this.setCell(x, y, StoryCell.Sand, 3);
          }
        }
      }
    }

    const carveChamber = (cx: number, cy: number, rx: number, ry: number) => {
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
          if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.0) {
            this.setCell(cx + dx, cy + dy, StoryCell.Empty, 0);
          }
        }
      }
    };

    carveChamber(this.nestX, this.nestY, 14, 10);
    carveChamber(this.aphidX, this.aphidY, 12, 8);
    carveChamber(this.nurseryX, this.nurseryY, 12, 8);
    for (let x = this.aphidX; x <= this.nurseryX; x++) {
      for (let dy = -2; dy <= 2; dy++) {
        this.setCell(x, this.nestY + dy, StoryCell.Empty, 0);
      }
    }

    // Wooden shelves / books outside the farm
    this.sugarX = Math.floor(w * lvl.sugarXFrac);
    this.sugarY = Math.floor(h * lvl.sugarYFrac);

    // Shelf directly supporting the Sugar Cube
    const shelfY = this.sugarY + 6;
    const shelfLeft = Math.max(8, this.sugarX - 38);
    const shelfRight = Math.min(w - 8, this.sugarX + 32);
    for (let y = shelfY; y <= shelfY + 5; y++) {
      for (let x = shelfLeft; x <= shelfRight; x++) {
        this.setCell(x, y, StoryCell.Wood, 18);
      }
    }

    // Extra chapter obstacles (book stack / wooden divider)
    if (lvl.shelfCount >= 2) {
      for (let y = Math.floor(h * 0.23); y <= Math.floor(h * 0.28); y++) {
        for (let x = Math.floor(w * 0.34); x <= Math.floor(w * 0.66); x++) {
          this.setCell(x, y, StoryCell.Wood, 18);
        }
      }
    }
    if (lvl.shelfCount >= 3) {
      // Vertical book barrier guarding the sugar shelf
      const wallX = this.sugarX - 28;
      for (let y = Math.max(6, this.sugarY - 12); y <= shelfY; y++) {
        for (let x = wallX; x <= wallX + 5; x++) {
          this.setCell(x, y, StoryCell.Wood, 22);
        }
      }
    }

    // Place Sugar Cube
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        this.setCell(this.sugarX + dx, this.sugarY + dy, StoryCell.Sugar, 1);
      }
    }
  }

  /* =========================================================
     DEEP COLONY ECONOMY ACTIONS
     ========================================================= */
  hireAphidHerder(): boolean {
    const costMin = 5 + this.state.aphidHerders * 5;
    const costLarv = 2 + this.state.aphidHerders;
    if (this.state.minerals < costMin || this.state.larvae < costLarv) return false;
    this.state.minerals -= costMin;
    this.state.larvae -= costLarv;
    this.state.aphidHerders++;
    this.audio.playUpgrade();
    this.particles.spawn(this.aphidX, this.aphidY, 120, 245, 130, 12, 20, 1.0, 1.8);
    this.callbacks.onToast(`🌿 Пастухов тлей: ${this.state.aphidHerders} (+нектар)`);
    this.callbacks.onHudSync();
    return true;
  }

  hireNurse(): boolean {
    const costNec = 9 + this.state.nurses * 7;
    const costMin = 4 + this.state.nurses * 4;
    if (this.state.nectar < costNec || this.state.minerals < costMin) return false;
    this.state.nectar -= costNec;
    this.state.minerals -= costMin;
    this.state.nurses++;
    this.audio.playUpgrade();
    this.particles.spawn(this.nurseryX, this.nurseryY, 255, 228, 175, 12, 20, 1.0, 1.8);
    this.callbacks.onToast(`🥚 Нянек личинок: ${this.state.nurses} (+личинки)`);
    this.callbacks.onHudSync();
    return true;
  }

  upgradePantry(): boolean {
    const costMin = 8 + this.state.pantryLevel * 8;
    const costNec = 8 + this.state.pantryLevel * 8;
    if (this.state.minerals < costMin || this.state.nectar < costNec) return false;
    this.state.minerals -= costMin;
    this.state.nectar -= costNec;
    this.state.pantryLevel++;
    this.state.satiety = Math.min(100, this.state.satiety + 25);
    this.audio.playUpgrade();
    this.callbacks.onToast(`🏠 Склад расширен (Ур. ${this.state.pantryLevel}): расход еды снижен!`);
    this.callbacks.onHudSync();
    return true;
  }

  upgradeJaws(): boolean {
    const costNec = 10 + this.state.jawLevel * 10;
    const costMin = 8 + this.state.jawLevel * 9;
    if (this.state.nectar < costNec || this.state.minerals < costMin) return false;
    this.state.nectar -= costNec;
    this.state.minerals -= costMin;
    this.state.jawLevel++;
    this.audio.playUpgrade();
    this.callbacks.onToast(`⚡ Жвалы усилены (+${this.state.jawLevel} урон)`);
    this.callbacks.onHudSync();
    return true;
  }

  upgradePheromones(): boolean {
    const costNec = 12 + this.state.pheromoneLevel * 12;
    const costLarv = 3 + this.state.pheromoneLevel * 2;
    if (this.state.nectar < costNec || this.state.larvae < costLarv) return false;
    this.state.nectar -= costNec;
    this.state.larvae -= costLarv;
    this.state.pheromoneLevel++;
    this.audio.playUpgrade();
    this.callbacks.onToast(`🏃 Феромонные тропы (Ур. ${this.state.pheromoneLevel}): +20% скорости!`);
    this.callbacks.onHudSync();
    return true;
  }

  unlockDigger(type: 'warrior' | 'scout' | 'queen'): boolean {
    if (type === 'warrior' && !this.state.warriorUnlocked && this.state.nectar >= 14 && this.state.larvae >= 5) {
      this.state.nectar -= 14;
      this.state.larvae -= 5;
      this.state.warriorUnlocked = true;
      this.state.selectedDigger = 'warrior';
      this.audio.playUpgrade();
      this.callbacks.onToast('Открыт Воин! Пробьёт гравий и пробку.');
      this.callbacks.onHudSync();
      return true;
    }
    if (type === 'scout' && !this.state.scoutUnlocked && this.state.nectar >= 11 && this.state.larvae >= 4) {
      this.state.nectar -= 11;
      this.state.larvae -= 4;
      this.state.scoutUnlocked = true;
      this.state.selectedDigger = 'scout';
      this.audio.playUpgrade();
      this.callbacks.onToast('Открыт Разведчик!');
      this.callbacks.onHudSync();
      return true;
    }
    if (type === 'queen' && !this.state.queenUnlocked && this.state.nectar >= 22 && this.state.larvae >= 8) {
      this.state.nectar -= 22;
      this.state.larvae -= 8;
      this.state.queenUnlocked = true;
      this.state.selectedDigger = 'queen';
      this.audio.playUpgrade();
      this.callbacks.onToast('Открыта Матка! Будет плодить помощников прямо в туннелях.');
      this.callbacks.onHudSync();
      return true;
    }
    return false;
  }

  selectDigger(type: 'worker' | 'warrior' | 'scout' | 'queen') {
    if (type === 'warrior' && !this.state.warriorUnlocked) return;
    if (type === 'scout' && !this.state.scoutUnlocked) return;
    if (type === 'queen' && !this.state.queenUnlocked) return;
    this.state.selectedDigger = type;
    this.callbacks.onHudSync();
  }

  /** FIXED: Ants can ONLY be deployed inside the ant farm's dug burrows (StoryCell.Empty)! */
  private isInsideFarmBurrow(x: number, y: number): boolean {
    if (x <= this.farmLeft + 2 || x >= this.farmRight - 2) return false;
    if (y <= this.farmTop + 2 || y >= this.farmBottom - 2) return false;
    return this.cells[y * this.width + x] === StoryCell.Empty;
  }

  private findNearestFarmBurrow(tx: number, ty: number, maxR = 26): { x: number; y: number } | null {
    const ix = Math.round(tx);
    const iy = Math.round(ty);
    if (this.isInsideFarmBurrow(ix, iy)) return { x: ix, y: iy };
    for (let r = 1; r <= maxR; r++) {
      const steps = r * 8;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = Math.round(ix + Math.cos(a) * r);
        const y = Math.round(iy + Math.sin(a) * r);
        if (this.isInsideFarmBurrow(x, y)) return { x, y };
      }
    }
    return null;
  }

  private deployDigger(wx: number, wy: number, angleOverride?: number) {
    // Reject clicks outside the glass farm!
    if (wx < this.farmLeft || wx > this.farmRight || wy < this.farmTop || wy > this.farmBottom) {
      this.callbacks.onToast('Муравьёв можно выпускать только внутри ходов фермы!');
      return;
    }

    const type = this.state.selectedDigger;
    const larvaCost = type === 'queen' ? 5 : type === 'warrior' ? 3 : type === 'scout' ? 2 : 1;
    const nectarCost = type === 'queen' ? 8 : type === 'warrior' ? 4 : 2;

    if (this.state.larvae < larvaCost || this.state.nectar < nectarCost) {
      this.callbacks.onToast(`Нужно ${larvaCost} 🥚 и ${nectarCost} 🍯 (развивай тлей и нянек!)`);
      return;
    }

    const spawn = this.findNearestFarmBurrow(wx, wy, 28) || { x: this.nestX, y: this.nestY };
    const angle =
      angleOverride !== undefined
        ? angleOverride
        : Math.hypot(wx - spawn.x, wy - spawn.y) > 2
          ? Math.atan2(wy - spawn.y, wx - spawn.x)
          : -Math.PI * 0.5;

    this.state.larvae -= larvaCost;
    this.state.nectar -= nectarCost;

    const cfg = ANT_TYPES[type as PlayableAntId];
    this.ants.push({
      id: this.nextAntId++,
      type,
      x: spawn.x,
      y: spawn.y,
      angle,
      fixedAngle: angle,
      age: 0,
      maxAge: cfg.baseLifespan,
      biteTimer: 0,
      biteFlash: 0,
      turnTimer: 0.6,
      spawnTimer: 2.2,
      legPhase: Math.random() * Math.PI * 2,
      trailTimer: 0
    });

    this.audio.ensureStarted();
    this.audio.playSpawn();
    this.particles.spawn(spawn.x, spawn.y, cfg.rgb[0], cfg.rgb[1], cfg.rgb[2], 5, 14, 0.5, 1.4);
    this.callbacks.onHudSync();
  }

  /* =========================================================
     SIMULATION UPDATE
     ========================================================= */
  private update(dt: number) {
    this.elapsed += dt;

    const pantryReduction = Math.pow(0.78, this.state.pantryLevel);
    const nectarProd = this.state.aphidHerders * 1.75;
    const nectarDrain = (0.4 + this.ants.length * 0.13) * pantryReduction;
    this.state.nectar = Math.max(0, this.state.nectar + (nectarProd - nectarDrain) * dt);
    this.state.larvae += this.state.nurses * 0.55 * dt;

    if (this.state.nectar > 1) {
      this.state.satiety = Math.min(100, this.state.satiety + dt * 4.5);
    } else {
      this.state.satiety = Math.max(0, this.state.satiety - dt * 4.5 * pantryReduction);
    }

    const speedMult = (this.state.satiety < 20 ? 0.5 : 1.0) * (1 + this.state.pheromoneLevel * 0.2);

    for (let i = this.ants.length - 1; i >= 0; i--) {
      const ant = this.ants[i];
      const cfg = ANT_TYPES[ant.type];
      ant.age += dt;
      if (ant.biteTimer > 0) ant.biteTimer -= dt;
      if (ant.biteFlash > 0) ant.biteFlash = Math.max(0, ant.biteFlash - dt * 5);
      ant.turnTimer -= dt;

      if (ant.age >= ant.maxAge) {
        if (ant.type !== 'brood') this.audio.playAntExpire();
        this.ants.splice(i, 1);
        continue;
      }

      if (ant.type === 'queen') {
        ant.spawnTimer -= dt;
        if (ant.spawnTimer <= 0) {
          ant.spawnTimer = 2.6;
          this.ants.push({
            id: this.nextAntId++,
            type: 'brood',
            x: ant.x,
            y: ant.y,
            angle: Math.random() * Math.PI * 2,
            fixedAngle: 0,
            age: 0,
            maxAge: 22,
            biteTimer: 0,
            biteFlash: 0,
            turnTimer: 0.4,
            spawnTimer: 0,
            legPhase: 0,
            trailTimer: 0
          });
        }
      }

      const speed = cfg.baseSpeed * speedMult;
      const dmg = cfg.baseDamage + this.state.jawLevel + (ant.type === 'warrior' ? 2 : 0);
      const radius = ant.type === 'warrior' ? 2.2 : 1.15;

      const curCell = this.getCell(Math.round(ant.x), Math.round(ant.y));
      if (curCell === StoryCell.RoomAir) {
        const toSugar = Math.atan2(this.sugarY - ant.y, this.sugarX - ant.x);
        let diff = toSugar - ant.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ant.angle += diff * Math.min(1, dt * 3.8);
      } else if (ant.type === 'warrior') {
        ant.angle = ant.fixedAngle;
      } else if (ant.type !== 'scout' && ant.turnTimer <= 0) {
        ant.angle += (Math.random() - 0.5) * 1.05;
        ant.turnTimer = 0.65 + Math.random() * 0.6;
      }

      const probeDist = ant.type === 'scout' ? Math.max(1.2, speed * dt) : 1.45;
      const nx = ant.x + Math.cos(ant.angle) * probeDist;
      const ny = ant.y + Math.sin(ant.angle) * probeDist;
      const ahead = this.getCell(Math.round(nx), Math.round(ny));

      if (ahead === StoryCell.Empty || ahead === StoryCell.RoomAir) {
        ant.x += Math.cos(ant.angle) * speed * dt;
        ant.y += Math.sin(ant.angle) * speed * dt;
        ant.legPhase += dt * speed * 1.4;
      } else if (ahead === StoryCell.Glass) {
        ant.angle += Math.PI * 0.65 + (Math.random() - 0.5) * 0.4;
        if (ant.type === 'warrior') ant.fixedAngle = ant.angle;
      } else if (ahead === StoryCell.Sugar) {
        if (!this.state.sugarFound) {
          this.state.sugarFound = true;
          this.audio.playSugarFound();
          this.particles.spawn(this.sugarX, this.sugarY, 255, 245, 175, 36, 45, 2.2, 2.5);
          const lvl = this.getCurrentLevel();
          this.callbacks.onVictory(lvl, this.state.levelIndex + 1 < STORY_LEVELS.length);
        }
      } else {
        ant.legPhase += dt * 4.5;
        if (ant.biteTimer <= 0) {
          ant.biteTimer = cfg.baseBiteInterval / speedMult;
          ant.biteFlash = 1;
          this.digStory(nx, ny, radius, dmg);
          if (ant.type === 'scout') {
            ant.angle += Math.PI * 0.8 + (Math.random() - 0.5) * 0.5;
          }
        }
      }
    }

    this.particles.update(dt);
    this.hudAccum += dt;
    if (this.hudAccum >= 0.25) {
      this.hudAccum = 0;
      this.callbacks.onHudSync();
    }
  }

  private getCell(x: number, y: number): StoryCell {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return StoryCell.Glass;
    return this.cells[y * this.width + x] as StoryCell;
  }

  private digStory(cx: number, cy: number, radius: number, damage: number) {
    const rCeil = Math.ceil(radius);
    const rSq = radius * radius;
    const w = this.width;

    for (let dy = -rCeil; dy <= rCeil; dy++) {
      for (let dx = -rCeil; dx <= rCeil; dx++) {
        if (dx * dx + dy * dy > rSq) continue;
        const x = Math.round(cx + dx);
        const y = Math.round(cy + dy);
        if (x < 0 || x >= w || y < 0 || y >= this.height) continue;

        const idx = y * w + x;
        const c = this.cells[idx] as StoryCell;
        if (c === StoryCell.Empty || c === StoryCell.RoomAir || c === StoryCell.Glass || c === StoryCell.Sugar) {
          continue;
        }

        if (this.hp[idx] > damage) {
          this.hp[idx] -= damage;
        } else {
          this.hp[idx] = 0;
          this.maxHp[idx] = 0;
          this.cells[idx] = y < this.farmTop ? StoryCell.RoomAir : StoryCell.Empty;
          this.state.minerals += c === StoryCell.Cork ? 2.5 : c === StoryCell.Gravel ? 1.2 : 0.4;
          this.audio.playDigTick();

          if (c === StoryCell.Cork && !this.state.escapedFarm) {
            this.state.escapedFarm = true;
            this.audio.playCrystal();
            this.particles.spawn(x, y, 255, 225, 130, 18, 28, 1.3, 2.0);
            this.callbacks.onToast('🌿 Пробка прогрызена! Муравьи выбрались наружу к сахару!');
          }
        }
      }
    }
  }

  /* =========================================================
     COZY RENDERER WITH APHID & NURSE/LARVAE TEXTURES!
     ========================================================= */
  private render() {
    const { width: w, height: h, cells, hp, maxHp, noise } = this;
    const data = this.imgData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const p = idx * 4;
        const c = cells[idx] as StoryCell;
        const n = noise[idx];
        const shade = (n & 7) - 3;

        if (c === StoryCell.RoomAir) {
          const grad = y / h;
          data[p] = Math.round(20 + grad * 16);
          data[p + 1] = Math.round(25 + grad * 16);
          data[p + 2] = Math.round(38 + grad * 12);
          data[p + 3] = 255;
        } else if (c === StoryCell.Empty) {
          data[p] = 25 + shade;
          data[p + 1] = 18 + shade;
          data[p + 2] = 13 + shade;
          data[p + 3] = 255;
        } else if (c === StoryCell.Glass) {
          const glint = (x + y) % 19 === 0 ? 35 : 0;
          data[p] = 135 + glint;
          data[p + 1] = 195 + glint;
          data[p + 2] = 212 + glint;
          data[p + 3] = 255;
        } else if (c === StoryCell.Sugar) {
          const pulse = 0.88 + 0.12 * Math.sin(this.elapsed * 4 + x + y);
          data[p] = Math.round(255 * pulse);
          data[p + 1] = Math.round(248 * pulse);
          data[p + 2] = Math.round(205 * pulse);
          data[p + 3] = 255;
        } else {
          let r = 114 + shade;
          let g = 86 + shade;
          let b = 55 + shade;
          if (c === StoryCell.Loam) { r = 78 + shade; g = 56 + shade; b = 38 + shade; }
          else if (c === StoryCell.Root) { r = 58 + shade; g = 41 + shade; b = 26 + shade; }
          else if (c === StoryCell.Gravel) {
            const speck = (n & 15) === 0 ? 18 : 0;
            r = 68 + shade + speck; g = 70 + shade + speck; b = 76 + shade + speck;
          } else if (c === StoryCell.Cork) { r = 166 + shade; g = 122 + shade; b = 76 + shade; }
          else if (c === StoryCell.Wood) {
            const grain = (y * 3 + (n & 3)) % 5 === 0 ? 10 : 0;
            r = 86 + grain + shade; g = 58 + grain + shade; b = 38 + shade;
          }

          const mHp = maxHp[idx] || 1;
          const dmgRatio = Math.max(0, (mHp - hp[idx]) / mHp);
          if (dmgRatio > 0) {
            r = Math.min(255, Math.round(r + dmgRatio * 100));
            g = Math.max(20, Math.round(g - dmgRatio * 20));
            b = Math.max(15, Math.round(b - dmgRatio * 25));
          }
          data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255;
        }
      }
    }

    this.offCtx.putImageData(this.imgData, 0, 0);

    const ctx = this.ctx;
    ctx.fillStyle = '#151a26';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    const drawW = w * this.camera.zoom;
    const drawH = h * this.camera.zoom;
    const drawX = this.viewW * 0.5 - this.camera.x * this.camera.zoom;
    const drawY = this.viewH * 0.5 - this.camera.y * this.camera.zoom;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.offscreen, drawX, drawY, drawW, drawH);

    const z = this.camera.zoom;

    // 1. LIVE APHID PASTURE TEXTURE (green aphids + honeydew drops + tending herder ants!)
    const apX = drawX + this.aphidX * z;
    const apY = drawY + this.aphidY * z;
    // Soft mossy leaf bed
    ctx.fillStyle = 'rgba(42, 118, 56, 0.42)';
    ctx.beginPath();
    ctx.ellipse(apX, apY + z * 1.2, z * 9.5, z * 4.2, 0, 0, Math.PI * 2);
    ctx.fill();

    const aphidCount = Math.min(8, 2 + this.state.aphidHerders * 2);
    for (let i = 0; i < aphidCount; i++) {
      const ang = (i / aphidCount) * Math.PI * 2 + Math.sin(this.elapsed * 0.7 + i) * 0.15;
      const ax = apX + Math.cos(ang) * z * 4.5;
      const ay = apY + Math.sin(ang) * z * 2.2;
      // Cute plump lime-green aphid body
      ctx.fillStyle = '#9cf56e';
      ctx.beginPath();
      ctx.ellipse(ax, ay, Math.max(2.2, z * 1.15), Math.max(1.7, z * 0.85), ang * 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Tiny dark eyes & golden honeydew droplet
      ctx.fillStyle = '#1d3b14';
      ctx.beginPath();
      ctx.arc(ax + z * 0.65, ay - z * 0.2, Math.max(0.7, z * 0.22), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd845';
      ctx.beginPath();
      ctx.arc(ax - z * 0.9, ay, Math.max(0.9, z * 0.34), 0, Math.PI * 2);
      ctx.fill();
    }
    // Animated herder ants circling the aphids!
    const herderVis = Math.min(4, this.state.aphidHerders);
    for (let i = 0; i < herderVis; i++) {
      const orbit = this.elapsed * 0.9 + (i / herderVis) * Math.PI * 2;
      const hx = apX + Math.cos(orbit) * z * 7.2;
      const hy = apY + Math.sin(orbit) * z * 4.2;
      drawDetailedAnt(ctx, 'worker', hx, hy, orbit + Math.PI * 0.5, this.elapsed * 8 + i, 0, z * 0.78, 'classic', [130, 235, 110]);
    }

    // 2. LIVE LARVAE NURSERY TEXTURE (pearly segmented wiggling larvae + nurse ants!)
    const nuX = drawX + this.nurseryX * z;
    const nuY = drawY + this.nurseryY * z;
    ctx.fillStyle = 'rgba(255, 224, 172, 0.16)';
    ctx.beginPath();
    ctx.ellipse(nuX, nuY + z * 1.0, z * 9.5, z * 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const larvaVis = Math.min(8, 2 + this.state.nurses * 2);
    for (let i = 0; i < larvaVis; i++) {
      const ang = (i / larvaVis) * Math.PI * 2;
      const lx = nuX + Math.cos(ang) * z * 4.2;
      const ly = nuY + Math.sin(ang) * z * 2.1;
      const wiggle = Math.sin(this.elapsed * 3.5 + i * 1.4) * 0.25;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(ang + wiggle);
      // Segmented pearly-white larva cocoon
      ctx.fillStyle = '#fff5df';
      ctx.beginPath();
      ctx.ellipse(0, 0, Math.max(2.5, z * 1.3), Math.max(1.4, z * 0.65), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(195, 165, 125, 0.7)';
      ctx.lineWidth = Math.max(0.7, z * 0.18);
      ctx.beginPath();
      ctx.moveTo(-z * 0.4, -z * 0.55);
      ctx.lineTo(-z * 0.4, z * 0.55);
      ctx.moveTo(z * 0.35, -z * 0.55);
      ctx.lineTo(z * 0.35, z * 0.55);
      ctx.stroke();
      ctx.restore();
    }
    // Animated nurse ants tending the nursery!
    const nurseVis = Math.min(4, this.state.nurses);
    for (let i = 0; i < nurseVis; i++) {
      const orbit = -this.elapsed * 0.85 + (i / nurseVis) * Math.PI * 2;
      const nx = nuX + Math.cos(orbit) * z * 7.2;
      const ny = nuY + Math.sin(orbit) * z * 4.2;
      drawDetailedAnt(ctx, 'worker', nx, ny, orbit - Math.PI * 0.5, this.elapsed * 7 + i, 0, z * 0.78, 'royal', [255, 205, 130]);
    }

    // Chamber Labels
    ctx.fillStyle = '#fff9eb';
    ctx.font = `600 ${Math.max(10, Math.round(z * 2.4))}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`🌿 Тли ×${this.state.aphidHerders}`, apX, apY + Math.max(18, z * 6.5));
    ctx.fillText(`🥚 Ясли ×${this.state.nurses}`, nuX, nuY + Math.max(18, z * 6.5));

    if (!this.state.escapedFarm) {
      ctx.fillStyle = 'rgba(255, 232, 175, 0.88)';
      ctx.fillText('▲ Пробка фермы (прогрызи наружу!)', drawX + this.nestX * z, drawY + (this.farmTop - 4) * z);
    }

    ctx.fillStyle = '#fff5b8';
    ctx.font = `700 ${Math.max(11, Math.round(z * 2.6))}px Inter, sans-serif`;
    ctx.fillText('🧊 Сахар', drawX + this.sugarX * z, drawY + (this.sugarY - 7) * z);

    // Particles
    for (const pt of this.particles.particles) {
      const alpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
      ctx.fillStyle = `rgba(${pt.r}, ${pt.g}, ${pt.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(drawX + pt.x * z, drawY + pt.y * z, Math.max(1.5, pt.size * z * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }

    // Digger Ants
    for (const ant of this.ants) {
      drawDetailedAnt(ctx, ant.type, drawX + ant.x * z, drawY + ant.y * z, ant.angle, ant.legPhase, ant.biteFlash, z);
    }

    // Aim arrow
    if (this.aimPreview) {
      const ax = drawX + this.aimPreview.fromX * z;
      const ay = drawY + this.aimPreview.fromY * z;
      const len = Math.max(36, z * 14);
      ctx.strokeStyle = this.aimPreview.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax + Math.cos(this.aimPreview.angle) * len, ay + Math.sin(this.aimPreview.angle) * len);
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
        this.camera.zoom = Math.max(1.5, Math.min(10, this.camera.zoom * factor));
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
      const spawn = this.findNearestFarmBurrow(wPos.x, wPos.y, 28) || { x: this.nestX, y: this.nestY };
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
          this.camera.zoom = Math.max(1.5, Math.min(10, this.pinchStartZoom * (dist / this.pinchStartDist)));
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
            color: ANT_TYPES[this.state.selectedDigger].color
          };
        }
      }
    });

    const endPtr = (e: PointerEvent) => {
      if (this.isAiming && this.aimOrigin) {
        if (this.aimDragged && this.aimPreview) {
          this.deployDigger(this.aimOrigin.x, this.aimOrigin.y, this.aimPreview.angle);
        } else if (this.aimClick) {
          this.deployDigger(this.aimClick.x, this.aimClick.y);
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
