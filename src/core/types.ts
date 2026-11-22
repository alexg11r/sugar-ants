export const enum CellType {
  Empty = 0,        // Dug / open void
  SoftSoil = 1,     // HP 3
  Clay = 2,         // HP 8
  Stone = 3,        // HP 18
  Obsidian = 4,     // HP 36
  HiddenArt = 5,    // Indestructible glowing white hidden picture (including frame & easter eggs)
  SkillCrystal = 6, // HP 10 - special crystal granting +1 Skill Point (only visible near tunnels)
  Sugar = 7         // Goal block: completely hidden until exposed!
}

export type PlayableAntId = 'worker' | 'warrior' | 'scout' | 'queen' | 'compass';
export type AntTypeId = PlayableAntId | 'brood';

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

export interface SaveState {
  skillPoints: number;
  nodeRanks: Record<string, number>;
  completedLevels: string[];
  mutationClaimedLevels: string[];
  mutations: MutationId[];
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
  crystalsCollected: number;
  totalCrystals: number;
}
