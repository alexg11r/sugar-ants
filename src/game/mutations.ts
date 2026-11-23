import { MutationDef, MutationId } from '../core/types';

export const MUTATIONS: MutationDef[] = [
  {
    id: 'start_sp_3',
    name: 'Генетическая память',
    description: 'Начинаешь каждый новый уровень сразу с ♦ 3 очками навыков.',
    accent: '#ffd845',
    icon: '♦'
  },
  {
    id: 'queen_anomaly',
    name: 'Королевская аномалия',
    description: 'Матка с шансом 5% может выпустить вместо маленького муравья любого другого (со сроком жизни как у маленького).',
    accent: '#e04bff',
    icon: '♛'
  },
  {
    id: 'acid_jaws',
    name: 'Кислотные жвалы',
    description: 'Все муравьи наносят +1 дополнительный урон по глине, камню и базальту.',
    accent: '#ff6b2b',
    icon: '⚡'
  },
  {
    id: 'far_sense',
    name: 'Дальнее чутьё',
    description: 'Радиус обнаружения кристаллов навыков вокруг тоннелей увеличен на 60%.',
    accent: '#35d6ff',
    icon: '◎'
  },
  {
    id: 'colony_echo',
    name: 'Эхо колонии',
    description: 'Все муравьи в колонии живут на 30% дольше на всех уровнях.',
    accent: '#3ce87a',
    icon: '∞'
  },
  {
    id: 'fast_metabolism',
    name: 'Ускоренный метаболизм',
    description: 'Все муравьи двигаются и грызут породу на 18% быстрее.',
    accent: '#63f5b0',
    icon: '»'
  },
  {
    id: 'twin_workers',
    name: 'Плотная кладка',
    description: '+2 к базовому лимиту активных Рабочих на всех уровнях.',
    accent: '#7bf563',
    icon: '✦'
  },
  {
    id: 'compass_cd',
    name: 'Сахарный инстинкт',
    description: 'Кулдаун Ищейки сокращён на 35%, а время её бега по следу сахара увеличено до 9 секунд.',
    accent: '#ffe07d',
    icon: '🧭'
  },
  {
    id: 'crystal_luck',
    name: 'Кристальный резонанс',
    description: 'С шансом 25% любой разрушенный кристалл даёт +1 дополнительное очко навыков.',
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
