import { MutationDef, MutationId } from '../core/types';

export const MUTATIONS: MutationDef[] = [
  {
    id: 'start_sp_3',
    name: 'Генетическая память',
    nameEn: 'Genetic Memory',
    description: 'Начинаешь каждый новый уровень сразу с ♦ 3 очками навыков.',
    descriptionEn: 'Start every new map right away with ♦ 3 Skill Points.',
    accent: '#ffd845',
    icon: '♦'
  },
  {
    id: 'queen_anomaly',
    name: 'Королевская аномалия',
    nameEn: 'Royal Anomaly',
    description: 'Матка с шансом 5% может выпустить вместо маленького муравья любого другого (со сроком жизни как у маленького).',
    descriptionEn: 'Queens have a 5% chance to hatch a bonus Worker, Warrior, or Scout instead of Brood (free slot!).',
    accent: '#e04bff',
    icon: '♛'
  },
  {
    id: 'acid_jaws',
    name: 'Кислотные жвалы',
    nameEn: 'Acid Mandibles',
    description: 'Все муравьи наносят +1 дополнительный урон по глине, камню и базальту.',
    descriptionEn: 'All ants deal +1 bonus damage against Clay, Stone, and Obsidian.',
    accent: '#ff6b2b',
    icon: '⚡'
  },
  {
    id: 'far_sense',
    name: 'Дальнее чутьё',
    nameEn: 'Deep Sense',
    description: 'Радиус обнаружения кристаллов навыков вокруг тоннелей увеличен на 60%.',
    descriptionEn: 'Skill crystal detection radius around tunnels increased by 60%.',
    accent: '#35d6ff',
    icon: '◎'
  },
  {
    id: 'colony_echo',
    name: 'Эхо колонии',
    nameEn: 'Colony Echo',
    description: 'Все муравьи в колонии живут на 30% дольше на всех уровнях.',
    descriptionEn: 'All ants in your colony live 30% longer on every map.',
    accent: '#3ce87a',
    icon: '∞'
  },
  {
    id: 'fast_metabolism',
    name: 'Ускоренный метаболизм',
    nameEn: 'Hyper Metabolism',
    description: 'Все муравьи двигаются и грызут породу на 18% быстрее.',
    descriptionEn: 'All ants move and chew through rock 18% faster.',
    accent: '#63f5b0',
    icon: '»'
  },
  {
    id: 'twin_workers',
    name: 'Плотная кладка',
    nameEn: 'Dense Clutch',
    description: '+2 к базовому лимиту активных Рабочих на всех уровнях.',
    descriptionEn: '+2 base active Worker limit across all maps.',
    accent: '#7bf563',
    icon: '✦'
  },
  {
    id: 'compass_cd',
    name: 'Сахарный инстинкт',
    nameEn: 'Sugar Instinct',
    description: 'Кулдаун Ищейки сокращён на 35%, а время её бега по следу сахара увеличено до 9 секунд.',
    descriptionEn: 'Bloodhound cooldown reduced by 35% and tracking duration increased to 9 seconds.',
    accent: '#ffe07d',
    icon: '🧭'
  },
  {
    id: 'crystal_luck',
    name: 'Кристальный резонанс',
    nameEn: 'Crystal Resonance',
    description: 'С шансом 25% любой разрушенный кристалл даёт +1 дополнительное очко навыков.',
    descriptionEn: 'Every broken crystal has a 25% chance to yield +1 extra Skill Point.',
    accent: '#7ae7ff',
    icon: '◈'
  }
];

export function getMutationDef(id: MutationId): MutationDef | undefined {
  return MUTATIONS.find((m) => m.id === id);
}

export function pickMutationChoices(owned: MutationId[], count = 3): MutationDef[] {
  const pool = MUTATIONS.filter((m) => !owned.includes(m.id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
