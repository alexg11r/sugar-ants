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

/** Rich, handcrafted, CSS-animated SVG artworks for every Colony Mutation! */
export function renderMutationSvg(id: MutationId): string {
  switch (id) {
    case 'start_sp_3':
      // Triple floating golden skill gems + DNA helix orbit
      return `<svg class="mut-svg mut-svg-sp" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="18" stroke="#ffd845" stroke-opacity="0.24" stroke-width="1.2" stroke-dasharray="4 4" class="mut-spin-slow"/>
        <g class="mut-float-1">
          <polygon points="24,6 31,15 24,24 17,15" fill="#ffd845" fill-opacity="0.32" stroke="#fff2a6" stroke-width="1.6"/>
          <polygon points="24,9 28,15 24,20 20,15" fill="#ffffff" fill-opacity="0.65"/>
        </g>
        <g class="mut-float-2">
          <polygon points="13,22 19,30 13,38 7,30" fill="#ffad42" fill-opacity="0.35" stroke="#ffe26a" stroke-width="1.5"/>
          <circle cx="13" cy="30" r="1.8" fill="#ffffff"/>
        </g>
        <g class="mut-float-3">
          <polygon points="35,22 41,30 35,38 29,30" fill="#ffad42" fill-opacity="0.35" stroke="#ffe26a" stroke-width="1.5"/>
          <circle cx="35" cy="30" r="1.8" fill="#ffffff"/>
        </g>
        <path d="M18 35 L24 39 L30 35" stroke="#ffe26a" stroke-width="1.5" stroke-linecap="round" class="mut-pulse"/>
      </svg>`;

    case 'queen_anomaly':
      // Regal violet-gold Queen Crown with orbiting anomaly sparks
      return `<svg class="mut-svg mut-svg-queen" viewBox="0 0 48 48" fill="none">
        <g class="mut-spin-med">
          <circle cx="24" cy="24" r="19" stroke="#e04bff" stroke-opacity="0.28" stroke-width="1.2" stroke-dasharray="3 5"/>
          <circle cx="43" cy="24" r="2.6" fill="#35d6ff"/>
          <circle cx="5" cy="24" r="2.4" fill="#3ce87a"/>
          <circle cx="24" cy="5" r="2.5" fill="#ff7a3d"/>
        </g>
        <g class="mut-float-1">
          <path d="M11 32 L13 17 L19.5 23 L24 13 L28.5 23 L35 17 L37 32 Z" fill="#e04bff" fill-opacity="0.32" stroke="#f5b8ff" stroke-width="1.8" stroke-linejoin="round"/>
          <rect x="12" y="34" width="24" height="3.2" rx="1.6" fill="#ffe26a" fill-opacity="0.85"/>
          <circle cx="24" cy="25" r="2.4" fill="#ffffff" class="mut-pulse"/>
          <circle cx="13" cy="15.5" r="1.8" fill="#ffe26a"/>
          <circle cx="24" cy="11.5" r="2.2" fill="#ffffff"/>
          <circle cx="35" cy="15.5" r="1.8" fill="#ffe26a"/>
        </g>
      </svg>`;

    case 'acid_jaws':
      // Glowing serrated mandibles snapping over bubbling neon acid drops!
      return `<svg class="mut-svg mut-svg-acid" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="17" fill="#ff6b2b" fill-opacity="0.1" class="mut-pulse"/>
        <g class="mut-jaw-left">
          <path d="M12 34 C9 23 13 13 22 10 C18 16 17 21 20 24 L17 26 L20 29 C17 31 15 33 12 34 Z" fill="#ff7a3d" fill-opacity="0.45" stroke="#ffd28a" stroke-width="1.7" stroke-linejoin="round"/>
        </g>
        <g class="mut-jaw-right">
          <path d="M36 34 C39 23 35 13 26 10 C30 16 31 21 28 24 L31 26 L28 29 C31 31 33 33 36 34 Z" fill="#ff7a3d" fill-opacity="0.45" stroke="#ffd28a" stroke-width="1.7" stroke-linejoin="round"/>
        </g>
        <g class="mut-drip-1">
          <path d="M24 22 C24 22 20 27 20 29.5 A4 4 0 0 0 28 29.5 C28 27 24 22 24 22 Z" fill="#7dff4d" stroke="#e4ffb8" stroke-width="1.2"/>
        </g>
        <circle cx="20" cy="38" r="1.8" fill="#a8ff6e" class="mut-drip-2"/>
        <circle cx="28" cy="36" r="1.5" fill="#7dff4d" class="mut-drip-3"/>
      </svg>`;

    case 'far_sense':
      // Expanding cyan sonar pulse rings + crystalline diamond eye!
      return `<svg class="mut-svg mut-svg-sense" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="7" stroke="#35d6ff" stroke-width="1.6" class="mut-sonar-1"/>
        <circle cx="24" cy="24" r="7" stroke="#78f2ff" stroke-width="1.4" class="mut-sonar-2"/>
        <path d="M7 24 C12 15 18 12 24 12 C30 12 36 15 41 24 C36 33 30 36 24 36 C18 36 12 33 7 24 Z" fill="#35d6ff" fill-opacity="0.16" stroke="#99f0ff" stroke-width="1.8"/>
        <polygon points="24,17 30,24 24,31 18,24" fill="#35d6ff" fill-opacity="0.6" stroke="#ffffff" stroke-width="1.4" class="mut-pulse"/>
        <circle cx="24" cy="24" r="2.2" fill="#ffffff"/>
      </svg>`;

    case 'colony_echo':
      // Flowing bioluminescent emerald infinity echo loop!
      return `<svg class="mut-svg mut-svg-echo" viewBox="0 0 48 48" fill="none">
        <path d="M14 24 C14 18 20 17 24 24 C28 31 34 30 34 24 C34 18 28 17 24 24 C20 31 14 30 14 24 Z" stroke="#3ce87a" stroke-opacity="0.32" stroke-width="6" stroke-linecap="round"/>
        <path d="M14 24 C14 18 20 17 24 24 C28 31 34 30 34 24 C34 18 28 17 24 24 C20 31 14 30 14 24 Z" stroke="#9effc4" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="14 8" class="mut-dash-flow"/>
        <circle cx="15" cy="24" r="2.2" fill="#ffffff" class="mut-pulse"/>
        <circle cx="33" cy="24" r="2.2" fill="#ffe26a" class="mut-pulse"/>
      </svg>`;

    case 'fast_metabolism':
      // Electrified streaking speed chevrons + hyper-core!
      return `<svg class="mut-svg mut-svg-speed" viewBox="0 0 48 48" fill="none">
        <path d="M9 14 L19 24 L9 34" stroke="#63f5b0" stroke-opacity="0.45" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="mut-streak-1"/>
        <path d="M19 12 L30 24 L19 36" stroke="#63f5b0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="mut-streak-2"/>
        <path d="M29 14 L39 24 L29 34" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="mut-streak-3"/>
        <line x1="6" y1="24" x2="17" y2="24" stroke="#ffe26a" stroke-width="2" stroke-linecap="round" class="mut-streak-1"/>
      </svg>`;

    case 'twin_workers':
      // Twin breathing emerald worker cocoons inside a glowing hexagonal brood cell!
      return `<svg class="mut-svg mut-svg-twins" viewBox="0 0 48 48" fill="none">
        <polygon points="24,5 40,14 40,34 24,43 8,34 8,14" fill="#7bf563" fill-opacity="0.1" stroke="#7bf563" stroke-opacity="0.48" stroke-width="1.6"/>
        <g class="mut-breathe-1">
          <ellipse cx="18" cy="25" rx="5.5" ry="8" fill="#3ce87a" fill-opacity="0.45" stroke="#c8ff99" stroke-width="1.6"/>
          <circle cx="16.8" cy="22" r="1.5" fill="#ffffff" fill-opacity="0.85"/>
        </g>
        <g class="mut-breathe-2">
          <ellipse cx="30" cy="25" rx="5.5" ry="8" fill="#7bf563" fill-opacity="0.45" stroke="#e2ffb8" stroke-width="1.6"/>
          <circle cx="28.8" cy="22" r="1.5" fill="#ffffff" fill-opacity="0.85"/>
        </g>
        <path d="M24 10 L24 15 M21.5 12.5 L26.5 12.5" stroke="#ffe26a" stroke-width="1.8" stroke-linecap="round" class="mut-pulse"/>
      </svg>`;

    case 'compass_cd':
      // Ornate golden Sugar Compass with oscillating magnetic needle!
      return `<svg class="mut-svg mut-svg-compass" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="17" fill="#ffe07d" fill-opacity="0.12" stroke="#ffe07d" stroke-width="1.8"/>
        <circle cx="24" cy="24" r="13" stroke="#fff4c4" stroke-opacity="0.35" stroke-width="1" stroke-dasharray="2 3"/>
        <path d="M24 5 L24 9 M24 39 L24 43 M5 24 L9 24 M39 24 L43 24" stroke="#ffe07d" stroke-width="1.8" stroke-linecap="round"/>
        <g class="mut-needle">
          <polygon points="24,11 28,24 24,22 20,24" fill="#ffe680" stroke="#ffffff" stroke-width="1"/>
          <polygon points="24,37 28,24 24,26 20,24" fill="#ff7a3d" fill-opacity="0.8"/>
          <circle cx="24" cy="24" r="2.6" fill="#ffffff"/>
        </g>
      </svg>`;

    case 'crystal_luck':
    default:
      // Twin shimmering prism crystals with twinkling sparkle glints!
      return `<svg class="mut-svg mut-svg-crystal" viewBox="0 0 48 48" fill="none">
        <g class="mut-float-1">
          <polygon points="21,8 30,22 21,40 12,22" fill="#7ae7ff" fill-opacity="0.36" stroke="#c8f8ff" stroke-width="1.7" stroke-linejoin="round"/>
          <polygon points="21,12 26,22 21,34 16,22" fill="#ffffff" fill-opacity="0.35"/>
        </g>
        <g class="mut-float-2">
          <polygon points="33,15 39,26 33,39 27,26" fill="#d45cff" fill-opacity="0.36" stroke="#f0c8ff" stroke-width="1.5" stroke-linejoin="round"/>
        </g>
        <path d="M11 11 L11 16 M8.5 13.5 L13.5 13.5" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" class="mut-twinkle-1"/>
        <path d="M36 9 L36 14 M33.5 11.5 L38.5 11.5" stroke="#ffe26a" stroke-width="1.6" stroke-linecap="round" class="mut-twinkle-2"/>
        <path d="M11 33 L11 37 M9 35 L13 35" stroke="#7ae7ff" stroke-width="1.5" stroke-linecap="round" class="mut-twinkle-2"/>
      </svg>`;
  }
}
