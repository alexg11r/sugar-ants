import { setLang } from '../core/i18n';
import { LEVELS } from '../core/levels';
import {
  AchievementDef,
  CareerStats,
  GameSettings,
  LevelRecord,
  MutationId,
  PlayableAntId,
  SaveState,
  SkillBranch,
  SkillNodeDef
} from '../core/types';
import { findNewlyEarnedAchievements, getAchievementById } from './achievements';

const STORAGE_KEY = 'sugar_ants_save_v3';

export const BRANCH_COLORS: Record<
  SkillBranch,
  { main: string; glow: string; bg: string; label: string; labelEn: string }
> = {
  worker: {
    main: '#3ce87a',
    glow: 'rgba(60, 232, 122, 0.45)',
    bg: 'rgba(20, 72, 38, 0.55)',
    label: 'Рабочий',
    labelEn: 'Worker'
  },
  warrior: {
    main: '#ff6b2b',
    glow: 'rgba(255, 107, 43, 0.48)',
    bg: 'rgba(85, 32, 12, 0.55)',
    label: 'Воин',
    labelEn: 'Warrior'
  },
  scout: {
    main: '#35d6ff',
    glow: 'rgba(53, 214, 255, 0.45)',
    bg: 'rgba(14, 62, 82, 0.55)',
    label: 'Разведчик',
    labelEn: 'Scout'
  },
  queen: {
    main: '#e04bff',
    glow: 'rgba(224, 75, 255, 0.45)',
    bg: 'rgba(72, 18, 86, 0.55)',
    label: 'Матка',
    labelEn: 'Queen'
  },
  colony: {
    main: '#ffd845',
    glow: 'rgba(255, 216, 69, 0.45)',
    bg: 'rgba(78, 64, 14, 0.55)',
    label: 'Колония',
    labelEn: 'Colony'
  }
};

export const SKILL_NODES: SkillNodeDef[] = [
  // CENTER — Worker (Green)
  {
    id: 'worker_root',
    gx: 0,
    gy: 0,
    branch: 'worker',
    shape: 'square',
    icon: 'ant',
    category: 'Базовый муравей',
    categoryEn: 'Base Ant',
    title: 'Рабочий',
    titleEn: 'Worker',
    description: 'Живёт долго, неспешно ползёт и методично выгрызает мягкую и среднюю породу.',
    descriptionEn: 'Lives long, crawls calmly, and methodically carves through soil and medium rock.',
    cost: 0,
    maxRank: 1,
    requires: []
  },
  {
    id: 'worker_spd',
    gx: 1,
    gy: 0,
    branch: 'worker',
    shape: 'square',
    icon: 'speed',
    category: 'Рабочий',
    categoryEn: 'Worker',
    title: 'Проворные лапки',
    titleEn: 'Nimble Legs',
    description: '+22% к скорости движения и частоте укусов Рабочего.',
    descriptionEn: '+22% Worker movement speed and bite rate.',
    cost: 1,
    maxRank: 3,
    requires: ['worker_root']
  },
  {
    id: 'worker_dmg',
    gx: 0,
    gy: 1,
    branch: 'worker',
    shape: 'square',
    icon: 'sword',
    category: 'Рабочий',
    categoryEn: 'Worker',
    title: 'Крепкие жвалы',
    titleEn: 'Strong Jaws',
    description: '+1 к урону каждого укуса Рабочего.',
    descriptionEn: '+1 damage per Worker bite.',
    cost: 1,
    maxRank: 3,
    requires: ['worker_root']
  },
  {
    id: 'worker_life',
    gx: 0,
    gy: -1,
    branch: 'worker',
    shape: 'circle',
    icon: 'hourglass',
    category: 'Рабочий',
    categoryEn: 'Worker',
    title: 'Долгожитель',
    titleEn: 'Longevity',
    description: '+35% к длительности жизни Рабочих.',
    descriptionEn: '+35% Worker lifespan.',
    cost: 2,
    maxRank: 3,
    requires: ['worker_root']
  },
  {
    id: 'worker_cap',
    gx: 1,
    gy: -1,
    branch: 'worker',
    shape: 'circle',
    icon: 'swarm',
    category: 'Рабочий',
    categoryEn: 'Worker',
    title: 'Больше рабочих',
    titleEn: 'Expanded Workforce',
    description: '+3 к максимуму одновременно активных Рабочих.',
    descriptionEn: '+3 maximum active Workers.',
    cost: 2,
    maxRank: 4,
    requires: ['worker_spd', 'worker_life']
  },
  {
    id: 'worker_evo',
    gx: 1,
    gy: -2,
    branch: 'worker',
    shape: 'square',
    icon: 'evo',
    category: 'Эволюция Рабочего',
    categoryEn: 'Worker Evolution',
    title: 'Эволюция: Титан-труженик',
    titleEn: 'Evolution: Titan Worker',
    description: 'Высшая эволюция Рабочих: +25% к скорости, +2 к урону, +2 к лимиту, широкий проход и 25% шанс изумрудного импульса по соседним блокам!',
    descriptionEn: 'Apex Worker evolution: +25% speed, +2 damage, +2 cap, wider tunnel cleave, and 25% emerald seismic pulse on nearby blocks!',
    cost: 10,
    maxRank: 1,
    requires: ['worker_cap']
  },

  // LEFT — Warrior (Orange/Red — balanced heavy line-breaker!)
  {
    id: 'warrior_unlock',
    gx: -1,
    gy: 0,
    branch: 'warrior',
    shape: 'square',
    icon: 'ant',
    category: 'Новый муравей',
    categoryEn: 'New Ant',
    title: 'Муравей-воин',
    titleEn: 'Warrior Ant',
    description: 'Тяжёлый таран: идёт строго в выбранном направлении и крушит несколько блоков сразу.',
    descriptionEn: 'Heavy battering ram: marches straight along your aimed line and smashes multiple blocks at once.',
    cost: 3,
    maxRank: 1,
    requires: ['worker_root']
  },
  {
    id: 'warrior_dmg',
    gx: -2,
    gy: 0,
    branch: 'warrior',
    shape: 'square',
    icon: 'sword',
    category: 'Воин',
    categoryEn: 'Warrior',
    title: 'Сокрушительный удар',
    titleEn: 'Crushing Blow',
    description: '+1 к урону Воина по всем задетым блокам.',
    descriptionEn: '+1 Warrior damage to all hit blocks.',
    cost: 3,
    maxRank: 4,
    requires: ['warrior_unlock']
  },
  {
    id: 'warrior_cleave',
    gx: -3,
    gy: 0,
    branch: 'warrior',
    shape: 'circle',
    icon: 'cleave',
    category: 'Воин',
    categoryEn: 'Warrior',
    title: 'Широкий захват',
    titleEn: 'Wide Cleave',
    description: 'Увеличивает зону удара Воина, позволяя задевать больше блоков за раз.',
    descriptionEn: 'Expands Warrior strike radius to carve wider passages.',
    cost: 4,
    maxRank: 3,
    requires: ['warrior_dmg']
  },
  {
    id: 'warrior_cap',
    gx: -1,
    gy: 1,
    branch: 'warrior',
    shape: 'circle',
    icon: 'swarm',
    category: 'Воин',
    categoryEn: 'Warrior',
    title: 'Отряд воинов',
    titleEn: 'Warrior Squad',
    description: '+1 к максимуму активных Воинов в колонии.',
    descriptionEn: '+1 maximum active Warriors.',
    cost: 3,
    maxRank: 3,
    requires: ['warrior_unlock']
  },
  {
    id: 'warrior_spd',
    gx: -2,
    gy: 1,
    branch: 'warrior',
    shape: 'circle',
    icon: 'speed',
    category: 'Воин',
    categoryEn: 'Warrior',
    title: 'Натиск',
    titleEn: 'Relentless Charge',
    description: '+20% к скорости шага и частоте ударов Воина.',
    descriptionEn: '+20% Warrior stride speed and attack cadence.',
    cost: 3,
    maxRank: 3,
    requires: ['warrior_dmg', 'warrior_cap']
  },

  // RIGHT / LOWER-RIGHT — Scout (Cyan)
  {
    id: 'scout_unlock',
    gx: 1,
    gy: 1,
    branch: 'scout',
    shape: 'square',
    icon: 'bounce',
    category: 'Новый муравей',
    categoryEn: 'New Ant',
    title: 'Муравей-разведчик',
    titleEn: 'Scout Ant',
    description: 'Стремительный рикошетчик! Быстро разведывает карту и наносит серии укусов при отскоках.',
    descriptionEn: 'Lightning ricochet explorer! Rapidly maps tunnels and chips rock on every bounce.',
    cost: 2,
    maxRank: 1,
    requires: ['worker_spd', 'worker_dmg']
  },
  {
    id: 'scout_spd',
    gx: 2,
    gy: 1,
    branch: 'scout',
    shape: 'square',
    icon: 'speed',
    category: 'Разведчик',
    categoryEn: 'Scout',
    title: 'Реактивный бег',
    titleEn: 'Jet Dash',
    description: '+25% к скорости полёта и рикошетов Разведчика.',
    descriptionEn: '+25% Scout dash and ricochet velocity.',
    cost: 2,
    maxRank: 4,
    requires: ['scout_unlock']
  },
  {
    id: 'scout_poison',
    gx: 3,
    gy: 1,
    branch: 'scout',
    shape: 'circle',
    icon: 'poison',
    category: 'Разведчик',
    categoryEn: 'Scout',
    title: 'Ядовитый рикошет',
    titleEn: 'Venomous Ricochet',
    description: 'При отскоке Разведчик отравляет задетые блоки кислотой — они разъедаются ещё 4.5 сек (до 3.5 урона/сек).',
    descriptionEn: 'On bounce, Scouts coat blocks in acid venom that corrodes rock for 4.5s (up to 3.5 DPS).',
    cost: 3,
    maxRank: 3,
    requires: ['scout_spd']
  },
  {
    id: 'scout_dmg',
    gx: 1,
    gy: 2,
    branch: 'scout',
    shape: 'circle',
    icon: 'sword',
    category: 'Разведчик',
    categoryEn: 'Scout',
    title: 'Острая тычка',
    titleEn: 'Piercing Strike',
    description: '+1 к урону каждого рикошета Разведчика.',
    descriptionEn: '+1 damage on every Scout bounce impact.',
    cost: 3,
    maxRank: 3,
    requires: ['scout_unlock']
  },
  {
    id: 'scout_cap',
    gx: 2,
    gy: 2,
    branch: 'scout',
    shape: 'square',
    icon: 'swarm',
    category: 'Разведчик',
    categoryEn: 'Scout',
    title: 'Стая разведчиков',
    titleEn: 'Scout Pack',
    description: '+3 к максимуму активных Разведчиков.',
    descriptionEn: '+3 maximum active Scouts.',
    cost: 3,
    maxRank: 3,
    requires: ['scout_spd', 'scout_dmg']
  },
  {
    id: 'scout_life',
    gx: 2,
    gy: 0,
    branch: 'scout',
    shape: 'circle',
    icon: 'hourglass',
    category: 'Разведчик',
    categoryEn: 'Scout',
    title: 'Дальний рейд',
    titleEn: 'Long Expedition',
    description: '+40% к времени жизни Разведчика.',
    descriptionEn: '+40% Scout lifespan.',
    cost: 3,
    maxRank: 3,
    requires: ['scout_spd']
  },

  // BOTTOM — Queen (Magenta)
  {
    id: 'queen_unlock',
    gx: 0,
    gy: 2,
    branch: 'queen',
    shape: 'square',
    icon: 'queen',
    category: 'Новый муравей',
    categoryEn: 'New Ant',
    title: 'Матка',
    titleEn: 'Queen Ant',
    description: 'Неспешно ползёт, выпускает выводок и усиливает всех союзных муравьёв в малом радиусе вокруг себя (+35% скорости, +1 урон).',
    descriptionEn: 'Slowly marches, spawns brood, and buffs all nearby allied ants in a small aura (+35% speed, +1 damage).',
    cost: 4,
    maxRank: 1,
    requires: ['worker_dmg', 'scout_unlock']
  },
  {
    id: 'queen_rate',
    gx: 0,
    gy: 3,
    branch: 'queen',
    shape: 'circle',
    icon: 'brood',
    category: 'Матка',
    categoryEn: 'Queen',
    title: 'Плодовитость',
    titleEn: 'Fertility',
    description: 'Матка выпускает маленьких муравьёв на 25% чаще.',
    descriptionEn: 'Queens hatch mini-ant brood 25% more often.',
    cost: 4,
    maxRank: 3,
    requires: ['queen_unlock']
  },
  {
    id: 'queen_brood_dmg',
    gx: -1,
    gy: 2,
    branch: 'queen',
    shape: 'square',
    icon: 'sword',
    category: 'Матка',
    categoryEn: 'Queen',
    title: 'Зубастый выводок',
    titleEn: 'Fierce Brood',
    description: '+1 к урону маленьких муравьёв Матки.',
    descriptionEn: '+1 damage for Queen mini-ant brood.',
    cost: 4,
    maxRank: 3,
    requires: ['queen_unlock']
  },
  {
    id: 'queen_brood_life',
    gx: -1,
    gy: 3,
    branch: 'queen',
    shape: 'circle',
    icon: 'hourglass',
    category: 'Матка',
    categoryEn: 'Queen',
    title: 'Королевская свита',
    titleEn: 'Royal Retinue',
    description: '+1 к лимиту Маток и +35% к жизни маленьких муравьёв.',
    descriptionEn: '+1 max active Queens and +35% brood lifespan.',
    cost: 5,
    maxRank: 3,
    requires: ['queen_rate', 'queen_brood_dmg']
  },

  // TOP — Colony (Yellow)
  {
    id: 'colony_life',
    gx: -1,
    gy: -1,
    branch: 'colony',
    shape: 'square',
    icon: 'hourglass',
    category: 'Колония',
    categoryEn: 'Colony',
    title: 'Долгая жизнь',
    titleEn: 'Enduring Colony',
    description: '+25% к времени жизни ВСЕХ муравьёв в колонии.',
    descriptionEn: '+25% lifespan for ALL ants in your colony.',
    cost: 3,
    maxRank: 4,
    requires: ['worker_life', 'warrior_unlock']
  },
  {
    id: 'colony_crystal',
    gx: -1,
    gy: -2,
    branch: 'colony',
    shape: 'circle',
    icon: 'crystal',
    category: 'Колония',
    categoryEn: 'Colony',
    title: 'Чистый кристалл',
    titleEn: 'Pure Crystal',
    description: '+1 дополнительное очко навыков с каждого найденного кристалла.',
    descriptionEn: '+1 extra Skill Point from every broken crystal.',
    cost: 6,
    maxRank: 2,
    requires: ['colony_life']
  },
  {
    id: 'colony_armor',
    gx: 0,
    gy: -2,
    branch: 'colony',
    shape: 'circle',
    icon: 'cleave',
    category: 'Колония',
    categoryEn: 'Colony',
    title: 'Камнееды',
    titleEn: 'Stone Eaters',
    description: '+1 бонусный урон всех муравьёв по плотной глине, камню и базальту.',
    descriptionEn: '+1 bonus damage for all ants against dense Clay, Stone, and Obsidian.',
    cost: 5,
    maxRank: 3,
    requires: ['worker_life', 'colony_life']
  }
];

export interface ColonyStats {
  globalLifeMult: number;
  globalSpeedMult: number;
  crystalBonus: number;
  crystalLuckChance: number;
  hardBlockBonusDmg: number;
  queenAnomaly: boolean;
  farSense: boolean;
  compassCooldownSec: number;
  compassDuration: number;
  worker: { speedMult: number; dmgBonus: number; lifeMult: number; maxActive: number; evolved: boolean };
  warrior: { speedMult: number; dmgBonus: number; radiusBonus: number; maxActive: number };
  scout: { speedMult: number; dmgBonus: number; lifeMult: number; maxActive: number; poisonRank: number };
  queen: { spawnRateMult: number; broodDmgBonus: number; broodLifeMult: number; maxActive: number };
}

function createDefaultSettings(): GameSettings {
  return {
    language: 'ru',
    soundtrack: 'emerald',
    autoSwitchTrack: true,
    musicEnabled: true,
    sfxEnabled: true,
    musicVolume: 0.65,
    sfxVolume: 0.75,
    autoSummon: false
  };
}

function createDefaultAntSpawns(): Record<PlayableAntId, number> {
  return {
    worker: 0,
    warrior: 0,
    scout: 0,
    queen: 0,
    compass: 0
  };
}

function createDefaultCareer(): CareerStats {
  return {
    antsSpawned: 0,
    blocksDug: 0,
    crystalsCollected: 0,
    mapsCleared: 0,
    totalPlaySec: 0,
    sugarsFound: 0,
    sporesBlasted: 0,
    sugarDustFound: 0,
    cocoonsHatched: 0,
    antSpawnsByType: createDefaultAntSpawns()
  };
}

export function createEmptyRecord(): LevelRecord {
  return {
    bestSugarSec: null,
    bestClearSec: null,
    maxArtPct: 0,
    maxDigPct: 0,
    cleared100: false,
    sugarFound: false,
    plays: 0,
    wins: 0,
    discoveredAt: null
  };
}

function createDefaultSave(): SaveState {
  return {
    skillPoints: 0,
    nodeRanks: { worker_root: 1 },
    completedLevels: [],
    mutationClaimedLevels: [],
    mutations: [],
    artifacts: [],
    achievements: [],
    career: createDefaultCareer(),
    records: {},
    currentLevelId: 'prism',
    settings: createDefaultSettings()
  };
}

export class SkillTreeManager {
  state: SaveState;
  onAchievementUnlocked: ((ach: AchievementDef) => void) | null = null;
  private saveThrottleDirty = false;
  private lastBgSaveMs = 0;

  constructor() {
    this.state = this.load();
    setLang(this.state.settings.language);
  }

  private load(): SaveState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultSave();
      const parsed = JSON.parse(raw) as Partial<SaveState>;
      const def = createDefaultSave();
      const ranks = { ...def.nodeRanks, ...(parsed.nodeRanks || {}) };
      ranks.worker_root = 1;

      const parsedSettings = (parsed.settings || {}) as Partial<GameSettings>;
      const legacyVol = typeof parsedSettings.volume === 'number' ? parsedSettings.volume : undefined;
      const settings: GameSettings = {
        ...createDefaultSettings(),
        ...parsedSettings,
        language: parsedSettings.language === 'en' ? 'en' : 'ru',
        musicVolume:
          typeof parsedSettings.musicVolume === 'number'
            ? parsedSettings.musicVolume
            : (legacyVol ?? 0.65),
        sfxVolume:
          typeof parsedSettings.sfxVolume === 'number'
            ? parsedSettings.sfxVolume
            : (legacyVol ?? 0.75)
      };

      const completedLevels = Array.isArray(parsed.completedLevels) ? parsed.completedLevels : [];
      const records: Record<string, LevelRecord> = {};
      if (parsed.records && typeof parsed.records === 'object') {
        for (const [k, v] of Object.entries(parsed.records)) {
          records[k] = { ...createEmptyRecord(), ...(v || {}) };
        }
      }
      // Migrate existing completed levels into Gallery records cleanly!
      for (const lvlId of completedLevels) {
        if (!records[lvlId]) records[lvlId] = createEmptyRecord();
        records[lvlId].sugarFound = true;
        if (!records[lvlId].discoveredAt) records[lvlId].discoveredAt = Date.now();
      }

      const parsedCareer = (parsed.career || {}) as Partial<CareerStats>;
      const career: CareerStats = {
        ...createDefaultCareer(),
        ...parsedCareer,
        sugarsFound:
          typeof parsedCareer.sugarsFound === 'number'
            ? parsedCareer.sugarsFound
            : completedLevels.length,
        antSpawnsByType: {
          ...createDefaultAntSpawns(),
          ...(parsedCareer.antSpawnsByType || {})
        }
      };

      return {
        skillPoints: typeof parsed.skillPoints === 'number' ? parsed.skillPoints : 0,
        nodeRanks: ranks,
        completedLevels,
        mutationClaimedLevels: Array.isArray(parsed.mutationClaimedLevels)
          ? parsed.mutationClaimedLevels
          : [],
        mutations: Array.isArray(parsed.mutations) ? (parsed.mutations as MutationId[]) : [],
        artifacts: Array.isArray(parsed.artifacts) ? (parsed.artifacts as string[]) : [],
        achievements: Array.isArray(parsed.achievements) ? (parsed.achievements as string[]) : [],
        career,
        records,
        currentLevelId: typeof parsed.currentLevelId === 'string' ? parsed.currentLevelId : def.currentLevelId,
        settings
      };
    } catch {
      return createDefaultSave();
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore quota errors
    }
  }

  resetAllProgress() {
    const prevSettings = { ...this.state.settings };
    this.state = createDefaultSave();
    this.state.settings = prevSettings;
    this.save();
  }

  /** Resets skill tree & skill points for a fresh level run, applying permanent mutations & secret artifacts! */
  resetTreeForNewLevel(levelId: string) {
    this.state.currentLevelId = levelId;
    this.state.nodeRanks = { worker_root: 1 };
    const mutBonus = this.hasMutation('start_sp_3') ? 3 : 0;
    const artifactBonus = this.state.artifacts.length;
    this.state.skillPoints = mutBonus + artifactBonus;
    this.recordLevelStart(levelId);
    this.save();
  }

  getRecord(levelId: string): LevelRecord {
    if (!this.state.records[levelId]) {
      this.state.records[levelId] = createEmptyRecord();
    }
    return this.state.records[levelId];
  }

  isLevelDiscoveredInGallery(levelId: string): boolean {
    if (this.state.completedLevels.includes(levelId)) return true;
    const rec = this.state.records[levelId];
    return Boolean(rec && (rec.sugarFound || rec.cleared100));
  }

  getDiscoveredGalleryCount(): number {
    let count = 0;
    for (const lvl of LEVELS) {
      if (this.isLevelDiscoveredInGallery(lvl.id)) count++;
    }
    return count;
  }

  recordLevelStart(levelId: string) {
    const rec = this.getRecord(levelId);
    rec.plays += 1;
  }

  recordLevelProgress(levelId: string, digPct: number, artPct: number) {
    const rec = this.getRecord(levelId);
    let changed = false;
    if (digPct > rec.maxDigPct) {
      rec.maxDigPct = Math.min(100, Math.round(digPct));
      changed = true;
    }
    if (artPct > rec.maxArtPct) {
      rec.maxArtPct = Math.min(100, Math.round(artPct));
      changed = true;
    }
    if (changed) {
      this.saveThrottleDirty = true;
    }
  }

  recordSugarWin(levelId: string, runElapsedSec: number) {
    const rec = this.getRecord(levelId);
    rec.sugarFound = true;
    rec.wins += 1;
    if (!rec.discoveredAt) rec.discoveredAt = Date.now();
    if (runElapsedSec > 0 && (rec.bestSugarSec === null || runElapsedSec < rec.bestSugarSec)) {
      rec.bestSugarSec = Math.round(runElapsedSec);
    }
    this.state.career.sugarsFound += 1;
    this.markLevelCompleted(levelId);
    this.save();
  }

  recordMapClear(levelId: string, runElapsedSec: number) {
    const rec = this.getRecord(levelId);
    rec.cleared100 = true;
    rec.sugarFound = true;
    rec.maxDigPct = 100;
    rec.maxArtPct = 100;
    if (!rec.discoveredAt) rec.discoveredAt = Date.now();
    if (runElapsedSec > 0 && (rec.bestClearSec === null || runElapsedSec < rec.bestClearSec)) {
      rec.bestClearSec = Math.round(runElapsedSec);
    }
    this.markLevelCompleted(levelId);
    this.recordCareer({ mapsCleared: 1 });
    this.save();
  }

  recordAntSpawn(type: PlayableAntId) {
    this.state.career.antSpawnsByType[type] = (this.state.career.antSpawnsByType[type] || 0) + 1;
    this.recordCareer({ antsSpawned: 1 });
  }

  recordPlayTime(dtSec: number) {
    if (dtSec <= 0) return;
    this.state.career.totalPlaySec += dtSec;
    this.saveThrottleDirty = true;
  }

  hasArtifact(id: string): boolean {
    return this.state.artifacts.includes(id);
  }

  /** Permanently records a discovered collectible artifact and grants +1 immediate SP (+1 permanent starting SP!) */
  collectArtifact(id: string): boolean {
    if (this.state.artifacts.includes(id)) return false;
    this.state.artifacts.push(id);
    this.state.skillPoints += 1;
    this.save();
    this.evaluateAchievements();
    return true;
  }

  /** Permanent +1% speed to ALL ants for each unlocked achievement! */
  getAchievementSpeedMult(): number {
    return 1 + this.state.achievements.length * 0.01;
  }

  /** Explicitly unlock a trigger-based achievement (compass, zoom_macro, coop_play, etc.) */
  unlockAchievement(id: string): boolean {
    if (this.state.achievements.includes(id)) return false;
    const def = getAchievementById(id);
    if (!def) return false;
    this.state.achievements.push(id);
    this.save();
    this.onAchievementUnlocked?.(def);
    return true;
  }

  /** Evaluates all progress-based achievements and emits callbacks for any newly earned ones */
  evaluateAchievements() {
    const newlyEarned = findNewlyEarnedAchievements(this.state);
    if (newlyEarned.length === 0) return;
    for (const ach of newlyEarned) {
      if (!this.state.achievements.includes(ach.id)) {
        this.state.achievements.push(ach.id);
      }
    }
    this.save();
    for (const ach of newlyEarned) {
      this.onAchievementUnlocked?.(ach);
    }
  }

  recordCareer(patch: Partial<CareerStats>) {
    if (patch.antsSpawned) this.state.career.antsSpawned += patch.antsSpawned;
    if (patch.blocksDug) this.state.career.blocksDug += patch.blocksDug;
    if (patch.crystalsCollected) this.state.career.crystalsCollected += patch.crystalsCollected;
    if (patch.mapsCleared) this.state.career.mapsCleared += patch.mapsCleared;
    if (patch.sporesBlasted) this.state.career.sporesBlasted += patch.sporesBlasted;
    if (patch.sugarDustFound) this.state.career.sugarDustFound += patch.sugarDustFound;
    if (patch.cocoonsHatched) this.state.career.cocoonsHatched += patch.cocoonsHatched;
    if (patch.sugarsFound) this.state.career.sugarsFound += patch.sugarsFound;

    this.evaluateAchievements();

    // Throttle frequent dig saves to once every 3s (immediate save for milestones)
    const now = Date.now();
    if (patch.mapsCleared || patch.crystalsCollected || now - this.lastBgSaveMs >= 3000) {
      this.lastBgSaveMs = now;
      this.saveThrottleDirty = false;
      this.save();
    } else {
      this.saveThrottleDirty = true;
    }
  }

  flushPendingSave() {
    if (this.saveThrottleDirty) {
      this.saveThrottleDirty = false;
      this.lastBgSaveMs = Date.now();
      this.save();
    }
  }

  hasMutation(id: MutationId): boolean {
    return this.state.mutations.includes(id);
  }

  addMutation(id: MutationId, forLevelId: string) {
    if (!this.state.mutations.includes(id)) {
      this.state.mutations.push(id);
    }
    if (!this.state.mutationClaimedLevels.includes(forLevelId)) {
      this.state.mutationClaimedLevels.push(forLevelId);
    }
    this.save();
    this.evaluateAchievements();
  }

  hasClaimedMutationForLevel(levelId: string): boolean {
    return this.state.mutationClaimedLevels.includes(levelId);
  }

  isLevelUnlocked(levelId: string): boolean {
    const idx = LEVELS.findIndex((l) => l.id === levelId);
    if (idx <= 0) return true;
    const prevLevel = LEVELS[idx - 1];
    return this.state.completedLevels.includes(prevLevel.id);
  }

  getHighestUnlockedLevelId(): string {
    let lastUnlocked = LEVELS[0].id;
    for (const lvl of LEVELS) {
      if (this.isLevelUnlocked(lvl.id)) {
        lastUnlocked = lvl.id;
      }
    }
    return lastUnlocked;
  }

  updateSettings(patch: Partial<GameSettings>) {
    this.state.settings = { ...this.state.settings, ...patch };
    if (patch.language) {
      setLang(patch.language);
    }
    this.save();
  }

  addSkillPoints(amount: number) {
    this.state.skillPoints += amount;
    this.save();
  }

  getRank(nodeId: string): number {
    return this.state.nodeRanks[nodeId] || 0;
  }

  isNodeVisible(node: SkillNodeDef): boolean {
    if (node.requires.length === 0) return true;
    if (this.getRank(node.id) > 0) return true;
    return node.requires.some((reqId) => this.getRank(reqId) > 0);
  }

  isNodeUnlockedForPurchase(node: SkillNodeDef): boolean {
    if (node.requires.length === 0) return true;
    return node.requires.some((reqId) => this.getRank(reqId) > 0);
  }

  getNodeCost(node: SkillNodeDef): number {
    const rank = this.getRank(node.id);
    if (node.maxRank <= 1) return node.cost;
    return Math.round(node.cost * Math.pow(1.6, rank));
  }

  canBuyNode(node: SkillNodeDef): boolean {
    const rank = this.getRank(node.id);
    if (rank >= node.maxRank) return false;
    if (!this.isNodeUnlockedForPurchase(node)) return false;
    return this.state.skillPoints >= this.getNodeCost(node);
  }

  buyNode(nodeId: string): boolean {
    const node = SKILL_NODES.find((n) => n.id === nodeId);
    if (!node || !this.canBuyNode(node)) return false;
    const cost = this.getNodeCost(node);
    this.state.skillPoints -= cost;
    this.state.nodeRanks[nodeId] = this.getRank(nodeId) + 1;
    this.save();
    this.evaluateAchievements();
    return true;
  }

  isAntUnlocked(id: PlayableAntId): boolean {
    if (id === 'worker' || id === 'compass') return true;
    if (id === 'warrior') return this.getRank('warrior_unlock') > 0;
    if (id === 'scout') return this.getRank('scout_unlock') > 0;
    if (id === 'queen') return this.getRank('queen_unlock') > 0;
    return false;
  }

  hasAffordableNode(): boolean {
    return SKILL_NODES.some((n) => this.canBuyNode(n));
  }

  markLevelCompleted(levelId: string) {
    if (!this.state.completedLevels.includes(levelId)) {
      this.state.completedLevels.push(levelId);
      this.save();
      this.evaluateAchievements();
    }
  }

  getColonyStats(): ColonyStats {
    const r = (id: string) => this.getRank(id);
    const echoMult = this.hasMutation('colony_echo') ? 1.3 : 1.0;
    const metabMult = this.hasMutation('fast_metabolism') ? 1.18 : 1.0;
    const achSpeedMult = this.getAchievementSpeedMult();
    const totalGlobalSpeed = metabMult * achSpeedMult;
    const acidBonus = this.hasMutation('acid_jaws') ? 1 : 0;
    const twinBonus = this.hasMutation('twin_workers') ? 2 : 0;
    const hasCompassMut = this.hasMutation('compass_cd');
    const workerEvo = r('worker_evo') > 0;

    return {
      globalLifeMult: (1 + r('colony_life') * 0.25) * echoMult,
      globalSpeedMult: totalGlobalSpeed,
      crystalBonus: r('colony_crystal'),
      crystalLuckChance: this.hasMutation('crystal_luck') ? 0.25 : 0,
      hardBlockBonusDmg: r('colony_armor') + acidBonus,
      queenAnomaly: this.hasMutation('queen_anomaly'),
      farSense: this.hasMutation('far_sense'),
      compassCooldownSec: hasCompassMut ? 78 : 120,
      compassDuration: hasCompassMut ? 9.0 : 6.5,
      worker: {
        speedMult: (1 + r('worker_spd') * 0.22) * (workerEvo ? 1.25 : 1) * totalGlobalSpeed,
        dmgBonus: r('worker_dmg') + (workerEvo ? 2 : 0),
        lifeMult: 1 + r('worker_life') * 0.35,
        maxActive: 6 + twinBonus + r('worker_cap') * 3 + (workerEvo ? 2 : 0),
        evolved: workerEvo
      },
      warrior: {
        speedMult: (1 + r('warrior_spd') * 0.2) * totalGlobalSpeed,
        dmgBonus: r('warrior_dmg'),
        radiusBonus: r('warrior_cleave') * 0.45,
        maxActive: 2 + r('warrior_cap')
      },
      scout: {
        speedMult: (1 + r('scout_spd') * 0.25) * totalGlobalSpeed,
        dmgBonus: r('scout_dmg'),
        lifeMult: 1 + r('scout_life') * 0.4,
        maxActive: 4 + r('scout_cap') * 3,
        poisonRank: r('scout_poison')
      },
      queen: {
        spawnRateMult: (1 + r('queen_rate') * 0.25) * totalGlobalSpeed,
        broodDmgBonus: r('queen_brood_dmg'),
        broodLifeMult: 1 + r('queen_brood_life') * 0.35,
        maxActive: 1 + r('queen_brood_life')
      }
    };
  }
}
