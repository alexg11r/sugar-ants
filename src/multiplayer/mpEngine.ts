import { ANT_TYPES, QUEEN_AURA_RADIUS } from '../core/ants';
import { MeditativeAudio } from '../core/audio';
import { subscribeBackgroundTick } from '../core/bgTicker';
import { getOptimalDpr, isMobileDevice } from '../core/device';
import { LEVELS } from '../core/levels';
import { ParticleSystem } from '../core/particles';
import { computeReachableMask, computeReachableWithDist, isReachableTerrainSquare } from '../core/reachability';
import { AimPreview, Camera, drawDetailedAnt } from '../core/renderer';
import {
  Ant,
  AntTypeId,
  CellType,
  LevelDefinition,
  PLAYER_COLORS,
  PlayableAntId,
  ScentPoint,
  SkillNodeDef
} from '../core/types';
import { BLOCK_HP } from '../core/world';
import { ColonyStats, SKILL_NODES } from '../game/skillTree';
import {
  MpMapSizePreset,
  MpMessage,
  MpMode,
  MpPlayerInfo,
  MpTransport,
  SyncedVotePayload
} from './mpTransport';

interface MpAnt extends Ant {
  ownerId: string;
  syncX?: number;
  syncY?: number;
  syncAngle?: number;
}

const SYNC_ANT_TYPES: AntTypeId[] = ['worker', 'warrior', 'scout', 'queen', 'compass', 'brood'];

interface MapPing {
  x: number;
  y: number;
  nick: string;
  colorHex: string;
  life: number;
  maxLife: number;
}

interface CoopWorm {
  x: number;
  y: number;
  angle: number;
  age: number;
  maxAge: number;
  speed: number;
  segments: { x: number; y: number }[];
}

export interface MpVoteState {
  active: boolean;
  reason: string;
  /** Map IDs to vote for (plus 'stay' to remain on current map) */
  options: string[];
  votes: Record<string, string>; // playerId -> levelId | 'stay'
  myChoice: string | null;
  timeLeft: number; // 30-second auto-finish countdown!
}

export interface MpMatchState {
  mpMode: MpMode;
  vsBot: boolean;
  localPlayerId: string;
  level: LevelDefinition;
  players: MpPlayerInfo[];
  localSp: number;
  nodeRanks: Record<string, number>;
  selectedAnt: PlayableAntId;
  compassCd: number;
  sugarFound: boolean;
  winnerId: string | null;
  totalBreakable: number;
  dugBreakable: number;
  allCleared: boolean;
  vote: MpVoteState;
  pingMode: boolean;
  nextSpDropSec: number;
}

export interface MpCallbacks {
  onHudSync: () => void;
  onToast: (msg: string) => void;
  onSystemChat: (text: string) => void;
  onVersusEnd: (winnerNick: string, iWon: boolean) => void;
  onVoteUpdate: () => void;
  onAllBlocksCleared: () => void;
}

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

export function computeCoopMapSize(
  playerCount: number,
  mpMode: MpMode,
  preset: MpMapSizePreset = 'auto'
): { width: number; height: number } {
  if (mpMode === 'versus') return { width: 400, height: 250 };
  if (preset === 'compact') return { width: 400, height: 250 };
  if (preset === 'large') return { width: 520, height: 330 };
  if (preset === 'huge') return { width: 640, height: 400 };
  // Default 'auto': minimum size for 5 players (490x310), scaling up to 10 players (640x400)
  const effective = Math.max(5, Math.min(10, playerCount));
  return {
    width: Math.min(640, 340 + effective * 30),
    height: Math.min(400, 220 + effective * 18)
  };
}

export class MultiplayerEngine {
  width = 400;
  height = 250;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly audio: MeditativeAudio;
  readonly callbacks: MpCallbacks;

  transport: MpTransport | null = null;
  cells: Uint8Array = new Uint8Array(1);
  hp: Uint8Array = new Uint8Array(1);
  maxHp: Uint8Array = new Uint8Array(1);
  isEdge: Uint8Array = new Uint8Array(1);
  revealedMask: Uint8Array = new Uint8Array(1);
  artExposed: Uint8Array = new Uint8Array(1);
  reachableMask: Uint8Array = new Uint8Array(1);
  noise: Uint8Array = new Uint8Array(1);

  sugarX = 200;
  sugarY = 125;
  sugarExposed = false;

  ants: MpAnt[] = [];
  scentTrail: ScentPoint[] = [];
  pings: MapPing[] = [];
  worms: CoopWorm[] = [];
  particles = new ParticleSystem();
  camera: Camera = { x: 200, y: 125, zoom: 3.2 };
  state: MpMatchState;
  active = false;
  seed = 1337;
  private voteTickAccum = 0;
  private achievementSpeedMult = 1;

  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private imgData: ImageData;
  private imgData32: Uint32Array;
  private glowCanvas: HTMLCanvasElement;
  private glowCtx: CanvasRenderingContext2D;
  private glowImgData: ImageData;
  private glowData32: Uint32Array;
  private bloomCanvas: HTMLCanvasElement;
  private bloomCtx: CanvasRenderingContext2D;
  private bloomW = 1;
  private bloomH = 1;
  private lastRebuildMs = 0;
  touchPanMode = false;

  private viewW = 1;
  private viewH = 1;
  private rafId = 0;
  private unsubBgTick: (() => void) | null = null;
  private lastWallMs = 0;
  private elapsed = 0;
  private nextAntId = 1;
  private hudAccum = 0;
  private botTimer = 0;
  private spDropAccum = 0;
  private revoteTimer = 0;
  private coopEventTimer = 75;
  private sugarRushTimer = 0;
  private antsSyncAccum = 0;
  private hadMyAntsLastSync = false;
  private cellsFlushAccum = 0;
  private pendingClearedCells = new Set<number>();

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

    this.offscreen = document.createElement('canvas');
    this.offCtx = this.offscreen.getContext('2d')!;
    this.imgData = this.offCtx.createImageData(1, 1);
    this.imgData32 = new Uint32Array(this.imgData.data.buffer);

    this.glowCanvas = document.createElement('canvas');
    this.glowCtx = this.glowCanvas.getContext('2d')!;
    this.glowImgData = this.glowCtx.createImageData(1, 1);
    this.glowData32 = new Uint32Array(this.glowImgData.data.buffer);

    this.bloomCanvas = document.createElement('canvas');
    this.bloomCtx = this.bloomCanvas.getContext('2d')!;

    this.state = this.createEmptyState('coop', false, 'local', LEVELS[0], []);
    this.resize();
    this.bindEvents();
  }

  private createEmptyState(
    mpMode: MpMode,
    vsBot: boolean,
    localPlayerId: string,
    level: LevelDefinition,
    players: MpPlayerInfo[]
  ): MpMatchState {
    return {
      mpMode,
      vsBot,
      localPlayerId,
      level,
      players,
      localSp: 3, // Generous start so every player can immediately explore skills!
      nodeRanks: { worker_root: 1 },
      selectedAnt: 'worker',
      compassCd: 0,
      sugarFound: false,
      winnerId: null,
      totalBreakable: 1,
      dugBreakable: 0,
      allCleared: false,
      vote: { active: false, reason: '', options: [], votes: {}, myChoice: null, timeLeft: 0 },
      pingMode: false,
      nextSpDropSec: 300
    };
  }

  startMatch(opts: {
    seed: number;
    levelId: string;
    mpMode: MpMode;
    vsBot: boolean;
    localPlayerId: string;
    players: MpPlayerInfo[];
    width?: number;
    height?: number;
    transport: MpTransport | null;
    emptyRle?: string;
    sugarFound?: boolean;
    activeVote?: SyncedVotePayload | null;
    startingSp?: number;
    achievementSpeedMult?: number;
    preserveExistingBases?: boolean;
  }) {
    this.seed = opts.seed;
    this.transport = opts.transport;
    this.achievementSpeedMult = opts.achievementSpeedMult ?? this.achievementSpeedMult ?? 1;
    const level = LEVELS.find((l) => l.id === opts.levelId) || LEVELS[0];
    const dims =
      opts.width && opts.height
        ? { width: opts.width, height: opts.height }
        : computeCoopMapSize(opts.players.length, opts.mpMode);

    this.width = dims.width;
    this.height = dims.height;

    const size = this.width * this.height;
    this.cells = new Uint8Array(size);
    this.hp = new Uint8Array(size);
    this.maxHp = new Uint8Array(size);
    this.isEdge = new Uint8Array(size);
    this.revealedMask = new Uint8Array(size);
    this.artExposed = new Uint8Array(size);
    this.reachableMask = new Uint8Array(size);
    this.noise = new Uint8Array(size);

    this.offscreen.width = this.width;
    this.offscreen.height = this.height;
    this.imgData = this.offCtx.createImageData(this.width, this.height);
    this.imgData32 = new Uint32Array(this.imgData.data.buffer);
    this.glowCanvas.width = this.width;
    this.glowCanvas.height = this.height;
    this.glowImgData = this.glowCtx.createImageData(this.width, this.height);
    this.glowData32 = new Uint32Array(this.glowImgData.data.buffer);
    this.bloomW = Math.max(1, Math.ceil(this.width * 0.35));
    this.bloomH = Math.max(1, Math.ceil(this.height * 0.35));
    this.bloomCanvas.width = this.bloomW;
    this.bloomCanvas.height = this.bloomH;
    this.lastRebuildMs = 0;

    // Keep exact synced base coords when joining mid-game, or assign fresh ring bases on match start
    const playersWithBases =
      opts.preserveExistingBases && opts.players.every((p) => p.baseX > 0 && p.baseY > 0)
        ? opts.players.map((p) => ({ ...p }))
        : this.assignPlayerBases(opts.players, opts.mpMode);

    this.state = this.createEmptyState(
      opts.mpMode,
      opts.vsBot,
      opts.localPlayerId,
      level,
      playersWithBases
    );
    if (typeof opts.startingSp === 'number') {
      this.state.localSp = opts.startingSp;
    }

    this.ants = [];
    this.scentTrail = [];
    this.pings = [];
    this.worms = [];
    this.particles.particles = [];
    this.botTimer = 1.4;
    this.spDropAccum = 0;
    this.revoteTimer = 0;
    this.voteTickAccum = 0;
    this.coopEventTimer = 75 + Math.random() * 40;
    this.sugarRushTimer = 0;
    this.antsSyncAccum = 0;
    this.cellsFlushAccum = 0;
    this.pendingClearedCells.clear();
    this.sugarExposed = Boolean(opts.sugarFound);
    this.state.sugarFound = Boolean(opts.sugarFound);

    this.generateSeededWorld(level, opts.seed, playersWithBases);

    // Apply pixel-exact RLE empty-cell snapshot when late-joining!
    if (opts.emptyRle) {
      this.applyEmptyRle(opts.emptyRle);
    }

    // Restore any active vote so late joiners immediately see & participate in voting!
    if (opts.activeVote && opts.activeVote.timeLeft > 1) {
      this.state.vote = {
        active: true,
        reason: opts.activeVote.reason,
        options: opts.activeVote.options,
        votes: { ...opts.activeVote.votes },
        myChoice: opts.activeVote.votes[this.state.localPlayerId] || null,
        timeLeft: opts.activeVote.timeLeft
      };
      this.callbacks.onVoteUpdate();
    } else {
      this.callbacks.onVoteUpdate();
    }

    this.resetCamera();
    this.active = true;
    this.lastWallMs = Date.now();
    this.callbacks.onHudSync();

    const modeLabel =
      opts.mpMode === 'coop'
        ? `🤝 Кооператив (${playersWithBases.length} игр., ${this.width}×${this.height})`
        : opts.vsBot
          ? '⚔ Гонка против ИИ-колонии'
          : '⚔ Онлайн 1 на 1';
    this.callbacks.onToast(`${modeLabel} • ${level.name}`);

    const stepWallClock = () => {
      const now = Date.now();
      const rawDt = Math.max(0, (now - this.lastWallMs) / 1000);
      this.lastWallMs = now;
      if (!this.active || rawDt <= 0) return;

      // Simulate active physics up to 60s smoothly in 50ms steps
      let rem = Math.min(rawDt, 60);
      while (rem > 0) {
        const step = Math.min(0.05, rem);
        this.update(step);
        rem -= step;
      }

      // If device slept >60s, fast-forward remaining wall-clock cooldowns & timers!
      if (rawDt > 60) {
        const extra = rawDt - 60;
        if (this.state.compassCd > 0) this.state.compassCd = Math.max(0, this.state.compassCd - extra);
        if (this.sugarRushTimer > 0) this.sugarRushTimer = Math.max(0, this.sugarRushTimer - extra);
        if (this.revoteTimer > 0) this.revoteTimer = Math.max(0.1, this.revoteTimer - extra);
        this.spDropAccum += extra;
        while (this.spDropAccum >= 300) {
          this.spDropAccum -= 300;
          this.state.localSp += Math.random() < 0.5 ? 1 : 2;
        }
        this.state.nextSpDropSec = Math.max(0, Math.ceil(300 - this.spDropAccum));
        if (this.state.vote.active) {
          this.state.vote.timeLeft = Math.max(0, this.state.vote.timeLeft - extra);
          if (this.state.vote.timeLeft <= 0) this.evaluateVotes(true);
          this.callbacks.onVoteUpdate();
        }
        this.callbacks.onHudSync();
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

  private assignPlayerBases(players: MpPlayerInfo[], mpMode: MpMode): MpPlayerInfo[] {
    const w = this.width;
    const h = this.height;
    return players.map((p, idx) => {
      if (mpMode === 'versus' && players.length === 2) {
        return {
          ...p,
          baseX: idx === 0 ? Math.floor(w * 0.19) : Math.floor(w * 0.81),
          baseY: Math.floor(h * 0.5)
        };
      }
      // Distribute up to 10 bases evenly in a welcoming ring inside the sanctuary!
      const angle = (idx / Math.max(1, players.length)) * Math.PI * 2 + Math.PI * 0.5;
      const rx = w * 0.31;
      const ry = h * 0.31;
      return {
        ...p,
        baseX: Math.round(w * 0.5 + Math.cos(angle) * rx),
        baseY: Math.round(h * 0.5 + Math.sin(angle) * ry)
      };
    });
  }

  /** Encodes ALL Empty cells into an ultra-compact Base36 RLE string (~2-5 KB for 100% pixel-exact map sync!) */
  encodeEmptyRle(): string {
    const cells = this.cells;
    const len = cells.length;
    if (len === 0) return '';
    const runs: string[] = [];
    let expectingEmpty = false; // First run is always Solid count (0 if cell 0 is Empty)
    let count = 0;

    for (let i = 0; i < len; i++) {
      const isEmpty = cells[i] === CellType.Empty;
      if (isEmpty === expectingEmpty) {
        count++;
      } else {
        runs.push(count.toString(36));
        expectingEmpty = isEmpty;
        count = 1;
      }
    }
    runs.push(count.toString(36));
    return runs.join(',');
  }

  /** Restores 100% pixel-exact dug tunnels, exposed HiddenArt, Sugar, edges & fog from Base36 RLE! */
  applyEmptyRle(rle: string) {
    if (!rle) return;
    const parts = rle.split(',');
    const w = this.width;
    const h = this.height;
    let idx = 0;
    let isEmpty = false;
    let dug = 0;

    for (let p = 0; p < parts.length; p++) {
      const runLen = parseInt(parts[p], 36);
      if (!Number.isFinite(runLen) || runLen < 0) continue;
      if (isEmpty) {
        for (let k = 0; k < runLen && idx < this.cells.length; k++, idx++) {
          const prev = this.cells[idx] as CellType;
          if (prev !== CellType.Empty) {
            if (prev === CellType.SoftSoil || prev === CellType.Clay || prev === CellType.Stone || prev === CellType.Obsidian) {
              dug++;
            }
            this.cells[idx] = CellType.Empty;
            this.hp[idx] = 0;
            this.maxHp[idx] = 0;
            this.isEdge[idx] = 0;
          }
        }
      } else {
        idx += runLen;
      }
      isEmpty = !isEmpty;
    }

    this.state.dugBreakable = Math.min(this.state.totalBreakable, this.state.dugBreakable + dug);

    // Rebuild edges, exposed art, sugar exposure & vision fog around all Empty cells (sampled every 4px for speed!)
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const i = row + x;
        const c = this.cells[i] as CellType;
        if (c === CellType.Empty) {
          if ((x & 3) === 0 && (y & 3) === 0) {
            this.revealCircle(x, y, 22);
          }
          continue;
        }
        if (
          this.cells[i - 1] === CellType.Empty ||
          this.cells[i + 1] === CellType.Empty ||
          this.cells[i - w] === CellType.Empty ||
          this.cells[i + w] === CellType.Empty
        ) {
          this.isEdge[i] = 1;
          if (c === CellType.HiddenArt) this.artExposed[i] = 1;
          if (c === CellType.Sugar) this.sugarExposed = true;
        }
      }
    }
  }

  getActiveVotePayload(): SyncedVotePayload | null {
    const v = this.state.vote;
    if (!v.active || v.timeLeft <= 0) return null;
    return {
      reason: v.reason,
      options: [...v.options],
      votes: { ...v.votes },
      timeLeft: Math.ceil(v.timeLeft)
    };
  }

  /** Seamless mid-match resync on the exact same map (e.g. after returning from minimized window!) */
  applyResyncSnapshot(opts: {
    players: MpPlayerInfo[];
    emptyRle?: string;
    sugarFound: boolean;
    activeVote: SyncedVotePayload | null;
  }) {
    this.syncPlayersList(opts.players);
    if (opts.emptyRle) {
      this.applyEmptyRle(opts.emptyRle);
    }
    if (opts.sugarFound) {
      this.sugarExposed = true;
      this.state.sugarFound = true;
    }
    if (opts.activeVote && opts.activeVote.timeLeft > 0) {
      this.state.vote = {
        active: true,
        reason: opts.activeVote.reason,
        options: opts.activeVote.options,
        votes: { ...opts.activeVote.votes },
        myChoice: opts.activeVote.votes[this.state.localPlayerId] || this.state.vote.myChoice || null,
        timeLeft: opts.activeVote.timeLeft
      };
    } else if (!opts.activeVote && this.state.vote.active) {
      this.state.vote.active = false;
      this.state.vote.timeLeft = 0;
    }
    this.callbacks.onVoteUpdate();
    this.callbacks.onHudSync();
  }

  /** Syncs updated players list (carving bases for newly joined players!) */
  syncPlayersList(players: MpPlayerInfo[]) {
    const existingIds = new Set(this.state.players.map((p) => p.id));
    for (const pl of players) {
      if (!existingIds.has(pl.id) && pl.baseX > 0 && pl.baseY > 0) {
        this.carveBaseChamber(pl.baseX, pl.baseY);
      }
    }
    this.state.players = players.map((p) => ({ ...p }));
    this.callbacks.onHudSync();
  }

  /** Mid-game late join: carve a fresh base for the newly arrived player! */
  addLateJoinPlayer(player: MpPlayerInfo): MpPlayerInfo {
    const existing = this.state.players.find((p) => p.id === player.id);
    if (existing) return existing;
    const idx = this.state.players.length;
    let bx = Math.round(this.width * 0.5);
    let by = Math.round(this.height * 0.5);
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = ((idx + attempt) * 2.39996) % (Math.PI * 2);
      const rx = attempt < 12 ? this.width * 0.31 : this.width * 0.22;
      const ry = attempt < 12 ? this.height * 0.31 : this.height * 0.22;
      const cx = Math.round(this.width * 0.5 + Math.cos(angle) * rx);
      const cy = Math.round(this.height * 0.5 + Math.sin(angle) * ry);
      if (this.reachableMask.length === this.cells.length && this.reachableMask[cy * this.width + cx] === 1) {
        bx = cx;
        by = cy;
        break;
      }
      if (attempt === 0) {
        bx = cx;
        by = cy;
      }
    }
    const withBase: MpPlayerInfo = { ...player, baseX: bx, baseY: by, dug: 0 };
    this.state.players.push(withBase);
    this.carveBaseChamber(bx, by);
    this.callbacks.onHudSync();
    return withBase;
  }

  resetCamera() {
    const me = this.getLocalPlayer();
    const fitZoom = Math.min((this.viewW * 0.92) / this.width, (this.viewH * 0.84) / this.height);
    this.camera.zoom = Math.max(1.8, Math.min(4.8, fitZoom * 1.35));
    this.camera.x = me ? me.baseX : this.width * 0.5;
    this.camera.y = me ? me.baseY : this.height * 0.5;
  }

  getLocalPlayer(): MpPlayerInfo | undefined {
    return this.state.players.find((p) => p.id === this.state.localPlayerId);
  }

  getPlayer(id: string): MpPlayerInfo | undefined {
    return this.state.players.find((p) => p.id === id);
  }

  /* =========================================================
     IN-MATCH CO-OP SKILL TREE LOGIC
     ========================================================= */
  getSkillRank(nodeId: string): number {
    return this.state.nodeRanks[nodeId] || 0;
  }

  isSkillVisible(node: SkillNodeDef): boolean {
    if (node.requires.length === 0) return true;
    if (this.getSkillRank(node.id) > 0) return true;
    return node.requires.some((req) => this.getSkillRank(req) > 0);
  }

  getSkillCost(node: SkillNodeDef): number {
    const rank = this.getSkillRank(node.id);
    if (node.maxRank <= 1) return node.cost;
    return Math.round(node.cost * Math.pow(1.55, rank));
  }

  canBuySkill(node: SkillNodeDef): boolean {
    const rank = this.getSkillRank(node.id);
    if (rank >= node.maxRank) return false;
    if (node.requires.length > 0 && !node.requires.some((req) => this.getSkillRank(req) > 0)) return false;
    return this.state.localSp >= this.getSkillCost(node);
  }

  buySkill(nodeId: string): boolean {
    const node = SKILL_NODES.find((n) => n.id === nodeId);
    if (!node || !this.canBuySkill(node)) return false;
    this.state.localSp -= this.getSkillCost(node);
    this.state.nodeRanks[nodeId] = this.getSkillRank(nodeId) + 1;
    this.audio.playUpgrade();
    if (nodeId === 'warrior_unlock') this.state.selectedAnt = 'warrior';
    if (nodeId === 'scout_unlock') this.state.selectedAnt = 'scout';
    if (nodeId === 'queen_unlock') this.state.selectedAnt = 'queen';
    this.callbacks.onHudSync();
    return true;
  }

  isAntUnlocked(id: PlayableAntId): boolean {
    if (id === 'worker' || id === 'compass') return true;
    if (id === 'warrior') return this.getSkillRank('warrior_unlock') > 0;
    if (id === 'scout') return this.getSkillRank('scout_unlock') > 0;
    if (id === 'queen') return this.getSkillRank('queen_unlock') > 0;
    return false;
  }

  hasAffordableSkill(): boolean {
    return SKILL_NODES.some((n) => this.canBuySkill(n));
  }

  getLocalColonyStats(): ColonyStats {
    const r = (id: string) => this.getSkillRank(id);
    const achSpd = this.achievementSpeedMult * (1 + r('all_speed') * 0.1);
    const workerEvo = r('worker_evo') > 0;
    return {
      globalLifeMult: (1 + r('colony_life') * 0.25) * (1 + r('all_life') * 0.15),
      globalSpeedMult: achSpd,
      globalDmgBonus: r('all_dmg'),
      visionBonusPx: r('all_vision') * 5,
      beaconDurationSec: 30 + r('all_beacon') * 10,
      beaconCooldownSec: Math.max(45, 120 - r('all_beacon') * 20),
      crystalBonus: r('colony_crystal'),
      crystalLuckChance: 0,
      hardBlockBonusDmg: r('colony_armor'),
      queenAnomaly: false,
      farSense: false,
      compassCooldownSec: 120,
      compassDuration: 6.5,
      worker: {
        speedMult: (1 + r('worker_spd') * 0.22) * (workerEvo ? 1.25 : 1) * achSpd,
        dmgBonus: r('worker_dmg') + (workerEvo ? 2 : 0),
        lifeMult: 1 + r('worker_life') * 0.35,
        maxActive: 6 + r('worker_cap') * 3 + (workerEvo ? 2 : 0),
        evolved: workerEvo
      },
      warrior: {
        speedMult: (1 + r('warrior_spd') * 0.2) * achSpd,
        dmgBonus: r('warrior_dmg'),
        radiusBonus: r('warrior_cleave') * 0.45,
        maxActive: 2 + r('warrior_cap')
      },
      scout: {
        speedMult: (1 + r('scout_spd') * 0.25) * achSpd,
        dmgBonus: r('scout_dmg'),
        lifeMult: 1 + r('scout_life') * 0.4,
        maxActive: 4 + r('scout_cap') * 3,
        poisonRank: r('scout_poison')
      },
      queen: {
        spawnRateMult: (1 + r('queen_rate') * 0.25) * achSpd,
        broodDmgBonus: r('queen_brood_dmg'),
        broodLifeMult: 1 + r('queen_brood_life') * 0.35,
        maxActive: 1 + r('queen_brood_life')
      }
    };
  }

  selectAnt(type: PlayableAntId) {
    if (!this.isAntUnlocked(type)) return;
    this.state.selectedAnt = type;
    this.callbacks.onHudSync();
  }

  togglePingMode() {
    this.state.pingMode = !this.state.pingMode;
    this.callbacks.onHudSync();
    if (this.state.pingMode) {
      this.callbacks.onToast('📍 Нажмите на карту, чтобы поставить маяк для команды!');
    }
  }

  /* =========================================================
     CO-OP 30-SEC MAP VOTING AFTER VICTORY (RE-VOTES EVERY 2 MIN IF STAY!)
     ========================================================= */
  startNextLevelVote(reason: string, broadcast = true, customOptions?: string[], durationSec = 30) {
    const others = LEVELS.filter((l) => l.id !== this.state.level.id).map((l) => l.id);
    const options = customOptions && customOptions.length > 0 ? customOptions : others.slice(0, 3);

    this.state.vote = {
      active: true,
      reason,
      options,
      votes: {},
      myChoice: null,
      timeLeft: durationSec
    };
    this.revoteTimer = 0;
    this.voteTickAccum = 0;
    if (broadcast) {
      this.transport?.send({ type: 'vote_start', reason, options, durationSec });
    }
    this.callbacks.onSystemChat(`🗳 Голосование (30 сек): ${reason}`);
    this.callbacks.onVoteUpdate();
  }

  castVote(choice: string) {
    if (!this.state.vote.active) return;
    this.state.vote.myChoice = choice;
    this.state.vote.votes[this.state.localPlayerId] = choice;
    this.transport?.send({ type: 'vote_cast', playerId: this.state.localPlayerId, choice });
    this.evaluateVotes(false);
    this.callbacks.onVoteUpdate();
  }

  private evaluateVotes(timedOut: boolean) {
    const v = this.state.vote;
    if (!v.active) return;
    const totalPlayers = Math.max(1, this.state.players.filter((p) => !p.id.startsWith('bot_')).length);
    const entries = Object.values(v.votes);
    if (!timedOut && entries.length < totalPlayers) return;

    const counts = new Map<string, number>();
    for (const ch of entries) {
      counts.set(ch, (counts.get(ch) || 0) + 1);
    }

    const stayVotes = counts.get('stay') || 0;
    let bestMapId = v.options[0] || LEVELS[0].id;
    let bestMapVotes = 0;
    for (const opt of v.options) {
      const c = counts.get(opt) || 0;
      if (c > bestMapVotes) {
        bestMapVotes = c;
        bestMapId = opt;
      }
    }

    // If 'stay' strictly beat the top map -> stay & re-vote in 2 min!
    // Otherwise (including when 30s timer expires with incomplete/zero votes!) -> advance to next map!
    if (stayVotes > bestMapVotes) {
      v.active = false;
      v.timeLeft = 0;
      this.revoteTimer = 120;
      this.callbacks.onSystemChat('Игроки решили остаться! Повторное голосование через 2 минуты.');
      this.callbacks.onToast('Продолжаем открывать карту! Повтор голосования через 2 мин.');
      this.callbacks.onVoteUpdate();
    } else {
      v.active = false;
      v.timeLeft = 0;
      this.callbacks.onVoteUpdate();
      if (!this.transport || this.transport.isHost) {
        this.advanceToNextCoopLevel(bestMapId);
      }
    }
  }

  advanceToNextCoopLevel(targetLevelId?: string) {
    const curIdx = LEVELS.findIndex((l) => l.id === this.state.level.id);
    const nextLvl =
      (targetLevelId && LEVELS.find((l) => l.id === targetLevelId)) ||
      LEVELS[(curIdx + 1) % LEVELS.length];
    const nextSeed = Math.floor(Math.random() * 1_000_000);
    const resetPlayers = this.state.players.map((p) => ({ ...p, dug: 0 }));

    this.transport?.send({
      type: 'next_level',
      seed: nextSeed,
      levelId: nextLvl.id,
      players: resetPlayers,
      width: this.width,
      height: this.height
    });

    this.startMatch({
      seed: nextSeed,
      levelId: nextLvl.id,
      mpMode: this.state.mpMode,
      vsBot: this.state.vsBot,
      localPlayerId: this.state.localPlayerId,
      players: resetPlayers,
      width: this.width,
      height: this.height,
      transport: this.transport
    });
  }

  handleRemoteMessage(msg: MpMessage) {
    if (!this.active) return;
    if (msg.type === 'spawn') {
      this.spawnAntInternal(msg.playerId, msg.antType, msg.x, msg.y, msg.angle, msg.antId);
    } else if (msg.type === 'dig') {
      this.digInternal(msg.x, msg.y, msg.radius, msg.damage, msg.playerId, false);
    } else if (msg.type === 'cells_clear') {
      this.applyRemoteCellsClear(msg.indices, msg.ownerId);
    } else if (msg.type === 'ants_sync') {
      if (msg.ownerId !== this.state.localPlayerId) {
        this.applyRemoteAntsSync(msg.ownerId, msg.ants);
      }
    } else if (msg.type === 'ping') {
      this.pings.push({
        x: msg.x,
        y: msg.y,
        nick: msg.nick,
        colorHex: msg.colorHex,
        life: 6.0,
        maxLife: 6.0
      });
      this.audio.playCompassLaunch();
    } else if (msg.type === 'sugar_win') {
      const wasFound = this.state.sugarFound;
      this.sugarExposed = true;
      this.state.sugarFound = true;
      if (this.state.mpMode === 'versus' && !this.state.winnerId) {
        this.state.winnerId = msg.winnerId;
        this.audio.playSugarFound();
        this.callbacks.onVersusEnd(msg.winnerNick, msg.winnerId === this.state.localPlayerId);
      } else if (this.state.mpMode === 'coop' && !wasFound) {
        this.audio.playSugarFound();
        this.callbacks.onSystemChat(`🧊 ${msg.winnerNick} нашёл сахар!`);
        if ((!this.transport || this.transport.isHost) && !this.state.vote.active) {
          this.startNextLevelVote('Сахар найден! Перейти к новой локации?', true);
        }
      }
    } else if (msg.type === 'players_update') {
      this.syncPlayersList(msg.players);
    } else if (msg.type === 'vote_start') {
      this.startNextLevelVote(msg.reason, false, msg.options, msg.durationSec || 30);
    } else if (msg.type === 'vote_cast') {
      this.state.vote.votes[msg.playerId] = msg.choice;
      this.evaluateVotes(false);
      this.callbacks.onVoteUpdate();
    } else if (msg.type === 'coop_event') {
      this.applyCoopEvent(msg.eventId, msg.seed);
    } else if (msg.type === 'next_level') {
      this.startMatch({
        seed: msg.seed,
        levelId: msg.levelId,
        mpMode: this.state.mpMode,
        vsBot: false,
        localPlayerId: this.state.localPlayerId,
        players: msg.players,
        width: msg.width,
        height: msg.height,
        transport: this.transport
      });
    }
  }

  /* =========================================================
     SEEDED WORLD GENERATION (NO UNREACHABLE POCKETS!)
     ========================================================= */
  private setBlock(idx: number, type: CellType) {
    this.cells[idx] = type;
    const baseHp = BLOCK_HP[type] ?? 1;
    this.hp[idx] = baseHp;
    this.maxHp[idx] = baseHp;
  }

  private carveBaseChamber(cx: number, cy: number) {
    const w = this.width;
    const h = this.height;
    const r = 12;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 4 || nx >= w - 4 || ny < 4 || ny >= h - 4) continue;
        const dist = Math.hypot(dx, dy);
        if (dist + (this.noise[ny * w + nx] / 255) * 2.5 < r) {
          this.setBlock(ny * w + nx, CellType.Empty);
        }
      }
    }
    this.revealCircle(cx, cy, 34);
  }

  private generateSeededWorld(level: LevelDefinition, seed: number, players: MpPlayerInfo[]) {
    const rng = mulberry32(seed);
    const { width: w, height: h } = this;

    this.cells.fill(0);
    this.hp.fill(0);
    this.maxHp.fill(0);
    this.isEdge.fill(0);
    this.revealedMask.fill(0);
    this.artExposed.fill(0);

    // 1. Seeded mineral layers
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const hash = ((x * 374761393 + y * 668265263 + seed) ^ (x * y * 1274126177)) >>> 0;
        this.noise[idx] = hash & 255;

        const n1 =
          Math.sin(x * 0.045 + Math.cos(y * 0.04) * 2.0) +
          Math.cos(y * 0.05 - Math.sin(x * 0.036) * 2.0);
        const hardness = n1 * 0.72;

        if (hardness > 1.35) this.setBlock(idx, CellType.Obsidian);
        else if (hardness > 0.85) this.setBlock(idx, CellType.Stone);
        else if (hardness > 0.25) this.setBlock(idx, CellType.Clay);
        else this.setBlock(idx, CellType.SoftSoil);
      }
    }

    // 2. Beautiful scaled Hidden Art
    const artMask = level.generateArt(w, h);
    for (let i = 0; i < w * h; i++) {
      if (artMask[i] === 1) this.setBlock(i, CellType.HiddenArt);
    }

    // 3. GUARANTEE ZERO UNREACHABLE POCKETS:
    // Open clean 6px passageways along cardinal & diagonal corridors inside the interior
    // (leaving the outer sanctuary frame intact!)
    const cx = Math.floor(w * 0.5);
    const cy = Math.floor(h * 0.5);
    const innerRx = w * 0.4;
    const innerRy = h * 0.4;
    for (let ray = 0; ray < 8; ray++) {
      const a = (ray / 8) * Math.PI * 2;
      for (let t = 0.06; t <= 0.92; t += 0.01) {
        const px = Math.round(cx + Math.cos(a) * innerRx * t);
        const py = Math.round(cy + Math.sin(a) * innerRy * t);
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = px + dx;
            const ny = py + dy;
            if (nx > 10 && nx < w - 10 && ny > 10 && ny < h - 10) {
              const idx = ny * w + nx;
              if (this.cells[idx] === CellType.HiddenArt) {
                this.setBlock(idx, CellType.SoftSoil);
              }
            }
          }
        }
      }
    }

    // 4. Carve all player bases
    for (const p of players) {
      this.carveBaseChamber(p.baseX, p.baseY);
    }

    // 4b. Compute BFS flood-fill reachability from player bases!
    // If any player base is isolated from player 0 by an art line, open a narrow soil passage toward center.
    const primarySeed = players.length > 0 ? [{ x: players[0].baseX, y: players[0].baseY }] : [{ x: cx, y: cy }];
    this.reachableMask = computeReachableMask(this.cells, w, h, primarySeed);
    let carvedConnector = false;
    for (let i = 1; i < players.length; i++) {
      const p = players[i];
      if (this.reachableMask[p.baseY * w + p.baseX] !== 1) {
        const steps = Math.max(1, Math.ceil(Math.hypot(cx - p.baseX, cy - p.baseY)));
        for (let s = 0; s <= steps; s++) {
          const px = Math.round(p.baseX + ((cx - p.baseX) * s) / steps);
          const py = Math.round(p.baseY + ((cy - p.baseY) * s) / steps);
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = px + dx;
              const ny = py + dy;
              if (nx > 6 && nx < w - 6 && ny > 6 && ny < h - 6) {
                const idx = ny * w + nx;
                if (this.cells[idx] === CellType.HiddenArt) {
                  this.setBlock(idx, CellType.SoftSoil);
                  carvedConnector = true;
                }
              }
            }
          }
          if (this.reachableMask[py * w + px] === 1) break;
        }
      }
    }
    if (carvedConnector) {
      this.reachableMask = computeReachableMask(this.cells, w, h, primarySeed);
    }

    // 5. Place Sugar Cube strictly in the FARTHEST 22% BFS path distance from ALL player bases
    // so Co-op / Versus maps are genuinely deep, fair, and never over in 5 minutes!
    const allBaseSeeds = players.length > 0 ? players.map((p) => ({ x: p.baseX, y: p.baseY })) : [{ x: cx, y: cy }];
    const distFromAll = computeReachableWithDist(this.cells, w, h, allBaseSeeds);
    const sugarCandidates: { x: number; y: number; bfsDist: number }[] = [];
    let maxSugarBfs = 0;
    for (let y = 8; y < h - 8; y += 3) {
      for (let x = 8; x < w - 8; x += 3) {
        if (!isReachableTerrainSquare(this.cells, this.reachableMask, w, h, x, y, 4)) continue;
        const d = distFromAll.dist[y * w + x];
        if (d <= 0) continue;
        if (d > maxSugarBfs) maxSugarBfs = d;
        sugarCandidates.push({ x, y, bfsDist: d });
      }
    }

    const farPool = sugarCandidates.filter((c) => c.bfsDist >= maxSugarBfs * 0.78);
    if (farPool.length > 0) {
      const pick = farPool[Math.floor(rng() * farPool.length)];
      this.sugarX = pick.x;
      this.sugarY = pick.y;
    } else if (sugarCandidates.length > 0) {
      sugarCandidates.sort((a, b) => b.bfsDist - a.bfsDist);
      this.sugarX = sugarCandidates[0].x;
      this.sugarY = sugarCandidates[0].y;
    } else {
      this.sugarX = cx;
      this.sugarY = cy;
    }

    // Encase Sugar inside a protective Stone/Obsidian geode shell so Co-op matches have real depth & pacing
    for (let dy = -13; dy <= 13; dy++) {
      for (let dx = -13; dx <= 13; dx++) {
        const sx = this.sugarX + dx;
        const sy = this.sugarY + dy;
        if (sx < 1 || sx >= w - 1 || sy < 1 || sy >= h - 1) continue;
        const idx = sy * w + sx;
        const cur = this.cells[idx] as CellType;
        if (cur === CellType.HiddenArt || cur === CellType.Empty) continue;
        const d = Math.hypot(dx, dy) + (this.noise[idx] / 255) * 2.2;
        if (d < 8.5) {
          this.setBlock(idx, CellType.Obsidian);
        } else if (d < 13.5 && (cur === CellType.SoftSoil || cur === CellType.Clay)) {
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

    // 6. Abundant Skill Crystals strictly inside BFS-reachable territory!
    const crystalGoal = 36 + players.length * 14;
    let placed = 0;
    for (let attempt = 0; attempt < crystalGoal * 35 && placed < crystalGoal; attempt++) {
      const lx = Math.floor(w * 0.08 + rng() * (w * 0.84));
      const ly = Math.floor(h * 0.08 + rng() * (h * 0.84));
      if (this.reachableMask[ly * w + lx] !== 1) continue;
      if (this.tryPlaceCrystal(lx, ly)) placed++;
    }

    // 7. Count reachable breakable blocks & mark initial edges
    let breakable = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const c = this.cells[idx] as CellType;
        if (
          (c === CellType.SoftSoil || c === CellType.Clay || c === CellType.Stone || c === CellType.Obsidian) &&
          this.reachableMask[idx] === 1
        ) {
          breakable++;
        }
        if (c !== CellType.Empty) {
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
    this.state.totalBreakable = Math.max(1, breakable);
    this.state.dugBreakable = 0;
  }

  private tryPlaceCrystal(cx: number, cy: number): boolean {
    const w = this.width;
    const h = this.height;
    if (cx < 8 || cx > w - 10 || cy < 8 || cy > h - 10) return false;
    if (this.reachableMask[cy * w + cx] !== 1) return false;
    if (Math.hypot(cx - this.sugarX, cy - this.sugarY) < 12) return false;
    for (let dy = -2; dy <= 3; dy++) {
      for (let dx = -2; dx <= 3; dx++) {
        const idx = (cy + dy) * w + (cx + dx);
        const c = this.cells[idx] as CellType;
        if (c !== CellType.SoftSoil && c !== CellType.Clay && c !== CellType.Stone) return false;
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
  countAnts(ownerId: string, type: PlayableAntId): number {
    let n = 0;
    for (const a of this.ants) {
      if (a.ownerId === ownerId && a.type === type && !a.fromQueen) n++;
    }
    return n;
  }

  getCap(type: PlayableAntId): number {
    const st = this.getLocalColonyStats();
    if (type === 'worker') return st.worker.maxActive;
    if (type === 'scout') return st.scout.maxActive;
    if (type === 'warrior') return st.warrior.maxActive;
    if (type === 'queen') return st.queen.maxActive;
    return 1;
  }

  private deployLocalAnt(wx: number, wy: number, angleOverride?: number) {
    if (this.state.mpMode === 'versus' && this.state.winnerId) return;

    const me = this.getLocalPlayer();
    if (!me) return;

    // Map Ping mode!
    if (this.state.pingMode) {
      this.state.pingMode = false;
      const colorHex = PLAYER_COLORS[me.colorIndex % PLAYER_COLORS.length].hex;
      this.pings.push({ x: wx, y: wy, nick: me.nick, colorHex, life: 6.0, maxLife: 6.0 });
      this.transport?.send({ type: 'ping', playerId: me.id, nick: me.nick, colorHex, x: wx, y: wy });
      this.audio.playCompassLaunch();
      this.callbacks.onSystemChat(`📍 ${me.nick} поставил маяк на карте!`);
      this.callbacks.onHudSync();
      return;
    }

    const type = this.state.selectedAnt;
    if (type === 'compass' && this.state.compassCd > 0) {
      const sec = Math.ceil(this.state.compassCd);
      this.callbacks.onToast(`Ищейка перезаряжается: ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
      return;
    }

    if (this.countAnts(me.id, type) >= this.getCap(type)) {
      this.callbacks.onToast(`Лимит «${ANT_TYPES[type].name}» достигнут (увеличь в ♦ Навыках)`);
      return;
    }

    const spawn = this.findNearestEmpty(wx, wy, 28) || { x: me.baseX, y: me.baseY };
    const angle =
      angleOverride !== undefined
        ? angleOverride
        : Math.hypot(wx - spawn.x, wy - spawn.y) > 2
          ? Math.atan2(wy - spawn.y, wx - spawn.x)
          : Math.atan2(this.height * 0.5 - spawn.y, this.width * 0.5 - spawn.x);

    if (type === 'compass') this.state.compassCd = 120;

    const spawned = this.spawnAntInternal(me.id, type, spawn.x, spawn.y, angle);
    this.transport?.send({
      type: 'spawn',
      antId: spawned.id,
      playerId: me.id,
      antType: type,
      x: spawn.x,
      y: spawn.y,
      angle
    });

    this.audio.ensureStarted();
    if (type === 'compass') this.audio.playCompassLaunch();
    else this.audio.playSpawn();
    this.callbacks.onHudSync();
  }

  private spawnAntInternal(
    ownerId: string,
    type: PlayableAntId | 'brood',
    x: number,
    y: number,
    angle: number,
    forcedId?: number
  ): MpAnt {
    const cfg = ANT_TYPES[type];
    const stats = ownerId === this.state.localPlayerId ? this.getLocalColonyStats() : null;
    const lifeMult = stats ? stats.globalLifeMult : 1;
    const isRemote = ownerId !== this.state.localPlayerId && !ownerId.startsWith('bot_');

    const ant: MpAnt = {
      id: forcedId !== undefined ? forcedId : this.nextAntId++,
      ownerId,
      type,
      x,
      y,
      syncX: x,
      syncY: y,
      syncAngle: angle,
      angle,
      fixedAngle: angle,
      age: 0,
      maxAge: isRemote ? 4.5 : type === 'compass' ? 5.0 : cfg.baseLifespan * lifeMult,
      biteTimer: 0,
      biteFlash: 0,
      turnTimer: 0.5,
      spawnTimer: 2.2,
      legPhase: Math.random() * Math.PI * 2,
      trailTimer: 0
    };
    this.ants.push(ant);
    this.particles.spawn(x, y, cfg.rgb[0], cfg.rgb[1], cfg.rgb[2], 4, 14, 0.45, 1.3);
    return ant;
  }

  private update(dt: number) {
    this.elapsed += dt;
    if (this.state.compassCd > 0) this.state.compassCd = Math.max(0, this.state.compassCd - dt);

    // Every 5 minutes (300s), grant +1 or +2 Skill Points to every player!
    this.spDropAccum += dt;
    this.state.nextSpDropSec = Math.max(0, Math.ceil(300 - this.spDropAccum));
    if (this.spDropAccum >= 300) {
      this.spDropAccum -= 300;
      const bonus = Math.random() < 0.5 ? 1 : 2;
      this.state.localSp += bonus;
      this.audio.playCrystal();
      this.callbacks.onToast(`♦ Бонус колонии (5 мин): +${bonus} очк. навыков!`);
      this.callbacks.onSystemChat(`✨ Все игроки получили по ♦ +${bonus} очк. навыков!`);
      this.callbacks.onHudSync();
    }

    // Co-op rare fun random events!
    if (this.sugarRushTimer > 0) {
      this.sugarRushTimer = Math.max(0, this.sugarRushTimer - dt);
    }
    if (this.state.mpMode === 'coop' && (!this.transport || this.transport.isHost)) {
      this.coopEventTimer -= dt;
      if (this.coopEventTimer <= 0) {
        this.coopEventTimer = 105 + Math.random() * 50;
        const pool: (
          | 'sugar_rush'
          | 'crystal_shower'
          | 'wild_swarm'
          | 'quake'
          | 'royal_blessing'
          | 'worm_cavein'
          | 'rockslide'
        )[] = [
          'sugar_rush',
          'crystal_shower',
          'wild_swarm',
          'quake',
          'royal_blessing',
          'worm_cavein',
          'worm_cavein', // slightly higher weight so players get to see the worm!
          'rockslide'
        ];
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        const evSeed = Math.floor(Math.random() * 1_000_000);
        this.transport?.send({ type: 'coop_event', eventId: chosen, seed: evSeed });
        this.applyCoopEvent(chosen, evSeed);
      }
    }

    // Update slithering earthworms that refill dug tunnels with fresh soil!
    this.updateWorms(dt);

    // 30-second Co-op Vote countdown (auto-finishes even if not all players voted!)
    if (this.state.vote.active) {
      this.state.vote.timeLeft = Math.max(0, this.state.vote.timeLeft - dt);
      this.voteTickAccum += dt;
      if (this.voteTickAccum >= 0.5) {
        this.voteTickAccum = 0;
        this.callbacks.onVoteUpdate();
      }
      if (this.state.vote.timeLeft <= 0) {
        this.evaluateVotes(true);
      }
    }

    // Co-op 2-minute re-vote timer after players voted NO
    if (this.revoteTimer > 0 && this.state.mpMode === 'coop' && this.state.sugarFound && !this.state.allCleared) {
      this.revoteTimer -= dt;
      if (this.revoteTimer <= 0 && (!this.transport || this.transport.isHost)) {
        this.startNextLevelVote('Прошло 2 минуты! Перейти к новой локации?', true);
      }
    }

    // Update map pings
    for (let i = this.pings.length - 1; i >= 0; i--) {
      this.pings[i].life -= dt;
      if (this.pings[i].life <= 0) this.pings.splice(i, 1);
    }

    // AI Bot Colony when playing vs Bot
    if (this.state.vsBot && !this.state.winnerId) {
      this.botTimer -= dt;
      if (this.botTimer <= 0) {
        this.botTimer = 2.6 + Math.random() * 1.5;
        this.runBotStep();
      }
    }

    const localStats = this.getLocalColonyStats();

    // Decay Bloodhound (Ищейка) scent trail in Co-op
    for (let i = this.scentTrail.length - 1; i >= 0; i--) {
      this.scentTrail[i].life -= dt;
      if (this.scentTrail[i].life <= 0) this.scentTrail.splice(i, 1);
    }

    // Collect Queens for tiny 13px royal aura buffing!
    const queens: { x: number; y: number }[] = [];
    for (let i = 0; i < this.ants.length; i++) {
      if (this.ants[i].type === 'queen') queens.push({ x: this.ants[i].x, y: this.ants[i].y });
    }
    const queenAuraSq = QUEEN_AURA_RADIUS * QUEEN_AURA_RADIUS;

    for (let i = this.ants.length - 1; i >= 0; i--) {
      const ant = this.ants[i];
      const cfg = ANT_TYPES[ant.type];
      const isLocal = ant.ownerId === this.state.localPlayerId;
      ant.age += dt;
      if (ant.biteTimer > 0) ant.biteTimer -= dt;
      if (ant.biteFlash > 0) ant.biteFlash = Math.max(0, ant.biteFlash - dt * 5);
      ant.turnTimer -= dt;

      if (ant.age >= ant.maxAge) {
        if (isLocal && ant.type !== 'brood') {
          const expInt = this.computeAntAudioIntensity(ant.x, ant.y);
          if (expInt > 0.04) this.audio.playAntExpire(expInt);
        }
        this.ants.splice(i, 1);
        continue;
      }

      // Only simulate physics & steering on locally-owned (and host-simulated bot) ants!
      // Remote players' ants smoothly interpolate directly to their authoritative synced position & angle!
      const isSimulatedHere = isLocal || (ant.ownerId.startsWith('bot_') && (!this.transport || this.transport.isHost));

      if (!isSimulatedHere) {
        const tx = ant.syncX !== undefined ? ant.syncX : ant.x;
        const ty = ant.syncY !== undefined ? ant.syncY : ant.y;
        const ta = ant.syncAngle !== undefined ? ant.syncAngle : ant.angle;
        const dx = tx - ant.x;
        const dy = ty - ant.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 18) {
          ant.x = tx;
          ant.y = ty;
        } else {
          const lerp = Math.min(1, dt * 14);
          ant.x += dx * lerp;
          ant.y += dy * lerp;
        }
        let aDiff = ta - ant.angle;
        while (aDiff > Math.PI) aDiff -= Math.PI * 2;
        while (aDiff < -Math.PI) aDiff += Math.PI * 2;
        ant.angle += aDiff * Math.min(1, dt * 16);
        ant.legPhase += dt * (dist > 0.25 ? Math.min(28, dist * 10) : 5.5);
        continue;
      }

      if (ant.type === 'queen') {
        ant.spawnTimer -= dt * (isLocal ? localStats.queen.spawnRateMult : 1);
        if (ant.spawnTimer <= 0) {
          ant.spawnTimer = 2.6;
          const b = this.spawnAntInternal(ant.ownerId, 'brood', ant.x, ant.y, Math.random() * Math.PI * 2);
          b.fromQueen = true;
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

      let speedMult = 1;
      let dmg = cfg.baseDamage;
      let radius = cfg.baseRadius;
      if (isLocal) {
        if (ant.type === 'worker') {
          speedMult = localStats.worker.speedMult;
          dmg += localStats.worker.dmgBonus;
          if (localStats.worker.evolved) radius += 0.8;
        }
        if (ant.type === 'warrior') { speedMult = localStats.warrior.speedMult; dmg += localStats.warrior.dmgBonus; radius += localStats.warrior.radiusBonus; }
        if (ant.type === 'scout') { speedMult = localStats.scout.speedMult; dmg += localStats.scout.dmgBonus; }
        if (ant.type === 'brood') { dmg += localStats.queen.broodDmgBonus; }
        if (ant.type === 'compass') { speedMult = localStats.globalSpeedMult; }
      }

      // Queen tiny royal buff aura (+35% speed, +1 dmg within 13px!)
      if (ant.type !== 'queen' && queens.length > 0) {
        for (let q = 0; q < queens.length; q++) {
          const qdx = ant.x - queens[q].x;
          const qdy = ant.y - queens[q].y;
          if (qdx * qdx + qdy * qdy <= queenAuraSq) {
            speedMult *= 1.35;
            dmg += 1;
            break;
          }
        }
      }

      if (this.sugarRushTimer > 0) {
        speedMult *= 1.8;
      }

      // Record lingering golden scent trail for Ищейка!
      if (ant.type === 'compass') {
        ant.trailTimer += dt;
        if (ant.trailTimer >= 0.12) {
          ant.trailTimer = 0;
          const last = this.scentTrail[this.scentTrail.length - 1];
          if (!last || Math.hypot(ant.x - last.x, ant.y - last.y) >= 2.2) {
            this.scentTrail.push({ x: ant.x, y: ant.y, angle: ant.angle, life: 16, maxLife: 16 });
            if (this.scentTrail.length > 180) this.scentTrail.shift();
          }
        }
      }

      const speed = cfg.baseSpeed * speedMult;
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
        this.digInternal(ix, iy, radius, 1, ant.ownerId, false);
        ant.angle += (Math.random() < 0.5 ? 1 : -1) * 1.1;
        if (ant.type === 'warrior') ant.fixedAngle = ant.angle;
      } else {
        ant.legPhase += dt * 4.5;
        if (ant.biteTimer <= 0) {
          ant.biteTimer = cfg.baseBiteInterval / speedMult;
          ant.biteFlash = 1;
          // Every player's own ants dig immediately & broadcast exact cleared cells!
          // Host also simulates bot ants.
          const isBotOwned = ant.ownerId.startsWith('bot_') && (!this.transport || this.transport.isHost);
          if (isLocal || isBotOwned) {
            this.digInternal(nx, ny, radius, dmg, ant.ownerId, true);
            if (isLocal && ant.type === 'worker' && localStats.worker.evolved && Math.random() < 0.25) {
              this.digInternal(nx, ny, 3.2, 2, ant.ownerId, true);
              this.particles.spawn(nx, ny, 95, 255, 175, 4, 20, 0.5, 1.5);
            }
            if (isLocal && ant.type === 'scout' && localStats.scout.poisonRank > 0) {
              this.digInternal(nx, ny, 1.8 + localStats.scout.poisonRank * 0.4, localStats.scout.poisonRank * 2, ant.ownerId, true);
              this.particles.spawn(nx, ny, 125, 255, 95, 4, 18, 0.6, 1.4);
            }
          }
          if (ant.type === 'scout') {
            ant.angle += Math.PI * 0.75 + (Math.random() - 0.5) * 0.5;
          }
        }
      }
    }

    if (this.state.allCleared && Math.random() < dt * 1.4) {
      const fx = this.width * (0.16 + Math.random() * 0.68);
      const fy = this.height * (0.16 + Math.random() * 0.68);
      const hue = Math.random() * Math.PI * 2;
      this.particles.spawn(
        fx,
        fy,
        Math.round(170 + 85 * Math.sin(hue)),
        Math.round(170 + 85 * Math.sin(hue + 2.1)),
        Math.round(170 + 85 * Math.sin(hue + 4.2)),
        10,
        28,
        1.7,
        1.9
      );
    }

    this.particles.update(dt);

    // Flush exact destroyed block indices (~7Hz) so all screens stay 100% pixel-identical!
    this.cellsFlushAccum += dt;
    if (this.cellsFlushAccum >= 0.14 && this.pendingClearedCells.size > 0) {
      this.cellsFlushAccum = 0;
      const batch = Array.from(this.pendingClearedCells);
      this.pendingClearedCells.clear();
      this.transport?.send({
        type: 'cells_clear',
        indices: batch,
        ownerId: this.state.localPlayerId
      });
    }

    // Each player broadcasts ONLY their own ants (~6Hz) when active, plus 1 empty flush when all expire!
    if (this.transport) {
      this.antsSyncAccum += dt;
      if (this.antsSyncAccum >= 0.16) {
        this.antsSyncAccum = 0;
        const myId = this.state.localPlayerId;
        const myAnts = this.ants.filter((a) => a.ownerId === myId);
        if (myAnts.length > 0 || this.hadMyAntsLastSync) {
          this.hadMyAntsLastSync = myAnts.length > 0;
          const snapshot: [number, number, number, number, number][] = myAnts.map((a) => [
            a.id,
            Math.max(0, SYNC_ANT_TYPES.indexOf(a.type)),
            Math.round(a.x * 10) / 10,
            Math.round(a.y * 10) / 10,
            Math.round(a.angle * 100) / 100
          ]);
          this.transport.send({ type: 'ants_sync', ownerId: myId, ants: snapshot });
        }
      }
    }

    this.hudAccum += dt;
    if (this.hudAccum >= 0.35) {
      this.hudAccum = 0;
      this.callbacks.onHudSync();
    }
  }

  /** Rare fun & negative Co-op random events synchronized across all players! */
  private applyCoopEvent(
    eventId:
      | 'sugar_rush'
      | 'crystal_shower'
      | 'wild_swarm'
      | 'quake'
      | 'royal_blessing'
      | 'worm_cavein'
      | 'rockslide',
    evSeed: number
  ) {
    const rng = mulberry32(evSeed);
    this.audio.playMutationSpawn();

    switch (eventId) {
      case 'worm_cavein': {
        // Spawn a slithering earthworm that crawls across dug tunnels and fills them back in!
        const startX = this.width * (0.2 + rng() * 0.6);
        const startY = this.height * (0.2 + rng() * 0.6);
        const angle = rng() * Math.PI * 2;
        const segments = Array.from({ length: 12 }, (_, idx) => ({
          x: startX - Math.cos(angle) * idx * 2.1,
          y: startY - Math.sin(angle) * idx * 2.1
        }));
        this.worms.push({
          x: startX,
          y: startY,
          angle,
          age: 0,
          maxAge: 15,
          speed: 22,
          segments
        });
        this.callbacks.onToast('🪱 Земляной червячок! Проползает и засыпает прорытые тоннели!');
        this.callbacks.onSystemChat('🪱 Негативное событие: Земляной червячок ползёт по карте и засыпает тоннели землёй!');
        break;
      }
      case 'rockslide': {
        // Scattered rubble falls back into open tunnels far from player bases
        let filled = 0;
        for (let attempt = 0; attempt < 900 && filled < 95; attempt++) {
          const rx = Math.floor(14 + rng() * (this.width - 28));
          const ry = Math.floor(14 + rng() * (this.height - 28));
          if (this.cells[ry * this.width + rx] !== CellType.Empty) continue;
          if (this.isNearAnyBase(rx, ry, 18)) continue;
          this.refillSoilPatch(rx, ry, 2.2);
          this.particles.spawn(rx, ry, 145, 115, 80, 3, 14, 0.8, 1.5);
          filled += 8;
        }
        this.callbacks.onToast('🪨 Осыпь в тоннелях! Часть дальних ходов завалило породой!');
        this.callbacks.onSystemChat('🪨 Негативное событие: Осыпь засыпала часть прорытых тоннелей!');
        break;
      }
      case 'sugar_rush': {
        this.sugarRushTimer = 25;
        for (const a of this.ants) {
          this.particles.spawn(a.x, a.y, 255, 224, 102, 5, 22, 0.9, 1.8);
        }
        this.callbacks.onToast('⚡ Событие: Сахарная лихорадка! Все муравьи ускорены ×1.8 на 25 сек!');
        this.callbacks.onSystemChat('⚡ Редкое событие: Сахарная лихорадка! Скорость всех муравьёв ×1.8 на 25с!');
        break;
      }
      case 'crystal_shower': {
        let spawned = 0;
        for (let attempt = 0; attempt < 260 && spawned < 7; attempt++) {
          const cx = Math.floor(this.width * 0.14 + rng() * (this.width * 0.72));
          const cy = Math.floor(this.height * 0.14 + rng() * (this.height * 0.72));
          if (this.tryPlaceCrystal(cx, cy)) {
            this.revealCircle(cx, cy, 14);
            this.particles.spawn(cx, cy, 75, 235, 255, 14, 28, 1.4, 2.0);
            spawned++;
          }
        }
        this.callbacks.onToast(`💎 Метеоритный дождь! На карте появилось ${spawned} новых кристаллов!`);
        this.callbacks.onSystemChat(`💎 Редкое событие: Кристальный дождь (+${spawned} кристаллов на карте)!`);
        break;
      }
      case 'wild_swarm': {
        for (const pl of this.state.players) {
          for (let k = 0; k < 4; k++) {
            const kind: PlayableAntId = k % 2 === 0 ? 'scout' : 'warrior';
            const bonusAnt = this.spawnAntInternal(pl.id, kind, pl.baseX, pl.baseY, rng() * Math.PI * 2);
            bonusAnt.fromQueen = true;
          }
        }
        this.callbacks.onToast('🐜 Нашествие союзников! Из каждой базы выбежали 4 бесплатных муравья!');
        this.callbacks.onSystemChat('🐜 Редкое событие: Нашествие бродяг — по 4 бесплатных Воина и Разведчика из каждой базы!');
        break;
      }
      case 'quake': {
        let cracked = 0;
        for (let i = 0; i < this.cells.length; i++) {
          if (this.isEdge[i] === 1 && this.hp[i] > 1 && this.hp[i] < 255) {
            this.hp[i] = Math.max(1, this.hp[i] - 4);
            cracked++;
          }
        }
        for (const pl of this.state.players) {
          this.particles.spawn(pl.baseX, pl.baseY, 255, 165, 70, 14, 30, 1.2, 1.8);
        }
        this.callbacks.onToast('🌋 Подземный толчок! Все стенки тоннелей ослаблены и треснули!');
        this.callbacks.onSystemChat(`🌋 Редкое событие: Подземный толчок ослабил ${cracked} блоков на стенах тоннелей!`);
        break;
      }
      case 'royal_blessing': {
        this.state.localSp += 1;
        for (const pl of this.state.players) {
          const q: MpAnt = {
            id: this.nextAntId++,
            ownerId: pl.id,
            type: 'queen',
            x: pl.baseX,
            y: pl.baseY,
            angle: rng() * Math.PI * 2,
            fixedAngle: 0,
            age: 0,
            maxAge: 22,
            biteTimer: 0,
            biteFlash: 0,
            turnTimer: 1.0,
            spawnTimer: 1.0,
            legPhase: 0,
            trailTimer: 0,
            fromQueen: true
          };
          this.ants.push(q);
          this.particles.spawn(pl.baseX, pl.baseY, 235, 120, 255, 14, 24, 1.3, 2.0);
        }
        this.callbacks.onToast('👑 Королевский визит! Временная Матка на каждой базе + ♦ 1 очко навыков!');
        this.callbacks.onSystemChat('👑 Редкое событие: Королевский визит — временная Матка у каждого игрока + ♦ 1!');
        this.callbacks.onHudSync();
        break;
      }
    }
  }

  private applyRemoteCellsClear(indices: number[], ownerId: string) {
    const w = this.width;
    const h = this.height;
    const ownerPlayer = this.getPlayer(ownerId);

    for (const idx of indices) {
      if (idx < 0 || idx >= this.cells.length) continue;
      const c = this.cells[idx] as CellType;
      if (c === CellType.Empty || c === CellType.HiddenArt || c === CellType.Sugar) continue;

      this.hp[idx] = 0;
      this.maxHp[idx] = 0;
      this.cells[idx] = CellType.Empty;
      this.isEdge[idx] = 0;

      const x = idx % w;
      const y = Math.floor(idx / w);

      if (c === CellType.SkillCrystal) {
        if (this.state.mpMode === 'coop') {
          this.state.localSp += 1 + this.getLocalColonyStats().crystalBonus;
        }
        this.audio.playCrystal();
        this.particles.spawn(x, y, 75, 235, 255, 8, 22, 0.9, 1.7);
      } else {
        this.state.dugBreakable++;
        if (ownerPlayer) ownerPlayer.dug++;
      }

      for (let ny = y - 1; ny <= y + 1; ny++) {
        for (let nx = x - 1; nx <= x + 1; nx++) {
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = ny * w + nx;
          if (this.cells[nIdx] !== CellType.Empty) {
            this.isEdge[nIdx] = 1;
            if (this.cells[nIdx] === CellType.HiddenArt) this.artExposed[nIdx] = 1;
            if (this.cells[nIdx] === CellType.Sugar) this.sugarExposed = true;
          }
        }
      }

      this.revealCircle(x, y, 22);
      if (indices.length > 0 && idx === indices[0]) {
        this.playProximityDigSound(x, y);
      }
    }

    if (
      !this.state.allCleared &&
      this.state.totalBreakable > 100 &&
      (this.state.dugBreakable >= this.state.totalBreakable * 0.99 ||
        this.state.totalBreakable - this.state.dugBreakable <= 18)
    ) {
      this.triggerEpicCoopClear();
    }
  }

  /** Updates ONLY the remote owner's ants — never touches local player's ants! */
  private applyRemoteAntsSync(ownerId: string, snapshot: [number, number, number, number, number][]) {
    const existingById = new Map<number, MpAnt>();
    const keptOtherAnts: MpAnt[] = [];

    for (const a of this.ants) {
      if (a.ownerId === ownerId) existingById.set(a.id, a);
      else keptOtherAnts.push(a);
    }

    for (const [id, typeIdx, x, y, angle] of snapshot) {
      const prev = existingById.get(id);
      if (prev) {
        if (Math.hypot(x - prev.x, y - prev.y) > 18) {
          prev.x = x;
          prev.y = y;
        }
        prev.syncX = x;
        prev.syncY = y;
        prev.syncAngle = angle;
        prev.fixedAngle = angle;
        prev.age = 0;
        prev.maxAge = 4.5;
        keptOtherAnts.push(prev);
      } else {
        const type = SYNC_ANT_TYPES[typeIdx] || 'worker';
        keptOtherAnts.push({
          id,
          ownerId,
          type,
          x,
          y,
          syncX: x,
          syncY: y,
          syncAngle: angle,
          angle,
          fixedAngle: angle,
          age: 0,
          maxAge: 4.5,
          biteTimer: 0,
          biteFlash: 0,
          turnTimer: 0.5,
          spawnTimer: 2.2,
          legPhase: Math.random() * Math.PI * 2,
          trailTimer: 0
        });
      }
    }
    this.ants = keptOtherAnts;
  }

  private isNearAnyBase(x: number, y: number, safeRadius: number): boolean {
    const rSq = safeRadius * safeRadius;
    for (const pl of this.state.players) {
      const dx = x - pl.baseX;
      const dy = y - pl.baseY;
      if (dx * dx + dy * dy <= rSq) return true;
    }
    return false;
  }

  private refillSoilPatch(cx: number, cy: number, radius: number) {
    const rCeil = Math.ceil(radius);
    const rSq = radius * radius;
    const w = this.width;
    const h = this.height;

    for (let dy = -rCeil; dy <= rCeil; dy++) {
      for (let dx = -rCeil; dx <= rCeil; dx++) {
        if (dx * dx + dy * dy > rSq) continue;
        const x = Math.round(cx + dx);
        const y = Math.round(cy + dy);
        if (x < 6 || x >= w - 6 || y < 6 || y >= h - 6) continue;
        if (this.isNearAnyBase(x, y, 16)) continue;

        const idx = y * w + x;
        if (this.cells[idx] === CellType.Empty) {
          this.setBlock(idx, CellType.SoftSoil);
          this.isEdge[idx] = 1;
          this.state.dugBreakable = Math.max(0, this.state.dugBreakable - 1);
        }
      }
    }
  }

  private updateWorms(dt: number) {
    for (let i = this.worms.length - 1; i >= 0; i--) {
      const worm = this.worms[i];
      worm.age += dt;
      if (worm.age >= worm.maxAge) {
        this.particles.spawn(worm.x, worm.y, 215, 130, 125, 10, 18, 0.9, 1.8);
        this.worms.splice(i, 1);
        continue;
      }

      // Sinuous slithering wave
      worm.angle += Math.sin(worm.age * 3.8) * 1.45 * dt;
      worm.x += Math.cos(worm.angle) * worm.speed * dt;
      worm.y += Math.sin(worm.angle) * worm.speed * dt;

      // Gently turn inward if approaching outer map perimeter
      if (worm.x < 24 || worm.x > this.width - 24 || worm.y < 24 || worm.y > this.height - 24) {
        worm.angle = Math.atan2(this.height * 0.5 - worm.y, this.width * 0.5 - worm.x);
      }

      // Follow-the-leader segment kinematics
      worm.segments[0].x = worm.x;
      worm.segments[0].y = worm.y;
      const segSpacing = 2.1;
      for (let s = 1; s < worm.segments.length; s++) {
        const prev = worm.segments[s - 1];
        const cur = worm.segments[s];
        const dx = prev.x - cur.x;
        const dy = prev.y - cur.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist > segSpacing) {
          cur.x = prev.x - (dx / dist) * segSpacing;
          cur.y = prev.y - (dy / dist) * segSpacing;
        }
      }

      // Refill dug tunnels behind the worm's tail!
      const tail = worm.segments[worm.segments.length - 1];
      this.refillSoilPatch(tail.x, tail.y, 2.3);
      if (Math.random() < 0.35) {
        this.particles.spawn(tail.x, tail.y, 165, 125, 92, 1, 10, 0.5, 1.3);
      }
    }
  }

  private runBotStep() {
    const bot = this.state.players.find((p) => p.id.startsWith('bot_'));
    if (!bot) return;
    const roll = Math.random();
    let type: PlayableAntId = 'worker';
    if (roll < 0.25 && this.countAnts(bot.id, 'warrior') < 2) type = 'warrior';
    else if (roll < 0.55 && this.countAnts(bot.id, 'scout') < 3) type = 'scout';
    else if (this.countAnts(bot.id, 'worker') >= 6) return;

    const toCenter = Math.atan2(
      this.height * 0.5 - bot.baseY + (Math.random() - 0.5) * 90,
      this.width * 0.5 - bot.baseX
    );
    this.spawnAntInternal(bot.id, type, bot.baseX, bot.baseY, toCenter);
  }

  private digInternal(
    cx: number,
    cy: number,
    radius: number,
    damage: number,
    ownerId: string,
    broadcast: boolean
  ) {
    const rCeil = Math.ceil(radius);
    const rSq = radius * radius;
    const w = this.width;
    let dugAny = false;
    const ownerPlayer = this.getPlayer(ownerId);

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
          if (!this.state.sugarFound) {
            this.state.sugarFound = true;
            this.audio.playSugarFound();
            this.particles.spawn(this.sugarX, this.sugarY, 255, 252, 224, 36, 48, 2.2, 2.5);
            this.particles.spawn(this.sugarX, this.sugarY, 175, 246, 255, 22, 40, 2.0, 2.2);
            this.particles.spawn(this.sugarX, this.sugarY, 255, 224, 102, 26, 32, 2.4, 2.6);

            if (this.state.mpMode === 'versus') {
              this.state.winnerId = ownerId;
              const nick = ownerPlayer?.nick || 'Игрок';
              if (broadcast) this.transport?.send({ type: 'sugar_win', winnerId: ownerId, winnerNick: nick });
              this.callbacks.onVersusEnd(nick, ownerId === this.state.localPlayerId);
            } else {
              // Co-op: notify room & trigger 30-second map vote!
              const nick = ownerPlayer?.nick || 'Колония';
              this.callbacks.onSystemChat(`🧊 ${nick} нашёл сахар!`);
              if (broadcast) this.transport?.send({ type: 'sugar_win', winnerId: ownerId, winnerNick: nick });
              if (!this.transport || this.transport.isHost) {
                this.startNextLevelVote('Сахар найден! Перейти к новой локации?', true);
              }
            }
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
          if (broadcast) {
            this.pendingClearedCells.add(idx);
          }

          if (c === CellType.SkillCrystal) {
            // In Co-op, everyone gets +1 SP when a crystal is broken so no one falls behind!
            if (this.state.mpMode === 'coop' || ownerId === this.state.localPlayerId) {
              this.state.localSp += 1 + this.getLocalColonyStats().crystalBonus;
            }
            this.audio.playCrystal();
            this.particles.spawn(x, y, 75, 235, 255, 10, 24, 1.0, 1.8);
          } else {
            this.state.dugBreakable++;
            if (ownerPlayer) ownerPlayer.dug++;
          }

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
      this.playProximityDigSound(cx, cy);
      // Check if 99%+ of all breakable blocks are eaten in Co-op -> Epic iridescent shimmer finale!
      if (
        !this.state.allCleared &&
        this.state.totalBreakable > 100 &&
        (this.state.dugBreakable >= this.state.totalBreakable * 0.99 ||
          this.state.totalBreakable - this.state.dugBreakable <= 18)
      ) {
        this.triggerEpicCoopClear();
      }
    }
  }

  /** Strict spatial close-zoom + central camera framing gate for ALL ant sounds in Co-op! */
  private computeAntAudioIntensity(wx: number, wy: number): number {
    const fitZoom = Math.min((this.viewW * 0.9) / Math.max(1, this.width), (this.viewH * 0.82) / Math.max(1, this.height));
    const minHearZoom = Math.max(7.2, fitZoom * 2.5);
    if (this.camera.zoom < minHearZoom) return 0;

    const zoomFactor = Math.min(1, (this.camera.zoom - minHearZoom) / 7.5);
    if (zoomFactor <= 0.02) return 0;

    const halfW = Math.max(1, this.viewW * 0.44);
    const halfH = Math.max(1, this.viewH * 0.44);
    const sx = (wx - this.camera.x) * this.camera.zoom;
    const sy = (wy - this.camera.y) * this.camera.zoom;
    const nx = Math.abs(sx) / halfW;
    const ny = Math.abs(sy) / halfH;
    if (nx >= 1 || ny >= 1) return 0;
    const dist = Math.hypot(nx, ny);
    if (dist >= 1) return 0;
    return zoomFactor * Math.pow(1 - dist, 1.4);
  }

  /** Gentle eating sound ONLY when zoomed in close and pointing camera right at the chewing ant! */
  private playProximityDigSound(wx: number, wy: number) {
    const intensity = this.computeAntAudioIntensity(wx, wy);
    if (intensity > 0.04) {
      this.audio.playDigTick(intensity);
    }
  }

  private triggerEpicCoopClear() {
    this.state.allCleared = true;
    const total = this.width * this.height;
    for (let i = 0; i < total; i++) {
      const c = this.cells[i] as CellType;
      if (
        (c === CellType.SoftSoil || c === CellType.Clay || c === CellType.Stone || c === CellType.Obsidian) &&
        this.reachableMask[i] === 1
      ) {
        this.cells[i] = CellType.Empty;
        this.hp[i] = 0;
        this.maxHp[i] = 0;
        this.isEdge[i] = 0;
      } else if (c === CellType.HiddenArt) {
        this.artExposed[i] = 1;
      }
    }
    this.state.dugBreakable = this.state.totalBreakable;
    this.audio.playEpicClearFanfare();
    const fitZoom = Math.min((this.viewW * 0.88) / this.width, (this.viewH * 0.74) / this.height);
    this.camera.x = this.width * 0.5;
    this.camera.y = this.height * 0.5;
    this.camera.zoom = Math.max(1.2, Math.min(3.8, fitZoom));
    for (let b = 0; b < 6; b++) {
      const fx = this.width * (0.2 + Math.random() * 0.6);
      const fy = this.height * (0.2 + Math.random() * 0.6);
      this.particles.spawn(fx, fy, 130 + Math.random() * 125, 170 + Math.random() * 85, 255, 22, 46, 2.2, 2.4);
    }
    this.callbacks.onAllBlocksCleared();
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

  setTouchPanMode(enabled: boolean) {
    this.touchPanMode = enabled;
    this.isAiming = false;
    this.aimPreview = null;
    this.canvas.style.cursor = enabled ? 'grab' : 'crosshair';
  }

  zoomBy(factor: number) {
    this.camera.zoom = Math.max(1.0, Math.min(28, this.camera.zoom * factor));
  }

  /* =========================================================
     RENDERER (MOBILE-OPTIMIZED + STYLED BASES + SKINS + PINGS)
     ========================================================= */
  private rebuildTextures() {
    const { width: w, height: h, cells, hp, maxHp, isEdge, revealedMask, artExposed, noise } = this;
    const data = this.imgData.data;
    const data32 = this.imgData32;
    const glow = this.glowImgData.data;
    const glow32 = this.glowData32;
    const pal = this.state.level.palette;
    const [bR, bG, bB] = pal.bgRgb;
    const [eR, eG, eB] = pal.emptyRgb;
    const [sR, sG, sB] = pal.softRgb;
    const [cR, cG, cB] = pal.clayRgb;
    const [stR, stG, stB] = pal.stoneRgb;
    const [oR, oG, oB] = pal.obsidianRgb;
    const [agR, agG, agB] = pal.artGlowRgb;

    const bgPacked = ((255 << 24) | (bB << 16) | (bG << 8) | bR) >>> 0;
    const emptyPacked = ((255 << 24) | (eB << 16) | (eG << 8) | eR) >>> 0;
    const cleared = this.state.allCleared;
    const sugarExp = this.sugarExposed;

    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const idx = row + x;
        const c = cells[idx] as CellType;
        glow32[idx] = 0;

        if (c === CellType.Empty) {
          data32[idx] = emptyPacked;
          continue;
        }

        const revByte = revealedMask[idx];
        if (revByte === 0 && !cleared && !(c === CellType.HiddenArt && artExposed[idx] === 1) && !(c === CellType.Sugar && sugarExp)) {
          data32[idx] = bgPacked;
          continue;
        }

        const p = idx * 4;
        const n = noise[idx];
        const vis = revByte / 255;

        if (c === CellType.HiddenArt && (artExposed[idx] === 1 || cleared)) {
          if (cleared) {
            const phase = x * 0.032 + y * 0.022 - this.elapsed * 2.6;
            const gleam = Math.pow(Math.max(0, Math.sin(x * 0.028 - y * 0.018 - this.elapsed * 3.4)), 8);
            const irR = Math.min(255, Math.round(188 + 67 * Math.sin(phase) + gleam * 115));
            const irG = Math.min(255, Math.round(192 + 63 * Math.sin(phase + 2.094) + gleam * 115));
            const irB = Math.min(255, Math.round(198 + 57 * Math.sin(phase + 4.188) + gleam * 115));
            data[p] = irR; data[p + 1] = irG; data[p + 2] = irB; data[p + 3] = 255;
            glow[p] = irR; glow[p + 1] = irG; glow[p + 2] = irB; glow[p + 3] = Math.min(255, Math.round(215 + gleam * 40));
          } else {
            data[p] = 255; data[p + 1] = 255; data[p + 2] = 255; data[p + 3] = 255;
            glow[p] = agR; glow[p + 1] = agG; glow[p + 2] = agB; glow[p + 3] = 220;
          }
          continue;
        }
        if (c === CellType.Sugar && sugarExp) {
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
          data32[idx] = bgPacked;
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
    this.bloomCtx.clearRect(0, 0, this.bloomW, this.bloomH);
    this.bloomCtx.imageSmoothingEnabled = true;
    this.bloomCtx.drawImage(this.glowCanvas, 0, 0, this.bloomW, this.bloomH);
  }

  private render() {
    const { width: w, height: h } = this;
    const pal = this.state.level.palette;
    const mobile = isMobileDevice();
    const now = performance.now();
    const rebuildInterval = mobile ? 50 : 28;
    if (this.lastRebuildMs === 0 || now - this.lastRebuildMs >= rebuildInterval) {
      this.rebuildTextures();
      this.lastRebuildMs = now;
    }

    const ctx = this.ctx;
    ctx.fillStyle = pal.bgHex;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    const z = this.camera.zoom;
    const drawX = this.viewW * 0.5 - this.camera.x * z;
    const drawY = this.viewH * 0.5 - this.camera.y * z;

    const srcX = Math.max(0, Math.floor(-drawX / z) - 1);
    const srcY = Math.max(0, Math.floor(-drawY / z) - 1);
    const srcX2 = Math.min(w, Math.ceil((this.viewW - drawX) / z) + 1);
    const srcY2 = Math.min(h, Math.ceil((this.viewH - drawY) / z) + 1);
    const srcW = srcX2 - srcX;
    const srcH = srcY2 - srcY;

    ctx.save();
    if (srcW > 0 && srcH > 0) {
      const dstX = drawX + srcX * z;
      const dstY = drawY + srcY * z;
      const dstW = srcW * z;
      const dstH = srcH * z;

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.offscreen, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);

      ctx.globalCompositeOperation = 'lighter';
      ctx.imageSmoothingEnabled = true;
      const bSx = (srcX / w) * this.bloomW;
      const bSy = (srcY / h) * this.bloomH;
      const bSw = (srcW / w) * this.bloomW;
      const bSh = (srcH / h) * this.bloomH;
      ctx.globalAlpha = this.state.allCleared ? 0.72 : 0.48;
      ctx.drawImage(this.bloomCanvas, bSx, bSy, bSw, bSh, dstX, dstY, dstW, dstH);
      ctx.globalAlpha = this.state.allCleared ? 0.44 : 0.26;
      ctx.drawImage(this.glowCanvas, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Draw stylized Citadel Bases for EVERY player!
    for (const pl of this.state.players) {
      const col = PLAYER_COLORS[pl.colorIndex % PLAYER_COLORS.length];
      const bx = drawX + pl.baseX * z;
      const by = drawY + pl.baseY * z;
      const pulse = 0.85 + 0.15 * Math.sin(this.elapsed * 2.5 + pl.colorIndex);
      const baseR = Math.max(11, z * 5.2);

      // Soft faction floor glow
      ctx.fillStyle = `rgba(${col.rgb[0]}, ${col.rgb[1]}, ${col.rgb[2]}, 0.16)`;
      ctx.beginPath();
      ctx.arc(bx, by, baseR * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // Outer hexagonal fortress ring
      ctx.strokeStyle = col.hex;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let s = 0; s < 6; s++) {
        const a = (s / 6) * Math.PI * 2 - Math.PI / 6;
        const px = bx + Math.cos(a) * baseR;
        const py = by + Math.sin(a) * baseR;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      // Inner pulsing core dome
      ctx.fillStyle = `rgba(${col.rgb[0]}, ${col.rgb[1]}, ${col.rgb[2]}, ${0.45 * pulse})`;
      ctx.beginPath();
      ctx.arc(bx, by, baseR * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Player nickname tag
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${Math.max(10, Math.round(z * 2.4))}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(pl.nick, bx, by + baseR + Math.max(12, z * 3.2));
    }

    // Draw Map Pings (📍 Beacons)
    for (const ping of this.pings) {
      const t = 1 - ping.life / ping.maxLife;
      const px = drawX + ping.x * z;
      const py = drawY + ping.y * z;
      const ringR = (8 + (t * 4 % 1) * 28) * Math.max(0.7, z * 0.25);
      ctx.strokeStyle = ping.colorHex;
      ctx.globalAlpha = Math.max(0, 1 - (t * 4 % 1));
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(px, py, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = Math.min(1, ping.life);
      ctx.fillStyle = ping.colorHex;
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`📍 ${ping.nick}`, px, py - 10);
      ctx.globalAlpha = 1;
    }

    // Particles
    for (const pt of this.particles.particles) {
      const alpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
      ctx.fillStyle = `rgba(${pt.r}, ${pt.g}, ${pt.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(drawX + pt.x * z, drawY + pt.y * z, Math.max(1.4, pt.size * z * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw slithering Earthworms (negative Co-op event!)
    for (const worm of this.worms) {
      for (let s = worm.segments.length - 1; s >= 0; s--) {
        const seg = worm.segments[s];
        const sx = drawX + seg.x * z;
        const sy = drawY + seg.y * z;
        const segR = Math.max(2.2, z * (s === 0 ? 1.55 : s === worm.segments.length - 1 ? 0.95 : 1.35));
        // Saddle band (clitellum) on segment 3-4, warm pink/terracotta on rest
        ctx.fillStyle = s === 3 || s === 4 ? '#f2b8a2' : s % 2 === 0 ? '#d97a72' : '#c4645e';
        ctx.beginPath();
        ctx.arc(sx, sy, segR, 0, Math.PI * 2);
        ctx.fill();
      }
      // Cute tiny eyes on worm head
      const hx = drawX + worm.x * z;
      const hy = drawY + worm.y * z;
      ctx.fillStyle = '#1a0c0c';
      ctx.beginPath();
      ctx.arc(hx + Math.cos(worm.angle - 0.5) * z * 0.7, hy + Math.sin(worm.angle - 0.5) * z * 0.7, Math.max(0.9, z * 0.28), 0, Math.PI * 2);
      ctx.arc(hx + Math.cos(worm.angle + 0.5) * z * 0.7, hy + Math.sin(worm.angle + 0.5) * z * 0.7, Math.max(0.9, z * 0.28), 0, Math.PI * 2);
      ctx.fill();
    }

    // Lingering golden trajectory ribbon for Ищейка in Co-op!
    if (this.scentTrail.length >= 2) {
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 1; i < this.scentTrail.length; i++) {
        const a = this.scentTrail[i - 1];
        const b = this.scentTrail[i];
        if (Math.hypot(b.x - a.x, b.y - a.y) > 16) continue;
        const alpha = Math.max(0, Math.min(1, b.life / b.maxLife));
        ctx.strokeStyle = `rgba(255, 224, 110, ${alpha * 0.72})`;
        ctx.lineWidth = Math.max(1.8, z * 0.55);
        ctx.beginPath();
        ctx.moveTo(drawX + a.x * z, drawY + a.y * z);
        ctx.lineTo(drawX + b.x * z, drawY + b.y * z);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Queen tiny 13px royal aura rings + Ants with each player's chosen SKIN & COLOR!
    const localWorkerEvo = this.getSkillRank('worker_evo') > 0;
    for (const ant of this.ants) {
      const sx = drawX + ant.x * z;
      const sy = drawY + ant.y * z;
      if (ant.type === 'queen') {
        const auraR = QUEEN_AURA_RADIUS * z;
        ctx.strokeStyle = 'rgba(255, 200, 120, 0.34)';
        ctx.lineWidth = Math.max(1.1, z * 0.22);
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(sx, sy, auraR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (sx < -36 || sx > this.viewW + 36 || sy < -36 || sy > this.viewH + 36) continue;
      const owner = this.getPlayer(ant.ownerId);
      const col = owner ? PLAYER_COLORS[owner.colorIndex % PLAYER_COLORS.length] : PLAYER_COLORS[0];
      const skin = owner ? owner.skin : 'classic';
      const isEvo = ant.type === 'worker' && ant.ownerId === this.state.localPlayerId && localWorkerEvo;
      drawDetailedAnt(ctx, ant.type, sx, sy, ant.angle, ant.legPhase, ant.biteFlash, z, skin, col.rgb, isEvo);
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
    const dpr = getOptimalDpr();
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
        const factor = e.deltaY < 0 ? 1.14 : 0.88;
        const before = this.screenToWorld(e.clientX, e.clientY);
        this.camera.zoom = Math.max(1.0, Math.min(28, this.camera.zoom * factor));
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

      if (e.button === 1 || e.button === 2 || (this.touchPanMode && !this.state.pingMode)) {
        this.isDraggingCam = true;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
        return;
      }

      const wPos = this.screenToWorld(e.clientX, e.clientY);
      const me = this.getLocalPlayer();
      const defNest = me ? { x: me.baseX, y: me.baseY } : { x: this.width * 0.5, y: this.height * 0.5 };
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
          const before = this.screenToWorld(midX, midY);
          this.camera.zoom = Math.max(1.0, Math.min(28, this.pinchStartZoom * (dist / this.pinchStartDist)));
          const after = this.screenToWorld(midX, midY);
          this.camera.x += before.x - after.x;
          this.camera.y += before.y - after.y;
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

      if (this.isAiming && this.aimOrigin && this.aimDownScreen && !this.state.pingMode) {
        if (Math.hypot(e.clientX - this.aimDownScreen.x, e.clientY - this.aimDownScreen.y) >= 8) {
          this.aimDragged = true;
          const wPos = this.screenToWorld(e.clientX, e.clientY);
          const me = this.getLocalPlayer();
          const col = me ? PLAYER_COLORS[me.colorIndex % PLAYER_COLORS.length].hex : '#3ce87a';
          this.aimPreview = {
            fromX: this.aimOrigin.x,
            fromY: this.aimOrigin.y,
            angle: Math.atan2(wPos.y - this.aimOrigin.y, wPos.x - this.aimOrigin.x),
            color: col
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
