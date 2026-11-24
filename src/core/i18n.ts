import { Language } from './types';

let currentLang: Language = 'ru';

export function getLang(): Language {
  return currentLang;
}

export function setLang(lang: Language) {
  currentLang = lang === 'en' ? 'en' : 'ru';
}

export function isEn(): boolean {
  return currentLang === 'en';
}

/** Picks localized string for bilingual data structures */
export function loc(ru: string, en?: string): string {
  return currentLang === 'en' && en ? en : ru;
}

/** Formats integer with locale thousands separator */
export function formatNum(n: number): string {
  return Math.round(n).toLocaleString(currentLang === 'en' ? 'en-US' : 'ru-RU');
}

/** Formats elapsed seconds for personal records (MM:SS or H:MM:SS) */
export function formatRecordTime(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || sec <= 0) return '—';
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Formats total lifetime play time cleanly (e.g. 2ч 14м / 2h 14m, or 18м / 18m, or 42с / 42s) */
export function formatPlayTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (currentLang === 'en') {
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${rem}s`;
    return `${rem}s`;
  }
  if (h > 0) return `${h}ч ${m}м`;
  if (m > 0) return `${m}м ${rem}с`;
  return `${rem}с`;
}

export const STRINGS: Record<string, { ru: string; en: string }> = {
  // Document & Main Menu
  docTitle: { ru: 'Sugar Ants — Медитативная колония', en: 'Sugar Ants — Meditative Colony' },
  skipNote: { ru: 'Нажмите, чтобы пропустить', en: 'Click or press any key to skip' },
  tagline: { ru: 'МЕДИТАТИВНАЯ СИМУЛЯЦИЯ КОЛОНИИ', en: 'MEDITATIVE COLONY SIMULATION' },
  play: { ru: 'ИГРАТЬ', en: 'PLAY' },
  continueRun: { ru: 'ПРОДОЛЖИТЬ', en: 'CONTINUE' },
  multiplayer: { ru: 'КООП-РЕЖИМ', en: 'CO-OP MODE' },
  mpMeta: { ru: '🚧 В разработке', en: '🚧 In Development' },
  mpInDevToast: {
    ru: '🚧 Кооп-режим пока в разработке — скоро вернётся!',
    en: '🚧 Co-op mode is currently in development — coming soon!'
  },
  secretFinds: { ru: 'СЕКРЕТНЫЕ НАХОДКИ', en: 'SECRET FINDS' },
  achievements: { ru: 'АЧИВКИ', en: 'ACHIEVEMENTS' },
  maps: { ru: 'Карты', en: 'Maps' },
  gallery: { ru: 'Галерея', en: 'Gallery' },
  stats: { ru: 'Статистика', en: 'Stats' },
  mutations: { ru: 'Мутации', en: 'Mutations' },
  settings: { ru: 'Настройки', en: 'Settings' },
  credits: { ru: 'Авторы', en: 'Credits' },
  ourTelegram: { ru: 'Наш Telegram', en: 'Our Telegram' },
  skills: { ru: 'Навыки', en: 'Skills' },

  // HUD Tooltips & Labels
  tipMainMenu: { ru: 'Главное меню', en: 'Main Menu' },
  tipSelectLevel: { ru: 'Выбор уровня', en: 'Select Map' },
  tipMutations: { ru: 'Активные мутации', en: 'Active Mutations' },
  tipArtifacts: { ru: 'Секретные находки (+1 стартовое очко навыков)', en: 'Secret Finds (+1 starting Skill Point each)' },
  tipAchievements: { ru: 'Ачивки (+1% к скорости всех муравьёв за каждую)', en: 'Achievements (+1% all-ant speed each)' },
  tipSp: { ru: 'Очки навыков (из кристаллов и находок)', en: 'Skill Points (from crystals & finds)' },
  tipArt: { ru: 'Открыто скрытой картины', en: 'Hidden artwork revealed' },
  tipDig: { ru: 'Прогрызено породы', en: 'Terrain excavated' },
  tipSugar: { ru: 'Статус поиска сахара', en: 'Sugar hunt status' },
  tipRush: { ru: 'Сахарная лихорадка: скорость ×1.6!', en: 'Sugar Rush: ×1.6 colony speed!' },
  tipAuto: { ru: 'Умный авто-призыв: нажми, чтобы вкл/выкл', en: 'Smart Auto-Summon: click to toggle on/off' },
  tipAutoConfig: { ru: 'Настроить умный авто-призыв (режим и муравьи)', en: 'Configure Smart Auto-Summon (mode & ants)' },
  autoFabLabel: { ru: 'Авто', en: 'Auto' },
  autoPopoverTitle: { ru: '🤖 Умный авто-призыв', en: '🤖 Smart Auto-Summon' },
  autoModeLabel: { ru: 'Стратегия', en: 'Strategy' },
  autoModeSmart: { ru: '🎯 Умный', en: '🎯 Smart' },
  autoModeBeacon: { ru: '📍 Метка', en: '📍 Beacon' },
  autoModeNest: { ru: '🏠 Гнездо', en: '🏠 Nest' },
  autoModeSmartHint: {
    ru: 'Ищет кристаллы и находки, Воинов шлёт в твёрдую породу, Разведчиков — в туман, Маток — в разные крылья.',
    en: 'Hunts crystals & finds, aims Warriors at hard rock, Scouts into dark fog, and spreads Queens across tunnels.'
  },
  autoModeBeaconHint: {
    ru: 'Выпускает муравьёв прямо у края тоннеля рядом с активной феромонной меткой.',
    en: 'Deploys ants right at the tunnel frontier closest to your active Pheromone Beacon.'
  },
  autoModeNestHint: {
    ru: 'Спокойно выпускает муравьёв из центрального гнезда в сторону ближайшей породы.',
    en: 'Calmly deploys ants from the central Nest toward nearby rock.'
  },
  autoAntsLabel: { ru: 'Кого призывать', en: 'Ants to summon' },
  tipBeacon: {
    ru: 'Феромонная метка (B): 30 сек, кулдаун 2 мин — притягивает Рабочих и выводок',
    en: 'Pheromone Beacon (B): 30s active, 2m cooldown — draws Workers & Brood'
  },
  beaconLabel: { ru: 'Метка', en: 'Beacon' },
  beaconAim: { ru: 'На карту', en: 'Tap map' },
  touchModeLaunch: { ru: 'Запуск', en: 'Launch' },
  touchModePan: { ru: 'Камера', en: 'Pan' },
  tipSettings: { ru: 'Настройки и саундтрек', en: 'Settings & Soundtrack' },
  tipCenterCam: { ru: 'Центрировать камеру', en: 'Center Camera' },
  tipTouchPan: { ru: 'Режим камеры (1 палец двигает карту)', en: 'Camera Pan mode (1-finger drag)' },
  tipZoomIn: { ru: 'Приблизить', en: 'Zoom In' },
  tipZoomOut: { ru: 'Отдалить', en: 'Zoom Out' },
  autoShort: { ru: '🤖 Авто', en: '🤖 Auto' },
  sugarSearching: { ru: 'Поиск сахара', en: 'Seeking Sugar' },
  sugarFoundShort: { ru: 'Сахар найден!', en: 'Sugar Found!' },
  ready: { ru: 'Готов', en: 'Ready' },
  secShort: { ru: 'с', en: 's' },

  // 4-Beat Epic Intro
  introBeat0Kicker: { ru: 'ПОД ЗЕМЛЁЙ', en: 'BENEATH THE EARTH' },
  introBlocksWord: { ru: 'БЛОКОВ', en: 'BLOCKS' },
  introBeat0Small: { ru: 'ПОРОДЫ, КАМНЯ И ОБСИДИАНА', en: 'SOIL, STONE & OBSIDIAN' },
  introBeat1Kicker: { ru: 'ТВОЯ СИЛА', en: 'YOUR FORCE' },
  introBeat1Big: { ru: 'КОЛОНИЯ МУРАВЬЁВ', en: 'AN ANT COLONY' },
  introBeat1Small: { ru: 'РАБОЧИЕ • ВОИНЫ • РАЗВЕДЧИКИ • МАТКА', en: 'WORKERS • WARRIORS • SCOUTS • QUEEN' },
  introBeat2Kicker: { ru: 'ОДНА ЦЕЛЬ', en: 'ONE GOAL' },
  introBeat2Big: { ru: 'ОДИН САХАР', en: 'ONE SUGAR CUBE' },
  introBeat2Small: { ru: 'СПРЯТАН В САМОЙ ДАЛЬНЕЙ ГЛУБИНЕ', en: 'BURIED IN THE DEEPEST REACHES' },
  introMapWord: { ru: 'КАРТА', en: 'MAP' },
  introBeat3Big: { ru: 'ПРОГРЫЗИ ПУТЬ', en: 'CARVE YOUR WAY' },
  introBeat3Small: { ru: 'РАСКРОЙ ТАЙНУЮ КАРТИНУ', en: 'UNCOVER THE HIDDEN ARTWORK' },

  // Tutorial Hints
  hintLaunchTouch: { ru: 'Тапни или потяни от гнезда — выпустить муравья', en: 'Tap or drag from the nest to launch an ant' },
  hintLaunchDesktop: { ru: 'Нажми или потяни — выпустить муравья', en: 'Click or drag to launch an ant' },
  hintZoomTouch: { ru: 'Щипок двумя пальцами — зум камеры', en: 'Pinch with two fingers to zoom camera' },
  hintZoomDesktop: { ru: 'Колесо мыши — приблизить / отдалить', en: 'Scroll wheel to zoom in / out' },
  hintPanTouch: { ru: 'Два пальца или кнопка ✋ — двигать камеру', en: 'Two fingers or ✋ button to pan camera' },
  hintPanDesktop: { ru: 'ПКМ или WASD / стрелки — двигать камеру', en: 'Right-Click or WASD / Arrows to pan' },

  // Sugar Found Celebration & Epic Clear
  sugarCinemaBanner: { ru: '✦ КРИСТАЛЛ САХАРА ОБНАРУЖЕН ✦', en: '✦ SUGAR CRYSTAL UNCOVERED ✦' },
  sugarNewRecord: { ru: '🏆 НОВЫЙ РЕКОРД!', en: '🏆 NEW RECORD!' },
  sugarBadge: { ru: '✦ ГЛАВНАЯ НАХОДКА КАРТЫ ✦', en: '✦ GRAND MAP DISCOVERY ✦' },
  sugarTitle: { ru: 'САХАР НАЙДЕН!', en: 'SUGAR FOUND!' },
  sugarSub: { ru: 'Карта «{name}» покорена!', en: 'Map "{name}" conquered!' },
  statDug: { ru: 'Прогрызено', en: 'Excavated' },
  statArt: { ru: 'Картина', en: 'Artwork' },
  statCrystals: { ru: 'Кристаллов', en: 'Crystals' },
  statTime: { ru: 'Время', en: 'Time' },
  chooseMutationBtn: { ru: '🧬 Выбрать мутацию →', en: '🧬 Choose Mutation →' },
  continueBtn: { ru: 'Продолжить →', en: 'Continue →' },
  epicBadge: { ru: '✨ ШЕДЕВР ОТКРЫТ НА 100% ✨', en: '✨ MASTERPIECE 100% REVEALED ✨' },
  epicSub: { ru: 'Все блоки прогрызены — картина сияет во всей красе!', en: 'Every block excavated — the artwork shines in full glory!' },
  epicAdmire: { ru: 'Любоваться', en: 'Admire' },
  epicSavePng: { ru: '⬇ PNG', en: '⬇ PNG' },
  epicNext: { ru: 'Следующая карта →', en: 'Next Map →' },
  epicNextNamed: { ru: 'Далее: {name} →', en: 'Next: {name} →' },

  // Skill Tree Inspector & Side General Upgrades
  stTitle: { ru: 'Дерево навыков', en: 'Skill Tree' },
  stGeneralTitle: { ru: 'Общие', en: 'General' },
  stSelectNode: { ru: 'Выберите узел', en: 'Select a node' },
  stDefaultDesc: {
    ru: 'Наведите на любой узел, чтобы увидеть описание. Нажмите на доступный узел, чтобы изучить его.',
    en: 'Hover any node to inspect details. Click an available node to unlock or upgrade it.'
  },
  stAvailableSp: { ru: 'Доступно очков', en: 'Available SP' },
  stLearn: { ru: 'Изучить', en: 'Unlock' },
  stUpgrade: { ru: 'Улучшить', en: 'Upgrade' },
  stMaxed: { ru: '✓ Изучено', en: '✓ Maxed' },

  // Modals: Maps / Levels
  mapsTitle: { ru: '🗺 Карты — Классический режим', en: '🗺 Maps — Classic Mode' },
  badgeHard: { ru: '🔥 Сложная', en: '🔥 Hard' },
  badgeExtreme: { ru: '💀 Экстрим', en: '💀 Extreme' },
  badgeDone: { ru: '🧊 Пройден', en: '🧊 Cleared' },
  badge100: { ru: '✨ 100%', en: '✨ 100%' },
  mapLockedDesc: { ru: 'Найдите сахар на предыдущем уровне, чтобы открыть', en: 'Find Sugar on the previous map to unlock' },
  btnContinue: { ru: 'Продолжить', en: 'Continue' },
  btnRestart: { ru: 'Заново', en: 'Restart' },
  btnPlay: { ru: 'Играть', en: 'Play' },
  btnLocked: { ru: 'Закрыт', en: 'Locked' },

  // Modal: Gallery
  galleryTitle: { ru: '🖼 Галерея картин ({n}/{total})', en: '🖼 Artwork Gallery ({n}/{total})' },
  gallerySummary: {
    ru: 'Находите сахар или очищайте карты на 100%, чтобы открывать картины в коллекции и сохранять их в высоком качестве PNG!',
    en: 'Find Sugar or 100% clear maps to unlock artworks in your collection and export them as crisp high-res PNGs!'
  },
  galleryClearedBadge: { ru: '✨ Переливающийся шедевр (100%)', en: '✨ Iridescent Masterpiece (100%)' },
  galleryDiscoveredBadge: { ru: '🧊 Картина открыта', en: '🧊 Artwork Discovered' },
  galleryLockedTitle: { ru: '??? (Скрытая картина)', en: '??? (Hidden Artwork)' },
  galleryLockedHint: { ru: 'Найдите сахар на карте «{name}», чтобы открыть её в галерее', en: 'Find Sugar on "{name}" to unlock this artwork' },
  gallerySavePng: { ru: '⬇ Сохранить PNG', en: '⬇ Save PNG' },
  galleryPreview: { ru: '🔍 Открыть', en: '🔍 View' },
  gallerySavedToast: { ru: '🖼 Картина «{name}» сохранена в PNG!', en: '🖼 Saved "{name}" as PNG!' },
  galleryBack: { ru: '← Назад в галерею', en: '← Back to Gallery' },

  // Modal: Colony Statistics & Personal Records
  statsTitle: { ru: '📊 Статистика колонии и рекорды', en: '📊 Colony Stats & Personal Records' },
  statTotalBlocks: { ru: 'Прогрызено блоков', en: 'Blocks Excavated' },
  statTotalAnts: { ru: 'Выпущено муравьёв', en: 'Ants Summoned' },
  statTotalTime: { ru: 'Время в игре', en: 'Total Play Time' },
  statTotalCrystals: { ru: 'Собрано кристаллов', en: 'Crystals Collected' },
  statTotalSugars: { ru: 'Найдено сахаров', en: 'Sugars Found' },
  statFavAnt: { ru: 'Любимый муравей', en: 'Favorite Ant' },
  statNone: { ru: 'Пока нет', en: 'None yet' },
  statUndergroundTitle: { ru: 'Подземные находки и постоянные бонусы', en: 'Underground Finds & Permanent Bonuses' },
  statSpores: { ru: 'Взрывных спор', en: 'Explosive Spores' },
  statDust: { ru: 'Сахарной пыли', en: 'Sugar Dust Veins' },
  statCocoons: { ru: 'Древних коконов', en: 'Ancient Cocoons' },
  statSpeedBonus: { ru: 'Бонус скорости', en: 'Speed Bonus' },
  statStartSpBonus: { ru: 'Старт. очки (находки)', en: 'Start SP (artifacts)' },
  statClearedMaps: { ru: 'Карт на 100%', en: '100% Cleared Maps' },
  recordsTitle: { ru: 'Личные рекорды по картам', en: 'Personal Records by Map' },
  recSugarBest: { ru: 'Рекорд сахара', en: 'Best Sugar' },
  recClearBest: { ru: 'Рекорд 100%', en: 'Best 100%' },
  recMaxDig: { ru: 'Макс. раскопки', en: 'Max Dug' },
  recMaxArt: { ru: 'Макс. картина', en: 'Max Art' },

  // Modal: Artifacts / Achievements / Mutations / Credits
  artifactFoundTitle: { ru: '✨ Секретная находка обнаружена!', en: '✨ Secret Artifact Discovered!' },
  artifactFoundBonus: {
    ru: '♦ Постоянный бонус: +1 очко навыков (сейчас и на старте каждой карты!)',
    en: '♦ Permanent Bonus: +1 Skill Point (right now & at the start of every map!)'
  },
  artifactCollectBtn: { ru: 'Забрать в коллекцию', en: 'Add to Collection' },
  artifactsTitle: { ru: '🏺 Секретные находки ({n}/{total})', en: '🏺 Secret Finds ({n}/{total})' },
  artifactsSummaryTitle: {
    ru: 'Постоянный бонус коллекции: ♦ +{n} к стартовым очкам навыков',
    en: 'Permanent Collection Bonus: ♦ +{n} starting Skill Points'
  },
  artifactsSummaryDesc: {
    ru: 'На каждой из {total} карт спрятан уникальный коллекционный артефакт. Найдите его муравьями, чтобы навсегда получать +1 очко навыков!',
    en: 'Each of the {total} maps hides a unique collectible artifact. Excavate it with your ants to permanently gain +1 Skill Point!'
  },
  artifactLockedName: { ru: '??? (Секретная находка)', en: '??? (Secret Artifact)' },
  artifactForeverBadge: { ru: '+1 ♦ навсегда', en: '+1 ♦ forever' },
  artifactHiddenOn: { ru: 'Спрятано в породе на карте «{name}»', en: 'Hidden deep inside "{name}"' },

  achTitle: { ru: '🏆 Ачивки ({n}/{total})', en: '🏆 Achievements ({n}/{total})' },
  achSpeedTitle: { ru: 'Бонус скорости всех муравьёв', en: 'All-Ant Speed Bonus' },
  achSpeedPill: { ru: '⚡ +{n}% к скорости', en: '⚡ +{n}% Speed' },
  achSummaryDesc: {
    ru: 'Каждая открытая ачивка навсегда добавляет <strong>+1% к скорости всех муравьёв</strong> (в Классике и Коопе).',
    en: 'Every unlocked achievement permanently grants <strong>+1% speed to all ants</strong> (in Classic & Co-op).'
  },
  achUnlockedToast: { ru: '🏆 Ачивка: {name} (+1% к скорости!)', en: '🏆 Achievement: {name} (+1% Speed!)' },

  mutTitle: { ru: '🧬 Мутации колонии', en: '🧬 Colony Mutations' },
  mutEmptyTitle: { ru: 'Пока нет мутаций', en: 'No Mutations Yet' },
  mutEmptyDesc: { ru: 'Найдите сахар на уровне, чтобы выбрать постоянную мутацию!', en: 'Find Sugar on a map to pick a permanent colony mutation!' },
  mutChoiceTitle: { ru: '🧊 Сахар найден! Выберите Мутацию', en: '🧊 Sugar Found! Choose a Mutation' },
  mutChoiceIntro: {
    ru: 'Уровень <strong>«{name}»</strong> пройден! Выберите 1 постоянную мутацию:',
    en: 'Map <strong>"{name}"</strong> cleared! Choose 1 permanent mutation:'
  },
  mutGotToast: { ru: 'Мутация получена: {name}!', en: 'Mutation acquired: {name}!' },
  postSugarTitle: { ru: '🧊 Уровень пройден!', en: '🧊 Map Cleared!' },
  postSugarText: { ru: 'Сахар на карте <strong>«{name}»</strong> найден!', en: 'Sugar found on <strong>"{name}"</strong>!' },
  stayAndDig: { ru: 'Остаться и копать', en: 'Stay & Keep Digging' },

  // Modal: Settings
  settingsTitle: { ru: '⚙ Настройки и саундтрек', en: '⚙ Settings & Soundtrack' },
  setLangTitle: { ru: '🌐 Язык интерфейса', en: '🌐 Interface Language' },
  setLangDesc: { ru: 'Переключение между русским и английским без перезагрузки', en: 'Switch between Russian and English instantly' },
  setSoundtrack: { ru: 'Саундтрек', en: 'Soundtrack' },
  setOn: { ru: 'Вкл', en: 'On' },
  setOff: { ru: 'Выкл', en: 'Off' },
  setAutoTrack: { ru: 'Автосмена саундтреков', en: 'Auto-Switch Soundtracks' },
  setAutoTrackDesc: { ru: 'Плавно переключать треки каждые 2.5 минуты', en: 'Smoothly rotate tracks every 2.5 minutes' },
  setMusicVol: { ru: '🎵 Громкость музыки', en: '🎵 Music Volume' },
  setSfxVol: { ru: '🔊 Громкость эффектов', en: '🔊 SFX Volume' },
  setMusicToggle: { ru: 'Фоновая музыка', en: 'Background Music' },
  setMusicDesc: { ru: 'Эмбиент, трип-хоп и IDM-синтез', en: 'Ambient, trip-hop & IDM synth' },
  setSfxToggle: { ru: 'Звуковые эффекты', en: 'Sound Effects' },
  setSfxDesc: { ru: 'Муравьи вблизи, находки, кристаллы и интерфейс', en: 'Close-up ants, discoveries, crystals & UI' },
  setAutoSummon: { ru: '🤖 Умный авто-призыв', en: '🤖 Smart Auto-Summon' },
  setAutoSummonDesc: {
    ru: 'Автоматически выпускать выбранных муравьёв по стратегии (умный фронт, метка или гнездо)',
    en: 'Automatically deploy selected ants using your strategy (Smart frontier, Beacon, or Nest)'
  },
  setAutoSummonOn: { ru: '🤖 Умный авто-призыв включён', en: '🤖 Smart Auto-Summon enabled' },
  setAutoSummonOff: { ru: '🤖 Авто-призыв выключен', en: '🤖 Auto-Summon disabled' },
  setResetTitle: { ru: 'Сброс прогресса', en: 'Reset Progress' },
  setResetDesc: { ru: 'Очистить уровни, рекорды, мутации, находки и ачивки', en: 'Clear maps, records, mutations, finds & achievements' },
  setResetBtn: { ru: 'Сбросить', en: 'Reset' },
  setResetToast: { ru: 'Прогресс, рекорды, мутации, находки и ачивки сброшены', en: 'Progress, records, mutations, finds & achievements reset' },
  trackSwitchedToast: { ru: '♪ Саундтрек: {name}', en: '♪ Soundtrack: {name}' },

  // Credits
  creditsTitle: { ru: '✦ Авторы — Sugar Ants', en: '✦ Credits — Sugar Ants' },
  creditsSub: { ru: 'Медитативная симуляция колонии', en: 'Meditative Colony Simulation' },
  creditsAuthorLbl: { ru: 'АВТОР И ИДЕЯ', en: 'CREATOR & DESIGN' },
  creditsAudioLbl: { ru: 'САУНДТРЕК И СИНТЕЗ', en: 'SOUNDTRACK & SYNTHESIS' },
  creditsAudioVal: { ru: 'Процедурный Web Audio движок<br/>Эмбиент • Трип-хоп • IDM', en: 'Procedural Web Audio Engine<br/>Ambient • Trip-Hop • IDM' },
  creditsThanksLbl: { ru: 'ОСОБАЯ БЛАГОДАРНОСТЬ', en: 'SPECIAL THANKS' },
  creditsThanksName: { ru: '🦐 Креветочке Русе', en: '🦐 Rusya the Shrimp' },
  creditsThanksPlayers: { ru: 'и всем игрокам!', en: 'and all players!' },
  creditsTgBtn: { ru: 'Наш Telegram', en: 'Our Telegram' },

  // Engine & Gameplay Toasts
  toastPrevMapLocked: { ru: 'Сначала пройдите предыдущий уровень!', en: 'Clear the previous map first!' },
  toastLevelStartSp: { ru: '{name} • Старт с ♦ {sp} очк. навыков!', en: '{name} • Starting with ♦ {sp} SP!' },
  toastLevelStart: { ru: 'Уровень: {name}', en: 'Map: {name}' },
  toastResumeRun: { ru: '▶ Продолжаем: {name} ({pct}%)', en: '▶ Resuming: {name} ({pct}%)' },
  toastBeaconMove: {
    ru: '📍 Нажми на карту — поставить метку на 30 сек (кулдаун 2 мин)',
    en: '📍 Tap the map to place a 30s Beacon (2 min cooldown)'
  },
  toastBeaconPlace: {
    ru: '📍 Нажми на карту — поставить феромонную метку на 30 сек',
    en: '📍 Tap the map to place a Pheromone Beacon for 30s'
  },
  toastBeaconActive: {
    ru: '📍 Метка активна ещё {sec}с — рабочие и выводок идут к ней!',
    en: '📍 Beacon active for {sec}s more — Workers & Brood are heading there!'
  },
  toastBeaconCd: {
    ru: '📍 Феромонная метка перезаряжается: {time}',
    en: '📍 Pheromone Beacon recharging: {time}'
  },
  toastBeaconCleared: { ru: '📍 Феромонная метка рассеялась', en: '📍 Pheromone Beacon dissipated' },
  toastBeaconSet: {
    ru: '📍 Метка поставлена на {sec} сек! Рабочие и выводок тянутся туда',
    en: '📍 Beacon active for {sec}s! Free Workers & Brood are drawn there'
  },
  toastBloodhoundGo: {
    ru: '🧭 Ищейка взяла след сахара! Следуй за золотым хвостом!',
    en: '🧭 Bloodhound caught the Sugar scent! Follow the golden trail!'
  },
  toastBloodhoundCd: { ru: 'Ищейка перезаряжается: {time}', en: 'Bloodhound recharging: {time}' },
  toastAntCap: {
    ru: 'Лимит «{name}»: {cap}/{cap} (увеличь в дереве навыков)',
    en: '"{name}" limit: {cap}/{cap} (increase in Skill Tree)'
  },
  toastQueenAnomaly: {
    ru: '♛ Королевская аномалия: Матка родила особого муравья!',
    en: '♛ Royal Anomaly: Queen hatched a special ant!'
  },
  toastSpGain: { ru: '♦ +{n} очко навыков', en: '♦ +{n} Skill Point' },
  toastSporeBlast: { ru: '💥 Взрывная спора расчистила пещеру!', en: '💥 Explosive Spore blasted open a cavern!' },
  toastSugarDust: { ru: '✨ Сахарная пыль! Скорость роя ×1.6 на 15 сек!', en: '✨ Sugar Dust! Colony speed ×1.6 for 15s!' },
  toastCocoonHatch: { ru: '🥚 Древний кокон! Освобождены 3 союзных муравья!', en: '🥚 Ancient Cocoon! 3 allied ants freed!' },
  toastTouchPanOn: { ru: '✋ Режим камеры: 1 палец двигает карту', en: '✋ Camera Mode: 1-finger drags the map' },
  toastTouchPanOff: { ru: '🐜 Режим запуска: касание выпускает муравья', en: '🐜 Launch Mode: tap to deploy ants' },

  // Multiplayer HUD & Lobby
  mpHudExit: { ru: 'Выйти в меню', en: 'Exit to Menu' },
  mpHudDig: { ru: 'Прогресс очистки карты', en: 'Map excavation progress' },
  mpHudPlayers: { ru: 'Игроки в комнате', en: 'Players in room' },
  mpHudSp: { ru: 'Ваши очки навыков', en: 'Your Skill Points' },
  mpHudTimer: { ru: 'До бонусных очков навыков (каждые 5 мин)', en: 'Until bonus SP drop (every 5 min)' },
  mpHudPing: { ru: 'Поставить маяк на карте', en: 'Place ping on map' },
  mpHudChat: { ru: 'Чат', en: 'Chat' },
  mpHudBase: { ru: 'К своей базе', en: 'Center on base' },
  mpChatPlaceholder: { ru: 'Написать в чат…', en: 'Type a message…' },
  mpLobbyTitle: { ru: '⚔ Мультиплеер — Список лобби', en: '⚔ Multiplayer — Lobby Browser' },
  mpLobbyRoomTitle: { ru: '🌐 Лобби • {code}', en: '🌐 Lobby • {code}' },
  mpProfileLabel: { ru: 'Ваш профиль (Ник, Скин, Цвет)', en: 'Your Profile (Nick, Skin, Color)' },
  mpNickPlaceholder: { ru: 'Ваш ник…', en: 'Your nickname…' },
  mpTaken: { ru: 'занят', en: 'taken' },
  mpCoopTitle: { ru: '🤝 Кооператив (до 10)', en: '🤝 Co-op (up to 10)' },
  mpCoopSub: { ru: 'Древо навыков, голосование, чат', en: 'Skill tree, map voting, chat' },
  mpVsTitle: { ru: '⚔ Гонка 1 на 1', en: '⚔ 1v1 Race' },
  mpVsSub: { ru: 'Кто первым найдёт сахар', en: 'First to reach the Sugar wins' },
  mpPassPlaceholder: { ru: 'Пароль (необяз.)', en: 'Password (optional)' },
  mpCreateBtn: { ru: '🌐 Создать лобби', en: '🌐 Create Lobby' },
  mpBotTitle: { ru: '🤖 Быстрый матч против ИИ', en: '🤖 Quick Match vs AI' },
  mpBotDesc: { ru: 'Запустить гонку 1v1 против соперника-бота прямо сейчас', en: 'Start a 1v1 race against an AI colony right now' },
  mpBotBtn: { ru: 'Старт vs ИИ', en: 'Start vs AI' },
  mpCodePlaceholder: { ru: 'Код комнаты (ANT-XXXX)', en: 'Room code (ANT-XXXX)' },
  mpJoinBtn: { ru: 'Войти', en: 'Join' },
  mpOpenLobbies: { ru: 'Открытые онлайн-лобби', en: 'Open Online Lobbies' },
  mpOnline: { ru: '🟢 Онлайн', en: '🟢 Online' },
  mpConnecting: { ru: '🟡 Подключение…', en: '🟡 Connecting…' },
  mpRefresh: { ru: '↻ Обновить', en: '↻ Refresh' },
  mpNoLobbiesOnline: {
    ru: 'Пока нет активных онлайн-лобби — создайте своё, и оно сразу появится в списке у всех игроков!',
    en: 'No active online lobbies yet — create one and it will appear for all players!'
  },
  mpNoLobbiesOffline: {
    ru: 'Подключаемся к онлайн-серверу лобби… Вы также можете создать комнату или войти по коду.',
    en: 'Connecting to lobby directory… You can also create a room or join by code.'
  },
  mpInGame: { ru: 'В игре (можно войти!)', en: 'In game (joinable!)' },
  mpInLobby: { ru: 'В лобби', en: 'In lobby' },
  mpCoopShort: { ru: '🤝 Кооп', en: '🤝 Co-op' },
  mpRaceAi: { ru: '⚔ Гонка vs ИИ', en: '⚔ Race vs AI' },
  mpRace1v1: { ru: '⚔ Гонка 1v1', en: '⚔ 1v1 Race' },
  mpPlayersInLobby: { ru: 'Игроки в лобби', en: 'Players in Lobby' },
  mpLobbyChat: { ru: 'Чат лобби', en: 'Lobby Chat' },
  mpLobbyChatPh: { ru: 'Сообщение в чат лобби…', en: 'Message lobby chat…' },
  mpSend: { ru: 'Отправить', en: 'Send' },
  mpLeaveLobby: { ru: 'Покинуть лобби', en: 'Leave Lobby' },
  mpStartGame: { ru: '▶ Начать игру', en: '▶ Start Game' },
  mpForceJoin: { ru: '⚡ Войти принудительно', en: '⚡ Force Join' },
  mpStayVote: { ru: '✕ Остаться', en: '✕ Stay' },
  mpVoted: { ru: 'Проголосовало', en: 'Voted' },
  mpVsWinTitle: { ru: '🏆 Победа вашей колонии!', en: '🏆 Victory for Your Colony!' },
  mpVsLoseTitle: { ru: '⚔ Соперник оказался быстрее!', en: '⚔ Rival Was Faster!' },
  mpVsWinBody: { ru: 'Ваши муравьи первыми добрались до сахара!', en: 'Your ants reached the Sugar first!' },
  mpVsLoseBody: { ru: 'Победил {nick}!', en: '{nick} won the race!' },
  mpNewMap: { ru: 'Новая карта', en: 'New Map' },
  mpToMenu: { ru: 'В меню', en: 'Main Menu' }
};

export function t(key: keyof typeof STRINGS, vars?: Record<string, string | number>): string {
  const entry = STRINGS[key];
  if (!entry) return String(key);
  let out = currentLang === 'en' ? entry.en : entry.ru;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return out;
}
