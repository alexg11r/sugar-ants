import { LEVELS } from '../core/levels';
import { AchievementDef, SaveState } from '../core/types';
import { SECRET_ARTIFACTS } from './artifacts';

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_ant',
    name: 'Первый шаг колонии',
    nameEn: 'First Step of the Colony',
    description: 'Выпустите своего первого муравья.',
    descriptionEn: 'Deploy your very first ant.',
    icon: '🐜',
    accent: '#3ce87a',
    goal: 1,
    getProgress: (s) => s.career.antsSpawned
  },
  {
    id: 'ants_50',
    name: 'Рой просыпается',
    nameEn: 'Awakening Swarm',
    description: 'Выпустите 50 муравьёв за всё время.',
    descriptionEn: 'Summon 50 ants across all runs.',
    icon: '🌿',
    accent: '#5ce890',
    goal: 50,
    getProgress: (s) => s.career.antsSpawned
  },
  {
    id: 'ants_300',
    name: 'Повелитель муравейника',
    nameEn: 'Sovereign of the Nest',
    description: 'Выпустите 300 муравьёв.',
    descriptionEn: 'Summon 300 ants across all runs.',
    icon: '👑',
    accent: '#ffd845',
    goal: 300,
    getProgress: (s) => s.career.antsSpawned
  },
  {
    id: 'dig_1000',
    name: 'Первые тоннели',
    nameEn: 'First Tunnels',
    description: 'Прогрызите 1 000 блоков породы.',
    descriptionEn: 'Excavate 1,000 blocks of rock.',
    icon: '⛏',
    accent: '#ffad42',
    goal: 1000,
    getProgress: (s) => s.career.blocksDug
  },
  {
    id: 'dig_15000',
    name: 'Подземный архитектор',
    nameEn: 'Subterranean Architect',
    description: 'Прогрызите 15 000 блоков породы.',
    descriptionEn: 'Excavate 15,000 blocks of rock.',
    icon: '🏛',
    accent: '#ff8a3d',
    goal: 15000,
    getProgress: (s) => s.career.blocksDug
  },
  {
    id: 'dig_75000',
    name: 'Сердце горы',
    nameEn: 'Heart of the Mountain',
    description: 'Прогрызите 75 000 блоков породы.',
    descriptionEn: 'Excavate 75,000 blocks of rock.',
    icon: '🌋',
    accent: '#ff5e5e',
    goal: 75000,
    getProgress: (s) => s.career.blocksDug
  },
  {
    id: 'crystals_10',
    name: 'Искатель кристаллов',
    nameEn: 'Crystal Seeker',
    description: 'Соберите 10 кристаллов навыков.',
    descriptionEn: 'Collect 10 skill crystals.',
    icon: '💎',
    accent: '#35d6ff',
    goal: 10,
    getProgress: (s) => s.career.crystalsCollected
  },
  {
    id: 'crystals_75',
    name: 'Хранитель самоцветов',
    nameEn: 'Gemstone Keeper',
    description: 'Соберите 75 кристаллов навыков.',
    descriptionEn: 'Collect 75 skill crystals.',
    icon: '💠',
    accent: '#78e6ff',
    goal: 75,
    getProgress: (s) => s.career.crystalsCollected
  },
  {
    id: 'unlock_warrior',
    name: 'Тяжёлая кавалерия',
    nameEn: 'Heavy Cavalry',
    description: 'Откройте в древе навыков Муравья-воина.',
    descriptionEn: 'Unlock the Warrior Ant in the Skill Tree.',
    icon: '⚔',
    accent: '#ff6b2b',
    goal: 1,
    getProgress: (s) => (s.achievements.includes('unlock_warrior') || (s.nodeRanks['warrior_unlock'] || 0) > 0 ? 1 : 0)
  },
  {
    id: 'unlock_scout',
    name: 'Быстрее ветра',
    nameEn: 'Faster than Wind',
    description: 'Откройте в древе навыков Муравья-разведчика.',
    descriptionEn: 'Unlock the Scout Ant in the Skill Tree.',
    icon: '⚡',
    accent: '#35d6ff',
    goal: 1,
    getProgress: (s) => (s.achievements.includes('unlock_scout') || (s.nodeRanks['scout_unlock'] || 0) > 0 ? 1 : 0)
  },
  {
    id: 'unlock_queen',
    name: 'Да здравствует королева!',
    nameEn: 'Long Live the Queen!',
    description: 'Откройте в древе навыков Матку.',
    descriptionEn: 'Unlock the Queen Ant in the Skill Tree.',
    icon: '♛',
    accent: '#e04bff',
    goal: 1,
    getProgress: (s) => (s.achievements.includes('unlock_queen') || (s.nodeRanks['queen_unlock'] || 0) > 0 ? 1 : 0)
  },
  {
    id: 'use_compass',
    name: 'Шестое чувство',
    nameEn: 'Sixth Sense',
    description: 'Запустите Ищейку на поиски сахара.',
    descriptionEn: 'Send out a Bloodhound to sniff the Sugar trail.',
    icon: '🧭',
    accent: '#ffe07d',
    goal: 1,
    getProgress: (s) => (s.achievements.includes('use_compass') ? 1 : 0)
  },
  {
    id: 'zoom_macro',
    name: 'Микромир',
    nameEn: 'Micro World',
    description: 'Приблизьте камеру вплотную, чтобы рассмотреть работу муравьёв.',
    descriptionEn: 'Zoom in super close to watch your ants nibble blocks.',
    icon: '🔍',
    accent: '#7dffb2',
    goal: 1,
    getProgress: (s) => (s.achievements.includes('zoom_macro') ? 1 : 0)
  },
  {
    id: 'first_sugar',
    name: 'Сладкая победа',
    nameEn: 'Sweet Victory',
    description: 'Отыщите свой первый кусочек сахара.',
    descriptionEn: 'Discover your very first Sugar cube.',
    icon: '🧊',
    accent: '#fff3b0',
    goal: 1,
    getProgress: (s) => Math.min(1, s.completedLevels.length)
  },
  {
    id: 'all_levels',
    name: 'Покоритель глубин',
    nameEn: 'Conqueror of the Depths',
    description: `Найдите сахар на всех ${LEVELS.length} картах.`,
    descriptionEn: `Find Sugar on all ${LEVELS.length} maps.`,
    icon: '🗺',
    accent: '#ffe26a',
    goal: LEVELS.length,
    getProgress: (s) => s.completedLevels.length
  },
  {
    id: 'clear_100',
    name: 'Идеальный шедевр',
    nameEn: 'Flawless Masterpiece',
    description: 'Очистите любую карту на 100% и увидьте переливающийся финал.',
    descriptionEn: 'Excavate any map to 100% and witness the iridescent finale.',
    icon: '✨',
    accent: '#ff8ef0',
    goal: 1,
    getProgress: (s) => Math.min(1, s.career.mapsCleared)
  },
  {
    id: 'rusya_shrimp',
    name: 'Привет, Руся!',
    nameEn: 'Hello, Rusya!',
    description: 'Найдите секретную Креветочку Русю на первой карте.',
    descriptionEn: 'Discover the secret Rusya the Shrimp artifact on Map 1.',
    icon: '🦐',
    accent: '#ff7a8a',
    goal: 1,
    getProgress: (s) => (s.artifacts.includes('rusya_shrimp') ? 1 : 0)
  },
  {
    id: 'all_artifacts',
    name: 'Тайный коллекционер',
    nameEn: 'Secret Collector',
    description: `Соберите все ${SECRET_ARTIFACTS.length} секретных коллекционных находок.`,
    descriptionEn: `Collect all ${SECRET_ARTIFACTS.length} hidden collectible artifacts.`,
    icon: '🏺',
    accent: '#ff96a6',
    goal: SECRET_ARTIFACTS.length,
    getProgress: (s) => s.artifacts.length
  },
  {
    id: 'mutations_3',
    name: 'Эволюция колонии',
    nameEn: 'Colony Evolution',
    description: 'Соберите 3 постоянные мутации колонии.',
    descriptionEn: 'Acquire 3 permanent colony mutations.',
    icon: '🧬',
    accent: '#d45cff',
    goal: 3,
    getProgress: (s) => s.mutations.length
  },
  {
    id: 'coop_play',
    name: 'Вместе веселее',
    nameEn: 'Better Together',
    description: 'Сыграйте матч в мультиплеере или кооперативе.',
    descriptionEn: 'Play a match in Multiplayer or Co-op.',
    icon: '🤝',
    accent: '#42f5c5',
    goal: 1,
    getProgress: (s) => (s.achievements.includes('coop_play') ? 1 : 0)
  }
];

export function getAchievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** Evaluates all count-based achievements against SaveState and returns any newly eligible IDs. */
export function findNewlyEarnedAchievements(state: SaveState): AchievementDef[] {
  const earned: AchievementDef[] = [];
  for (const ach of ACHIEVEMENTS) {
    if (state.achievements.includes(ach.id)) continue;
    if (ach.getProgress(state) >= ach.goal) {
      earned.push(ach);
    }
  }
  return earned;
}
