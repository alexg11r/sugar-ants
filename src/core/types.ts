export const enum CellType {
  Empty = 0,          // Dug / open void
  SoftSoil = 1,       // HP 3
  Clay = 2,           // HP 8
  Stone = 3,          // HP 18
  Obsidian = 4,       // HP 36
  HiddenArt = 5,      // Indestructible glowing white hidden picture (including frame & easter eggs)
  SkillCrystal = 6,   // HP 10 - special crystal granting +1 Skill Point (only visible near tunnels)
  Sugar = 7,          // Goal block: completely hidden until exposed!
  Artifact = 8,       // Secret collectible artifact (e.g. Креветочка Руся) -> permanent +1 SP!
  ExplosiveSpore = 9, // Volatile subterranean spore bulb -> blasts a neat cavern!
  SugarDust = 10,     // Golden crystal vein -> triggers 15s ×1.6 Sugar Rush!
  AncientCocoon = 11  // Silk pod -> hatches 3 free allied bonus ants deep in the tunnel!
}

export type Language = 'ru' | 'en';

export type PlayableAntId = 'worker' | 'warrior' | 'scout' | 'queen' | 'compass';
export type AntTypeId = PlayableAntId | 'brood';
export type AntSkinId = 'classic' | 'cyber' | 'royal';

export interface PlayerColorDef {
  id: string;
  name: string;
  nameEn: string;
  hex: string;
  rgb: [number, number, number];
}

export const PLAYER_COLORS: PlayerColorDef[] = [
  { id: 'emerald', name: 'Изумруд', nameEn: 'Emerald', hex: '#3ce87a', rgb: [60, 232, 122] },
  { id: 'crimson', name: 'Алый', nameEn: 'Crimson', hex: '#ff4d6d', rgb: [255, 77, 109] },
  { id: 'cyan', name: 'Лазурь', nameEn: 'Cyan', hex: '#35d6ff', rgb: [53, 214, 255] },
  { id: 'violet', name: 'Фиолет', nameEn: 'Violet', hex: '#d45cff', rgb: [212, 92, 255] },
  { id: 'amber', name: 'Янтарь', nameEn: 'Amber', hex: '#ff9d42', rgb: [255, 157, 66] },
  { id: 'lime', name: 'Лайм', nameEn: 'Lime', hex: '#a6ff4d', rgb: [166, 255, 77] },
  { id: 'coral', name: 'Коралл', nameEn: 'Coral', hex: '#ff7b54', rgb: [255, 123, 84] },
  { id: 'teal', name: 'Бирюза', nameEn: 'Teal', hex: '#2ef2c9', rgb: [46, 242, 201] },
  { id: 'gold', name: 'Золото', nameEn: 'Gold', hex: '#ffe066', rgb: [255, 224, 102] },
  { id: 'pink', name: 'Розовый', nameEn: 'Pink', hex: '#ff70c8', rgb: [255, 112, 200] }
];

export interface AntTypeConfig {
  id: AntTypeId;
  name: string;
  nameEn: string;
  shortName: string;
  shortNameEn: string;
  description: string;
  descriptionEn: string;
  color: string;
  rgb: [number, number, number];
  hotkey: string;
  baseSpeed: number;
  baseDamage: number;
  baseBiteInterval: number;
  baseLifespan: number;
  baseMaxActive: number;
  baseRadius: number;
  scale: number;
  cooldownSec?: number;
}

export interface Ant {
  id: number;
  type: AntTypeId;
  x: number;
  y: number;
  angle: number;
  fixedAngle: number;
  age: number;
  maxAge: number;
  biteTimer: number;
  biteFlash: number;
  turnTimer: number;
  spawnTimer: number;
  legPhase: number;
  trailTimer: number;
  fromQueen?: boolean;
  /** Temporary obstacle wall-slide timer so beacon-guided ants smoothly skirt HiddenArt walls instead of sticking! */
  wallSlideTimer?: number;
  wallSlideDir?: number;
  /** True when currently inside a Queen's tiny royal buff aura */
  queenBuffed?: boolean;
}

export interface ScentPoint {
  x: number;
  y: number;
  angle: number;
  life: number;
  maxLife: number;
}

export interface PheromoneBeacon {
  x: number;
  y: number;
  timeLeft: number;
  maxDuration: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  g: number;
  b: number;
  life: number;
  maxLife: number;
  size: number;
}

export type SkillBranch = 'worker' | 'warrior' | 'scout' | 'queen' | 'colony';
export type SkillShape = 'square' | 'circle';
export type SkillIcon =
  | 'ant'
  | 'sword'
  | 'speed'
  | 'hourglass'
  | 'cleave'
  | 'bounce'
  | 'queen'
  | 'brood'
  | 'crystal'
  | 'swarm'
  | 'compass'
  | 'poison'
  | 'evo'
  | 'radar'
  | 'beacon';

export interface SkillNodeDef {
  id: string;
  gx: number;
  gy: number;
  branch: SkillBranch;
  shape: SkillShape;
  icon: SkillIcon;
  /** Optional 'side' panel renders standalone general colony upgrades beside the main ant tree */
  panel?: 'side';
  category: string;
  categoryEn: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  cost: number;
  maxRank: number;
  requires: string[];
}

export type MutationId =
  | 'start_sp_3'
  | 'queen_anomaly'
  | 'acid_jaws'
  | 'far_sense'
  | 'colony_echo'
  | 'fast_metabolism'
  | 'twin_workers'
  | 'compass_cd'
  | 'crystal_luck';

export interface MutationDef {
  id: MutationId;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  accent: string;
  icon: string;
}

export type SoundtrackId =
  | 'emerald'
  | 'triphop'
  | 'triphop_dub'
  | 'triphop_velvet'
  | 'aphex'
  | 'lunar'
  | 'deep_nest'
  | 'starlight';

export type AutoSummonMode = 'smart' | 'beacon' | 'nest';
export type DisplayMode = 'fullscreen' | 'windowed';
export type ResolutionId = 'auto' | '1280x720' | '1366x768' | '1600x900' | '1920x1080' | '2560x1440';

export interface GameSettings {
  language: Language;
  soundtrack: SoundtrackId;
  autoSwitchTrack: boolean;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  musicVolume: number;
  sfxVolume: number;
  /** Legacy unified volume field kept optional for seamless save migration */
  volume?: number;
  autoSummon: boolean;
  autoSummonMode: AutoSummonMode;
  autoSummonTypes: Record<PlayableAntId, boolean>;
  displayMode: DisplayMode;
  resolution: ResolutionId;
}

export interface ArtifactDef {
  id: string;
  levelId: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  accent: string;
  rgb: [number, number, number];
}

export interface LevelRecord {
  bestSugarSec: number | null;
  bestClearSec: number | null;
  maxArtPct: number;
  maxDigPct: number;
  cleared100: boolean;
  sugarFound: boolean;
  plays: number;
  wins: number;
  discoveredAt: number | null;
}

export interface CareerStats {
  antsSpawned: number;
  blocksDug: number;
  crystalsCollected: number;
  mapsCleared: number;
  totalPlaySec: number;
  sugarsFound: number;
  sporesBlasted: number;
  sugarDustFound: number;
  cocoonsHatched: number;
  antSpawnsByType: Record<PlayableAntId, number>;
}

export interface AchievementDef {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  accent: string;
  goal: number;
  getProgress: (state: SaveState) => number;
}

export interface SaveState {
  skillPoints: number;
  nodeRanks: Record<string, number>;
  completedLevels: string[];
  mutationClaimedLevels: string[];
  mutations: MutationId[];
  artifacts: string[];
  achievements: string[];
  career: CareerStats;
  records: Record<string, LevelRecord>;
  currentLevelId: string;
  settings: GameSettings;
}

export interface LevelPalette {
  bgHex: string;
  bgRgb: [number, number, number];
  emptyRgb: [number, number, number];
  softRgb: [number, number, number];
  clayRgb: [number, number, number];
  stoneRgb: [number, number, number];
  obsidianRgb: [number, number, number];
  artGlowRgb: [number, number, number];
  accentHex: string;
}

export interface LevelDefinition {
  id: string;
  name: string;
  nameEn: string;
  subtitle: string;
  subtitleEn: string;
  width: number;
  height: number;
  crystalCount: number;
  /** Geological difficulty multiplier (default 1.0; >1 increases rock density & obsidian depth) */
  difficulty?: number;
  difficultyLabel?: 'hard' | 'extreme';
  palette: LevelPalette;
  generateArt: (w: number, h: number) => Uint8Array;
}

export interface WorldStats {
  totalBreakable: number;
  dugBreakable: number;
  totalArt: number;
  revealedArt: number;
  sugarFound: boolean;
  mapCleared: boolean;
  artifactCollected: boolean;
  crystalsCollected: number;
  totalCrystals: number;
}
