import { ArtifactDef } from '../core/types';

export const SECRET_ARTIFACTS: ArtifactDef[] = [
  {
    id: 'rusya_shrimp',
    levelId: 'prism',
    name: 'Креветочка Руся',
    nameEn: 'Rusya the Shrimp',
    description:
      'Легендарная маленькая коралловая креветочка, уснувшая среди изумрудных призм. Её усики приносят вечную удачу колонии!',
    descriptionEn:
      'The legendary little coral shrimp curled up among emerald prisms. Her whiskers bring eternal luck to the colony!',
    accent: '#ff7a8a',
    rgb: [255, 122, 138]
  },
  {
    id: 'cosmic_candy',
    levelId: 'galaxy',
    name: 'Космический Леденец',
    nameEn: 'Cosmic Candy',
    description:
      'Сладкий кристаллический осколок кометы, миллионы лет дрейфовавший сквозь звёздную пыль.',
    descriptionEn:
      'A sweet crystalline comet shard that drifted through starlight for millions of years.',
    accent: '#5ce8ff',
    rgb: [92, 232, 255]
  },
  {
    id: 'amber_seal',
    levelId: 'ant-crown',
    name: 'Янтарная Печать Королевы',
    nameEn: "Queen's Amber Seal",
    description:
      'Древняя капля солнечного янтаря с отпечатком самой первой правительницы муравьиного царства.',
    descriptionEn:
      'An ancient droplet of solar amber bearing the crest of the very first ant sovereign.',
    accent: '#ffb84d',
    rgb: [255, 184, 77]
  },
  {
    id: 'moon_bell',
    levelId: 'moon-temple',
    name: 'Лунный Колокольчик',
    nameEn: 'Lunar Bell',
    description:
      'Хрупкий аметистовый талисман, еле слышно звенящий в тишине подземных колонн.',
    descriptionEn:
      'A delicate amethyst chime humming softly in the hush of subterranean pillars.',
    accent: '#e07bff',
    rgb: [224, 123, 255]
  },
  {
    id: 'golden_sprout',
    levelId: 'tree-of-life',
    name: 'Золотой Росток',
    nameEn: 'Golden Sprout',
    description:
      'Вечнозелёный сияющий побег из самой сердцевины Древа Жизни.',
    descriptionEn:
      'An evergreen radiant shoot born inside the very heartwood of the Tree of Life.',
    accent: '#7aff8a',
    rgb: [122, 255, 138]
  },
  {
    id: 'frost_pearl',
    levelId: 'crystal-hydra',
    name: 'Ледяная Жемчужина',
    nameEn: 'Frost Pearl',
    description:
      'Замерзшая слеза Хрустальной Гидры, внутри которой вечно кружится крошечная метель.',
    descriptionEn:
      'A frozen tear of the Crystal Hydra holding a tiny perpetual snowstorm inside.',
    accent: '#72f2ff',
    rgb: [114, 242, 255]
  },
  {
    id: 'ember_feather',
    levelId: 'ember-phoenix',
    name: 'Перо Феникса',
    nameEn: 'Phoenix Feather',
    description:
      'Тёплое золотисто-алое перо, которое мягко светится даже в самой непроглядной базальтовой тьме.',
    descriptionEn:
      'A warm crimson-gold plume that glows steadily even in the deepest basalt dark.',
    accent: '#ff7847',
    rgb: [255, 120, 71]
  },
  {
    id: 'abyss_compass',
    levelId: 'void-leviathan',
    name: 'Астральный Компас',
    nameEn: 'Astral Compass',
    description:
      'Древний звёздный артефакт из глубин Бездны, чья стрелка всегда тянется к самым редким сокровищам.',
    descriptionEn:
      'An ancient celestial relic from the Abyss whose needle forever points toward hidden wonders.',
    accent: '#d896ff',
    rgb: [216, 150, 255]
  }
];

export function getArtifactForLevel(levelId: string): ArtifactDef | undefined {
  return SECRET_ARTIFACTS.find((a) => a.levelId === levelId);
}

export function getArtifactById(id: string): ArtifactDef | undefined {
  return SECRET_ARTIFACTS.find((a) => a.id === id);
}

/** Crisp custom pixel-art SVG icon for each collectible secret artifact! */
export function renderArtifactSvg(id: string): string {
  switch (id) {
    case 'rusya_shrimp':
      return `<svg viewBox="0 0 24 24" shape-rendering="crispEdges">
        <rect x="3" y="4" width="3" height="1" fill="#ffb8c2"/>
        <rect x="6" y="5" width="2" height="1" fill="#ffb8c2"/>
        <rect x="2" y="7" width="4" height="1" fill="#ff99a8"/>
        <rect x="8" y="6" width="5" height="4" fill="#ff7a8a"/>
        <rect x="9" y="7" width="1" height="1" fill="#18080c"/>
        <rect x="11" y="6" width="2" height="1" fill="#ffc4cc"/>
        <rect x="13" y="7" width="4" height="4" fill="#ff6678"/>
        <rect x="14" y="7" width="2" height="1" fill="#ffb8c2"/>
        <rect x="15" y="11" width="4" height="4" fill="#ff5468"/>
        <rect x="16" y="11" width="2" height="1" fill="#ffa3b0"/>
        <rect x="13" y="15" width="4" height="3" fill="#e84359"/>
        <rect x="9" y="16" width="4" height="2" fill="#ff7a8a"/>
        <rect x="7" y="15" width="3" height="2" fill="#ffb8c2"/>
        <rect x="7" y="18" width="3" height="2" fill="#ff5468"/>
        <rect x="10" y="10" width="1" height="3" fill="#ff99a8"/>
        <rect x="12" y="11" width="1" height="3" fill="#ff99a8"/>
        <rect x="14" y="12" width="1" height="2" fill="#ff99a8"/>
      </svg>`;
    case 'cosmic_candy':
      return `<svg viewBox="0 0 24 24" shape-rendering="crispEdges">
        <rect x="4" y="10" width="3" height="4" fill="#35b8ff"/>
        <rect x="17" y="10" width="3" height="4" fill="#35b8ff"/>
        <rect x="7" y="8" width="10" height="8" fill="#5ce8ff"/>
        <rect x="9" y="6" width="6" height="12" fill="#80f2ff"/>
        <rect x="10" y="9" width="4" height="2" fill="#ffffff"/>
        <rect x="11" y="13" width="3" height="2" fill="#d45cff"/>
      </svg>`;
    case 'amber_seal':
      return `<svg viewBox="0 0 24 24" shape-rendering="crispEdges">
        <rect x="7" y="4" width="10" height="16" fill="#ff9d2e"/>
        <rect x="5" y="7" width="14" height="10" fill="#ffb84d"/>
        <rect x="8" y="6" width="3" height="3" fill="#fff0b8"/>
        <rect x="9" y="13" width="6" height="2" fill="#7a3a00"/>
        <rect x="9" y="10" width="1" height="3" fill="#7a3a00"/>
        <rect x="11" y="11" width="2" height="2" fill="#7a3a00"/>
        <rect x="14" y="10" width="1" height="3" fill="#7a3a00"/>
      </svg>`;
    case 'moon_bell':
      return `<svg viewBox="0 0 24 24" shape-rendering="crispEdges">
        <rect x="10" y="4" width="4" height="2" fill="#f3c6ff"/>
        <rect x="8" y="6" width="8" height="3" fill="#e07bff"/>
        <rect x="6" y="9" width="12" height="7" fill="#c752f2"/>
        <rect x="5" y="16" width="14" height="2" fill="#f3c6ff"/>
        <rect x="10" y="18" width="4" height="3" fill="#ffe680"/>
        <rect x="8" y="9" width="2" height="5" fill="#ffffff" fill-opacity="0.55"/>
      </svg>`;
    case 'frost_pearl':
      return `<svg viewBox="0 0 24 24" shape-rendering="crispEdges">
        <rect x="9" y="3" width="6" height="2" fill="#d8fbff"/>
        <rect x="6" y="5" width="12" height="14" fill="#3ac6e8"/>
        <rect x="4" y="8" width="16" height="8" fill="#5ce8ff"/>
        <rect x="7" y="7" width="10" height="10" fill="#9cf4ff"/>
        <rect x="9" y="8" width="3" height="3" fill="#ffffff"/>
        <rect x="12" y="12" width="2" height="2" fill="#ffffff"/>
        <rect x="9" y="19" width="6" height="2" fill="#238db5"/>
      </svg>`;
    case 'ember_feather':
      return `<svg viewBox="0 0 24 24" shape-rendering="crispEdges">
        <rect x="16" y="3" width="4" height="3" fill="#fff099"/>
        <rect x="13" y="5" width="5" height="4" fill="#ffbb45"/>
        <rect x="10" y="8" width="6" height="4" fill="#ff7835"/>
        <rect x="7" y="11" width="6" height="4" fill="#ff4d35"/>
        <rect x="6" y="14" width="4" height="4" fill="#c92e2e"/>
        <rect x="4" y="18" width="3" height="3" fill="#ffe699"/>
        <rect x="14" y="6" width="2" height="2" fill="#ffffff"/>
        <rect x="11" y="10" width="2" height="2" fill="#ffe066"/>
      </svg>`;
    case 'abyss_compass':
      return `<svg viewBox="0 0 24 24" shape-rendering="crispEdges">
        <rect x="8" y="3" width="8" height="2" fill="#e5b8ff"/>
        <rect x="5" y="5" width="14" height="14" fill="#46206b"/>
        <rect x="3" y="8" width="18" height="8" fill="#7035ad"/>
        <rect x="6" y="6" width="12" height="12" fill="#1e0d36"/>
        <rect x="11" y="5" width="2" height="6" fill="#ffe26a"/>
        <rect x="11" y="13" width="2" height="6" fill="#5ce8ff"/>
        <rect x="5" y="11" width="6" height="2" fill="#d896ff"/>
        <rect x="13" y="11" width="6" height="2" fill="#d896ff"/>
        <rect x="10" y="10" width="4" height="4" fill="#ffffff"/>
        <rect x="8" y="19" width="8" height="2" fill="#e5b8ff"/>
      </svg>`;
    default:
      // golden_sprout
      return `<svg viewBox="0 0 24 24" shape-rendering="crispEdges">
        <rect x="11" y="10" width="2" height="10" fill="#3ce87a"/>
        <rect x="6" y="7" width="5" height="4" fill="#7aff8a"/>
        <rect x="5" y="6" width="3" height="2" fill="#d8ff99"/>
        <rect x="13" y="6" width="5" height="4" fill="#ffe066"/>
        <rect x="16" y="5" width="3" height="2" fill="#fff7c2"/>
        <rect x="8" y="19" width="8" height="2" fill="#268c52"/>
      </svg>`;
  }
}
