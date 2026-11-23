import { LEVELS } from '../core/levels';
import {
  GameSettings,
  MutationId,
  PlayableAntId,
  SaveState,
  SkillBranch,
  SkillNodeDef
} from '../core/types';

const STORAGE_KEY = 'sugar_ants_save_v3';

export const BRANCH_COLORS: Record<SkillBranch, { main: string; glow: string; bg: string; label: string }> = {
  worker: {
    main: '#3ce87a',
    glow: 'rgba(60, 232, 122, 0.45)',
    bg: 'rgba(20, 72, 38, 0.55)',
    label: 'Рабочий'
  },
  warrior: {
    main: '#ff6b2b',
    glow: 'rgba(255, 107, 43, 0.48)',
    bg: 'rgba(85, 32, 12, 0.55)',
    label: 'Воин'
  },
  scout: {
    main: '#35d6ff',
    glow: 'rgba(53, 214, 255, 0.45)',
    bg: 'rgba(14, 62, 82, 0.55)',
    label: 'Разведчик'
  },
  queen: {
    main: '#e04bff',
    glow: 'rgba(224, 75, 255, 0.45)',
    bg: 'rgba(72, 18, 86, 0.55)',
    label: 'Матка'
  },
  colony: {
    main: '#ffd845',
    glow: 'rgba(255, 216, 69, 0.45)',
    bg: 'rgba(78, 64, 14, 0.55)',
    label: 'Колония'
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
    title: 'Рабочий',
    description: 'Живёт долго, неспешно ползёт и методично выгрызает мягкую и среднюю породу.',
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
    title: 'Проворные лапки',
    description: '+22% к скорости движения и частоте укусов Рабочего.',
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
    title: 'Крепкие жвалы',
    description: '+1 к урону каждого укуса Рабочего.',
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
    title: 'Долгожитель',
    description: '+35% к длительности жизни Рабочих.',
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
    title: 'Больше рабочих',
    description: '+3 к максимуму одновременно активных Рабочих.',
    cost: 2,
    maxRank: 4,
    requires: ['worker_spd', 'worker_life']
  },

  // LEFT — Warrior (Orange/Red)
  {
    id: 'warrior_unlock',
    gx: -1,
    gy: 0,
    branch: 'warrior',
    shape: 'square',
    icon: 'ant',
    category: 'Новый муравей',
    title: 'Муравей-воин',
    description: 'Идёт строго в выбранном направлении и бьёт сразу по нескольким блокам.',
    cost: 2,
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
    title: 'Сокрушительный удар',
    description: '+2 к урону Воина по всем задетым блокам.',
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
    title: 'Широкий захват',
    description: 'Увеличивает зону удара Воина, позволяя крушить ещё больше блоков за раз.',
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
    title: 'Отряд воинов',
    description: '+2 к максимуму активных Воинов в колонии.',
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
    title: 'Натиск',
    description: '+22% к скорости шага и частоте ударов Воина.',
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
    title: 'Муравей-разведчик',
    description: 'Очень быстрый! Отскакивает от блоков, давая им лёгкую тычку при каждом ударе.',
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
    title: 'Реактивный бег',
    description: '+25% к скорости полёта и рикошетов Разведчика.',
    cost: 2,
    maxRank: 4,
    requires: ['scout_unlock']
  },
  {
    id: 'scout_dmg',
    gx: 1,
    gy: 2,
    branch: 'scout',
    shape: 'circle',
    icon: 'sword',
    category: 'Разведчик',
    title: 'Острая тычка',
    description: '+1 к урону каждого рикошета Разведчика.',
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
    title: 'Стая разведчиков',
    description: '+3 к максимуму активных Разведчиков.',
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
    title: 'Дальний рейд',
    description: '+40% к времени жизни Разведчика.',
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
    title: 'Матка',
    description: 'Медленно ползёт и выпускает вокруг себя маленьких муравьёв, которые кушают блоки рядом.',
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
    title: 'Плодовитость',
    description: 'Матка выпускает маленьких муравьёв на 25% чаще.',
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
    title: 'Зубастый выводок',
    description: '+1 к урону маленьких муравьёв Матки.',
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
    title: 'Королевская свита',
    description: '+1 к лимиту Маток и +35% к жизни маленьких муравьёв.',
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
    title: 'Долгая жизнь',
    description: '+25% к времени жизни ВСЕХ муравьёв в колонии.',
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
    title: 'Чистый кристалл',
    description: '+1 дополнительное очко навыков с каждого найденного кристалла.',
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
    title: 'Камнееды',
    description: '+1 бонусный урон всех муравьёв по плотной глине, камню и базальту.',
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
  worker: { speedMult: number; dmgBonus: number; lifeMult: number; maxActive: number };
  warrior: { speedMult: number; dmgBonus: number; radiusBonus: number; maxActive: number };
  scout: { speedMult: number; dmgBonus: number; lifeMult: number; maxActive: number };
  queen: { spawnRateMult: number; broodDmgBonus: number; broodLifeMult: number; maxActive: number };
}

function createDefaultSettings(): GameSettings {
  return {
    soundtrack: 'emerald',
    autoSwitchTrack: true,
    musicEnabled: true,
    sfxEnabled: true,
    volume: 0.65
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
    currentLevelId: 'prism',
    settings: createDefaultSettings()
  };
}

export class SkillTreeManager {
  state: SaveState;

  constructor() {
    this.state = this.load();
  }

  private load(): SaveState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return createDefaultSave();
      const parsed = JSON.parse(raw) as Partial<SaveState>;
      const def = createDefaultSave();
      const ranks = { ...def.nodeRanks, ...(parsed.nodeRanks || {}) };
      ranks.worker_root = 1;
      return {
        skillPoints: typeof parsed.skillPoints === 'number' ? parsed.skillPoints : 0,
        nodeRanks: ranks,
        completedLevels: Array.isArray(parsed.completedLevels) ? parsed.completedLevels : [],
        mutationClaimedLevels: Array.isArray(parsed.mutationClaimedLevels)
          ? parsed.mutationClaimedLevels
          : [],
        mutations: Array.isArray(parsed.mutations) ? (parsed.mutations as MutationId[]) : [],
        artifacts: Array.isArray(parsed.artifacts) ? (parsed.artifacts as string[]) : [],
        currentLevelId: typeof parsed.currentLevelId === 'string' ? parsed.currentLevelId : def.currentLevelId,
        settings: { ...createDefaultSettings(), ...(parsed.settings || {}) }
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
    this.save();
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
    return true;
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
    }
  }

  getColonyStats(): ColonyStats {
    const r = (id: string) => this.getRank(id);
    const echoMult = this.hasMutation('colony_echo') ? 1.3 : 1.0;
    const metabMult = this.hasMutation('fast_metabolism') ? 1.18 : 1.0;
    const acidBonus = this.hasMutation('acid_jaws') ? 1 : 0;
    const twinBonus = this.hasMutation('twin_workers') ? 2 : 0;
    const hasCompassMut = this.hasMutation('compass_cd');

    return {
      globalLifeMult: (1 + r('colony_life') * 0.25) * echoMult,
      globalSpeedMult: metabMult,
      crystalBonus: r('colony_crystal'),
      crystalLuckChance: this.hasMutation('crystal_luck') ? 0.25 : 0,
      hardBlockBonusDmg: r('colony_armor') + acidBonus,
      queenAnomaly: this.hasMutation('queen_anomaly'),
      farSense: this.hasMutation('far_sense'),
      compassCooldownSec: hasCompassMut ? 78 : 120,
      compassDuration: hasCompassMut ? 7.0 : 5.0,
      worker: {
        speedMult: (1 + r('worker_spd') * 0.22) * metabMult,
        dmgBonus: r('worker_dmg'),
        lifeMult: 1 + r('worker_life') * 0.35,
        maxActive: 6 + twinBonus + r('worker_cap') * 3
      },
      warrior: {
        speedMult: (1 + r('warrior_spd') * 0.22) * metabMult,
        dmgBonus: r('warrior_dmg') * 2,
        radiusBonus: r('warrior_cleave') * 0.65,
        maxActive: 2 + r('warrior_cap') * 2
      },
      scout: {
        speedMult: (1 + r('scout_spd') * 0.25) * metabMult,
        dmgBonus: r('scout_dmg'),
        lifeMult: 1 + r('scout_life') * 0.4,
        maxActive: 4 + r('scout_cap') * 3
      },
      queen: {
        spawnRateMult: (1 + r('queen_rate') * 0.25) * metabMult,
        broodDmgBonus: r('queen_brood_dmg'),
        broodLifeMult: 1 + r('queen_brood_life') * 0.35,
        maxActive: 1 + r('queen_brood_life')
      }
    };
  }
}
