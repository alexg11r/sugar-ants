import { ANT_TYPES } from '../core/ants';
import { MeditativeAudio } from '../core/audio';
import { LEVELS } from '../core/levels';
import { ParticleSystem } from '../core/particles';
import { AimPreview, Camera, drawDetailedAnt } from '../core/renderer';
import {
  Ant,
  CellType,
  LevelDefinition,
  PLAYER_COLORS,
  PlayableAntId,
  SkillNodeDef
} from '../core/types';
import { BLOCK_HP } from '../core/world';
import { ColonyStats, SKILL_NODES } from '../game/skillTree';
import { MpMessage, MpMode, MpPlayerInfo, MpTransport } from './mpTransport';

interface MpAnt extends Ant {
  ownerId: string;
}

interface MapPing {
  x: number;
  y: number;
  nick: string;
  colorHex: string;
  life: number;
  maxLife: number;
}

export interface MpVoteState {
  active: boolean;
  reason: string;
  votes: Record<string, boolean>;
  myVote: boolean | null;
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

export function computeCoopMapSize(playerCount: number, mpMode: MpMode): { width: number; height: number } {
  if (mpMode === 'versus') return { width: 400, height: 250 };
  // Default minimum size is for 5 players (490x310), scaling proportionally up to 10 players (640x400)!
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
  noise: Uint8Array = new Uint8Array(1);

  sugarX = 200;
  sugarY = 125;
  sugarExposed = false;

  ants: MpAnt[] = [];
  pings: MapPing[] = [];
  particles = new ParticleSystem();
  camera: Camera = { x: 200, y: 125, zoom: 3.2 };
  state: MpMatchState;
  active = false;
  seed = 1337;
  /** Recorded dig log for mid-game late-join synchronization */
  dugHistory: [number, number, number, number][] = [];

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
  private spDropAccum = 0;
  private revoteTimer = 0;
  private coopEventTimer = 75; // First rare fun event after ~75-115s, then every ~105-155s
  private sugarRushTimer = 0;

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

    this.glowCanvas = document.createElement('canvas');
    this.glowCtx = this.glowCanvas.getContext('2d')!;
    this.glowImgData = this.glowCtx.createImageData(1, 1);

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
      vote: { active: false, reason: '', votes: {}, myVote: null },
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
    lateDugEvents?: [number, number, number, number][];
    startingSp?: number;
  }) {
    this.seed = opts.seed;
    this.transport = opts.transport;
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
    this.noise = new Uint8Array(size);

    this.offscreen.width = this.width;
    this.offscreen.height = this.height;
    this.imgData = this.offCtx.createImageData(this.width, this.height);
    this.glowCanvas.width = this.width;
    this.glowCanvas.height = this.height;
    this.glowImgData = this.glowCtx.createImageData(this.width, this.height);

    // Assign base positions for all players
    const playersWithBases = this.assignPlayerBases(opts.players, opts.mpMode);

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
    this.pings = [];
    this.particles.particles = [];
    this.dugHistory = [];
    this.botTimer = 1.4;
    this.spDropAccum = 0;
    this.revoteTimer = 0;
    this.coopEventTimer = 75 + Math.random() * 40;
    this.sugarRushTimer = 0;
    this.sugarExposed = false;

    this.generateSeededWorld(level, opts.seed, playersWithBases);

    // Apply late-join dig replay if joining mid-game!
    if (opts.lateDugEvents && opts.lateDugEvents.length > 0) {
      for (const [dx, dy, rad, dmg] of opts.lateDugEvents) {
        this.digInternal(dx, dy, rad, dmg, 'replay', false);
      }
    }

    this.resetCamera();
    this.active = true;
    this.lastTime = performance.now();
    this.callbacks.onHudSync();

    const modeLabel =
      opts.mpMode === 'coop'
        ? `🤝 Кооператив (${playersWithBases.length} игр., ${this.width}×${this.height})`
        : opts.vsBot
          ? '⚔ Гонка против ИИ-колонии'
          : '⚔ Онлайн 1 на 1';
    this.callbacks.onToast(`${modeLabel} • ${level.name}`);

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

  /** Mid-game late join: carve a fresh base for the newly arrived player! */
  addLateJoinPlayer(player: MpPlayerInfo): MpPlayerInfo {
    const idx = this.state.players.length;
    const angle = (idx * 2.39996) % (Math.PI * 2); // golden angle spacing
    const bx = Math.round(this.width * 0.5 + Math.cos(angle) * this.width * 0.31);
    const by = Math.round(this.height * 0.5 + Math.sin(angle) * this.height * 0.31);
    const withBase: MpPlayerInfo = { ...player, baseX: bx, baseY: by, dug: 0 };
    this.state.players.push(withBase);
    this.carveBaseChamber(bx, by);
    this.callbacks.onSystemChat(`${withBase.nick} подключился к игре!`);
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
    return {
      globalLifeMult: 1 + r('colony_life') * 0.25,
      globalSpeedMult: 1,
      crystalBonus: r('colony_crystal'),
      crystalLuckChance: 0,
      hardBlockBonusDmg: r('colony_armor'),
      queenAnomaly: false,
      farSense: false,
      compassCooldownSec: 120,
      compassDuration: 5.0,
      worker: {
        speedMult: 1 + r('worker_spd') * 0.22,
        dmgBonus: r('worker_dmg'),
        lifeMult: 1 + r('worker_life') * 0.35,
        maxActive: 6 + r('worker_cap') * 3
      },
      warrior: {
        speedMult: 1 + r('warrior_spd') * 0.22,
        dmgBonus: r('warrior_dmg') * 2,
        radiusBonus: r('warrior_cleave') * 0.65,
        maxActive: 2 + r('warrior_cap') * 2
      },
      scout: {
        speedMult: 1 + r('scout_spd') * 0.25,
        dmgBonus: r('scout_dmg'),
        lifeMult: 1 + r('scout_life') * 0.4,
        maxActive: 4 + r('scout_cap') * 3
      },
      queen: {
        spawnRateMult: 1 + r('queen_rate') * 0.25,
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
     CO-OP VOTING AFTER SUGAR FOUND (RE-VOTES EVERY 2 MIN IF NO!)
     ========================================================= */
  startNextLevelVote(reason: string, broadcast = true) {
    this.state.vote = {
      active: true,
      reason,
      votes: {},
      myVote: null
    };
    this.revoteTimer = 0;
    if (broadcast) {
      this.transport?.send({ type: 'vote_start', reason });
    }
    this.callbacks.onSystemChat(`🗳 Голосование: ${reason}`);
    this.callbacks.onVoteUpdate();
  }

  castVote(yes: boolean) {
    if (!this.state.vote.active) return;
    this.state.vote.myVote = yes;
    this.state.vote.votes[this.state.localPlayerId] = yes;
    this.transport?.send({ type: 'vote_cast', playerId: this.state.localPlayerId, yes });
    this.evaluateVotes();
    this.callbacks.onVoteUpdate();
  }

  private evaluateVotes() {
    const v = this.state.vote;
    if (!v.active) return;
    const totalPlayers = Math.max(1, this.state.players.filter((p) => !p.id.startsWith('bot_')).length);
    const entries = Object.values(v.votes);
    if (entries.length < totalPlayers) return;

    const yesCount = entries.filter(Boolean).length;
    const noCount = entries.length - yesCount;

    if (yesCount > noCount) {
      // Majority voted YES -> move to next map!
      v.active = false;
      this.callbacks.onVoteUpdate();
      if (!this.transport || this.transport.isHost) {
        this.advanceToNextCoopLevel();
      }
    } else {
      // Voted NO -> keep digging until 100%, repeat vote in 2 minutes (120s)!
      v.active = false;
      this.revoteTimer = 120;
      this.callbacks.onSystemChat('Продолжаем копать! Повторное голосование через 2 минуты.');
      this.callbacks.onToast('Продолжаем открывать карту! Повтор голосования через 2 мин.');
      this.callbacks.onVoteUpdate();
    }
  }

  advanceToNextCoopLevel() {
    const curIdx = LEVELS.findIndex((l) => l.id === this.state.level.id);
    const nextLvl = LEVELS[(curIdx + 1) % LEVELS.length];
    const nextSeed = Math.floor(Math.random() * 1_000_000);
    const dims = computeCoopMapSize(this.state.players.length, this.state.mpMode);
    const resetPlayers = this.state.players.map((p) => ({ ...p, dug: 0 }));

    this.transport?.send({
      type: 'next_level',
      seed: nextSeed,
      levelId: nextLvl.id,
      players: resetPlayers,
      width: dims.width,
      height: dims.height
    });

    this.startMatch({
      seed: nextSeed,
      levelId: nextLvl.id,
      mpMode: this.state.mpMode,
      vsBot: this.state.vsBot,
      localPlayerId: this.state.localPlayerId,
      players: resetPlayers,
      width: dims.width,
      height: dims.height,
      transport: this.transport
    });
  }

  handleRemoteMessage(msg: MpMessage) {
    if (msg.type === 'spawn') {
      this.spawnAntInternal(msg.playerId, msg.antType, msg.x, msg.y, msg.angle);
    } else if (msg.type === 'dig') {
      this.digInternal(msg.x, msg.y, msg.radius, msg.damage, msg.playerId, false);
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
      this.sugarExposed = true;
      this.state.sugarFound = true;
      if (this.state.mpMode === 'versus' && !this.state.winnerId) {
        this.state.winnerId = msg.winnerId;
        this.audio.playSugarFound();
        this.callbacks.onVersusEnd(msg.winnerNick, msg.winnerId === this.state.localPlayerId);
      }
    } else if (msg.type === 'vote_start') {
      this.startNextLevelVote(msg.reason, false);
    } else if (msg.type === 'vote_cast') {
      this.state.vote.votes[msg.playerId] = msg.yes;
      this.evaluateVotes();
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

    // 5. Place Sugar Cube fairly near center (guaranteed reachable!)
    let placedSugar = false;
    for (let attempt = 0; attempt < 300; attempt++) {
      const sx = Math.floor(w * 0.5 + (rng() - 0.5) * (w * 0.24));
      const sy = Math.floor(h * 0.5 + (rng() - 0.5) * (h * 0.34));
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
      this.sugarX = cx;
      this.sugarY = cy;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          this.setBlock((cy + dy) * w + (cx + dx), CellType.Sugar);
        }
      }
    }

    // 6. Abundant Skill Crystals scaled by player count so nobody runs short!
    const crystalGoal = 36 + players.length * 14;
    let placed = 0;
    for (let attempt = 0; attempt < crystalGoal * 25 && placed < crystalGoal; attempt++) {
      const lx = Math.floor(w * 0.1 + rng() * (w * 0.8));
      const ly = Math.floor(h * 0.1 + rng() * (h * 0.8));
      const nx = (lx - cx) / (w * 0.41);
      const ny = (ly - cy) / (h * 0.41);
      if (nx * nx + ny * ny > 0.92) continue;
      if (this.tryPlaceCrystal(lx, ly)) placed++;
    }

    // 7. Count breakable blocks inside sanctuary & mark initial edges
    let breakable = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const c = this.cells[idx] as CellType;
        if (c === CellType.SoftSoil || c === CellType.Clay || c === CellType.Stone || c === CellType.Obsidian) {
          const nx = (x - cx) / (w * 0.42);
          const ny = (y - cy) / (h * 0.42);
          if (nx * nx + ny * ny < 0.94) breakable++;
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
    if (Math.hypot(cx - this.sugarX, cy - this.sugarY) < 12) return false;
    for (let dy = -2; dy <= 3; dy++) {
      for (let dx = -2; dx <= 3; dx++) {
        const c = this.cells[(cy + dy) * w + (cx + dx)] as CellType;
        if (c !== CellType.SoftSoil && c !== CellType.Clay && c !== CellType.Stone) return false;
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
  private countAnts(ownerId: string, type: PlayableAntId): number {
    let n = 0;
    for (const a of this.ants) if (a.ownerId === ownerId && a.type === type) n++;
    return n;
  }

  private getCap(type: PlayableAntId): number {
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
      this.callbacks.onToast(`Компас перезаряжается: ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);
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

    this.spawnAntInternal(me.id, type, spawn.x, spawn.y, angle);
    this.transport?.send({ type: 'spawn', playerId: me.id, antType: type, x: spawn.x, y: spawn.y, angle });

    this.audio.ensureStarted();
    if (type === 'compass') this.audio.playCompassLaunch();
    else this.audio.playSpawn();
    this.callbacks.onHudSync();
  }

  private spawnAntInternal(ownerId: string, type: PlayableAntId | 'brood', x: number, y: number, angle: number) {
    const cfg = ANT_TYPES[type];
    const stats = ownerId === this.state.localPlayerId ? this.getLocalColonyStats() : null;
    const lifeMult = stats ? stats.globalLifeMult : 1;

    this.ants.push({
      id: this.nextAntId++,
      ownerId,
      type,
      x,
      y,
      angle,
      fixedAngle: angle,
      age: 0,
      maxAge: type === 'compass' ? 5.0 : cfg.baseLifespan * lifeMult,
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
        const pool: ('sugar_rush' | 'crystal_shower' | 'wild_swarm' | 'quake' | 'royal_blessing')[] = [
          'sugar_rush',
          'crystal_shower',
          'wild_swarm',
          'quake',
          'royal_blessing'
        ];
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        const evSeed = Math.floor(Math.random() * 1_000_000);
        this.transport?.send({ type: 'coop_event', eventId: chosen, seed: evSeed });
        this.applyCoopEvent(chosen, evSeed);
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

    for (let i = this.ants.length - 1; i >= 0; i--) {
      const ant = this.ants[i];
      const cfg = ANT_TYPES[ant.type];
      const isLocal = ant.ownerId === this.state.localPlayerId;
      ant.age += dt;
      if (ant.biteTimer > 0) ant.biteTimer -= dt;
      if (ant.biteFlash > 0) ant.biteFlash = Math.max(0, ant.biteFlash - dt * 5);
      ant.turnTimer -= dt;

      if (ant.age >= ant.maxAge) {
        if (isLocal && ant.type !== 'brood') this.audio.playAntExpire();
        this.ants.splice(i, 1);
        continue;
      }

      if (ant.type === 'queen') {
        ant.spawnTimer -= dt * (isLocal ? localStats.queen.spawnRateMult : 1);
        if (ant.spawnTimer <= 0) {
          ant.spawnTimer = 2.6;
          this.spawnAntInternal(ant.ownerId, 'brood', ant.x, ant.y, Math.random() * Math.PI * 2);
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
        if (ant.type === 'worker') { speedMult = localStats.worker.speedMult; dmg += localStats.worker.dmgBonus; }
        if (ant.type === 'warrior') { speedMult = localStats.warrior.speedMult; dmg += localStats.warrior.dmgBonus; radius += localStats.warrior.radiusBonus; }
        if (ant.type === 'scout') { speedMult = localStats.scout.speedMult; dmg += localStats.scout.dmgBonus; }
        if (ant.type === 'brood') { dmg += localStats.queen.broodDmgBonus; }
      }
      if (ant.type === 'compass') dmg = 1;

      if (this.sugarRushTimer > 0) {
        speedMult *= 1.8;
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
          this.digInternal(nx, ny, radius, dmg, ant.ownerId, isLocal);
          if (ant.type === 'scout') {
            ant.angle += Math.PI * 0.75 + (Math.random() - 0.5) * 0.5;
          }
        }
      }
    }

    this.particles.update(dt);

    this.hudAccum += dt;
    if (this.hudAccum >= 0.35) {
      this.hudAccum = 0;
      this.callbacks.onHudSync();
    }
  }

  /** Rare fun Co-op random events synchronized across all players! */
  private applyCoopEvent(
    eventId: 'sugar_rush' | 'crystal_shower' | 'wild_swarm' | 'quake' | 'royal_blessing',
    evSeed: number
  ) {
    const rng = mulberry32(evSeed);
    this.audio.playMutationSpawn();

    switch (eventId) {
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
            this.spawnAntInternal(pl.id, kind, pl.baseX, pl.baseY, rng() * Math.PI * 2);
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
            trailTimer: 0
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
            this.particles.spawn(this.sugarX, this.sugarY, 255, 245, 175, 34, 42, 2.0, 2.4);

            if (this.state.mpMode === 'versus') {
              this.state.winnerId = ownerId;
              const nick = ownerPlayer?.nick || 'Игрок';
              if (broadcast) this.transport?.send({ type: 'sugar_win', winnerId: ownerId, winnerNick: nick });
              this.callbacks.onVersusEnd(nick, ownerId === this.state.localPlayerId);
            } else {
              // Co-op: trigger vote to move to next map!
              this.callbacks.onSystemChat(`🧊 ${ownerPlayer?.nick || 'Колония'} нашёл сахар!`);
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
      if (this.dugHistory.length < 4000) {
        this.dugHistory.push([Math.round(cx), Math.round(cy), Math.round(radius * 10) / 10, damage]);
      }
      if (broadcast) {
        this.transport?.send({ type: 'dig', playerId: ownerId, x: cx, y: cy, radius, damage });
      }
      // Check if 99%+ of all breakable blocks are eaten in Co-op!
      if (!this.state.allCleared && this.state.dugBreakable >= this.state.totalBreakable * 0.99) {
        this.state.allCleared = true;
        this.callbacks.onAllBlocksCleared();
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
     RENDERER (STYLED BASES + PLAYER SKINS + COLORS + PINGS)
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

    const z = this.camera.zoom;
    const drawW = w * z;
    const drawH = h * z;
    const drawX = this.viewW * 0.5 - this.camera.x * z;
    const drawY = this.viewH * 0.5 - this.camera.y * z;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.offscreen, drawX, drawY, drawW, drawH);

    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.filter = `blur(${Math.max(4, Math.min(10, z * 1.5))}px)`;
    ctx.globalAlpha = 0.56;
    ctx.drawImage(this.glowCanvas, drawX, drawY, drawW, drawH);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

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

    // Ants with each player's chosen SKIN & COLOR!
    for (const ant of this.ants) {
      const owner = this.getPlayer(ant.ownerId);
      const col = owner ? PLAYER_COLORS[owner.colorIndex % PLAYER_COLORS.length] : PLAYER_COLORS[0];
      const skin = owner ? owner.skin : 'classic';
      const sx = drawX + ant.x * z;
      const sy = drawY + ant.y * z;
      drawDetailedAnt(ctx, ant.type, sx, sy, ant.angle, ant.legPhase, ant.biteFlash, z, skin, col.rgb);
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
        this.camera.zoom = Math.max(1.0, Math.min(10, this.camera.zoom * factor));
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
          this.camera.zoom = Math.max(1.0, Math.min(10, this.pinchStartZoom * (dist / this.pinchStartDist)));
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
