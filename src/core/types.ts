export const enum CellType {
  Empty = 0,        // Dug / open void
  SoftSoil = 1,     // HP 3
  Clay = 2,         // HP 8
  Stone = 3,        // HP 18
  Obsidian = 4,     // HP 36
  HiddenArt = 5,    // Indestructible glowing white hidden picture (including frame & easter eggs)
  SkillCrystal = 6, // HP 10 - special crystal granting +1 Skill Point (only visible near tunnels)
  Sugar = 7,        // Goal block: completely hidden until exposed!
  Artifact = 8      // Secret collectible artifact (e.g. Креветочка Руся) -> permanent +1 SP!
}

export type PlayableAntId = 'worker' | 'warrior' | 'scout' | 'queen' | 'compass';
export type AntTypeId = PlayableAntId | 'brood';
export type AntSkinId = 'classic' | 'cyber' | 'royal';

export interface PlayerColorDef {
  id: string;
  name: string;
  hex: string;
  rgb: [number, number, number];
}

export const PLAYER_COLORS: PlayerColorDef[] = [
  { id: 'emerald', name: 'Изумруд', hex: '#3ce87a', rgb: [60, 232, 122] },
  { id: 'crimson', name: 'Алый', hex: '#ff4d6d', rgb: [255, 77, 109] },
  { id: 'cyan', name: 'Лазурь', hex: '#35d6ff', rgb: [53, 214, 255] },
  { id: 'violet', name: 'Фиолет', hex: '#d45cff', rgb: [212, 92, 255] },
  { id: 'amber', name: 'Янтарь', hex: '#ff9d42', rgb: [255, 157, 66] },
  { id: 'lime', name: 'Лайм', hex: '#a6ff4d', rgb: [166, 255, 77] },
  { id: 'coral', name: 'Коралл', hex: '#ff7b54', rgb: [255, 123, 84] },
  { id: 'teal', name: 'Бирюза', hex: '#2ef2c9', rgb: [46, 242, 201] },
  { id: 'gold', name: 'Золото', hex: '#ffe066', rgb: [255, 224, 102] },
  { id: 'pink', name: 'Розовый', hex: '#ff70c8', rgb: [255, 112, 200] }
];

export interface AntTypeConfig {
  id: AntTypeId;
  name: string;
  shortName: string;
  description: string;
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
  | 'compass';

export interface SkillNodeDef {
  id: string;
  gx: number;
  gy: number;
  branch: SkillBranch;
  shape: SkillShape;
  icon: SkillIcon;
  category: string;
  title: string;
  description: string;
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
  description: string;
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

export interface GameSettings {
  soundtrack: SoundtrackId;
  autoSwitchTrack: boolean;
  musicEnabled: boolean;
  sfxEnabled: boolean;
  volume: number;
}

export interface ArtifactDef {
  id: string;
  levelId: string;
  name: string;
  description: string;
  accent: string;
  rgb: [number, number, number];
}

export interface CareerStats {
  antsSpawned: number;
  blocksDug: number;
  crystalsCollected: number;
  mapsCleared: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
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
  subtitle: string;
  width: number;
  height: number;
  crystalCount: number;
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
