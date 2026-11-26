export interface ChangelogEntry {
  version: string;
  date: string;
  titleRu: string;
  titleEn: string;
  highlightsRu: string[];
  highlightsEn: string[];
}

export const GAME_VERSION = 'v1.4.0';

/** Newest versions & most impactful changes always at the top! */
export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v1.4.0',
    date: '26.11.2026',
    titleRu: 'Лавка колонии, Фазовый муравей, скины и космический финал',
    titleEn: 'Colony Shop, Phase Ant, Skins & Cosmic Clear Finale',
    highlightsRu: [
      'Лавка колонии и сахарная валюта: +1 валюта за каждый найденный сахар (8 за уровни) и +2 за уникальные ачивки Telegram и Boosty (всего до 10).',
      'Секретный тип муравья — Фазовый муравей (2 валюты): раз в 6 сек телепортируется сквозь толщу породы, создавая квантовый импульс в точке входа и выхода.',
      '2 косметических скина с живым предпросмотром (по 4 валюты): «Инопланетный рой» и «Космический» (полная версия) — выбор скина прямо в главном меню.',
      'Баланс и эволюции: общая скорость муравьёв снижена на 20%, Разведчиков и выводка ещё на −10%, Матки на −50%, взрывной жучок замедлен; Эволюция Воина теперь создаёт до 2 призрачных клонов (в 2 раза слабее) на каждого призванного Воина.',
      'Гигантские уровни 6–8 (+60% площади) и +50% прочности пород на 7 и 8 уровнях + оптимизация рендера (dirty-rect / viewport) для плавной работы без лагов.',
      'Космический финал 100% карты: после полного открытия рисунка за пределами нерушимых блоков появляется анимированная космическо-фрактальная текстура, а камеру нельзя увести далеко за границы.',
      'Новый органический стиль иконок дерева навыков, элегантная Гайд-книга с анимациями блоков и муравьёв при наведении, кнопка выхода и разгруженное главное меню.',
      'Новые секретные ачивки (включая клик по ползущему муравью в «Авторах» и на фоне меню), кнопка «Full Game» с описанием полной версии и расширенная демо-версия (4 уровня).',
      'В «Авторах» добавлена особая благодарность за тестирование pintupagar.'
    ],
    highlightsEn: [
      'Colony Shop & Sugar Currency: earn +1 currency per unique Sugar found (8 across levels) and +2 from Telegram & Boosty community achievements (10 max).',
      'New Secret Ant — Phase Ant (2 currency): blinks through solid rock every 6s, triggering a quantum pulse at both departure and arrival.',
      '2 Cosmetic Skins with live animated preview (4 currency each): Alien Swarm and Cosmic (Full Game) — switchable anytime from the Main Menu.',
      'Colony Rebalance & Evolutions: all ant speeds reduced by 20%, Scouts & Brood by an extra 10%, Queen by 50%, Exploding Beetle slowed; Evolved Warriors now spawn up to 2 half-strength spectral clones per summoned Warrior.',
      'Massive Levels 6–8 (+60% larger area) & +50% tougher rocks on Levels 7–8, paired with dirty-rect / viewport rendering optimization for zero lag.',
      'Cosmic 100% Finale: clearing an entire map unveils a living animated cosmic-fractal backdrop beyond the indestructible artwork, with camera clamping to keep the artwork in frame.',
      'Redesigned organic Skill Tree icons & nodes, refined Guide Book with block zoom & ant wiggle hover animations, streamlined Main Menu, and Exit button.',
      'New secret Easter-egg achievements (including clicking the crawling ant in Credits & Main Menu), Full Game showcase button, and expanded 4-level Demo.',
      'Added special testing thanks to pintupagar in Credits.'
    ]
  }
];
