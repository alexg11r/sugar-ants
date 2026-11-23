import { ArtifactDef } from '../core/types';

export const SECRET_ARTIFACTS: ArtifactDef[] = [
  {
    id: 'rusya_shrimp',
    levelId: 'prism',
    name: 'Креветочка Руся',
    description:
      'Легендарная маленькая коралловая креветочка, уснувшая среди изумрудных призм. Её усики приносят вечную удачу колонии!',
    accent: '#ff7a8a',
    rgb: [255, 122, 138]
  },
  {
    id: 'cosmic_candy',
    levelId: 'galaxy',
    name: 'Космический Леденец',
    description:
      'Сладкий кристаллический осколок кометы, миллионы лет дрейфовавший сквозь звёздную пыль.',
    accent: '#5ce8ff',
    rgb: [92, 232, 255]
  },
  {
    id: 'amber_seal',
    levelId: 'ant-crown',
    name: 'Янтарная Печать Королевы',
    description:
      'Древняя капля солнечного янтаря с отпечатком самой первой правительницы муравьиного царства.',
    accent: '#ffb84d',
    rgb: [255, 184, 77]
  },
  {
    id: 'moon_bell',
    levelId: 'moon-temple',
    name: 'Лунный Колокольчик',
    description:
      'Хрупкий аметистовый талисман, еле слышно звенящий в тишине подземных колонн.',
    accent: '#e07bff',
    rgb: [224, 123, 255]
  },
  {
    id: 'golden_sprout',
    levelId: 'tree-of-life',
    name: 'Золотой Росток',
    description:
      'Вечнозелёный сияющий побег из самой сердцевины Древа Жизни.',
    accent: '#7aff8a',
    rgb: [122, 255, 138]
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
      // Cute glowing pixel coral shrimp "Креветочка Руся"!
      return `<svg viewBox="0 0 24 24" shape-rendering="crispEdges">
        <!-- Long playful antennae -->
        <rect x="3" y="4" width="3" height="1" fill="#ffb8c2"/>
        <rect x="6" y="5" width="2" height="1" fill="#ffb8c2"/>
        <rect x="2" y="7" width="4" height="1" fill="#ff99a8"/>
        <!-- Head & cute dark eye -->
        <rect x="8" y="6" width="5" height="4" fill="#ff7a8a"/>
        <rect x="9" y="7" width="1" height="1" fill="#18080c"/>
        <rect x="11" y="6" width="2" height="1" fill="#ffc4cc"/>
        <!-- Curved segmented shrimp body -->
        <rect x="13" y="7" width="4" height="4" fill="#ff6678"/>
        <rect x="14" y="7" width="2" height="1" fill="#ffb8c2"/>
        <rect x="15" y="11" width="4" height="4" fill="#ff5468"/>
        <rect x="16" y="11" width="2" height="1" fill="#ffa3b0"/>
        <rect x="13" y="15" width="4" height="3" fill="#e84359"/>
        <!-- Tail fan -->
        <rect x="9" y="16" width="4" height="2" fill="#ff7a8a"/>
        <rect x="7" y="15" width="3" height="2" fill="#ffb8c2"/>
        <rect x="7" y="18" width="3" height="2" fill="#ff5468"/>
        <!-- Little shrimp legs -->
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
        <!-- Tiny crown inside amber -->
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
