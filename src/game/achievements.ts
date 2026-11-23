import { AchievementDef, SaveState } from '../core/types';

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_ant',
    name: 'Первый шаг колонии',
    description: 'Выпустите своего первого муравья.',
    icon: '🐜',
    accent: '#3ce87a',
    goal: 1,
    getProgress: (s) => s.career.antsSpawned
  },
  {
    id: 'ants_50',
    name: 'Рой просыпается',
    description: 'Выпустите 50 муравьёв за всё время.',
    icon: '🌿',
    accent: '#5ce890',
    goal: 50,
    getProgress: (s) => s.career.antsSpawned
  },
  {
    id: 'ants_300',
    name: 'Повелитель муравейника',
    description: 'Выпустите 300 муравьёв.',
    icon: '👑',
    accent: '#ffd845',
    goal: 300,
    getProgress: (s) => s.career.antsSpawned
  },
  {
    id: 'dig_1000',
    name: 'Первые тоннели',
    description: 'Прогрызите 1 000 блоков породы.',
    icon: '⛏',
    accent: '#ffad42',
    goal: 1000,
    getProgress: (s) => s.career.blocksDug
  },
  {
    id: 'dig_15000',
    name: 'Подземный архитектор',
    description: 'Прогрызите 15 000 блоков породы.',
    icon: '🏛',
    accent: '#ff8a3d',
    goal: 15000,
    getProgress: (s) => s.career.blocksDug
  },
  {
    id: 'dig_75000',
    name: 'Сердце горы',
    description: 'Прогрызите 75 000 блоков породы.',
    icon: '🌋',
    accent: '#ff5e5e',
    goal: 75000,
    getProgress: (s) => s.career.blocksDug
  },
  {
    id: 'crystals_10',
    name: 'Искатель кристаллов',
    description: 'Соберите 10 кристаллов навыков.',
    icon: '💎',
    accent: '#35d6ff',
    goal: 10,
    getProgress: (s) => s.career.crystalsCollected
  },
  {
    id: 'crystals_75',
    name: 'Хранитель самоцветов',
    description: 'Соберите 75 кристаллов навыков.',
    icon: '💠',
    accent: '#78e6ff',
    goal: 75,
    getProgress: (s) => s.career.crystalsCollected
  },
  {
    id: 'unlock_warrior',
    name: 'Тяжёлая кавалерия',
    description: 'Откройте в древе навыков Муравья-воина.',
    icon: '⚔',
    accent: '#ff6b2b',
    goal: 1,
    getProgress: (s) => (s.achievements.includes('unlock_warrior') || (s.nodeRanks['warrior_unlock'] || 0) > 0 ? 1 : 0)
  },
  {
    id: 'unlock_scout',
    name: 'Быстрее ветра',
    description: 'Откройте в древе навыков Муравья-разведчика.',
    icon: '⚡',
    accent: '#35d6ff',
    goal: 1,
    getProgress: (s) => (s.achievements.includes('unlock_scout') || (s.nodeRanks['scout_unlock'] || 0) > 0 ? 1 : 0)
  },
  {
    id: 'unlock_queen',
    name: 'Да здравствует королева!',
    description: 'Откройте в древе навыков Матку.',
    icon: '♛',
    accent: '#e04bff',
    goal: 1,
    getProgress: (s) => (s.achievements.includes('unlock_queen') || (s.nodeRanks['queen_unlock'] || 0) > 0 ? 1 : 0)
  },
  {
    id: 'use_compass',
    name: 'Шестое чувство',
    description: 'Запустите Ищейку на поиски сахара.',
    icon: '🧭',
    accent: '#ffe07d',
    goal: 1,
    getProgress: (s) => (s.achievements.includes('use_compass') ? 1 : 0)
  },
  {
    id: 'zoom_macro',
    name: 'Микромир',
    description: 'Приблизьте камеру вплотную, чтобы рассмотреть работу муравьёв.',
    icon: '🔍',
    accent: '#7dffb2',
    goal: 1,
    getProgress: (s) => (s.achievements.includes('zoom_macro') ? 1 : 0)
  },
  {
    id: 'first_sugar',
    name: 'Сладкая победа',
    description: 'Отыщите свой первый кусочек сахара.',
    icon: '🧊',
    accent: '#fff3b0',
    goal: 1,
    getProgress: (s) => Math.min(1, s.completedLevels.length)
  },
  {
    id: 'all_levels',
    name: 'Покоритель глубин',
    description: 'Найдите сахар на всех 5 картах.',
    icon: '🗺',
    accent: '#ffe26a',
    goal: 5,
    getProgress: (s) => s.completedLevels.length
  },
  {
    id: 'clear_100',
    name: 'Идеальный шедевр',
    description: 'Очистите любую карту на 100% и увидьте переливающийся финал.',
    icon: '✨',
    accent: '#ff8ef0',
    goal: 1,
    getProgress: (s) => Math.min(1, s.career.mapsCleared)
  },
  {
    id: 'rusya_shrimp',
    name: 'Привет, Руся!',
    description: 'Найдите секретную Креветочку Русю на первой карте.',
    icon: '🦐',
    accent: '#ff7a8a',
    goal: 1,
    getProgress: (s) => (s.artifacts.includes('rusya_shrimp') ? 1 : 0)
  },
  {
    id: 'all_artifacts',
    name: 'Тайный коллекционер',
    description: 'Соберите все 5 секретных коллекционных находок.',
    icon: '🏺',
    accent: '#ff96a6',
    goal: 5,
    getProgress: (s) => s.artifacts.length
  },
  {
    id: 'mutations_3',
    name: 'Эволюция колонии',
    description: 'Соберите 3 постоянные мутации колонии.',
    icon: '🧬',
    accent: '#d45cff',
    goal: 3,
    getProgress: (s) => s.mutations.length
  },
  {
    id: 'coop_play',
    name: 'Вместе веселее',
    description: 'Сыграйте матч в мультиплеере или кооперативе.',
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
