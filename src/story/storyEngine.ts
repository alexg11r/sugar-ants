import { ANT_TYPES } from '../core/ants';
import { MeditativeAudio } from '../core/audio';
import { ParticleSystem } from '../core/particles';
import { AimPreview, Camera, drawDetailedAnt } from '../core/renderer';
import { Ant, PlayableAntId } from '../core/types';

const enum StoryCell {
  Empty = 0,
  Sand = 1,      // HP 3  - warm golden-brown ant farm sand
  Loam = 2,      // HP 7  - rich dark earth
  Root = 3,      // HP 14 - woody roots
  Glass = 4,     // Indestructible glass wall of the ant farm
  Cork = 5,      // HP 15 - chewable cork/silicone lid plug to escape!
  Wood = 6,      // HP 16 - wooden windowsill / table outside the farm
  RoomAir = 7,   // Open cozy twilight room air above the farm
  Sugar = 8      // Goal: Sugar cube on the windowsill!
}

export interface StoryState {
  nectar: number;
  larvae: number;
  minerals: number;
  satiety: number; // 0..100%
  aphidHerders: number;
  nurses: number;
  jawLevel: number;
  warriorUnlocked: boolean;
  scoutUnlocked: boolean;
  escapedFarm: boolean;
  sugarFound: boolean;
  selectedDigger: 'worker' | 'warrior' | 'scout';
}

export interface StoryCallbacks {
  onHudSync: () => void;
  onToast: (msg: string) => void;
  onVictory: () => void;
}

export class StoryEngine {
  readonly width = 260;
  readonly height = 165;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly audio: MeditativeAudio;
  readonly callbacks: StoryCallbacks;

  cells: Uint8Array;
  hp: Uint8Array;
  maxHp: Uint8Array;
  noise: Uint8Array;

  ants: Ant[] = [];
  particles = new ParticleSystem();
  camera: Camera = { x: 130, y: 90, zoom: 4 };
  state: StoryState;
  active = false;

  // Farm geometry
  readonly farmLeft = 56;
  readonly farmRight = 204;
  readonly farmTop = 64;
  readonly farmBottom = 154;
  readonly nestX = 130;
  readonly nestY = 128;
  readonly aphidX = 96;
  readonly aphidY = 130;
  readonly nurseryX = 164;
  readonly nurseryY = 130;
  sugarX = 216;
  sugarY = 34;

  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private imgData: ImageData;
  private viewW = 1;
  private viewH = 1;
  private rafId = 0;
  private lastTime = 0;
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

    const size = this.width * this.height;
    this.cells = new Uint8Array(size);
    this.hp = new Uint8Array(size);
    this.maxHp = new Uint8Array(size);
    this.noise = new Uint8Array(size);

    this.offscreen = document.createElement('canvas');
    this.offscreen.width = this.width;
    this.offscreen.height = this.height;
    this.offCtx = this.offscreen.getContext('2d')!;
    this.imgData = this.offCtx.createImageData(this.width, this.height);

    this.state = this.createInitialState();
    this.resize();
    this.bindEvents();
  }

  private createInitialState(): StoryState {
    return {
      nectar: 16,
      larvae: 6,
      minerals: 0,
      satiety: 72,
      aphidHerders: 1,
      nurses: 1,
      jawLevel: 0,
      warriorUnlocked: false,
      scoutUnlocked: false,
      escapedFarm: false,
      sugarFound: false,
      selectedDigger: 'worker'
    };
  }

  startNewGame() {
    this.state = this.createInitialState();
    this.ants = [];
    this.particles.particles = [];
    this.generateFarmWorld();
    this.resetCamera();
    this.active = true;
    this.lastTime = performance.now();
    this.callbacks.onHudSync();
    this.callbacks.onToast('День 14. Хозяин забыл о ферме. Выращивай тлей и прогрызай пробку наверх!');

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
    const fitZoom = Math.min((this.viewW * 0.94) / this.width, (this.viewH * 0.84) / this.height);
    this.camera.zoom = Math.max(2.2, Math.min(6, fitZoom));
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

  private generateFarmWorld() {
    const { width: w, height: h } = this;

    // 1. Fill upper room air & warm tabletop outside the farm
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const hash = ((x * 374761393 + y * 668265263) ^ (x * y * 1274126177)) >>> 0;
        this.noise[idx] = hash & 255;

        if (y >= this.farmBottom) {
          // Solid wooden table underneath the farm
          this.setCell(x, y, StoryCell.Wood, 16);
        } else {
          // Room space outside the glass farm (walkable once escaped!)
          this.setCell(x, y, StoryCell.RoomAir, 0);
        }
      }
    }

    // 2. Fill interior of the Glass Ant Farm with layered sandy soil, loam & roots
    for (let y = this.farmTop; y <= this.farmBottom; y++) {
      for (let x = this.farmLeft; x <= this.farmRight; x++) {
        const isBorder =
          x <= this.farmLeft + 2 ||
          x >= this.farmRight - 2 ||
          y <= this.farmTop + 2 ||
          y >= this.farmBottom - 2;

        if (isBorder) {
          // Top center has a chewable Cork/Silicone Plug (escape route!)
          const inPlug = y <= this.farmTop + 2 && Math.abs(x - this.nestX) <= 10;
          if (inPlug) {
            this.setCell(x, y, StoryCell.Cork, 15);
          } else {
            this.setCell(x, y, StoryCell.Glass, 255);
          }
        } else {
          const depth = (y - this.farmTop) / (this.farmBottom - this.farmTop);
          const wave = Math.sin(x * 0.09 + y * 0.06) + Math.cos(x * 0.05 - y * 0.11);
          if (wave > 1.35) {
            this.setCell(x, y, StoryCell.Root, 14);
          } else if (depth > 0.45 && wave > 0.15) {
            this.setCell(x, y, StoryCell.Loam, 7);
          } else {
            this.setCell(x, y, StoryCell.Sand, 3);
          }
        }
      }
    }

    // 3. Carve cozy starting nest + Aphid Pasture + Larvae Nursery inside the farm
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
    carveChamber(this.aphidX, this.aphidY, 10, 7);
    carveChamber(this.nurseryX, this.nurseryY, 10, 7);
    // Connecting tunnels between chambers
    for (let x = this.aphidX; x <= this.nurseryX; x++) {
      for (let dy = -2; dy <= 2; dy++) {
        this.setCell(x, this.nestY + dy, StoryCell.Empty, 0);
      }
    }

    // 4. Add a wooden shelf / book obstacle in the room above so ants can crawl over or chew through it to reach Sugar!
    for (let y = 44; y <= 50; y++) {
      for (let x = 160; x <= 246; x++) {
        this.setCell(x, y, StoryCell.Wood, 16);
      }
    }

    // 5. Place the gleaming Sugar Cube on the wooden shelf outside the farm!
    this.sugarX = 216;
    this.sugarY = 38;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        this.setCell(this.sugarX + dx, this.sugarY + dy, StoryCell.Sugar, 1);
      }
    }
  }

  /* =========================================================
     COLONY ECONOMY ACTIONS
     ========================================================= */
  hireAphidHerder(): boolean {
    const costMinerals = 6 + this.state.aphidHerders * 5;
    const costLarvae = 2 + this.state.aphidHerders;
    if (this.state.minerals < costMinerals || this.state.larvae < costLarvae) return false;
    this.state.minerals -= costMinerals;
    this.state.larvae -= costLarvae;
    this.state.aphidHerders++;
    this.audio.playUpgrade();
    this.particles.spawn(this.aphidX, this.aphidY, 110, 245, 130, 12, 20, 1.0, 1.8);
    this.callbacks.onToast(`🌿 Пастухов тлей: ${this.state.aphidHerders} (+нектар)`);
    this.callbacks.onHudSync();
    return true;
  }

  hireNurse(): boolean {
    const costNectar = 10 + this.state.nurses * 8;
    const costMinerals = 4 + this.state.nurses * 4;
    if (this.state.nectar < costNectar || this.state.minerals < costMinerals) return false;
    this.state.nectar -= costNectar;
    this.state.minerals -= costMinerals;
    this.state.nurses++;
    this.audio.playUpgrade();
    this.particles.spawn(this.nurseryX, this.nurseryY, 255, 220, 165, 12, 20, 1.0, 1.8);
    this.callbacks.onToast(`🥚 Нянек личинок: ${this.state.nurses} (+личинки)`);
    this.callbacks.onHudSync();
    return true;
  }

  upgradeJaws(): boolean {
    const costNectar = 12 + this.state.jawLevel * 12;
    const costMinerals = 10 + this.state.jawLevel * 10;
    if (this.state.nectar < costNectar || this.state.minerals < costMinerals) return false;
    this.state.nectar -= costNectar;
    this.state.minerals -= costMinerals;
    this.state.jawLevel++;
    this.audio.playUpgrade();
    this.callbacks.onToast(`⚡ Жвалы усилены (Ур. ${this.state.jawLevel})!`);
    this.callbacks.onHudSync();
    return true;
  }

  unlockWarrior(): boolean {
    if (this.state.warriorUnlocked) return false;
    if (this.state.nectar < 16 || this.state.larvae < 6) return false;
    this.state.nectar -= 16;
    this.state.larvae -= 6;
    this.state.warriorUnlocked = true;
    this.state.selectedDigger = 'warrior';
    this.audio.playUpgrade();
    this.callbacks.onToast('Открыт Воин! Поможет пробить пробку фермы.');
    this.callbacks.onHudSync();
    return true;
  }

  unlockScout(): boolean {
    if (this.state.scoutUnlocked) return false;
    if (this.state.nectar < 12 || this.state.larvae < 4) return false;
    this.state.nectar -= 12;
    this.state.larvae -= 4;
    this.state.scoutUnlocked = true;
    this.state.selectedDigger = 'scout';
    this.audio.playUpgrade();
    this.callbacks.onToast('Открыт Разведчик!');
    this.callbacks.onHudSync();
    return true;
  }

  selectDigger(type: 'worker' | 'warrior' | 'scout') {
    if (type === 'warrior' && !this.state.warriorUnlocked) return;
    if (type === 'scout' && !this.state.scoutUnlocked) return;
    this.state.selectedDigger = type;
    this.callbacks.onHudSync();
  }

  private deployDigger(wx: number, wy: number, angleOverride?: number) {
    const type = this.state.selectedDigger;
    const larvaCost = type === 'warrior' ? 3 : type === 'scout' ? 2 : 1;
    const nectarCost = type === 'warrior' ? 4 : 2;

    if (this.state.larvae < larvaCost || this.state.nectar < nectarCost) {
      this.callbacks.onToast(`Нужно ${larvaCost} 🥚 и ${nectarCost} 🍯 (развивай тлей и нянек!)`);
      return;
    }

    const spawn = this.findNearestOpen(wx, wy, 28) || { x: this.nestX, y: this.nestY };
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
      spawnTimer: 0,
      legPhase: Math.random() * Math.PI * 2,
      trailTimer: 0
    });

    this.audio.ensureStarted();
    this.audio.playSpawn();
    this.particles.spawn(spawn.x, spawn.y, cfg.rgb[0], cfg.rgb[1], cfg.rgb[2], 5, 14, 0.5, 1.4);
    this.callbacks.onHudSync();
  }

  private findNearestOpen(tx: number, ty: number, maxR = 24): { x: number; y: number } | null {
    const ix = Math.round(tx);
    const iy = Math.round(ty);
    const isOpen = (x: number, y: number) => {
      if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
      const c = this.cells[y * this.width + x] as StoryCell;
      return c === StoryCell.Empty || (this.state.escapedFarm && c === StoryCell.RoomAir);
    };
    if (isOpen(ix, iy)) return { x: ix, y: iy };
    for (let r = 1; r <= maxR; r++) {
      const steps = r * 8;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = Math.round(ix + Math.cos(a) * r);
        const y = Math.round(iy + Math.sin(a) * r);
        if (isOpen(x, y)) return { x, y };
      }
    }
    return null;
  }

  /* =========================================================
     SIMULATION UPDATE
     ========================================================= */
  private update(dt: number) {
    this.elapsed += dt;

    // 1. Colony economy production & hunger
    const nectarProd = this.state.aphidHerders * 1.65;
    const nectarDrain = 0.45 + this.ants.length * 0.14;
    this.state.nectar = Math.max(0, this.state.nectar + (nectarProd - nectarDrain) * dt);
    this.state.larvae += this.state.nurses * 0.52 * dt;

    if (this.state.nectar > 1) {
      this.state.satiety = Math.min(100, this.state.satiety + dt * 4.5);
    } else {
      this.state.satiety = Math.max(0, this.state.satiety - dt * 5.0);
    }

    const hungerSpeedMult = this.state.satiety < 20 ? 0.5 : 1.0;

    // 2. Update digger ants
    for (let i = this.ants.length - 1; i >= 0; i--) {
      const ant = this.ants[i];
      const cfg = ANT_TYPES[ant.type];
      ant.age += dt;
      if (ant.biteTimer > 0) ant.biteTimer -= dt;
      if (ant.biteFlash > 0) ant.biteFlash = Math.max(0, ant.biteFlash - dt * 5);
      ant.turnTimer -= dt;

      if (ant.age >= ant.maxAge) {
        this.audio.playAntExpire();
        this.ants.splice(i, 1);
        continue;
      }

      const speed = cfg.baseSpeed * hungerSpeedMult;
      const dmg = cfg.baseDamage + this.state.jawLevel + (ant.type === 'warrior' ? 2 : 0);
      const radius = ant.type === 'warrior' ? 2.2 : 1.15;

      // Once an ant escapes into the open room air, gently steer toward the Sugar Cube on the table!
      const curCell = this.getCell(Math.round(ant.x), Math.round(ant.y));
      if (curCell === StoryCell.RoomAir) {
        const toSugar = Math.atan2(this.sugarY - ant.y, this.sugarX - ant.x);
        let diff = toSugar - ant.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ant.angle += diff * Math.min(1, dt * 3.5);
      } else if (ant.type === 'warrior') {
        ant.angle = ant.fixedAngle;
      } else if (ant.type === 'worker' && ant.turnTimer <= 0) {
        // Gentle upward bias toward the cork lid inside the farm
        ant.angle += (Math.random() - 0.5) * 1.0;
        ant.turnTimer = 0.65 + Math.random() * 0.6;
      }

      const probeDist = ant.type === 'scout' ? Math.max(1.2, speed * dt) : 1.45;
      const nx = ant.x + Math.cos(ant.angle) * probeDist;
      const ny = ant.y + Math.sin(ant.angle) * probeDist;
      const ix = Math.round(nx);
      const iy = Math.round(ny);

      const ahead = this.getCell(ix, iy);
      if (ahead === StoryCell.Empty || ahead === StoryCell.RoomAir) {
        ant.x += Math.cos(ant.angle) * speed * dt;
        ant.y += Math.sin(ant.angle) * speed * dt;
        ant.legPhase += dt * speed * 1.4;
      } else if (ahead === StoryCell.Glass) {
        // Bounce off glass walls of the ant farm
        ant.angle += Math.PI * 0.65 + (Math.random() - 0.5) * 0.4;
        if (ant.type === 'warrior') ant.fixedAngle = ant.angle;
      } else if (ahead === StoryCell.Sugar) {
        if (!this.state.sugarFound) {
          this.state.sugarFound = true;
          this.audio.playSugarFound();
          this.particles.spawn(this.sugarX, this.sugarY, 255, 245, 175, 36, 45, 2.2, 2.5);
          this.callbacks.onVictory();
        }
      } else {
        // Chew sand, loam, root, cork, or wood!
        ant.legPhase += dt * 4.5;
        if (ant.biteTimer <= 0) {
          ant.biteTimer = cfg.baseBiteInterval;
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
          this.state.minerals += c === StoryCell.Cork ? 2 : 0.35;
          this.audio.playDigTick();

          if (c === StoryCell.Cork && !this.state.escapedFarm) {
            this.state.escapedFarm = true;
            this.audio.playCrystal();
            this.particles.spawn(x, y, 255, 225, 130, 18, 28, 1.3, 2.0);
            this.callbacks.onToast('🌿 Пробка прогрызена! Муравьи вышли на подоконник к сахару!');
          }
        }
      }
    }
  }

  /* =========================================================
     COZY ANT-FARM RENDERER
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
          // Warm dusk windowsill gradient
          const grad = y / h;
          data[p] = Math.round(22 + grad * 14);
          data[p + 1] = Math.round(28 + grad * 16);
          data[p + 2] = Math.round(42 + grad * 10);
          data[p + 3] = 255;
        } else if (c === StoryCell.Empty) {
          // Cozy dark burrow inside the ant farm
          data[p] = 26 + shade;
          data[p + 1] = 19 + shade;
          data[p + 2] = 14 + shade;
          data[p + 3] = 255;
        } else if (c === StoryCell.Glass) {
          // Translucent pale-cyan glass frame
          const glint = (x + y) % 19 === 0 ? 35 : 0;
          data[p] = 135 + glint;
          data[p + 1] = 195 + glint;
          data[p + 2] = 210 + glint;
          data[p + 3] = 255;
        } else if (c === StoryCell.Sugar) {
          const pulse = 0.88 + 0.12 * Math.sin(this.elapsed * 4 + x + y);
          data[p] = Math.round(255 * pulse);
          data[p + 1] = Math.round(248 * pulse);
          data[p + 2] = Math.round(205 * pulse);
          data[p + 3] = 255;
        } else {
          let r = 112 + shade;
          let g = 84 + shade;
          let b = 54 + shade;

          if (c === StoryCell.Loam) {
            r = 78 + shade;
            g = 56 + shade;
            b = 38 + shade;
          } else if (c === StoryCell.Root) {
            r = 58 + shade;
            g = 41 + shade;
            b = 27 + shade;
          } else if (c === StoryCell.Cork) {
            r = 166 + shade;
            g = 122 + shade;
            b = 76 + shade;
          } else if (c === StoryCell.Wood) {
            const grain = ((y * 3 + (n & 3)) % 5 === 0) ? 10 : 0;
            r = 86 + grain + shade;
            g = 58 + grain + shade;
            b = 38 + shade;
          }

          const mHp = maxHp[idx] || 1;
          const dmgRatio = Math.max(0, (mHp - hp[idx]) / mHp);
          if (dmgRatio > 0) {
            r = Math.min(255, Math.round(r + dmgRatio * 100));
            g = Math.max(20, Math.round(g - dmgRatio * 20));
            b = Math.max(15, Math.round(b - dmgRatio * 25));
          }

          data[p] = r;
          data[p + 1] = g;
          data[p + 2] = b;
          data[p + 3] = 255;
        }
      }
    }

    this.offCtx.putImageData(this.imgData, 0, 0);

    const ctx = this.ctx;
    ctx.fillStyle = '#161c28';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    const drawW = w * this.camera.zoom;
    const drawH = h * this.camera.zoom;
    const drawX = this.viewW * 0.5 - this.camera.x * this.camera.zoom;
    const drawY = this.viewH * 0.5 - this.camera.y * this.camera.zoom;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.offscreen, drawX, drawY, drawW, drawH);

    // Draw cozy glowing Aphid Pasture & Larvae Nursery icons inside the farm!
    const drawChamberBadge = (wx: number, wy: number, color: string, label: string) => {
      const sx = drawX + wx * this.camera.zoom;
      const sy = drawY + wy * this.camera.zoom;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(7, this.camera.zoom * 2.8), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff9eb';
      ctx.font = `600 ${Math.max(10, Math.round(this.camera.zoom * 2.6))}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(label, sx, sy + Math.max(18, this.camera.zoom * 5.2));
    };

    drawChamberBadge(this.aphidX, this.aphidY, 'rgba(92, 224, 120, 0.35)', `🌿 Тли ×${this.state.aphidHerders}`);
    drawChamberBadge(this.nurseryX, this.nurseryY, 'rgba(255, 224, 160, 0.32)', `🥚 Ясли ×${this.state.nurses}`);

    // Label the Cork Plug until escaped
    if (!this.state.escapedFarm) {
      const px = drawX + this.nestX * this.camera.zoom;
      const py = drawY + (this.farmTop - 4) * this.camera.zoom;
      ctx.fillStyle = 'rgba(255, 232, 175, 0.85)';
      ctx.font = `600 ${Math.max(10, Math.round(this.camera.zoom * 2.5))}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('▲ Пробка фермы (прогрызи наружу!)', px, py);
    }

    // Label Sugar Cube on the windowsill
    const sugX = drawX + this.sugarX * this.camera.zoom;
    const sugY = drawY + (this.sugarY - 7) * this.camera.zoom;
    ctx.fillStyle = '#fff5b8';
    ctx.font = `700 ${Math.max(11, Math.round(this.camera.zoom * 2.7))}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🧊 Сахар', sugX, sugY);

    // Particles
    for (const pt of this.particles.particles) {
      const alpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
      ctx.fillStyle = `rgba(${pt.r}, ${pt.g}, ${pt.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(drawX + pt.x * this.camera.zoom, drawY + pt.y * this.camera.zoom, Math.max(1.5, pt.size * this.camera.zoom * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }

    // Ants
    for (const ant of this.ants) {
      const sx = drawX + ant.x * this.camera.zoom;
      const sy = drawY + ant.y * this.camera.zoom;
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
      const spawn = this.findNearestOpen(wPos.x, wPos.y, 28) || { x: this.nestX, y: this.nestY };
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
