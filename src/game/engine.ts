import { ANT_TYPES, AntManager } from '../core/ants';
import { MeditativeAudio } from '../core/audio';
import { LEVELS } from '../core/levels';
import { ParticleSystem } from '../core/particles';
import { AimPreview, Camera, WorldRenderer } from '../core/renderer';
import { LevelDefinition, PlayableAntId } from '../core/types';
import { World } from '../core/world';
import { SkillTreeManager } from './skillTree';

export interface EngineCallbacks {
  onHudSync: () => void;
  onSugarFound: (level: LevelDefinition) => void;
  onToast: (message: string) => void;
  onFirstInteract: () => void;
}

export class GameEngine {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly skillTree: SkillTreeManager;
  readonly audio: MeditativeAudio;
  readonly ants: AntManager;
  readonly particles: ParticleSystem;
  readonly renderer: WorldRenderer;
  readonly callbacks: EngineCallbacks;

  world: World;
  selectedAnt: PlayableAntId = 'worker';
  camera: Camera = { x: 200, y: 125, zoom: 3.5 };
  paused = true; // Starts paused while Main Menu is open

  private viewW = 1;
  private viewH = 1;
  private rafId = 0;
  private lastTime = 0;
  private elapsed = 0;
  private hudSyncAccum = 0;
  private interacted = false;

  // Pointer & multitouch state
  private activePointers = new Map<number, { x: number; y: number }>();
  private isDraggingCam = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private pinchStartDist = 0;
  private pinchStartZoom = 1;

  // Universal tap-or-drag aiming state (works for ALL ant types!)
  private isAimingAnt = false;
  private aimOriginWorld: { x: number; y: number } | null = null;
  private aimClickWorld: { x: number; y: number } | null = null;
  private aimDownScreen: { x: number; y: number } | null = null;
  private aimDragged = false;
  private aimPreview: AimPreview | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    skillTree: SkillTreeManager,
    audio: MeditativeAudio,
    callbacks: EngineCallbacks
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.skillTree = skillTree;
    this.audio = audio;
    this.callbacks = callbacks;

    this.ants = new AntManager();
    this.particles = new ParticleSystem();

    const startLevel =
      LEVELS.find((l) => l.id === skillTree.state.currentLevelId && skillTree.isLevelUnlocked(l.id)) ||
      LEVELS[0];
    this.world = new World(startLevel, skillTree.hasMutation('far_sense'));
    this.renderer = new WorldRenderer(this.world.width, this.world.height);

    this.resize();
    this.resetCamera();
    this.bindEvents();
  }

  start() {
    this.lastTime = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      if (!this.paused) {
        this.update(dt);
      }
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
  }

  loadLevel(levelId: string, resetSkills = true) {
    if (!this.skillTree.isLevelUnlocked(levelId)) {
      this.callbacks.onToast('Сначала пройдите предыдущий уровень!');
      return;
    }
    const level = LEVELS.find((l) => l.id === levelId) || LEVELS[0];
    if (resetSkills) {
      this.skillTree.resetTreeForNewLevel(level.id);
      this.selectedAnt = 'worker';
    }
    this.world = new World(level, this.skillTree.hasMutation('far_sense'));
    this.ants.clear();
    this.particles.particles = [];
    this.resetCamera();
    this.callbacks.onHudSync();

    if (resetSkills && this.skillTree.hasMutation('start_sp_3')) {
      this.callbacks.onToast(`${level.name} • Мутация: старт с ♦ 3 очками!`);
    } else {
      this.callbacks.onToast(`Уровень: ${level.name}`);
    }
  }

  selectAnt(type: PlayableAntId) {
    if (!this.skillTree.isAntUnlocked(type)) return;
    this.selectedAnt = type;
    this.callbacks.onHudSync();
  }

  resetCamera() {
    const fitZoom = Math.min((this.viewW * 0.96) / this.world.width, (this.viewH * 0.88) / this.world.height);
    this.camera.zoom = Math.max(2.6, Math.min(5.5, fitZoom * 1.48));
    this.camera.x = this.world.nestX;
    this.camera.y = Math.max(this.world.height * 0.44, this.world.nestY - 34);
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = Math.floor(this.viewW * dpr);
    this.canvas.height = Math.floor(this.viewH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const wx = (sx - this.viewW * 0.5) / this.camera.zoom + this.camera.x;
    const wy = (sy - this.viewH * 0.5) / this.camera.zoom + this.camera.y;
    return { x: wx, y: wy };
  }

  private markInteracted() {
    if (!this.interacted) {
      this.interacted = true;
      this.audio.ensureStarted();
      this.callbacks.onFirstInteract();
    }
  }

  private deployAntAt(wx: number, wy: number, angleOverride?: number) {
    this.markInteracted();

    let spawn = this.world.findNearestEmpty(wx, wy, 30);
    if (!spawn) {
      spawn = { x: this.world.nestX, y: this.world.nestY };
    }

    const angle =
      angleOverride !== undefined
        ? angleOverride
        : Math.hypot(wx - spawn.x, wy - spawn.y) > 2
          ? Math.atan2(wy - spawn.y, wx - spawn.x)
          : -Math.PI * 0.5 + (Math.random() - 0.5) * 1.4;

    const stats = this.skillTree.getColonyStats();
    const res = this.ants.spawnAnt(this.selectedAnt, spawn.x, spawn.y, angle, stats);
    if (res.ok) {
      const rgb = ANT_TYPES[this.selectedAnt].rgb;
      this.particles.spawn(spawn.x, spawn.y, rgb[0], rgb[1], rgb[2], 5, 16, 0.5, 1.4);
      if (this.selectedAnt === 'compass') {
        this.audio.playCompassLaunch();
        this.callbacks.onToast('🧭 Компас взял след сахара!');
      } else {
        this.audio.playSpawn();
      }
      this.callbacks.onHudSync();
    } else if (res.reason === 'cooldown') {
      const sec = Math.ceil(this.ants.compassCooldown);
      const m = Math.floor(sec / 60);
      const s = String(sec % 60).padStart(2, '0');
      this.callbacks.onToast(`Компас перезаряжается: ${m}:${s}`);
    } else {
      const cfg = ANT_TYPES[this.selectedAnt];
      const cap = this.ants.getMaxActive(this.selectedAnt, stats);
      this.callbacks.onToast(`Лимит «${cfg.name}»: ${cap}/${cap} (увеличь в дереве навыков)`);
    }
  }

  private update(dt: number) {
    this.elapsed += dt;

    const stats = this.skillTree.getColonyStats();
    const events = this.ants.update(dt, this.world, this.particles, stats);

    if (events.dugPixels > 0) {
      this.audio.playDigTick();
    }
    if (events.artRevealed > 0) {
      this.audio.playArtReveal();
    }
    if (events.anomalySpawned > 0) {
      this.audio.playMutationSpawn();
      this.callbacks.onToast('♛ Королевская аномалия: Матка родила особого муравья!');
    }
    if (events.antsExpired > 0) {
      this.audio.playAntExpire();
    }
    if (events.crystalsBroken > 0) {
      let gained = events.crystalsBroken * (1 + stats.crystalBonus);
      if (stats.crystalLuckChance > 0 && Math.random() < stats.crystalLuckChance) {
        gained += 1;
      }
      this.skillTree.addSkillPoints(gained);
      this.audio.playCrystal();
      this.callbacks.onToast(`♦ +${gained} очко навыков`);
      this.callbacks.onHudSync();
    }
    if (events.sugarHit) {
      this.skillTree.markLevelCompleted(this.world.level.id);
      this.audio.playSugarFound();
      this.callbacks.onHudSync();
      this.callbacks.onSugarFound(this.world.level);
    }

    this.particles.update(dt);

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.25) {
      this.hudSyncAccum = 0;
      this.callbacks.onHudSync();
    }
  }

  private render() {
    this.renderer.render(
      this.ctx,
      this.viewW,
      this.viewH,
      this.camera,
      this.world,
      this.ants.ants,
      this.particles,
      this.elapsed,
      this.aimPreview
    );
  }

  private bindEvents() {
    window.addEventListener('resize', () => {
      this.resize();
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        if (this.paused) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        const before = this.screenToWorld(e.clientX, e.clientY);
        this.camera.zoom = Math.max(1.2, Math.min(12, this.camera.zoom * factor));
        const after = this.screenToWorld(e.clientX, e.clientY);
        this.camera.x += before.x - after.x;
        this.camera.y += before.y - after.y;
      },
      { passive: false }
    );

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.paused) return;
      this.canvas.setPointerCapture(e.pointerId);
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 2) {
        this.isAimingAnt = false;
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

      // Universal tap OR drag-to-aim launch for ALL ant types!
      const wPos = this.screenToWorld(e.clientX, e.clientY);
      const spawn = this.world.findNearestEmpty(wPos.x, wPos.y, 30) || {
        x: this.world.nestX,
        y: this.world.nestY
      };
      this.isAimingAnt = true;
      this.aimOriginWorld = spawn;
      this.aimClickWorld = wPos;
      this.aimDownScreen = { x: e.clientX, y: e.clientY };
      this.aimDragged = false;
      this.aimPreview = null;
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.activePointers.has(e.pointerId)) return;
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.activePointers.size === 2) {
        const pts = Array.from(this.activePointers.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const midX = (pts[0].x + pts[1].x) * 0.5;
        const midY = (pts[0].y + pts[1].y) * 0.5;

        if (this.pinchStartDist > 0) {
          const scale = dist / this.pinchStartDist;
          this.camera.zoom = Math.max(1.2, Math.min(12, this.pinchStartZoom * scale));
        }

        const dx = midX - this.lastDragX;
        const dy = midY - this.lastDragY;
        this.camera.x -= dx / this.camera.zoom;
        this.camera.y -= dy / this.camera.zoom;
        this.lastDragX = midX;
        this.lastDragY = midY;
        return;
      }

      if (this.isDraggingCam) {
        const dx = e.clientX - this.lastDragX;
        const dy = e.clientY - this.lastDragY;
        this.camera.x -= dx / this.camera.zoom;
        this.camera.y -= dy / this.camera.zoom;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
        return;
      }

      if (this.isAimingAnt && this.aimOriginWorld && this.aimDownScreen) {
        const dragScreenDist = Math.hypot(
          e.clientX - this.aimDownScreen.x,
          e.clientY - this.aimDownScreen.y
        );
        if (dragScreenDist >= 8) {
          this.aimDragged = true;
          const wPos = this.screenToWorld(e.clientX, e.clientY);
          const angle = Math.atan2(
            wPos.y - this.aimOriginWorld.y,
            wPos.x - this.aimOriginWorld.x
          );
          this.aimPreview = {
            fromX: this.aimOriginWorld.x,
            fromY: this.aimOriginWorld.y,
            angle,
            color: ANT_TYPES[this.selectedAnt].color
          };
        }
      }
    });

    const endPointer = (e: PointerEvent) => {
      if (this.isAimingAnt && this.aimOriginWorld) {
        if (this.aimDragged && this.aimPreview) {
          // Released after dragging: launch strictly along aimed arrow!
          this.deployAntAt(this.aimOriginWorld.x, this.aimOriginWorld.y, this.aimPreview.angle);
        } else if (this.aimClickWorld) {
          // Quick tap: deploy naturally at clicked spot
          this.deployAntAt(this.aimClickWorld.x, this.aimClickWorld.y);
        }
        this.isAimingAnt = false;
        this.aimOriginWorld = null;
        this.aimClickWorld = null;
        this.aimDownScreen = null;
        this.aimDragged = false;
        this.aimPreview = null;
      }

      this.activePointers.delete(e.pointerId);
      if (this.activePointers.size < 2) {
        this.pinchStartDist = 0;
      }
      if (this.activePointers.size === 0) {
        this.isDraggingCam = false;
      }
    };

    this.canvas.addEventListener('pointerup', endPointer);
    this.canvas.addEventListener('pointercancel', endPointer);

    window.addEventListener('keydown', (e) => {
      if (this.paused) return;
      if (e.key === '1') this.selectAnt('worker');
      if (e.key === '2') this.selectAnt('warrior');
      if (e.key === '3') this.selectAnt('scout');
      if (e.key === '4') this.selectAnt('queen');
      if (e.key === '5') this.selectAnt('compass');
      if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
        this.resetCamera();
      }
    });
  }
}
