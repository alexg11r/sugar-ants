import { ANT_TYPES, AntManager } from '../core/ants';
import { MeditativeAudio } from '../core/audio';
import { subscribeBackgroundTick } from '../core/bgTicker';
import { getOptimalDpr } from '../core/device';
import { loc, t } from '../core/i18n';
import { LEVELS } from '../core/levels';
import { ParticleSystem } from '../core/particles';
import { AimPreview, Camera, WorldRenderer } from '../core/renderer';
import { Ant, ArtifactDef, LevelDefinition, PheromoneBeacon, PlayableAntId } from '../core/types';
import { World, WorldSnapshot } from '../core/world';
import { getArtifactForLevel } from './artifacts';
import { SkillTreeManager } from './skillTree';

const ACTIVE_RUN_STORAGE_KEY = 'sugar_ants_active_run_v1';
export const BEACON_DURATION_SEC = 30;
export const BEACON_COOLDOWN_SEC = 120;

interface ActiveRunSnapshot {
  v: 1;
  savedAt: number;
  world: WorldSnapshot;
  ants: Ant[];
  compassCooldown: number;
  selectedAnt: PlayableAntId;
  camera: Camera;
  beacon?: PheromoneBeacon | null;
  beaconCooldown?: number;
  runElapsedSec?: number;
}

export interface EngineCallbacks {
  onHudSync: () => void;
  onSugarFound: (level: LevelDefinition) => void;
  onArtifactFound: (artifact: ArtifactDef) => void;
  onMapCleared: (level: LevelDefinition) => void;
  onToast: (message: string) => void;
  onFirstInteract: () => void;
  onZoomInteract: () => void;
  onPanInteract: () => void;
}

export class GameEngine {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly skillTree: SkillTreeManager;
  readonly audio: MeditativeAudio;
  readonly ants: AntManager;
  readonly particles: ParticleSystem;
  renderer: WorldRenderer;
  readonly callbacks: EngineCallbacks;

  world: World;
  selectedAnt: PlayableAntId = 'worker';
  camera: Camera = { x: 200, y: 125, zoom: 3.5 };
  paused = true; // Starts paused while Main Menu is open
  /** Mobile 1-finger camera pan toggle (false = 1-finger launches ants, true = 1-finger drags camera) */
  touchPanMode = false;
  /** Pheromone beacon guiding free Workers & Queen Brood gently for 30s (2 min cooldown)! */
  beacon: PheromoneBeacon | null = null;
  beaconMode = false;
  beaconCooldown = 0;
  /** Remaining seconds of ×1.6 Sugar Dust Rush fever! */
  sugarRushTimer = 0;
  /** Elapsed active seconds in the current level run (for personal speed records!) */
  runElapsedSec = 0;
  /** True when an in-progress mid-map run exists (either restored from disk or played in this session) */
  private hasActiveRun = false;
  /** Held keyboard keys for smooth PC WASD / Arrow camera panning */
  private heldKeys = new Set<string>();

  private viewW = 1;
  private viewH = 1;
  private rafId = 0;
  private unsubBgTick: (() => void) | null = null;
  private lastWallMs = 0;
  private elapsed = 0;
  private hudSyncAccum = 0;
  private autoSaveAccum = 0;
  private autoSummonAccum = 0;
  private lastLaunchWorld: { x: number; y: number } | null = null;
  private fireworkAccum = 0;
  private sugarBurstTime = -1;
  private sugarBurstTimers: number[] = [];
  private cameraEaseTarget: { x: number; y: number; zoom: number } | null = null;
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

    const restored = this.tryRestoreSavedRun();
    if (restored) {
      this.world = restored.world;
      this.ants.restoreState(restored.ants, restored.compassCooldown);
      this.selectedAnt = this.skillTree.isAntUnlocked(restored.selectedAnt) ? restored.selectedAnt : 'worker';
      this.camera = { ...restored.camera };
      this.beacon = restored.beacon ? { ...restored.beacon } : null;
      this.beaconCooldown = restored.beaconCooldown;
      this.runElapsedSec = restored.runElapsedSec;
      this.hasActiveRun = true;
      this.renderer = new WorldRenderer(this.world.width, this.world.height);
      this.resize();
    } else {
      const startLevel =
        LEVELS.find((l) => l.id === skillTree.state.currentLevelId && skillTree.isLevelUnlocked(l.id)) ||
        LEVELS[0];
      const startArtifact = this.pickUncollectedArtifact(startLevel.id);
      this.world = new World(startLevel, skillTree.hasMutation('far_sense'), startArtifact);
      this.renderer = new WorldRenderer(this.world.width, this.world.height);
      this.resize();
      this.resetCamera();
    }

    this.bindEvents();
  }

  private tryRestoreSavedRun(): {
    world: World;
    ants: Ant[];
    compassCooldown: number;
    selectedAnt: PlayableAntId;
    camera: Camera;
    beacon: PheromoneBeacon | null;
    beaconCooldown: number;
    runElapsedSec: number;
  } | null {
    try {
      const raw = localStorage.getItem(ACTIVE_RUN_STORAGE_KEY);
      if (!raw) return null;
      const snap = JSON.parse(raw) as Partial<ActiveRunSnapshot>;
      if (!snap || snap.v !== 1 || !snap.world || typeof snap.world.levelId !== 'string') return null;

      const lvl = LEVELS.find((l) => l.id === snap.world!.levelId);
      if (!lvl || !this.skillTree.isLevelUnlocked(lvl.id)) return null;

      const artDef = this.pickUncollectedArtifact(lvl.id);
      const world = World.fromSnapshot(snap.world, lvl, this.skillTree.hasMutation('far_sense'), artDef);
      if (!world) return null;

      const cam = snap.camera && Number.isFinite(snap.camera.x) && Number.isFinite(snap.camera.y) && Number.isFinite(snap.camera.zoom)
        ? {
            x: snap.camera.x,
            y: snap.camera.y,
            zoom: Math.max(1.0, Math.min(28, snap.camera.zoom))
          }
        : { x: world.nestX, y: world.nestY, zoom: 7.5 };

      const savedAnts = Array.isArray(snap.ants) ? snap.ants : [];
      const selectedAnt: PlayableAntId = snap.selectedAnt || 'worker';
      const beacon: PheromoneBeacon | null =
        snap.beacon && Number.isFinite(snap.beacon.x) && Number.isFinite(snap.beacon.y)
          ? {
              x: snap.beacon.x,
              y: snap.beacon.y,
              timeLeft:
                typeof snap.beacon.timeLeft === 'number' && snap.beacon.timeLeft > 0
                  ? Math.min(BEACON_DURATION_SEC, snap.beacon.timeLeft)
                  : BEACON_DURATION_SEC,
              maxDuration:
                typeof snap.beacon.maxDuration === 'number' && snap.beacon.maxDuration > 0
                  ? snap.beacon.maxDuration
                  : BEACON_DURATION_SEC
            }
          : null;
      return {
        world,
        ants: savedAnts,
        compassCooldown: typeof snap.compassCooldown === 'number' ? snap.compassCooldown : 0,
        selectedAnt,
        camera: cam,
        beacon,
        beaconCooldown:
          typeof snap.beaconCooldown === 'number' && Number.isFinite(snap.beaconCooldown)
            ? Math.max(0, Math.min(BEACON_COOLDOWN_SEC, snap.beaconCooldown))
            : 0,
        runElapsedSec: typeof snap.runElapsedSec === 'number' && Number.isFinite(snap.runElapsedSec) ? snap.runElapsedSec : 0
      };
    } catch {
      return null;
    }
  }

  /** Saves complete mid-map state (pixel terrain, tunnels, fog, ants, skills, camera) to localStorage (~15-30 KB)! */
  saveRunProgress(): boolean {
    if (!this.hasActiveRun && this.world.stats.dugBreakable === 0 && this.ants.ants.length === 0) {
      return false;
    }
    try {
      this.skillTree.flushPendingSave();
      const payload: ActiveRunSnapshot = {
        v: 1,
        savedAt: Date.now(),
        world: this.world.exportSnapshot(),
        ants: this.ants.ants.map((a) => ({ ...a })),
        compassCooldown: this.ants.compassCooldown,
        selectedAnt: this.selectedAnt,
        camera: { ...this.camera },
        beacon: this.beacon ? { ...this.beacon } : null,
        beaconCooldown: this.beaconCooldown,
        runElapsedSec: this.runElapsedSec
      };
      localStorage.setItem(ACTIVE_RUN_STORAGE_KEY, JSON.stringify(payload));
      this.hasActiveRun = true;
      return true;
    } catch {
      return false;
    }
  }

  clearSavedRun() {
    this.hasActiveRun = false;
    try {
      localStorage.removeItem(ACTIVE_RUN_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  hasResumableRun(): boolean {
    return (
      this.hasActiveRun ||
      this.world.stats.dugBreakable > 0 ||
      this.ants.ants.length > 0 ||
      this.world.stats.crystalsCollected > 0
    );
  }

  getSavedRunSummary(): { levelId: string; levelName: string; digPct: number } | null {
    if (!this.hasResumableRun()) return null;
    const { stats, level } = this.world;
    const digPct =
      stats.totalBreakable > 0
        ? Math.min(100, Math.round((stats.dugBreakable / stats.totalBreakable) * 100))
        : 0;
    return { levelId: level.id, levelName: loc(level.name, level.nameEn), digPct };
  }

  setTouchPanMode(enabled: boolean) {
    this.touchPanMode = enabled;
    if (enabled) this.beaconMode = false;
    this.isAimingAnt = false;
    this.aimPreview = null;
    this.canvas.style.cursor = enabled ? 'grab' : 'crosshair';
  }

  toggleBeaconMode() {
    if (this.beaconMode) {
      this.beaconMode = false;
      this.canvas.style.cursor = this.touchPanMode ? 'grab' : 'crosshair';
      this.callbacks.onHudSync();
      return;
    }
    if (this.beacon && this.beacon.timeLeft > 0) {
      this.callbacks.onToast(t('toastBeaconActive', { sec: Math.ceil(this.beacon.timeLeft) }));
      return;
    }
    if (this.beaconCooldown > 0) {
      const sec = Math.ceil(this.beaconCooldown);
      const time = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      this.callbacks.onToast(t('toastBeaconCd', { time }));
      return;
    }
    this.beaconMode = true;
    this.touchPanMode = false;
    this.isAimingAnt = false;
    this.aimPreview = null;
    this.canvas.style.cursor = 'cell';
    this.callbacks.onToast(t('toastBeaconPlace'));
    this.callbacks.onHudSync();
  }

  clearBeacon() {
    this.beacon = null;
    this.beaconMode = false;
    this.canvas.style.cursor = this.touchPanMode ? 'grab' : 'crosshair';
    this.callbacks.onHudSync();
  }

  zoomBy(factor: number) {
    this.cameraEaseTarget = null;
    this.camera.zoom = Math.max(1.0, Math.min(28, this.camera.zoom * factor));
    if (this.camera.zoom >= 16) {
      this.skillTree.unlockAchievement('zoom_macro');
    }
    this.callbacks.onZoomInteract();
  }

  start() {
    this.lastWallMs = Date.now();
    const stepWallClock = () => {
      const now = Date.now();
      const rawDt = Math.max(0, (now - this.lastWallMs) / 1000);
      this.lastWallMs = now;
      if (this.paused || rawDt <= 0) return;

      // Catch up in safe 50ms sub-steps so minimized tabs NEVER freeze ants or cooldowns!
      let rem = Math.min(rawDt, 60);
      while (rem > 0) {
        const step = Math.min(0.05, rem);
        this.update(step);
        rem -= step;
      }
      if (rawDt > 60) {
        const extra = rawDt - 60;
        this.ants.compassCooldown = Math.max(0, this.ants.compassCooldown - extra);
        if (this.beacon) {
          this.beacon.timeLeft -= extra;
          if (this.beacon.timeLeft <= 0) {
            const overflow = -this.beacon.timeLeft;
            this.beacon = null;
            this.beaconCooldown = Math.max(0, BEACON_COOLDOWN_SEC - overflow);
          }
        } else if (this.beaconCooldown > 0) {
          this.beaconCooldown = Math.max(0, this.beaconCooldown - extra);
        }
        this.callbacks.onHudSync();
      }
    };

    // Unthrottled Web Worker background heartbeat keeps simulation & cooldowns alive when minimized
    if (!this.unsubBgTick) {
      this.unsubBgTick = subscribeBackgroundTick(() => {
        if (document.hidden && !this.paused) stepWallClock();
      });
    }

    const loop = () => {
      stepWallClock();
      this.render();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  destroy() {
    this.clearSugarBurstTimers();
    this.skillTree.flushPendingSave();
    cancelAnimationFrame(this.rafId);
    if (this.unsubBgTick) {
      this.unsubBgTick();
      this.unsubBgTick = null;
    }
  }

  private clearSugarBurstTimers() {
    for (const id of this.sugarBurstTimers) window.clearTimeout(id);
    this.sugarBurstTimers = [];
  }

  private pickUncollectedArtifact(levelId: string): ArtifactDef | null {
    const def = getArtifactForLevel(levelId);
    if (!def || this.skillTree.hasArtifact(def.id)) return null;
    return def;
  }

  /** Smoothly eases the camera from wide view down into close-up nest focus right after the chapter intro! */
  playNestRevealBurst() {
    const { nestX, nestY } = this.world;
    const fitZoom = Math.min((this.viewW * 0.88) / this.world.width, (this.viewH * 0.8) / this.world.height);
    const closeZoom = Math.max(7.2, Math.min(11.5, fitZoom * 3.4));
    this.camera.x = nestX;
    this.camera.y = nestY;
    this.camera.zoom = Math.max(2.6, closeZoom * 0.45);
    this.cameraEaseTarget = { x: nestX, y: nestY, zoom: closeZoom };

    [0, 1, 2].forEach((step) => {
      setTimeout(() => {
        if (this.paused) return;
        this.audio.playRevealPop(step);
        this.particles.spawn(nestX, nestY, 95, 255, 165, 8 + step * 4, 18 + step * 8, 0.7, 1.5);
      }, step * 110);
    });
  }

  /** Smoothly eases the camera out to frame the entire shimmering masterpiece */
  easeCameraToFullMap() {
    const fitZoom = Math.min((this.viewW * 0.88) / this.world.width, (this.viewH * 0.74) / this.world.height);
    this.cameraEaseTarget = {
      x: this.world.width * 0.5,
      y: this.world.height * 0.5,
      zoom: Math.max(1.3, Math.min(4.2, fitZoom))
    };
  }

  loadLevel(levelId: string, resetSkills = true) {
    if (!this.skillTree.isLevelUnlocked(levelId)) {
      this.callbacks.onToast(t('toastPrevMapLocked'));
      return;
    }
    const level = LEVELS.find((l) => l.id === levelId) || LEVELS[0];
    if (resetSkills) {
      this.skillTree.resetTreeForNewLevel(level.id);
      this.selectedAnt = 'worker';
    } else {
      this.skillTree.recordLevelStart(level.id);
    }
    const artDef = this.pickUncollectedArtifact(level.id);
    this.world = new World(level, this.skillTree.hasMutation('far_sense'), artDef);
    // Recreate WorldRenderer whenever world dimensions change (e.g. Maps 6/7/8!)
    this.renderer = new WorldRenderer(this.world.width, this.world.height);
    this.ants.clear();
    this.particles.particles = [];
    this.clearSugarBurstTimers();
    this.sugarBurstTime = -1;
    this.cameraEaseTarget = null;
    this.beacon = null;
    this.beaconMode = false;
    this.beaconCooldown = 0;
    this.sugarRushTimer = 0;
    this.runElapsedSec = 0;
    this.lastLaunchWorld = null;
    this.fireworkAccum = 0;
    this.autoSaveAccum = 0;
    this.hasActiveRun = true;
    this.resetCamera();
    this.saveRunProgress();
    this.callbacks.onHudSync();

    const startSp = this.skillTree.state.skillPoints;
    const lvlName = loc(level.name, level.nameEn);
    if (resetSkills && startSp > 0) {
      this.callbacks.onToast(t('toastLevelStartSp', { name: lvlName, sp: startSp }));
    } else {
      this.callbacks.onToast(t('toastLevelStart', { name: lvlName }));
    }
  }

  selectAnt(type: PlayableAntId) {
    if (!this.skillTree.isAntUnlocked(type)) return;
    this.selectedAnt = type;
    this.callbacks.onHudSync();
  }

  resetCamera() {
    const fitZoom = Math.min((this.viewW * 0.92) / this.world.width, (this.viewH * 0.84) / this.world.height);
    // Start nicely zoomed in on the central nest so Layer 1 pixel details are crisp & intimate!
    this.camera.zoom = Math.max(6.8, Math.min(10.5, fitZoom * 3.2));
    this.camera.x = this.world.nestX;
    this.camera.y = this.world.nestY;
  }

  private resize() {
    const dpr = getOptimalDpr();
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
      this.hasActiveRun = true;
      this.lastLaunchWorld = { x: spawn.x, y: spawn.y };
      const rgb = ANT_TYPES[this.selectedAnt].rgb;
      this.particles.spawn(spawn.x, spawn.y, rgb[0], rgb[1], rgb[2], 5, 16, 0.5, 1.4);
      this.skillTree.recordAntSpawn(this.selectedAnt);
      if (this.selectedAnt === 'compass') {
        this.audio.playCompassLaunch();
        this.skillTree.unlockAchievement('use_compass');
        this.callbacks.onToast(t('toastBloodhoundGo'));
      } else {
        this.audio.playSpawn();
      }
      this.callbacks.onHudSync();
    } else if (res.reason === 'cooldown') {
      const sec = Math.ceil(this.ants.compassCooldown);
      const m = Math.floor(sec / 60);
      const s = String(sec % 60).padStart(2, '0');
      this.callbacks.onToast(t('toastBloodhoundCd', { time: `${m}:${s}` }));
    } else {
      const cfg = ANT_TYPES[this.selectedAnt];
      const cap = this.ants.getMaxActive(this.selectedAnt, stats);
      this.callbacks.onToast(t('toastAntCap', { name: loc(cfg.name, cfg.nameEn), cap }));
    }
  }

  /**
   * Strict spatial camera-proximity + close-zoom audio gate for ALL ant sounds!
   * Returns 0 (100% silent) whenever zoomed far out OR when the camera is pointed away from the ants.
   */
  private computeAntAudioIntensity(points: { x: number; y: number }[]): number {
    if (points.length === 0) return 0;
    const fitZoom = Math.min((this.viewW * 0.9) / this.world.width, (this.viewH * 0.82) / this.world.height);
    const minHearZoom = Math.max(7.2, fitZoom * 2.5);
    if (this.camera.zoom < minHearZoom) return 0;

    const zoomFactor = Math.min(1, (this.camera.zoom - minHearZoom) / 7.5);
    if (zoomFactor <= 0.02) return 0;

    const halfW = Math.max(1, this.viewW * 0.44);
    const halfH = Math.max(1, this.viewH * 0.44);
    let bestProx = 0;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const sx = (pt.x - this.camera.x) * this.camera.zoom;
      const sy = (pt.y - this.camera.y) * this.camera.zoom;
      const nx = Math.abs(sx) / halfW;
      const ny = Math.abs(sy) / halfH;
      if (nx >= 1 || ny >= 1) continue;
      const dist = Math.hypot(nx, ny);
      if (dist < 1) {
        const prox = Math.pow(1 - dist, 1.4);
        if (prox > bestProx) bestProx = prox;
      }
    }
    return zoomFactor * bestProx;
  }

  /** Dramatic "Found a Diamond!" in-world Sugar celebration: slow-mo + camera swoop + multi-wave diamond fireworks! */
  private triggerEpicSugarCelebration() {
    this.clearSugarBurstTimers();
    this.sugarBurstTime = 0;

    const { sugarX, sugarY } = this.world;
    const fitZoom = Math.min((this.viewW * 0.88) / this.world.width, (this.viewH * 0.8) / this.world.height);
    const targetZoom = Math.max(11.0, Math.min(16.5, fitZoom * 4.4));
    this.cameraEaseTarget = { x: sugarX, y: sugarY, zoom: targetZoom };

    // Wave 1: Pure diamond-gold explosion immediately
    this.particles.spawn(sugarX, sugarY, 255, 252, 224, 34, 48, 2.2, 2.5);
    this.particles.spawn(sugarX, sugarY, 175, 246, 255, 22, 38, 2.0, 2.2);
    this.particles.spawn(sugarX, sugarY, 255, 224, 102, 26, 30, 2.4, 2.6);

    // Wave 2: Secondary diamond glitter burst at +280ms
    this.sugarBurstTimers.push(
      window.setTimeout(() => {
        if (this.paused) return;
        this.particles.spawn(sugarX, sugarY, 255, 240, 155, 28, 52, 2.1, 2.3);
        this.particles.spawn(sugarX, sugarY, 130, 238, 255, 20, 44, 1.9, 2.0);
      }, 280)
    );

    // Wave 3: Shimmering crown halo at +620ms
    this.sugarBurstTimers.push(
      window.setTimeout(() => {
        if (this.paused) return;
        for (let k = 0; k < 6; k++) {
          const ang = (k / 6) * Math.PI * 2;
          this.particles.spawn(
            sugarX + Math.cos(ang) * 7,
            sugarY + Math.sin(ang) * 7,
            255,
            245,
            180,
            7,
            24,
            1.6,
            1.9
          );
        }
      }, 620)
    );

    // Open the grand Diamond-Sugar celebration overlay after the camera swoops in & bursts play out!
    const foundLevel = this.world.level;
    this.sugarBurstTimers.push(
      window.setTimeout(() => {
        this.callbacks.onSugarFound(foundLevel);
      }, 920)
    );
  }

  private update(dt: number) {
    this.elapsed += dt;
    this.runElapsedSec += dt;
    this.skillTree.recordPlayTime(dt);

    // Dramatic brief slow-motion hit-stop right when discovering Sugar!
    let simDt = dt;
    if (this.sugarBurstTime >= 0) {
      this.sugarBurstTime += dt;
      if (this.sugarBurstTime < 0.85) {
        simDt = dt * 0.25;
      } else if (this.sugarBurstTime < 1.35) {
        const ramp = (this.sugarBurstTime - 0.85) / 0.5;
        simDt = dt * (0.25 + ramp * 0.75);
      }
      if (this.sugarBurstTime >= 2.8) {
        this.sugarBurstTime = -1;
      }
    }

    if (this.sugarRushTimer > 0) {
      this.sugarRushTimer = Math.max(0, this.sugarRushTimer - dt);
    }

    // Pheromone Beacon 30s active duration -> 2 min (120s) cooldown!
    if (this.beacon) {
      this.beacon.timeLeft -= dt;
      if (this.beacon.timeLeft <= 0) {
        this.particles.spawn(this.beacon.x, this.beacon.y, 66, 245, 197, 8, 16, 0.7, 1.4);
        this.beacon = null;
        this.beaconCooldown = BEACON_COOLDOWN_SEC;
        this.callbacks.onHudSync();
      }
    } else if (this.beaconCooldown > 0) {
      this.beaconCooldown = Math.max(0, this.beaconCooldown - dt);
    }

    // Smooth PC keyboard camera panning (WASD / ЦФЫВ / Arrow keys!)
    if (this.heldKeys.size > 0) {
      let kx = 0;
      let ky = 0;
      if (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft')) kx -= 1;
      if (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight')) kx += 1;
      if (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp')) ky -= 1;
      if (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown')) ky += 1;
      if (kx !== 0 || ky !== 0) {
        const len = Math.hypot(kx, ky);
        const panWorldSpeed = (340 / Math.max(1.2, this.camera.zoom)) * dt;
        this.cameraEaseTarget = null;
        this.camera.x += (kx / len) * panWorldSpeed;
        this.camera.y += (ky / len) * panWorldSpeed;
        this.callbacks.onPanInteract();
      }
    }

    const stats = this.skillTree.getColonyStats();
    const rushMult = this.sugarRushTimer > 0 ? 1.6 : 1;
    const events = this.ants.update(simDt, this.world, this.particles, stats, this.beacon, rushMult);

    // Optional Auto-Summon (toggled in Settings): calmly refills empty ant slots without spam sounds!
    if (this.skillTree.state.settings.autoSummon && !this.world.stats.mapCleared) {
      this.autoSummonAccum += dt;
      if (this.autoSummonAccum >= 0.65) {
        this.autoSummonAccum = 0;
        const order: PlayableAntId[] = [];
        if (this.selectedAnt !== 'compass') order.push(this.selectedAnt);
        for (const t of ['worker', 'warrior', 'scout', 'queen'] as PlayableAntId[]) {
          if (!order.includes(t)) order.push(t);
        }
        for (const antType of order) {
          if (!this.skillTree.isAntUnlocked(antType)) continue;
          if (this.ants.countPlayerByType(antType) >= this.ants.getMaxActive(antType, stats)) continue;
          const anchor = this.beacon || this.lastLaunchWorld || { x: this.world.nestX, y: this.world.nestY };
          const spawn = this.world.findNearestEmpty(anchor.x, anchor.y, 28) || {
            x: this.world.nestX,
            y: this.world.nestY
          };
          const ang = this.beacon
            ? Math.atan2(this.beacon.y - spawn.y, this.beacon.x - spawn.x) + (Math.random() - 0.5) * 0.7
            : Math.random() * Math.PI * 2;
          const r = this.ants.spawnAnt(antType, spawn.x, spawn.y, ang, stats);
          if (r.ok) {
            this.hasActiveRun = true;
            const rgb = ANT_TYPES[antType].rgb;
            this.particles.spawn(spawn.x, spawn.y, rgb[0], rgb[1], rgb[2], 3, 12, 0.45, 1.2);
            this.skillTree.recordAntSpawn(antType);
          }
          break;
        }
      }
    }

    // ALL ongoing ant sounds are strictly gated by close zoom + central camera framing!
    if (events.dugPoints.length > 0) {
      const digIntensity = this.computeAntAudioIntensity(events.dugPoints);
      if (digIntensity > 0.04) {
        this.audio.playDigTick(digIntensity);
      }
    }
    if (events.dugPixels > 0) {
      this.skillTree.recordCareer({ blocksDug: events.dugPixels });
    }
    if (events.artPoints.length > 0) {
      const artIntensity = this.computeAntAudioIntensity(events.artPoints);
      if (artIntensity > 0.04) {
        this.audio.playArtReveal(artIntensity);
      }
    }
    if (events.anomalySpawned > 0) {
      const anomIntensity = this.computeAntAudioIntensity(events.anomalyPoints);
      if (anomIntensity > 0.04) {
        this.audio.playMutationSpawn(anomIntensity);
      }
      this.callbacks.onToast(t('toastQueenAnomaly'));
    }
    if (events.expiredPoints.length > 0) {
      const expIntensity = this.computeAntAudioIntensity(events.expiredPoints);
      if (expIntensity > 0.04) {
        this.audio.playAntExpire(expIntensity);
      }
    }
    if (events.crystalsBroken > 0) {
      let gained = events.crystalsBroken * (1 + stats.crystalBonus);
      if (stats.crystalLuckChance > 0 && Math.random() < stats.crystalLuckChance) {
        gained += 1;
      }
      this.skillTree.addSkillPoints(gained);
      this.skillTree.recordCareer({ crystalsCollected: events.crystalsBroken });
      this.audio.playCrystal();
      this.callbacks.onToast(t('toastSpGain', { n: gained }));
      this.callbacks.onHudSync();
    }
    if (events.sporeBlasts.length > 0) {
      this.skillTree.recordCareer({ sporesBlasted: events.sporeBlasts.length });
      this.audio.playSporeBlast();
      this.callbacks.onToast(t('toastSporeBlast'));
      this.callbacks.onHudSync();
    }
    if (events.sugarDustHits.length > 0) {
      this.skillTree.recordCareer({ sugarDustFound: events.sugarDustHits.length });
      this.sugarRushTimer = Math.max(this.sugarRushTimer, 15);
      this.audio.playSugarDustRush();
      this.callbacks.onToast(t('toastSugarDust'));
      this.callbacks.onHudSync();
    }
    if (events.cocoonHatches.length > 0) {
      this.skillTree.recordCareer({ cocoonsHatched: events.cocoonHatches.length });
      for (const c of events.cocoonHatches) {
        this.ants.spawnFreeAlliesAt(c.x, c.y, stats, this.particles);
      }
      this.audio.playCocoonHatch();
      this.callbacks.onToast(t('toastCocoonHatch'));
      this.callbacks.onHudSync();
    }
    if (events.artifactFound) {
      const art = events.artifactFound;
      if (this.skillTree.collectArtifact(art.id)) {
        this.audio.playArtifactFound();
        this.saveRunProgress();
        this.callbacks.onHudSync();
        this.callbacks.onArtifactFound(art);
      }
    }
    if (events.sugarHit) {
      this.skillTree.recordSugarWin(this.world.level.id, this.runElapsedSec);
      this.audio.playSugarFound();
      this.saveRunProgress();
      this.callbacks.onHudSync();
      this.triggerEpicSugarCelebration();
    }

    // Epic 100% map-cleared finale: sweep stray pixels, zoom out to showcase shimmering art & fireworks!
    if (events.dugPixels > 0 && this.world.checkAndFinishClear()) {
      this.skillTree.recordMapClear(this.world.level.id, this.runElapsedSec);
      this.audio.playEpicClearFanfare();
      this.easeCameraToFullMap();
      for (let b = 0; b < 6; b++) {
        const fx = this.world.width * (0.2 + Math.random() * 0.6);
        const fy = this.world.height * (0.2 + Math.random() * 0.6);
        this.particles.spawn(fx, fy, 120 + Math.random() * 135, 160 + Math.random() * 95, 255, 22, 46, 2.2, 2.4);
      }
      this.callbacks.onHudSync();
      this.callbacks.onMapCleared(this.world.level);
    }

    // Ongoing celebratory shimmer sparkles while admiring a 100% cleared iridescent map!
    if (this.world.stats.mapCleared) {
      this.fireworkAccum += dt;
      if (this.fireworkAccum >= 0.9) {
        this.fireworkAccum = 0;
        const fx = this.world.width * (0.16 + Math.random() * 0.68);
        const fy = this.world.height * (0.16 + Math.random() * 0.68);
        const hue = Math.random() * Math.PI * 2;
        const r = Math.round(170 + 85 * Math.sin(hue));
        const g = Math.round(170 + 85 * Math.sin(hue + 2.1));
        const b = Math.round(170 + 85 * Math.sin(hue + 4.2));
        this.particles.spawn(fx, fy, r, g, b, 10, 28, 1.7, 1.9);
      }
    }

    // Smooth camera showcase easing (cancelled immediately if user pans/zooms manually)
    if (this.cameraEaseTarget) {
      const k = Math.min(1, dt * 3.5);
      this.camera.x += (this.cameraEaseTarget.x - this.camera.x) * k;
      this.camera.y += (this.cameraEaseTarget.y - this.camera.y) * k;
      this.camera.zoom += (this.cameraEaseTarget.zoom - this.camera.zoom) * k;
      if (
        Math.abs(this.cameraEaseTarget.x - this.camera.x) < 0.4 &&
        Math.abs(this.cameraEaseTarget.y - this.camera.y) < 0.4 &&
        Math.abs(this.cameraEaseTarget.zoom - this.camera.zoom) < 0.02
      ) {
        this.cameraEaseTarget = null;
      }
    }

    this.particles.update(dt);

    this.hudSyncAccum += dt;
    if (this.hudSyncAccum >= 0.25) {
      this.hudSyncAccum = 0;
      const ws = this.world.stats;
      const digPct =
        ws.totalBreakable > 0 ? Math.min(100, Math.round((ws.dugBreakable / ws.totalBreakable) * 100)) : 0;
      const artPct =
        ws.totalArt > 0 ? Math.min(100, Math.round((ws.revealedArt / ws.totalArt) * 100)) : 0;
      this.skillTree.recordLevelProgress(this.world.level.id, digPct, artPct);
      this.callbacks.onHudSync();
    }

    // Periodic crash-safe mid-map autosave every 12 seconds!
    this.autoSaveAccum += dt;
    if (this.autoSaveAccum >= 12) {
      this.autoSaveAccum = 0;
      this.saveRunProgress();
    }
  }

  private render() {
    const sugarBurst =
      this.sugarBurstTime >= 0 && this.sugarBurstTime < 2.8
        ? { x: this.world.sugarX, y: this.world.sugarY, progress: this.sugarBurstTime / 2.8 }
        : null;
    this.renderer.render(
      this.ctx,
      this.viewW,
      this.viewH,
      this.camera,
      this.world,
      this.ants.ants,
      this.particles,
      this.elapsed,
      this.aimPreview,
      sugarBurst,
      this.ants.scentTrail,
      this.beacon,
      this.skillTree.getRank('worker_evo') > 0
    );
  }

  private bindEvents() {
    window.addEventListener('resize', () => {
      this.resize();
    });
    const persistNow = () => {
      this.skillTree.flushPendingSave();
      if (!this.paused || this.hasActiveRun) {
        this.saveRunProgress();
      }
    };
    window.addEventListener('beforeunload', persistNow);
    window.addEventListener('pagehide', persistNow);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) persistNow();
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.canvas.addEventListener(
      'wheel',
      (e) => {
        if (this.paused) return;
        e.preventDefault();
        this.cameraEaseTarget = null;
        const factor = e.deltaY < 0 ? 1.14 : 0.88;
        const before = this.screenToWorld(e.clientX, e.clientY);
        this.camera.zoom = Math.max(1.0, Math.min(28, this.camera.zoom * factor));
        const after = this.screenToWorld(e.clientX, e.clientY);
        this.camera.x += before.x - after.x;
        this.camera.y += before.y - after.y;
        if (this.camera.zoom >= 16) {
          this.skillTree.unlockAchievement('zoom_macro');
        }
        this.callbacks.onZoomInteract();
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

      if (e.button === 1 || e.button === 2 || (this.touchPanMode && !this.beaconMode)) {
        this.isDraggingCam = true;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
        return;
      }

      // Pheromone Beacon placement mode (30s active duration -> 2 min cooldown!)
      if (this.beaconMode) {
        const wPos = this.screenToWorld(e.clientX, e.clientY);
        const cx = Math.max(8, Math.min(this.world.width - 8, wPos.x));
        const cy = Math.max(8, Math.min(this.world.height - 8, wPos.y));
        this.beacon = {
          x: cx,
          y: cy,
          timeLeft: BEACON_DURATION_SEC,
          maxDuration: BEACON_DURATION_SEC
        };
        this.beaconMode = false;
        this.canvas.style.cursor = 'crosshair';
        this.audio.ensureStarted();
        this.audio.playBeaconPlace();
        this.particles.spawn(cx, cy, 66, 245, 197, 16, 26, 0.95, 1.9);
        this.saveRunProgress();
        this.callbacks.onToast(t('toastBeaconSet'));
        this.callbacks.onHudSync();
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
        this.cameraEaseTarget = null;
        const pts = Array.from(this.activePointers.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const midX = (pts[0].x + pts[1].x) * 0.5;
        const midY = (pts[0].y + pts[1].y) * 0.5;

        if (this.pinchStartDist > 0) {
          const scale = dist / this.pinchStartDist;
          if (Math.abs(scale - 1) > 0.06) this.callbacks.onZoomInteract();
          const before = this.screenToWorld(midX, midY);
          this.camera.zoom = Math.max(1.0, Math.min(28, this.pinchStartZoom * scale));
          const after = this.screenToWorld(midX, midY);
          this.camera.x += before.x - after.x;
          this.camera.y += before.y - after.y;
          if (this.camera.zoom >= 16) {
            this.skillTree.unlockAchievement('zoom_macro');
          }
        }

        const dx = midX - this.lastDragX;
        const dy = midY - this.lastDragY;
        if (Math.hypot(dx, dy) > 4) this.callbacks.onPanInteract();
        this.camera.x -= dx / this.camera.zoom;
        this.camera.y -= dy / this.camera.zoom;
        this.lastDragX = midX;
        this.lastDragY = midY;
        return;
      }

      if (this.isDraggingCam) {
        this.cameraEaseTarget = null;
        const dx = e.clientX - this.lastDragX;
        const dy = e.clientY - this.lastDragY;
        if (Math.hypot(dx, dy) > 4) this.callbacks.onPanInteract();
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
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (
        e.code === 'KeyW' ||
        e.code === 'KeyA' ||
        e.code === 'KeyS' ||
        e.code === 'KeyD' ||
        e.code === 'ArrowUp' ||
        e.code === 'ArrowDown' ||
        e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight'
      ) {
        this.heldKeys.add(e.code);
      }
      if (e.key === '1') this.selectAnt('worker');
      if (e.key === '2') this.selectAnt('warrior');
      if (e.key === '3') this.selectAnt('scout');
      if (e.key === '4') this.selectAnt('queen');
      if (e.key === '5') this.selectAnt('compass');
      if (e.key === '+' || e.key === '=') this.zoomBy(1.18);
      if (e.key === '-' || e.key === '_') this.zoomBy(0.84);
      if (e.key === 'b' || e.key === 'B' || e.key === 'и' || e.key === 'И') {
        this.toggleBeaconMode();
      }
      if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') {
        this.resetCamera();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.heldKeys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.heldKeys.clear();
    });
  }
}
