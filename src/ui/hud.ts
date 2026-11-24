import { ANT_TYPES, PLAYABLE_ANTS } from '../core/ants';
import { SOUNDTRACKS } from '../core/audio';
import { isMobileDevice } from '../core/device';
import { downloadArtworkPng, renderArtworkToCanvas } from '../core/gallery';
import {
  formatNum,
  formatPlayTime,
  formatRecordTime,
  getLang,
  loc,
  t
} from '../core/i18n';
import { LEVELS } from '../core/levels';
import {
  AchievementDef,
  AntSkinId,
  ArtifactDef,
  AutoSummonMode,
  Language,
  LevelDefinition,
  PLAYER_COLORS,
  PlayableAntId,
  SkillIcon,
  SkillNodeDef
} from '../core/types';
import { ACHIEVEMENTS } from '../game/achievements';
import { SECRET_ARTIFACTS, renderArtifactSvg } from '../game/artifacts';
import { GameEngine } from '../game/engine';
import { MenuBackground } from '../game/menuBg';
import { MUTATIONS, pickMutationChoices, renderMutationSvg } from '../game/mutations';
import { BRANCH_COLORS, SKILL_NODES } from '../game/skillTree';
import { computeCoopMapSize, MultiplayerEngine } from '../multiplayer/mpEngine';
import {
  ChatMessage,
  listOpenLobbies,
  MpMapSizePreset,
  MpMessage,
  MpMode,
  MpPlayerInfo,
  MpTransport,
  SyncedVotePayload
} from '../multiplayer/mpTransport';
import { onlineDirectory } from '../multiplayer/onlineDirectory';

const NODE_STEP = 74;
const ORIGIN_X = 270;
const ORIGIN_Y = 192;
const NICK_STORAGE_KEY = 'sugar_ants_nick_v1';
const HINTS_DONE_KEY = 'sugar_ants_hints_done_v1';

const SKIN_OPTIONS: { id: AntSkinId; name: string; nameEn: string }[] = [
  { id: 'classic', name: 'Классик', nameEn: 'Classic' },
  { id: 'cyber', name: 'Кибер', nameEn: 'Cyber' },
  { id: 'royal', name: 'Король', nameEn: 'Royal' }
];

function renderSkillSvg(icon: SkillIcon): string {
  switch (icon) {
    case 'ant':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <ellipse cx="12" cy="17.5" rx="3.4" ry="4" fill="currentColor" fill-opacity="0.28"/>
        <ellipse cx="12" cy="11.5" rx="2" ry="2.2" fill="currentColor" fill-opacity="0.5"/>
        <circle cx="12" cy="6.8" r="2.1" fill="currentColor"/>
        <path d="M10.5 5 8 2.5M13.5 5 16 2.5M10 10 5.5 8M14 10 18.5 8M10 12 5 13M14 12 19 13M10 14 6 18M14 14 18 18"/>
      </svg>`;
    case 'compass':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <polygon points="15.5,8.5 13.5,13.5 8.5,15.5 10.5,10.5" fill="currentColor" fill-opacity="0.45"/>
      </svg>`;
    case 'sword':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.5 17.5 3 6V3h3l11.5 11.5"/>
        <path d="M13 19l6-6M16 16l4 4M19 21l2-2"/>
      </svg>`;
    case 'speed':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M4 7h9M2 12h12M6 17h8"/>
        <circle cx="18" cy="12" r="3" fill="currentColor"/>
      </svg>`;
    case 'hourglass':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 3h12M6 21h12M7 3v4l5 5 5-5V3M7 21v-4l5-5 5 5v4"/>
      </svg>`;
    case 'cleave':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 12a8 8 0 0 1 16 0"/>
        <path d="M7 16a5 5 0 0 1 10 0"/>
        <path d="M12 4v16"/>
      </svg>`;
    case 'bounce':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 18 11 11 16 16 20 6"/>
        <path d="M15 6h5v5"/>
        <circle cx="5" cy="17" r="2" fill="currentColor"/>
      </svg>`;
    case 'queen':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 17 5 8l4.5 4L12 5l2.5 7L19 8l2 9H3z" fill="currentColor" fill-opacity="0.22"/>
        <path d="M4 20h16"/>
      </svg>`;
    case 'brood':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3.2" fill="currentColor"/>
        <circle cx="5.5" cy="7.5" r="1.8" fill="currentColor"/>
        <circle cx="18.5" cy="7.5" r="1.8" fill="currentColor"/>
        <circle cx="6.5" cy="17.5" r="1.8" fill="currentColor"/>
        <circle cx="17.5" cy="17.5" r="1.8" fill="currentColor"/>
      </svg>`;
    case 'crystal':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
        <polygon points="12,2 20,12 12,22 4,12" fill="currentColor" fill-opacity="0.25"/>
      </svg>`;
    case 'swarm':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="9" cy="10" r="2.8" fill="currentColor"/>
        <circle cx="16" cy="14" r="2.4" fill="currentColor" fill-opacity="0.7"/>
        <path d="M17 5v4M15 7h4"/>
      </svg>`;
    case 'poison':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3 C12 3 6.5 10.2 6.5 14.5 A5.5 5.5 0 0 0 17.5 14.5 C17.5 10.2 12 3 12 3 Z" fill="currentColor" fill-opacity="0.28"/>
        <circle cx="10.5" cy="14.5" r="1.2" fill="currentColor"/>
        <circle cx="14" cy="16.2" r="0.9" fill="currentColor"/>
        <circle cx="13.5" cy="12" r="0.8" fill="currentColor"/>
      </svg>`;
    case 'evo':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12,2 16,8 22,12 16,16 12,22 8,16 2,12 8,8" fill="currentColor" fill-opacity="0.24"/>
        <circle cx="12" cy="12" r="3" fill="currentColor"/>
      </svg>`;
    case 'radar':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9" stroke-opacity="0.45"/>
        <circle cx="12" cy="12" r="5" stroke-opacity="0.8"/>
        <circle cx="12" cy="12" r="1.8" fill="currentColor"/>
        <path d="M12 12 L18.5 6.5"/>
      </svg>`;
    case 'beacon':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 21 C12 21 6.5 14.5 6.5 9.8 A5.5 5.5 0 1 1 17.5 9.8 C17.5 14.5 12 21 12 21 Z" fill="currentColor" fill-opacity="0.25"/>
        <circle cx="12" cy="9.5" r="2.2" fill="currentColor"/>
      </svg>`;
  }
}

export class HudController {
  private engine: GameEngine;
  private mp: MultiplayerEngine;
  private menuBg: MenuBackground;
  private mpTransport: MpTransport | null = null;

  private gameCanvasEl = document.getElementById('game-canvas')!;
  private mpCanvasEl = document.getElementById('mp-canvas')!;

  // Splash & Original Epic 4-Beat Subterranean Intro elements
  private splashOverlayEl = document.getElementById('splash-overlay')!;
  private introOverlayEl = document.getElementById('game-intro-overlay')!;
  private introStageEl = document.getElementById('intro-stage')!;
  private introVisualEl = document.getElementById('intro-visual')!;
  private introKickerEl = document.getElementById('intro-kicker')!;
  private introBigEl = document.getElementById('intro-big')!;
  private introSmallEl = document.getElementById('intro-small')!;
  private introDotsEl = document.getElementById('intro-dots')!;
  private introShockwavesEl = document.getElementById('intro-shockwaves')!;

  // Main Menu elements
  private mainMenuEl = document.getElementById('main-menu')!;
  private menuLangCodeEl = document.getElementById('menu-lang-code')!;
  private menuPlayLabelEl = document.getElementById('menu-play-label')!;
  private menuContinueSubEl = document.getElementById('menu-continue-sub')!;
  private menuArtCountEl = document.getElementById('menu-art-count')!;
  private menuAchCountEl = document.getElementById('menu-ach-count')!;
  private menuProgressCountEl = document.getElementById('menu-progress-count')!;
  private menuGalleryCountEl = document.getElementById('menu-gallery-count')!;
  private menuMutCountEl = document.getElementById('menu-mut-count')!;

  // Classic HUD elements
  private hudTopEl = document.getElementById('hud-top')!;
  private hudBottomEl = document.getElementById('hud-bottom')!;
  private touchCamControlsEl = document.getElementById('touch-cam-controls')!;
  private btnTouchPanEl = document.getElementById('btn-touch-pan')!;
  private btnTouchPanIconEl = document.getElementById('btn-touch-pan-icon')!;
  private btnTouchPanLblEl = document.getElementById('btn-touch-pan-lbl')!;
  private beaconDockEl = document.getElementById('beacon-dock')!;
  private btnAutoSummonEl = document.getElementById('btn-auto-summon')!;
  private btnAutoConfigEl = document.getElementById('btn-auto-config')!;
  private autoPopoverEl = document.getElementById('auto-popover')!;
  private autoPopModesEl = document.getElementById('auto-pop-modes')!;
  private autoPopHintEl = document.getElementById('auto-pop-hint')!;
  private autoPopAntsEl = document.getElementById('auto-pop-ants')!;
  private autoFabLabelEl = document.getElementById('auto-fab-label')!;
  private autoFabStatusEl = document.getElementById('auto-fab-status')!;
  private beaconFabLabelEl = document.getElementById('beacon-fab-label')!;
  private beaconFabStatusEl = document.getElementById('beacon-fab-status')!;
  private mpTouchCamControlsEl = document.getElementById('mp-touch-cam-controls')!;
  private mpBtnTouchPanEl = document.getElementById('mp-btn-touch-pan')!;
  private levelNameEl = document.getElementById('level-name')!;
  private statMutCountEl = document.getElementById('stat-mut-count')!;
  private statArtifactsCountEl = document.getElementById('stat-artifacts-count')!;
  private statAchCountEl = document.getElementById('stat-ach-count')!;
  private statSpEl = document.getElementById('stat-sp')!;
  private statArtEl = document.getElementById('stat-art')!;
  private statDigEl = document.getElementById('stat-dig')!;
  private statSugarEl = document.getElementById('stat-sugar')!;
  private sugarChipEl = document.getElementById('sugar-chip')!;
  private rushChipEl = document.getElementById('rush-chip')!;
  private statRushEl = document.getElementById('stat-rush')!;
  private btnBeaconEl = document.getElementById('btn-beacon')!;
  private antBarEl = document.getElementById('ant-bar')!;
  private upgradeBadgeEl = document.getElementById('upgrade-badge')!;
  private tutorialHintEl = document.getElementById('tutorial-hint')!;
  private tutorialHintIconEl = document.getElementById('tutorial-hint-icon')!;
  private tutorialHintTextEl = document.getElementById('tutorial-hint-text')!;
  private sugarCinemaOverlayEl = document.getElementById('sugar-cinema-overlay')!;
  private sugarCinemaBannerEl = document.getElementById('sugar-cinema-banner')!;
  private sugarCinemaSubEl = document.getElementById('sugar-cinema-sub')!;
  private sugarFoundOverlayEl = document.getElementById('sugar-found-overlay')!;
  private sugarRecordBadgeEl = document.getElementById('sugar-record-badge')!;
  private sugarFoundSubEl = document.getElementById('sugar-found-sub')!;
  private sugarFoundStatsEl = document.getElementById('sugar-found-stats')!;
  private sugarFoundCtaEl = document.getElementById('sugar-found-cta') as HTMLButtonElement;
  private epicClearBannerEl = document.getElementById('epic-clear-banner')!;
  private epicClearTitleEl = document.getElementById('epic-clear-title')!;
  private epicBtnSavePngEl = document.getElementById('epic-btn-save-png') as HTMLButtonElement;
  private epicBtnNextEl = document.getElementById('epic-btn-next') as HTMLButtonElement;
  private toastContainerEl = document.getElementById('toast-container')!;

  // Multiplayer HUD elements
  private mpHudTopEl = document.getElementById('mp-hud-top')!;
  private mpHudBottomEl = document.getElementById('mp-hud-bottom')!;
  private mpModeLabelEl = document.getElementById('mp-mode-label')!;
  private mpDigPctEl = document.getElementById('mp-dig-pct')!;
  private mpPlayerCountEl = document.getElementById('mp-player-count')!;
  private mpLocalSpEl = document.getElementById('mp-local-sp')!;
  private mpSpTimerEl = document.getElementById('mp-sp-timer')!;
  private mpBtnPingEl = document.getElementById('mp-btn-ping')!;
  private mpBtnChatToggleEl = document.getElementById('mp-btn-chat-toggle')!;
  private mpAntBarEl = document.getElementById('mp-ant-bar')!;
  private mpSkillBadgeEl = document.getElementById('mp-skill-badge')!;

  // Multiplayer Vote & Chat elements
  private mpVoteBannerEl = document.getElementById('mp-vote-banner')!;
  private mpVoteTextEl = document.getElementById('mp-vote-text')!;
  private mpVoteActionsEl = document.getElementById('mp-vote-actions')!;
  private mpVoteTallyEl = document.getElementById('mp-vote-tally')!;
  private mpChatBoxEl = document.getElementById('mp-chat-box')!;
  private mpChatLogEl = document.getElementById('mp-chat-log')!;
  private mpChatFormEl = document.getElementById('mp-chat-form') as HTMLFormElement;
  private mpChatInputEl = document.getElementById('mp-chat-input') as HTMLInputElement;

  // Skill tree elements
  private stOverlayEl = document.getElementById('skill-tree-overlay')!;
  private stGeneralNodesEl = document.getElementById('st-general-nodes')!;
  private stLinksEl = document.getElementById('st-links') as unknown as SVGSVGElement;
  private stNodesEl = document.getElementById('st-nodes')!;
  private stPointsNumEl = document.getElementById('st-points-num')!;
  private stTooltipEl = document.getElementById('st-tooltip')!;
  private stTtCatEl = document.getElementById('st-tt-cat')!;
  private stTtTitleEl = document.getElementById('st-tt-title')!;
  private stTtDescEl = document.getElementById('st-tt-desc')!;
  private stTtCostEl = document.getElementById('st-tt-cost')!;
  private stTtBuyEl = document.getElementById('st-tt-buy') as HTMLButtonElement;

  // Generic modal elements
  private modalBackdropEl = document.getElementById('modal-backdrop')!;
  private modalTitleEl = document.getElementById('modal-title')!;
  private modalBodyEl = document.getElementById('modal-body')!;

  private mode: 'menu' | 'classic' | 'mp' = 'menu';
  private skillTreeOpen = false;
  private autoPopoverOpen = false;
  private lastRenderedSp = -1;
  private selectedNodeId: string = 'worker_root';
  private lastBoughtNodeId: string | null = null;
  private tutorialStep: 'launch' | 'zoom' | 'pan' | 'done' = 'launch';
  private introTimers: number[] = [];
  private introRafId = 0;
  private introCancelFn: (() => void) | null = null;
  private epicNextAction: (() => void) | null = null;
  private epicCurrentLevel: LevelDefinition | null = null;
  private pendingSugarLevel: LevelDefinition | null = null;

  // Multiplayer Lobby & Profile State
  private localNick: string;
  private localColorIndex = 0;
  private localSkin: AntSkinId = 'classic';
  private lobbyMpMode: MpMode = 'coop';
  private lobbyLevelId: string = LEVELS[0].id;
  private lobbyMapSize: MpMapSizePreset = 'auto';
  private lobbyPlayers: MpPlayerInfo[] = [];
  private lobbyStatus = '';
  private inLobbyRoom = false;
  private lobbyBrowserOpen = false;
  private lobbyBrowserRefreshTimer: number | null = null;
  private unsubOnlineLobbies: (() => void) | null = null;
  private chatMessages: ChatMessage[] = [];
  private chatOpen = true;
  private mpSyncedWithHost = false;
  private forceJoinRetryTimer: number | null = null;
  private pendingRleSync: {
    syncId: string;
    total: number;
    parts: Map<number, string>;
    payload: Extract<MpMessage, { type: 'late_sync' }>;
    fallbackTimer: number;
  } | null = null;

  constructor(engine: GameEngine, mp: MultiplayerEngine, menuBg: MenuBackground) {
    this.engine = engine;
    this.mp = mp;
    this.menuBg = menuBg;

    this.localNick =
      localStorage.getItem(NICK_STORAGE_KEY) || `Муравей-${Math.floor(10 + Math.random() * 89)}`;
    if (localStorage.getItem(HINTS_DONE_KEY) === '1') {
      this.tutorialStep = 'done';
    }

    this.engine.audio.onTrackAutoSwitch = (track) => {
      this.engine.skillTree.updateSettings({ soundtrack: track.id });
      this.showToast(t('trackSwitchedToast', { name: loc(track.name, track.nameEn) }));
    };
    this.engine.skillTree.onAchievementUnlocked = (ach) => this.handleAchievementUnlocked(ach);

    this.bindButtons();
    this.bindUiSounds();
    this.applyLanguage();
    this.showMainMenu();
    this.playStartupSplash();
  }

  /** Instant live RU / EN switcher across every static DOM label, tooltip, HUD & open screen! */
  private setLanguage(next: Language) {
    this.engine.skillTree.updateSettings({ language: next });
    this.applyLanguage();
  }

  private toggleLanguage() {
    this.setLanguage(getLang() === 'ru' ? 'en' : 'ru');
  }

  private applyLanguage() {
    const lang = getLang();
    document.documentElement.lang = lang;
    document.title = t('docTitle');
    this.menuLangCodeEl.textContent = lang.toUpperCase();

    const setText = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    const setTitle = (id: string, title: string) => {
      const el = document.getElementById(id);
      if (el) el.title = title;
    };

    // Splash & Intro skip notes
    setText('splash-skip-note', t('skipNote'));
    setText('intro-skip-note', t('skipNote'));

    // Main Menu
    setText('menu-tagline', t('tagline'));
    setText('menu-mp-label', t('multiplayer'));
    setText('menu-mp-meta', t('mpMeta'));
    setText('menu-art-label', t('secretFinds'));
    setText('menu-ach-label', t('achievements'));
    setText('menu-lbl-levels', t('maps'));
    setText('menu-lbl-gallery', t('gallery'));
    setText('menu-lbl-stats', t('stats'));
    setText('menu-lbl-mutations', t('mutations'));
    setText('menu-lbl-settings', t('settings'));
    setText('menu-lbl-credits', t('credits'));
    setText('menu-donate-text', t('donate'));

    // Classic HUD tooltips & labels
    setTitle('btn-menu', t('tipMainMenu'));
    setTitle('btn-levels', t('tipSelectLevel'));
    setTitle('btn-mutations', t('tipMutations'));
    setTitle('btn-artifacts', t('tipArtifacts'));
    setTitle('btn-achievements', t('tipAchievements'));
    setTitle('chip-sp', t('tipSp'));
    setTitle('chip-art', t('tipArt'));
    setTitle('chip-dig', t('tipDig'));
    setTitle('sugar-chip', t('tipSugar'));
    setTitle('rush-chip', t('tipRush'));
    setTitle('btn-auto-summon', t('tipAuto'));
    setTitle('btn-auto-config', t('tipAutoConfig'));
    setText('auto-pop-title', t('autoPopoverTitle'));
    setText('auto-pop-mode-label', t('autoModeLabel'));
    setText('auto-pop-ants-label', t('autoAntsLabel'));
    this.autoFabLabelEl.textContent = t('autoFabLabel');
    setTitle('btn-beacon', t('tipBeacon'));
    this.beaconFabLabelEl.textContent = t('beaconLabel');
    this.syncTouchPanButton();
    setTitle('btn-settings-hud', t('tipSettings'));
    setTitle('btn-reset-cam', t('tipCenterCam'));
    setTitle('btn-touch-pan', t('tipTouchPan'));
    setTitle('btn-zoom-in', t('tipZoomIn'));
    setTitle('btn-zoom-out', t('tipZoomOut'));
    setText('btn-upgrades-label', t('skills'));

    // Sugar Cinema Banner, Sugar Found Overlay & Epic 100% Clear Banner
    this.sugarCinemaBannerEl.textContent = t('sugarCinemaBanner');
    this.sugarRecordBadgeEl.textContent = t('sugarNewRecord');
    setText('sugar-found-badge', t('sugarBadge'));
    setText('sugar-found-title', t('sugarTitle'));
    setText('epic-clear-badge', t('epicBadge'));
    setText('epic-clear-sub', t('epicSub'));
    setText('epic-btn-admire', t('epicAdmire'));
    setText('epic-btn-save-png', t('epicSavePng'));

    if (this.autoPopoverOpen) {
      this.renderAutoPopover();
    }

    // Skill Tree inspector static text
    setText('st-general-title', `✦ ${t('stGeneralTitle')}`);
    setText('st-points-label', t('stAvailableSp'));
    if (!this.skillTreeOpen) {
      this.stTtCatEl.textContent = t('stTitle');
      this.stTtTitleEl.textContent = t('stSelectNode');
      this.stTtDescEl.textContent = t('stDefaultDesc');
    } else {
      this.renderSkillTree(false);
    }

    // Multiplayer HUD tooltips & chat input
    setTitle('mp-btn-menu', t('mpHudExit'));
    setTitle('mp-chip-dig', t('mpHudDig'));
    setTitle('mp-chip-players', t('mpHudPlayers'));
    setTitle('mp-chip-sp', t('mpHudSp'));
    setTitle('mp-chip-timer', t('mpHudTimer'));
    setTitle('mp-btn-ping', t('mpHudPing'));
    setTitle('mp-btn-chat-toggle', t('mpHudChat'));
    setTitle('mp-btn-settings', t('tipSettings'));
    setTitle('mp-btn-reset-cam', t('mpHudBase'));
    setTitle('mp-btn-touch-pan', t('tipTouchPan'));
    setTitle('mp-btn-zoom-in', t('tipZoomIn'));
    setTitle('mp-btn-zoom-out', t('tipZoomOut'));
    setText('mp-btn-skills-label', t('skills'));
    this.mpChatInputEl.placeholder = t('mpChatPlaceholder');

    this.syncMenuSummary();
    if (this.mode === 'classic') {
      this.sync();
      this.renderTutorialHint();
    } else if (this.mode === 'mp') {
      this.syncMpHud();
      this.syncMpVoteBanner();
    }
  }

  private syncTouchPanButton() {
    const pan = this.engine.touchPanMode;
    this.btnTouchPanEl.classList.toggle('pan-active', pan);
    this.btnTouchPanIconEl.textContent = pan ? '✋' : '🐜';
    this.btnTouchPanLblEl.textContent = pan ? t('touchModePan') : t('touchModeLaunch');
  }

  /** Crisp tactile UI hover & click SFX across all buttons (like the reference menu!) */
  private bindUiSounds() {
    let lastHovered: Element | null = null;
    const selector =
      '.mbtn, .mbtn-mini, .menu-lang-btn, .beacon-fab, .auto-config-pill, .auto-mode-chip, .auto-ant-chip, .touch-cam-btn, .action-btn, .pill-btn, .icon-btn, .ant-btn, .upgrade-btn, .track-card';
    document.addEventListener('pointerover', (e) => {
      if ((e as PointerEvent).pointerType === 'touch') return;
      const btn = (e.target as HTMLElement | null)?.closest(selector);
      if (btn && btn !== lastHovered && !(btn as HTMLButtonElement).disabled) {
        lastHovered = btn;
        this.engine.audio.playUiHover();
      } else if (!btn) {
        lastHovered = null;
      }
    });
    document.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement | null)?.closest(selector);
      if (btn && !(btn as HTMLButtonElement).disabled) {
        this.engine.audio.playUiClick();
      }
    });
  }

  /** Studio Splash Screen (GrAx STUDIO) smoothly dissolving into the stylish Main Menu */
  private playStartupSplash() {
    const el = this.splashOverlayEl;
    if (!el) return;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      el.classList.add('fade-out');
      setTimeout(() => el.classList.add('hidden'), 460);
    };

    el.addEventListener('click', () => {
      this.engine.audio.ensureStarted();
      finish();
    }, { once: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        finish();
        window.removeEventListener('keydown', onKey);
      }
    };
    window.addEventListener('keydown', onKey);

    setTimeout(() => this.engine.audio.playSplashLogo(), 120);
    setTimeout(() => {
      window.removeEventListener('keydown', onKey);
      finish();
    }, 2050);
  }

  /** Original Epic 4-Beat Subterranean Intro: Blocks -> Ant Colony -> One Sugar -> Launch! */
  private playPreGameIntro(onComplete: () => void) {
    this.cancelPreGameIntro();

    const lvl = this.engine.world.level;
    const lvlIdx = Math.max(0, LEVELS.findIndex((l) => l.id === lvl.id));
    const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][lvlIdx] || String(lvlIdx + 1);
    const totalBlocks = Math.max(1000, this.engine.world.stats.totalBreakable);
    const lvlDisplayName = loc(lvl.name, lvl.nameEn).toUpperCase();
    const blocksWord = t('introBlocksWord');

    // 100% original Sugar Ants pixel-geometric SVG emblems for each beat
    const svgBlocks = `<svg viewBox="0 0 96 96" shape-rendering="crispEdges">
      <rect x="20" y="20" width="56" height="56" rx="4" fill="#1b1410" stroke="#ffad42" stroke-width="3"/>
      <rect x="24" y="24" width="48" height="12" fill="#4f3622"/>
      <rect x="24" y="36" width="48" height="12" fill="#6b4428"/>
      <rect x="24" y="48" width="48" height="12" fill="#4e525c"/>
      <rect x="24" y="60" width="48" height="12" fill="#2a2038"/>
      <path d="M48 20 L44 36 L53 46 L42 62 L49 76" fill="none" stroke="#ffe26a" stroke-width="3"/>
      <path d="M22 48 L38 45 L44 36" fill="none" stroke="#ffad42" stroke-width="2"/>
      <path d="M74 54 L58 52 L53 46" fill="none" stroke="#ffad42" stroke-width="2"/>
      <rect x="46" y="44" width="6" height="6" fill="#ffffff"/>
    </svg>`;

    const svgColony = `<svg viewBox="0 0 96 96" shape-rendering="crispEdges">
      <circle cx="48" cy="48" r="13" fill="#0d2b1a" stroke="#3ce87a" stroke-width="3"/>
      <circle cx="48" cy="48" r="5" fill="#7dffb2"/>
      <g class="swarm-ring">
        <g transform="translate(48 16)"><rect x="-3" y="-6" width="6" height="4" fill="#7dffb2"/><rect x="-2" y="-1" width="4" height="4" fill="#3ce87a"/><rect x="-3" y="4" width="6" height="5" fill="#25b85c"/></g>
        <g transform="translate(76 32) rotate(60)"><rect x="-3" y="-6" width="6" height="4" fill="#7dffb2"/><rect x="-2" y="-1" width="4" height="4" fill="#3ce87a"/><rect x="-3" y="4" width="6" height="5" fill="#25b85c"/></g>
        <g transform="translate(76 64) rotate(120)"><rect x="-3" y="-6" width="6" height="4" fill="#7dffb2"/><rect x="-2" y="-1" width="4" height="4" fill="#3ce87a"/><rect x="-3" y="4" width="6" height="5" fill="#25b85c"/></g>
        <g transform="translate(48 80) rotate(180)"><rect x="-3" y="-6" width="6" height="4" fill="#7dffb2"/><rect x="-2" y="-1" width="4" height="4" fill="#3ce87a"/><rect x="-3" y="4" width="6" height="5" fill="#25b85c"/></g>
        <g transform="translate(20 64) rotate(240)"><rect x="-3" y="-6" width="6" height="4" fill="#7dffb2"/><rect x="-2" y="-1" width="4" height="4" fill="#3ce87a"/><rect x="-3" y="4" width="6" height="5" fill="#25b85c"/></g>
        <g transform="translate(20 32) rotate(300)"><rect x="-3" y="-6" width="6" height="4" fill="#7dffb2"/><rect x="-2" y="-1" width="4" height="4" fill="#3ce87a"/><rect x="-3" y="4" width="6" height="5" fill="#25b85c"/></g>
      </g>
    </svg>`;

    const svgSugar = `<svg viewBox="0 0 96 96" shape-rendering="crispEdges">
      <circle cx="48" cy="48" r="38" fill="none" stroke="#ffe26a" stroke-opacity="0.28" stroke-width="1.5" stroke-dasharray="5 5"/>
      <circle cx="48" cy="48" r="26" fill="none" stroke="#ffe26a" stroke-opacity="0.52" stroke-width="2"/>
      <g class="sugar-float">
        <rect x="30" y="30" width="36" height="36" fill="#ffcf4a"/>
        <rect x="33" y="33" width="30" height="30" fill="#ffe985"/>
        <rect x="36" y="36" width="24" height="24" fill="#fff7cc"/>
        <rect x="39" y="39" width="9" height="9" fill="#ffffff"/>
        <rect x="46" y="10" width="4" height="10" fill="#fff7cc"/>
        <rect x="46" y="76" width="4" height="10" fill="#fff7cc"/>
        <rect x="10" y="46" width="10" height="4" fill="#fff7cc"/>
        <rect x="76" y="46" width="10" height="4" fill="#fff7cc"/>
      </g>
    </svg>`;

    const svgLaunch = `<svg viewBox="0 0 96 96" fill="none">
      <polygon points="48,10 82,48 48,86 14,48" stroke="#7dffb2" stroke-width="3" fill="rgba(60,232,122,0.14)"/>
      <polygon points="48,22 70,48 48,74 26,48" stroke="#ffe26a" stroke-width="2.5" fill="rgba(255,226,106,0.18)"/>
      <circle cx="48" cy="48" r="8" fill="#ffffff"/>
    </svg>`;

    const beats: {
      step: 0 | 1 | 2 | 3;
      delayMs: number;
      kicker: string;
      big: string;
      small: string;
      svg: string;
      rollTo?: number;
    }[] = [
      {
        step: 0,
        delayMs: 0,
        kicker: t('introBeat0Kicker'),
        big: `${formatNum(totalBlocks)} ${blocksWord}`,
        small: t('introBeat0Small'),
        svg: svgBlocks,
        rollTo: totalBlocks
      },
      {
        step: 1,
        delayMs: 1300,
        kicker: t('introBeat1Kicker'),
        big: t('introBeat1Big'),
        small: t('introBeat1Small'),
        svg: svgColony
      },
      {
        step: 2,
        delayMs: 2550,
        kicker: t('introBeat2Kicker'),
        big: t('introBeat2Big'),
        small: t('introBeat2Small'),
        svg: svgSugar
      },
      {
        step: 3,
        delayMs: 3850,
        kicker: `${t('introMapWord')} ${roman} • ${lvlDisplayName}`,
        big: t('introBeat3Big'),
        small: t('introBeat3Small'),
        svg: svgLaunch
      }
    ];

    const el = this.introOverlayEl;
    el.style.setProperty('--map-accent', lvl.palette.accentHex);
    el.classList.remove('hidden', 'fade-out');

    const dots = Array.from(this.introDotsEl.querySelectorAll<HTMLElement>('.intro-dot'));
    const waves = Array.from(this.introShockwavesEl.querySelectorAll<HTMLElement>('.intro-wave'));

    const showBeat = (b: (typeof beats)[number]) => {
      if (this.introRafId) {
        cancelAnimationFrame(this.introRafId);
        this.introRafId = 0;
      }

      el.dataset.beat = String(b.step);
      el.classList.remove('beat-impact');
      void el.offsetWidth;
      el.classList.add('beat-impact');

      // Retrigger shockwave burst rings
      for (const w of waves) {
        w.style.animation = 'none';
        void w.offsetWidth;
        w.style.animation = '';
      }

      // Retrigger stage slam animation
      this.introVisualEl.innerHTML = b.svg;
      this.introKickerEl.textContent = b.kicker;
      this.introSmallEl.textContent = b.small;
      this.introStageEl.style.animation = 'none';
      void this.introStageEl.offsetWidth;
      this.introStageEl.style.animation = '';

      // Update progress segments
      dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === b.step);
        dot.classList.toggle('done', idx < b.step);
      });

      this.engine.audio.playIntroBeat(b.step);

      // Odometer fast count-up for real block count on Beat 0!
      if (b.rollTo !== undefined) {
        const target = b.rollTo;
        const startMs = performance.now();
        const durMs = 540;
        const tick = (now: number) => {
          const p = Math.min(1, (now - startMs) / durMs);
          const eased = 1 - Math.pow(1 - p, 3);
          const cur = Math.round(target * eased);
          this.introBigEl.textContent = `${formatNum(cur)} ${blocksWord}`;
          if (p < 1) {
            this.introRafId = requestAnimationFrame(tick);
          } else {
            this.introRafId = 0;
          }
        };
        this.introBigEl.textContent = `0 ${blocksWord}`;
        this.introRafId = requestAnimationFrame(tick);
      } else {
        this.introBigEl.textContent = b.big;
      }
    };

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      this.clearIntroTimers();
      window.removeEventListener('keydown', onKey);
      el.removeEventListener('click', finish);
      this.introCancelFn = null;
      el.classList.add('fade-out');
      setTimeout(() => el.classList.add('hidden'), 420);
      onComplete();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        finish();
      }
    };

    this.introCancelFn = finish;
    el.addEventListener('click', finish);
    window.addEventListener('keydown', onKey);

    for (const b of beats) {
      if (b.delayMs === 0) {
        showBeat(b);
      } else {
        this.introTimers.push(window.setTimeout(() => showBeat(b), b.delayMs));
      }
    }
    this.introTimers.push(window.setTimeout(finish, 4950));
  }

  private clearIntroTimers() {
    for (const t of this.introTimers) window.clearTimeout(t);
    this.introTimers = [];
    if (this.introRafId) {
      cancelAnimationFrame(this.introRafId);
      this.introRafId = 0;
    }
  }

  private cancelPreGameIntro() {
    this.clearIntroTimers();
    if (this.introCancelFn) {
      const fn = this.introCancelFn;
      this.introCancelFn = null;
      fn();
    }
    this.introOverlayEl.classList.add('hidden');
  }

  private bindButtons() {
    // Main menu buttons
    document.getElementById('menu-btn-lang')!.addEventListener('click', () => {
      this.toggleLanguage();
    });

    document.getElementById('menu-play-classic')!.addEventListener('click', () => {
      this.engine.audio.ensureStarted();
      const saved = this.engine.getSavedRunSummary();
      if (saved) {
        // Seamlessly resume saved mid-map run right where the player left off!
        this.enterClassicGame();
        if (saved.digPct > 0) {
          this.showToast(t('toastResumeRun', { name: saved.levelName, pct: saved.digPct }));
        }
      } else {
        const targetLvl = this.engine.skillTree.state.currentLevelId;
        this.engine.loadLevel(
          this.engine.skillTree.isLevelUnlocked(targetLvl) ? targetLvl : LEVELS[0].id,
          true
        );
        this.menuBg.stop();
        this.mainMenuEl.classList.add('hidden');
        this.playPreGameIntro(() => {
          this.enterClassicGame();
          this.engine.playNestRevealBurst();
        });
      }
    });

    document.getElementById('menu-play-mp')!.addEventListener('click', () => {
      this.engine.audio.ensureStarted();
      this.showToast(t('mpInDevToast'));
    });

    document.getElementById('menu-btn-artifacts')!.addEventListener('click', () => this.openArtifactsModal());
    document.getElementById('menu-btn-achievements')!.addEventListener('click', () => this.openAchievementsModal());
    document.getElementById('menu-btn-levels')!.addEventListener('click', () => this.openLevelsModal());
    document.getElementById('menu-btn-gallery')!.addEventListener('click', () => this.openGalleryModal());
    document.getElementById('menu-btn-stats')!.addEventListener('click', () => this.openStatsModal());
    document.getElementById('menu-btn-mutations')!.addEventListener('click', () => this.openMutationsModal());
    document.getElementById('menu-btn-settings')!.addEventListener('click', () => this.openSettingsModal());
    document.getElementById('menu-btn-credits')!.addEventListener('click', () => this.openCreditsModal());

    // Classic HUD buttons
    document.getElementById('btn-menu')!.addEventListener('click', () => this.showMainMenu());
    this.btnAutoSummonEl.addEventListener('click', () => {
      const next = !this.engine.skillTree.state.settings.autoSummon;
      this.engine.skillTree.updateSettings({ autoSummon: next });
      this.sync();
      if (this.autoPopoverOpen) this.renderAutoPopover();
      this.showToast(next ? t('setAutoSummonOn') : t('setAutoSummonOff'));
    });
    this.btnAutoConfigEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAutoPopover();
    });
    document.getElementById('auto-pop-close')!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAutoPopover();
    });
    document.addEventListener('pointerdown', (e) => {
      if (!this.autoPopoverOpen) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('#auto-popover') || target.closest('#btn-auto-config') || target.closest('#btn-auto-summon')) {
        return;
      }
      this.closeAutoPopover();
    });
    this.btnBeaconEl.addEventListener('click', () => {
      this.closeAutoPopover();
      this.engine.toggleBeaconMode();
    });
    document.getElementById('btn-settings-hud')!.addEventListener('click', () => this.openSettingsModal());
    document.getElementById('btn-reset-cam')!.addEventListener('click', () => this.engine.resetCamera());
    document.getElementById('btn-upgrades')!.addEventListener('click', () => this.openSkillTree());
    document.getElementById('btn-mutations')!.addEventListener('click', () => this.openMutationsModal());
    document.getElementById('btn-artifacts')!.addEventListener('click', () => this.openArtifactsModal());
    document.getElementById('btn-achievements')!.addEventListener('click', () => this.openAchievementsModal());
    document.getElementById('btn-levels')!.addEventListener('click', () => this.openLevelsModal());

    // Mobile Touch Camera Controls (Classic)
    this.btnTouchPanEl.addEventListener('click', () => {
      const next = !this.engine.touchPanMode;
      this.engine.setTouchPanMode(next);
      this.syncTouchPanButton();
      this.showToast(next ? t('toastTouchPanOn') : t('toastTouchPanOff'));
    });
    document.getElementById('btn-zoom-in')!.addEventListener('click', () => this.engine.zoomBy(1.32));
    document.getElementById('btn-zoom-out')!.addEventListener('click', () => this.engine.zoomBy(0.76));

    // Mobile Touch Camera Controls (Multiplayer)
    this.mpBtnTouchPanEl.addEventListener('click', () => {
      const next = !this.mp.touchPanMode;
      this.mp.setTouchPanMode(next);
      this.mpBtnTouchPanEl.classList.toggle('pan-active', next);
      this.mpBtnTouchPanEl.textContent = next ? '✋' : '🐜';
      this.showToast(next ? t('toastTouchPanOn') : t('toastTouchPanOff'));
    });
    document.getElementById('mp-btn-zoom-in')!.addEventListener('click', () => this.mp.zoomBy(1.32));
    document.getElementById('mp-btn-zoom-out')!.addEventListener('click', () => this.mp.zoomBy(0.76));

    // Epic Diamond-Sugar Found Celebration CTA -> smoothly opens Mutation choice!
    this.sugarFoundCtaEl.addEventListener('click', () => {
      const lvl = this.pendingSugarLevel || this.engine.world.level;
      this.pendingSugarLevel = null;
      this.sugarFoundOverlayEl.classList.add('hidden');
      this.openSugarMutationModal(lvl);
    });

    // Epic 100% Clear Banner buttons
    this.epicBtnSavePngEl.addEventListener('click', () => {
      const lvl = this.epicCurrentLevel || this.engine.world.level;
      if (downloadArtworkPng(lvl, true, getLang())) {
        this.showToast(t('gallerySavedToast', { name: loc(lvl.name, lvl.nameEn) }));
      }
    });
    document.getElementById('epic-btn-admire')!.addEventListener('click', () => {
      this.epicClearBannerEl.classList.add('hidden');
    });
    this.epicBtnNextEl.addEventListener('click', () => {
      this.epicClearBannerEl.classList.add('hidden');
      this.epicNextAction?.();
    });

    // Multiplayer HUD buttons
    document.getElementById('mp-btn-menu')!.addEventListener('click', () => {
      this.leaveMultiplayerRoom();
      this.showMainMenu();
    });
    document.getElementById('mp-btn-ping')!.addEventListener('click', () => this.mp.togglePingMode());
    document.getElementById('mp-btn-chat-toggle')!.addEventListener('click', () => {
      this.chatOpen = !this.chatOpen;
      this.mpChatBoxEl.classList.toggle('hidden', !this.chatOpen);
      if (this.chatOpen) {
        this.mpBtnChatToggleEl.classList.remove('ping-active');
        this.renderChatLogs();
      }
    });
    document.getElementById('mp-btn-settings')!.addEventListener('click', () => this.openSettingsModal());
    document.getElementById('mp-btn-reset-cam')!.addEventListener('click', () => this.mp.resetCamera());
    document.getElementById('mp-btn-skills')!.addEventListener('click', () => this.openSkillTree());

    // In-game chat form & emoji buttons
    this.mpChatFormEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.mpChatInputEl.value.trim();
      if (!text) return;
      this.mpChatInputEl.value = '';
      this.sendChatMessage(text);
    });

    this.mpChatBoxEl.querySelectorAll('.emoji-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const em = (btn as HTMLElement).dataset.emoji || '🐜';
        this.sendChatMessage(em);
      });
    });

    // Skill tree buttons
    document.getElementById('skill-tree-close')!.addEventListener('click', () => this.closeSkillTree());
    this.stTtBuyEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.tryBuySkillNode(this.selectedNodeId);
    });

    // Modal close
    document.getElementById('modal-close')!.addEventListener('click', () => this.closeModal());
    this.modalBackdropEl.addEventListener('click', (e) => {
      if (e.target === this.modalBackdropEl) this.closeModal();
    });

    window.addEventListener('keydown', (e) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (!this.sugarFoundOverlayEl.classList.contains('hidden')) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.sugarFoundCtaEl.click();
        }
        return;
      }
      if (e.key === 'Tab' || e.key === 'e' || e.key === 'E' || e.key === 'у' || e.key === 'У') {
        if (this.mode === 'classic' && this.modalBackdropEl.classList.contains('hidden')) {
          e.preventDefault();
          if (this.skillTreeOpen) this.closeSkillTree();
          else this.openSkillTree();
        }
        return;
      }
      if (e.key === 'Escape') {
        if (!this.modalBackdropEl.classList.contains('hidden')) {
          this.closeModal();
        } else if (this.autoPopoverOpen) {
          this.closeAutoPopover();
        } else if (this.skillTreeOpen) {
          this.closeSkillTree();
        } else if (this.mode === 'classic' && this.engine.beaconMode) {
          this.engine.toggleBeaconMode();
        } else if (this.mode !== 'menu') {
          this.showMainMenu();
        }
      }
    });

    // Auto-reconnect MQTT & resync exact map/chat/vote whenever returning from minimized window/tab!
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      onlineDirectory.ensureLiveConnection();
      if (this.mode === 'mp' && this.mpTransport && !this.mpTransport.isHost) {
        setTimeout(() => {
          if (!this.mpTransport || this.mpTransport.isHost || this.mode !== 'mp') return;
          if (this.mpSyncedWithHost) {
            this.mpTransport.send({ type: 'resync_req', playerId: this.mpTransport.localId });
          } else {
            this.mpTransport.send({
              type: 'hello',
              player: this.makeLocalPlayerInfo(this.mpTransport.localId, false),
              password: ''
            });
          }
        }, 350);
      }
    });
  }

  private clearForceJoinRetry() {
    if (this.forceJoinRetryTimer !== null) {
      window.clearInterval(this.forceJoinRetryTimer);
      this.forceJoinRetryTimer = null;
    }
  }

  private clearPendingRleSync() {
    if (this.pendingRleSync) {
      window.clearTimeout(this.pendingRleSync.fallbackTimer);
      this.pendingRleSync = null;
    }
  }

  private leaveMultiplayerRoom() {
    this.clearForceJoinRetry();
    this.clearPendingRleSync();
    this.mpSyncedWithHost = false;
    this.mpTransport?.close();
    this.mpTransport = null;
    this.inLobbyRoom = false;
    this.lobbyPlayers = [];
  }

  showMainMenu() {
    // Save active mid-map Classic progress right before leaving to the Main Menu!
    if (this.mode === 'classic') {
      this.engine.saveRunProgress();
    }
    this.mode = 'menu';
    this.closeAutoPopover();
    this.closeSkillTree();
    this.hideSugarCinematic();
    this.engine.paused = true;
    this.mp.stop();

    this.hudTopEl.classList.add('hidden');
    this.hudBottomEl.classList.add('hidden');
    this.beaconDockEl.classList.add('hidden');
    this.touchCamControlsEl.classList.add('hidden');
    this.mpTouchCamControlsEl.classList.add('hidden');
    this.tutorialHintEl.classList.add('hidden');
    this.sugarFoundOverlayEl.classList.add('hidden');
    this.epicClearBannerEl.classList.add('hidden');
    this.mpHudTopEl.classList.add('hidden');
    this.mpHudBottomEl.classList.add('hidden');
    this.mpVoteBannerEl.classList.add('hidden');
    this.mpChatBoxEl.classList.add('hidden');
    this.mpCanvasEl.classList.add('hidden');
    this.gameCanvasEl.classList.remove('hidden');

    this.mainMenuEl.classList.remove('hidden');
    this.syncMenuSummary();
    this.menuBg.start();
  }

  enterClassicGame() {
    this.mode = 'classic';
    this.closeModal();
    this.closeAutoPopover();
    this.hideSugarCinematic();
    this.mp.stop();
    this.menuBg.stop();

    this.mainMenuEl.classList.add('hidden');
    this.sugarFoundOverlayEl.classList.add('hidden');
    this.epicClearBannerEl.classList.add('hidden');
    this.mpHudTopEl.classList.add('hidden');
    this.mpHudBottomEl.classList.add('hidden');
    this.mpTouchCamControlsEl.classList.add('hidden');
    this.mpVoteBannerEl.classList.add('hidden');
    this.mpChatBoxEl.classList.add('hidden');
    this.mpCanvasEl.classList.add('hidden');

    this.gameCanvasEl.classList.remove('hidden');
    this.hudTopEl.classList.remove('hidden');
    this.hudBottomEl.classList.remove('hidden');
    this.beaconDockEl.classList.remove('hidden');
    this.touchCamControlsEl.classList.remove('hidden');
    this.syncTouchPanButton();
    this.engine.paused = false;
    this.sync();
    this.renderTutorialHint();
  }

  enterMultiplayerMatch(opts: {
    seed: number;
    levelId: string;
    mpMode: MpMode;
    vsBot: boolean;
    localPlayerId: string;
    players: MpPlayerInfo[];
    width?: number;
    height?: number;
    transport: MpTransport | null;
    emptyRle?: string;
    sugarFound?: boolean;
    activeVote?: SyncedVotePayload | null;
    startingSp?: number;
    preserveExistingBases?: boolean;
  }) {
    this.mode = 'mp';
    this.inLobbyRoom = false;
    // Start with chat collapsed on small mobile screens so the map stays unobstructed!
    this.chatOpen = !isMobileDevice();
    this.mpBtnChatToggleEl.classList.remove('ping-active');
    this.closeModal();
    this.closeAutoPopover();
    this.closeSkillTree();
    this.hideSugarCinematic();
    this.engine.paused = true;
    this.menuBg.stop();

    this.mainMenuEl.classList.add('hidden');
    this.hudTopEl.classList.add('hidden');
    this.hudBottomEl.classList.add('hidden');
    this.beaconDockEl.classList.add('hidden');
    this.touchCamControlsEl.classList.add('hidden');
    this.tutorialHintEl.classList.add('hidden');
    this.sugarFoundOverlayEl.classList.add('hidden');
    this.epicClearBannerEl.classList.add('hidden');
    this.gameCanvasEl.classList.add('hidden');

    this.mpCanvasEl.classList.remove('hidden');
    this.mpHudTopEl.classList.remove('hidden');
    this.mpHudBottomEl.classList.remove('hidden');
    this.mpTouchCamControlsEl.classList.remove('hidden');
    this.mpBtnTouchPanEl.classList.toggle('pan-active', this.mp.touchPanMode);
    this.mpBtnTouchPanEl.textContent = this.mp.touchPanMode ? '✋' : '🐜';
    this.mpChatBoxEl.classList.toggle('hidden', !this.chatOpen);

    // Unlock multiplayer achievement & apply permanent +1% per achievement speed bonus + artifact SP bonus!
    this.engine.skillTree.unlockAchievement('coop_play');
    const artifactBonus = this.engine.skillTree.state.artifacts.length;
    const achSpeedMult = this.engine.skillTree.getAchievementSpeedMult();
    const baseSp = opts.startingSp ?? 3;
    this.mp.startMatch({
      ...opts,
      startingSp: baseSp + artifactBonus,
      achievementSpeedMult: achSpeedMult
    });
    this.syncMpHud();
    this.syncMpVoteBanner();
    this.renderChatLogs();
  }

  private syncMenuSummary() {
    const { skillTree } = this.engine;
    const saved = this.engine.getSavedRunSummary();
    if (saved) {
      this.menuPlayLabelEl.textContent = t('continueRun');
      this.menuContinueSubEl.textContent = `${saved.levelName} • ${saved.digPct}%`;
    } else {
      const lvl = LEVELS.find((l) => l.id === skillTree.state.currentLevelId) || LEVELS[0];
      this.menuPlayLabelEl.textContent = t('play');
      this.menuContinueSubEl.textContent = loc(lvl.name, lvl.nameEn);
    }
    this.menuProgressCountEl.textContent = `${skillTree.state.completedLevels.length}/${LEVELS.length}`;
    this.menuGalleryCountEl.textContent = `${skillTree.getDiscoveredGalleryCount()}/${LEVELS.length}`;
    this.menuMutCountEl.textContent = String(skillTree.state.mutations.length);
    const artCnt = skillTree.state.artifacts.length;
    this.menuArtCountEl.textContent = `${artCnt}/${SECRET_ARTIFACTS.length} • +${artCnt} ♦`;
    const achCnt = skillTree.state.achievements.length;
    this.menuAchCountEl.textContent = `${achCnt}/${ACHIEVEMENTS.length} • +${achCnt}% ⚡`;
  }

  /* =========================================================
     INTERACTIVE 3-STEP CONTEXTUAL TUTORIAL HINTS (like reference!)
     ========================================================= */
  notifyTutorialAction(action: 'launch' | 'zoom' | 'pan') {
    if (this.mode !== 'classic' || this.tutorialStep === 'done') return;
    if (action !== this.tutorialStep) return;

    this.engine.audio.playHintDone();
    if (this.tutorialStep === 'launch') {
      this.tutorialStep = 'zoom';
    } else if (this.tutorialStep === 'zoom') {
      this.tutorialStep = 'pan';
    } else if (this.tutorialStep === 'pan') {
      this.tutorialStep = 'done';
      try {
        localStorage.setItem(HINTS_DONE_KEY, '1');
      } catch {
        // Ignore
      }
    }
    this.renderTutorialHint();
  }

  private renderTutorialHint() {
    if (this.mode !== 'classic' || this.tutorialStep === 'done') {
      this.tutorialHintEl.classList.add('hidden');
      return;
    }

    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    this.tutorialHintEl.classList.remove('hidden');
    this.tutorialHintEl.style.animation = 'none';
    void this.tutorialHintEl.offsetWidth;
    this.tutorialHintEl.style.animation = '';

    if (this.tutorialStep === 'launch') {
      this.tutorialHintIconEl.innerHTML = `<svg viewBox="0 0 28 28" fill="none">
        <circle cx="9" cy="19" r="3.2" fill="#3ce87a"/>
        <line x1="12" y1="16" x2="21" y2="7" stroke="#ffe26a" stroke-width="2" stroke-dasharray="3 2.5"/>
        <polygon points="23,5 17,6.5 21.5,11" fill="#ffe26a"/>
        <path d="M16 17l3.2 8.5 1.7-3.1 3.1-1.7L16 17z" fill="#ffffff" stroke="#08140d" stroke-width="1"/>
      </svg>`;
      this.tutorialHintTextEl.textContent = isTouch ? t('hintLaunchTouch') : t('hintLaunchDesktop');
    } else if (this.tutorialStep === 'zoom') {
      // Crisp pixel Mouse with highlighted scrolling wheel (exact reference style!)
      this.tutorialHintIconEl.innerHTML = `<svg viewBox="0 0 28 28" shape-rendering="crispEdges">
        <rect x="8" y="3" width="12" height="22" rx="5" fill="#102419" stroke="#e8fff2" stroke-width="2"/>
        <line x1="8" y1="12" x2="20" y2="12" stroke="#e8fff2" stroke-width="1.5"/>
        <line x1="14" y1="3" x2="14" y2="12" stroke="#e8fff2" stroke-width="1.5"/>
        <rect x="12.5" y="5.5" width="3" height="5.5" rx="1" fill="#ffad42"/>
      </svg>`;
      this.tutorialHintTextEl.textContent = isTouch ? t('hintZoomTouch') : t('hintZoomDesktop');
    } else if (this.tutorialStep === 'pan') {
      // Crisp pixel Mouse with highlighted Right Mouse Button (exact reference style!)
      this.tutorialHintIconEl.innerHTML = `<svg viewBox="0 0 28 28" shape-rendering="crispEdges">
        <rect x="8" y="3" width="12" height="22" rx="5" fill="#102419" stroke="#e8fff2" stroke-width="2"/>
        <path d="M14 4h2.5a3.5 3.5 0 0 1 3.5 3.5V12h-6V4z" fill="#ffad42"/>
        <line x1="8" y1="12" x2="20" y2="12" stroke="#e8fff2" stroke-width="1.5"/>
        <line x1="14" y1="3" x2="14" y2="12" stroke="#e8fff2" stroke-width="1.5"/>
      </svg>`;
      this.tutorialHintTextEl.textContent = isTouch ? t('hintPanTouch') : t('hintPanDesktop');
    }
  }

  showToast(message: string, variant: 'default' | 'ach' = 'default') {
    const el = document.createElement('div');
    el.className = variant === 'ach' ? 'toast toast-ach' : 'toast';
    el.textContent = message;
    this.toastContainerEl.appendChild(el);
    setTimeout(() => el.remove(), variant === 'ach' ? 4100 : 3100);
  }

  private handleAchievementUnlocked(ach: AchievementDef) {
    this.engine.audio.playAchievementUnlock();
    this.showToast(t('achUnlockedToast', { name: loc(ach.name, ach.nameEn) }), 'ach');
    this.syncMenuSummary();
    this.statAchCountEl.textContent = `${this.engine.skillTree.state.achievements.length}/${ACHIEVEMENTS.length}`;
  }

  /* =========================================================
     MULTIPLAYER CHAT (LOBBY + IN-GAME!)
     ========================================================= */
  pushSystemChat(text: string, broadcast = false) {
    const msg: ChatMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      senderNick: 'Система',
      senderColor: '#88d9c4',
      text,
      system: true,
      ts: Date.now()
    };
    this.appendChatUnique(msg);
    if (broadcast) {
      this.mpTransport?.send({ type: 'chat', msg });
    }
  }

  private appendChatUnique(msg: ChatMessage, isIncomingRemote = false) {
    if (this.chatMessages.some((m) => m.id === msg.id)) return;
    this.chatMessages.push(msg);
    this.chatMessages.sort((a, b) => a.ts - b.ts);
    if (this.chatMessages.length > 60) this.chatMessages.shift();
    this.renderChatLogs();
    if (isIncomingRemote && !msg.system && this.mode === 'mp' && !this.chatOpen) {
      this.mpBtnChatToggleEl.classList.add('ping-active');
      this.showToast(`💬 ${msg.senderNick}: ${msg.text.slice(0, 60)}`);
    }
  }

  private sendChatMessage(text: string) {
    const col = PLAYER_COLORS[this.localColorIndex % PLAYER_COLORS.length].hex;
    const msg: ChatMessage = {
      id: `m_${this.mpTransport?.localId || 'loc'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderNick: this.localNick,
      senderColor: col,
      text,
      ts: Date.now()
    };
    this.appendChatUnique(msg);
    this.mpTransport?.send({ type: 'chat', msg });
  }

  private renderChatLogs() {
    const html = this.chatMessages
      .map((m) =>
        m.system
          ? `<div class="chat-line sys">${escapeHtml(m.text)}</div>`
          : `<div class="chat-line"><strong style="color:${m.senderColor}">${escapeHtml(m.senderNick)}:</strong> ${escapeHtml(m.text)}</div>`
      )
      .join('');

    this.mpChatLogEl.innerHTML = html;
    this.mpChatLogEl.scrollTop = this.mpChatLogEl.scrollHeight;

    const lobbyLog = document.getElementById('lobby-chat-log');
    if (lobbyLog) {
      lobbyLog.innerHTML = html;
      lobbyLog.scrollTop = lobbyLog.scrollHeight;
    }
  }

  /* =========================================================
     MULTIPLAYER LOBBY BROWSER & PRE-GAME ROOM
     ========================================================= */
  private makeLocalPlayerInfo(id: string, isHost: boolean): MpPlayerInfo {
    return {
      id,
      nick: this.localNick,
      colorIndex: this.localColorIndex,
      skin: this.localSkin,
      isHost,
      dug: 0,
      baseX: 0,
      baseY: 0
    };
  }

  private pickFreeColorIndex(players: MpPlayerInfo[], preferred: number): number {
    const taken = new Set(players.map((p) => p.colorIndex));
    if (!taken.has(preferred)) return preferred;
    for (let i = 0; i < PLAYER_COLORS.length; i++) {
      if (!taken.has(i)) return i;
    }
    return preferred;
  }

  openMultiplayerLobbyModal() {
    this.openModal(
      this.inLobbyRoom
        ? t('mpLobbyRoomTitle', { code: this.mpTransport?.roomCode || '' })
        : t('mpLobbyTitle')
    );
    if (this.inLobbyRoom) {
      this.lobbyBrowserOpen = false;
      this.stopLobbyBrowserRefresh();
      this.renderLobbyRoomScreen();
    } else {
      this.lobbyBrowserOpen = true;
      if (!this.unsubOnlineLobbies) {
        this.unsubOnlineLobbies = onlineDirectory.onLobbiesUpdated(() => {
          if (this.lobbyBrowserOpen && !this.inLobbyRoom && !this.modalBackdropEl.classList.contains('hidden')) {
            this.refreshOpenLobbiesList();
          }
        });
      }
      this.stopLobbyBrowserRefresh();
      this.lobbyBrowserRefreshTimer = window.setInterval(() => {
        if (this.lobbyBrowserOpen && !this.inLobbyRoom && !this.modalBackdropEl.classList.contains('hidden')) {
          this.refreshOpenLobbiesList();
        }
      }, 5000);
      this.renderMpBrowserScreen();
    }
  }

  private stopLobbyBrowserRefresh() {
    if (this.lobbyBrowserRefreshTimer !== null) {
      window.clearInterval(this.lobbyBrowserRefreshTimer);
      this.lobbyBrowserRefreshTimer = null;
    }
  }

  private renderProfileCustomizer(container: HTMLElement, takenColors: Set<number>, onUpdate?: () => void) {
    const wrap = document.createElement('div');
    wrap.className = 'settings-group';
    wrap.innerHTML = `<div class="settings-label">${t('mpProfileLabel')}</div>`;

    // Nick input
    const nickRow = document.createElement('div');
    nickRow.style.display = 'flex';
    nickRow.style.gap = '8px';
    const nickInput = document.createElement('input');
    nickInput.className = 'mp-input';
    nickInput.style.textTransform = 'none';
    nickInput.style.letterSpacing = '0';
    nickInput.placeholder = t('mpNickPlaceholder');
    nickInput.maxLength = 18;
    nickInput.value = this.localNick;
    nickInput.addEventListener('change', () => {
      const v = nickInput.value.trim();
      if (v) {
        this.localNick = v;
        localStorage.setItem(NICK_STORAGE_KEY, v);
        onUpdate?.();
      }
    });
    nickRow.appendChild(nickInput);
    wrap.appendChild(nickRow);

    // 3 Skins selector
    const skinGrid = document.createElement('div');
    skinGrid.className = 'skin-grid';
    for (const sk of SKIN_OPTIONS) {
      const btn = document.createElement('button');
      btn.className = `track-card${this.localSkin === sk.id ? ' active' : ''}`;
      btn.style.textAlign = 'center';
      btn.style.padding = '7px 6px';
      btn.innerHTML = `<strong style="margin:0">${loc(sk.name, sk.nameEn)}</strong>`;
      btn.addEventListener('click', () => {
        this.localSkin = sk.id;
        onUpdate?.();
        if (this.inLobbyRoom) this.renderLobbyRoomScreen();
        else this.renderMpBrowserScreen();
      });
      skinGrid.appendChild(btn);
    }
    wrap.appendChild(skinGrid);

    // 10 Color swatches
    const swatchGrid = document.createElement('div');
    swatchGrid.className = 'color-swatch-grid';
    PLAYER_COLORS.forEach((col, idx) => {
      const isMine = this.localColorIndex === idx;
      const isTaken = !isMine && takenColors.has(idx);
      const sw = document.createElement('button');
      sw.className = `color-swatch${isMine ? ' active' : ''}`;
      sw.style.background = col.hex;
      sw.style.color = col.hex;
      sw.disabled = isTaken;
      const colName = loc(col.name, col.nameEn);
      sw.title = isTaken ? `${colName} (${t('mpTaken')})` : colName;
      sw.addEventListener('click', () => {
        this.localColorIndex = idx;
        onUpdate?.();
        if (this.inLobbyRoom) this.renderLobbyRoomScreen();
        else this.renderMpBrowserScreen();
      });
      swatchGrid.appendChild(sw);
    });
    wrap.appendChild(swatchGrid);

    container.appendChild(wrap);
  }

  private renderMpBrowserScreen() {
    this.modalTitleEl.textContent = t('mpLobbyTitle');
    this.modalBodyEl.innerHTML = '';

    // 1. Player Profile (Nick + 3 Skins + 10 Colors)
    this.renderProfileCustomizer(this.modalBodyEl, new Set());

    // 2. Mode & Map selector for creating a room
    const modeGrid = document.createElement('div');
    modeGrid.className = 'track-grid';
    const coopCard = document.createElement('button');
    coopCard.className = `track-card${this.lobbyMpMode === 'coop' ? ' active' : ''}`;
    coopCard.innerHTML = `<strong>${t('mpCoopTitle')}</strong><small>${t('mpCoopSub')}</small>`;
    coopCard.addEventListener('click', () => {
      this.lobbyMpMode = 'coop';
      this.renderMpBrowserScreen();
    });

    const vsCard = document.createElement('button');
    vsCard.className = `track-card${this.lobbyMpMode === 'versus' ? ' active' : ''}`;
    vsCard.innerHTML = `<strong>${t('mpVsTitle')}</strong><small>${t('mpVsSub')}</small>`;
    vsCard.addEventListener('click', () => {
      this.lobbyMpMode = 'versus';
      this.renderMpBrowserScreen();
    });
    modeGrid.appendChild(coopCard);
    modeGrid.appendChild(vsCard);
    this.modalBodyEl.appendChild(modeGrid);

    // Map + Optional Password (empty by default = passwordless!)
    const createRow = document.createElement('div');
    createRow.className = 'card-row';
    createRow.style.flexWrap = 'wrap';
    const mapSel = document.createElement('select');
    mapSel.className = 'mp-input';
    mapSel.style.textTransform = 'none';
    mapSel.style.letterSpacing = '0';
    mapSel.style.minWidth = '150px';
    for (const lvl of LEVELS) {
      const opt = document.createElement('option');
      opt.value = lvl.id;
      opt.textContent = loc(lvl.name, lvl.nameEn);
      if (lvl.id === this.lobbyLevelId) opt.selected = true;
      mapSel.appendChild(opt);
    }
    mapSel.addEventListener('change', () => (this.lobbyLevelId = mapSel.value));

    const passInput = document.createElement('input');
    passInput.className = 'mp-input';
    passInput.style.textTransform = 'none';
    passInput.style.letterSpacing = '0';
    passInput.style.maxWidth = '150px';
    passInput.placeholder = t('mpPassPlaceholder');

    const createBtn = document.createElement('button');
    createBtn.className = 'action-btn primary';
    createBtn.textContent = t('mpCreateBtn');
    createBtn.addEventListener('click', () => {
      this.createHostLobby(passInput.value);
    });

    createRow.appendChild(mapSel);
    createRow.appendChild(passInput);
    createRow.appendChild(createBtn);
    this.modalBodyEl.appendChild(createRow);

    // 3. Instant Solo vs AI Rival Colony
    const botRow = document.createElement('div');
    botRow.className = 'card-row';
    botRow.innerHTML = `
      <div class="card-row-info">
        <div class="card-row-title">${t('mpBotTitle')}</div>
        <div class="card-row-desc">${t('mpBotDesc')}</div>
      </div>
    `;
    const botBtn = document.createElement('button');
    botBtn.className = 'action-btn';
    botBtn.textContent = t('mpBotBtn');
    botBtn.addEventListener('click', () => {
      this.leaveMultiplayerRoom();
      this.chatMessages = [];
      const me = this.makeLocalPlayerInfo('local_1', true);
      const botColor = this.pickFreeColorIndex([me], 1);
      const bot: MpPlayerInfo = {
        id: 'bot_rival',
        nick: getLang() === 'en' ? 'AI Colony' : 'ИИ-Колония',
        colorIndex: botColor,
        skin: 'cyber',
        isHost: false,
        dug: 0,
        baseX: 0,
        baseY: 0
      };
      this.enterMultiplayerMatch({
        seed: Math.floor(Math.random() * 1_000_000),
        levelId: this.lobbyLevelId,
        mpMode: 'versus',
        vsBot: true,
        localPlayerId: me.id,
        players: [me, bot],
        transport: null
      });
    });
    botRow.appendChild(botBtn);
    this.modalBodyEl.appendChild(botRow);

    // 4. Open Online Lobbies List (isolated container so refreshes never steal input focus!)
    const lobbiesWrap = document.createElement('div');
    lobbiesWrap.id = 'mp-open-lobbies-wrap';
    lobbiesWrap.style.display = 'flex';
    lobbiesWrap.style.flexDirection = 'column';
    lobbiesWrap.style.gap = '8px';
    this.modalBodyEl.appendChild(lobbiesWrap);
    this.refreshOpenLobbiesList();

    // 5. Direct Join by Room Code
    const joinRow = document.createElement('div');
    joinRow.className = 'card-row';
    const codeInput = document.createElement('input');
    codeInput.className = 'mp-input';
    codeInput.placeholder = t('mpCodePlaceholder');
    const joinBtn = document.createElement('button');
    joinBtn.className = 'action-btn primary';
    joinBtn.textContent = t('mpJoinBtn');
    joinBtn.addEventListener('click', () => {
      if (codeInput.value.trim()) {
        this.joinExistingLobby(codeInput.value.trim(), passInput.value);
      }
    });
    joinRow.appendChild(codeInput);
    joinRow.appendChild(joinBtn);
    this.modalBodyEl.appendChild(joinRow);
  }

  private refreshOpenLobbiesList() {
    const wrap = document.getElementById('mp-open-lobbies-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';

    const listHeader = document.createElement('div');
    listHeader.style.display = 'flex';
    listHeader.style.justifyContent = 'space-between';
    listHeader.style.alignItems = 'center';
    const isOnline = onlineDirectory.isConnected();
    listHeader.innerHTML = `<div class="settings-label">${t('mpOpenLobbies')} • <span style="color:${isOnline ? '#3ce87a' : '#ffd845'}">${isOnline ? t('mpOnline') : t('mpConnecting')}</span></div>`;
    const refBtn = document.createElement('button');
    refBtn.className = 'action-btn';
    refBtn.style.padding = '4px 10px';
    refBtn.textContent = t('mpRefresh');
    refBtn.addEventListener('click', () => {
      onlineDirectory.ensureLiveConnection();
      this.refreshOpenLobbiesList();
    });
    listHeader.appendChild(refBtn);
    wrap.appendChild(listHeader);

    const lobbies = listOpenLobbies();
    if (lobbies.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'card-row-desc';
      empty.textContent = isOnline ? t('mpNoLobbiesOnline') : t('mpNoLobbiesOffline');
      wrap.appendChild(empty);
    } else {
      for (const lob of lobbies) {
        const lvlObj = LEVELS.find((l) => l.id === lob.levelId);
        const lvlName = lvlObj ? loc(lvlObj.name, lvlObj.nameEn) : lob.levelId;
        const row = document.createElement('div');
        row.className = 'card-row';
        row.innerHTML = `
          <div class="card-row-info">
            <div class="card-row-title">
              <span>${lob.hasPassword ? '🔒 ' : ''}${lob.code} • ${escapeHtml(lob.hostNick)}</span>
              <span class="badge-done">${lob.playerCount}/${lob.maxPlayers}</span>
            </div>
            <div class="card-row-desc">${lob.mpMode === 'coop' ? t('mpCoopShort') : '⚔ 1v1'} • ${lvlName} • ${lob.inGame ? t('mpInGame') : t('mpInLobby')}</div>
          </div>
        `;
        const jBtn = document.createElement('button');
        jBtn.className = 'action-btn primary';
        jBtn.textContent = t('mpJoinBtn');
        jBtn.addEventListener('click', () => {
          const pw = lob.hasPassword
            ? window.prompt(getLang() === 'en' ? 'Enter lobby password:' : 'Введите пароль лобби:') || ''
            : '';
          this.joinExistingLobby(lob.code, pw);
        });
        row.appendChild(jBtn);
        wrap.appendChild(row);
      }
    }
  }

  private createHostLobby(password = '') {
    this.leaveMultiplayerRoom();
    this.chatMessages = [];

    const transport = new MpTransport({
      onStatus: (st) => {
        this.lobbyStatus = st;
        if (this.inLobbyRoom) this.renderLobbyRoomScreen();
      },
      onMessage: (msg, fromPeerId) => this.handleHostMessage(msg, fromPeerId),
      onPeerDisconnected: (peerId) => {
        const left = this.lobbyPlayers.find((p) => p.id === peerId);
        this.lobbyPlayers = this.lobbyPlayers.filter((p) => p.id !== peerId);
        if (left) {
          this.pushSystemChat(`${left.nick} покинул лобби.`);
          this.broadcastLobbyState();
        }
        if (this.inLobbyRoom) this.renderLobbyRoomScreen();
      }
    });

    const hostPlayer = this.makeLocalPlayerInfo(transport.localId, true);
    this.lobbyPlayers = [hostPlayer];
    this.mpTransport = transport;
    this.inLobbyRoom = true;

    transport.createRoom({
      hostNick: this.localNick,
      mpMode: this.lobbyMpMode,
      levelId: this.lobbyLevelId,
      password,
      getListingMeta: () => ({
        playerCount: this.mode === 'mp' ? this.mp.state.players.length : this.lobbyPlayers.length,
        inGame: this.mode === 'mp',
        levelId: this.mode === 'mp' ? this.mp.state.level.id : this.lobbyLevelId,
        mpMode: this.lobbyMpMode
      })
    });

    this.pushSystemChat(`Лобби ${transport.roomCode} создано! Делитесь кодом с друзьями.`);
    this.openMultiplayerLobbyModal();
  }

  private joinExistingLobby(code: string, password = '') {
    this.leaveMultiplayerRoom();
    this.chatMessages = [];

    const transport = new MpTransport({
      onStatus: (st) => {
        this.lobbyStatus = st;
        if (this.inLobbyRoom) this.renderLobbyRoomScreen();
      },
      onMessage: (msg) => this.handleGuestMessage(msg),
      onPeerDisconnected: (_peerId, wasHost) => {
        if (wasHost) {
          this.showToast('Хост закрыл лобби');
          this.pushSystemChat('Хост закрыл лобби.');
        }
      }
    });

    const me = this.makeLocalPlayerInfo(transport.localId, false);
    this.lobbyPlayers = [me];
    this.mpTransport = transport;
    this.inLobbyRoom = true;
    transport.joinRoom(code, me, password);
    this.openMultiplayerLobbyModal();
  }

  private broadcastLobbyState() {
    if (!this.mpTransport?.isHost) return;
    this.mpTransport.send({
      type: 'lobby_state',
      players: this.lobbyPlayers,
      mpMode: this.lobbyMpMode,
      levelId: this.lobbyLevelId,
      mapSizePreset: this.lobbyMapSize,
      inGame: this.mode === 'mp',
      code: this.mpTransport.roomCode,
      chatHistory: this.chatMessages.slice(-30)
    });
  }

  /** Sends compact pixel-exact RLE map + active vote + chat history to a late-joining or resyncing guest! */
  private sendLateSyncTo(peerId: string) {
    if (!this.mpTransport || !this.mpTransport.isHost || this.mode !== 'mp') return;
    const rle = this.mp.encodeEmptyRle();
    const activeVote = this.mp.getActiveVotePayload();
    const chatHistory = this.chatMessages.slice(-30);

    if (rle.length <= 8000) {
      this.mpTransport.sendTo(peerId, {
        type: 'late_sync',
        seed: this.mp.seed,
        levelId: this.mp.state.level.id,
        mpMode: this.mp.state.mpMode,
        players: this.mp.state.players,
        width: this.mp.width,
        height: this.mp.height,
        emptyRle: rle,
        sugarFound: this.mp.state.sugarFound,
        activeVote,
        chatHistory
      });
    } else {
      const chunkSize = 7500;
      const syncId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const total = Math.ceil(rle.length / chunkSize);
      this.mpTransport.sendTo(peerId, {
        type: 'late_sync',
        syncId,
        seed: this.mp.seed,
        levelId: this.mp.state.level.id,
        mpMode: this.mp.state.mpMode,
        players: this.mp.state.players,
        width: this.mp.width,
        height: this.mp.height,
        emptyRle: '',
        rleChunksTotal: total,
        sugarFound: this.mp.state.sugarFound,
        activeVote,
        chatHistory
      });
      for (let i = 0; i < total; i++) {
        this.mpTransport.sendTo(peerId, {
          type: 'rle_chunk',
          syncId,
          index: i,
          total,
          data: rle.slice(i * chunkSize, (i + 1) * chunkSize)
        });
      }
    }
  }

  private handleHostMessage(msg: MpMessage, fromPeerId: string) {
    if (!this.mpTransport) return;

    if (msg.type === 'resync_req') {
      if (this.mode === 'mp') {
        this.sendLateSyncTo(fromPeerId);
      }
      return;
    }

    if (msg.type === 'hello') {
      if (this.mpTransport.password && msg.password !== this.mpTransport.password) {
        this.mpTransport.sendTo(fromPeerId, { type: 'reject', reason: 'Неверный пароль лобби!' });
        return;
      }

      if (this.mode === 'mp') {
        const existing = this.mp.state.players.find((p) => p.id === msg.player.id);
        if (existing) {
          // Returning or retrying guest -> immediately resend fresh pixel-exact snapshot!
          this.sendLateSyncTo(fromPeerId);
          return;
        }
        const maxP = this.lobbyMpMode === 'coop' ? 10 : 2;
        if (this.mp.state.players.length >= maxP) {
          this.mpTransport.sendTo(fromPeerId, { type: 'reject', reason: `Лобби заполнено (${maxP}/${maxP})` });
          return;
        }

        const assignedColor = this.pickFreeColorIndex(this.mp.state.players, msg.player.colorIndex);
        const joined: MpPlayerInfo = { ...msg.player, colorIndex: assignedColor, isHost: false };

        // MID-GAME LATE JOIN! Carve their base, notify all players & send compact RLE sync!
        const added = this.mp.addLateJoinPlayer(joined);
        this.lobbyPlayers = this.mp.state.players;
        this.pushSystemChat(`${added.nick} подключился к игре!`, true);
        this.mpTransport.send({ type: 'players_update', players: this.mp.state.players });
        this.sendLateSyncTo(fromPeerId);
        this.broadcastLobbyState();
        this.showToast(`${added.nick} вошёл в идущую игру!`);
      } else {
        const alreadyIn = this.lobbyPlayers.some((p) => p.id === msg.player.id);
        const maxP = this.lobbyMpMode === 'coop' ? 10 : 2;
        if (!alreadyIn && this.lobbyPlayers.length >= maxP) {
          this.mpTransport.sendTo(fromPeerId, { type: 'reject', reason: `Лобби заполнено (${maxP}/${maxP})` });
          return;
        }
        const others = this.lobbyPlayers.filter((p) => p.id !== msg.player.id);
        const assignedColor = this.pickFreeColorIndex(others, msg.player.colorIndex);
        const joined: MpPlayerInfo = { ...msg.player, colorIndex: assignedColor, isHost: false };
        this.lobbyPlayers = [...others, joined];
        if (!alreadyIn) {
          this.pushSystemChat(`${joined.nick} вошёл в лобби!`, true);
        }
        this.broadcastLobbyState();
        if (this.inLobbyRoom) this.renderLobbyRoomScreen();
      }
      return;
    }

    if (msg.type === 'update_profile') {
      const target = this.lobbyPlayers.find((p) => p.id === msg.playerId);
      if (target) {
        const others = this.lobbyPlayers.filter((p) => p.id !== msg.playerId);
        target.nick = msg.nick;
        target.skin = msg.skin;
        target.colorIndex = this.pickFreeColorIndex(others, msg.colorIndex);
        this.broadcastLobbyState();
        if (this.inLobbyRoom) this.renderLobbyRoomScreen();
      }
      return;
    }

    if (msg.type === 'chat') {
      this.appendChatUnique(msg.msg, true);
      return;
    }

    // All peers receive room pub/sub directly — apply locally only while in an active match!
    if (this.mode === 'mp') {
      this.mp.handleRemoteMessage(msg);
    }
  }

  private applyIncomingLateSync(msg: Extract<MpMessage, { type: 'late_sync' }>, fullRle: string) {
    if (!this.mpTransport) return;
    this.mpSyncedWithHost = true;
    this.clearForceJoinRetry();
    this.clearPendingRleSync();

    this.lobbyPlayers = msg.players;
    this.lobbyMpMode = msg.mpMode;
    this.lobbyLevelId = msg.levelId;

    const me = msg.players.find((p) => p.id === this.mpTransport!.localId);
    if (me) this.localColorIndex = me.colorIndex;

    if (msg.chatHistory && msg.chatHistory.length > 0) {
      for (const cm of msg.chatHistory) this.appendChatUnique(cm, false);
    }

    // If already playing the exact same map & seed (e.g. tab wake-up resync), patch in-place!
    if (
      this.mode === 'mp' &&
      this.mp.active &&
      this.mp.seed === msg.seed &&
      this.mp.state.level.id === msg.levelId &&
      this.mp.width === msg.width &&
      this.mp.height === msg.height
    ) {
      this.mp.applyResyncSnapshot({
        players: msg.players,
        emptyRle: fullRle,
        sugarFound: msg.sugarFound,
        activeVote: msg.activeVote
      });
      this.renderChatLogs();
      return;
    }

    // Otherwise load Host's exact map, seed, bases, RLE tunnels, active vote & chat history!
    this.enterMultiplayerMatch({
      seed: msg.seed,
      levelId: msg.levelId,
      mpMode: msg.mpMode,
      vsBot: false,
      localPlayerId: this.mpTransport.localId,
      players: msg.players,
      width: msg.width,
      height: msg.height,
      transport: this.mpTransport,
      emptyRle: fullRle,
      sugarFound: msg.sugarFound,
      activeVote: msg.activeVote,
      startingSp: 5,
      preserveExistingBases: true
    });
  }

  private handleGuestMessage(msg: MpMessage) {
    if (msg.type === 'reject') {
      this.showToast(msg.reason);
      this.leaveMultiplayerRoom();
      this.renderMpBrowserScreen();
      return;
    }
    if (msg.type === 'lobby_state') {
      this.lobbyPlayers = msg.players;
      this.lobbyMpMode = msg.mpMode;
      this.lobbyLevelId = msg.levelId;
      this.lobbyMapSize = msg.mapSizePreset || 'auto';
      const me = msg.players.find((p) => p.id === this.mpTransport?.localId);
      if (me) this.localColorIndex = me.colorIndex;
      if (msg.chatHistory) {
        for (const cm of msg.chatHistory) this.appendChatUnique(cm, false);
      }
      if (this.inLobbyRoom) this.renderLobbyRoomScreen();
      return;
    }
    if (msg.type === 'chat') {
      this.appendChatUnique(msg.msg, true);
      return;
    }
    if (msg.type === 'start') {
      this.mpSyncedWithHost = true;
      this.clearForceJoinRetry();
      this.enterMultiplayerMatch({
        seed: msg.seed,
        levelId: msg.levelId,
        mpMode: msg.mpMode,
        vsBot: false,
        localPlayerId: this.mpTransport!.localId,
        players: msg.players,
        width: msg.width,
        height: msg.height,
        transport: this.mpTransport
      });
      return;
    }
    if (msg.type === 'late_sync') {
      if (msg.rleChunksTotal && msg.rleChunksTotal > 0 && msg.syncId) {
        this.clearPendingRleSync();
        const syncId = msg.syncId;
        const fallbackTimer = window.setTimeout(() => {
          if (this.pendingRleSync && this.pendingRleSync.syncId === syncId) {
            const p = this.pendingRleSync;
            this.applyIncomingLateSync(p.payload, '');
          }
        }, 3000);
        this.pendingRleSync = {
          syncId,
          total: msg.rleChunksTotal,
          parts: new Map(),
          payload: msg,
          fallbackTimer
        };
      } else {
        this.applyIncomingLateSync(msg, msg.emptyRle || '');
      }
      return;
    }
    if (msg.type === 'rle_chunk') {
      if (this.pendingRleSync && this.pendingRleSync.syncId === msg.syncId) {
        this.pendingRleSync.parts.set(msg.index, msg.data);
        if (this.pendingRleSync.parts.size >= this.pendingRleSync.total) {
          let fullRle = '';
          for (let i = 0; i < this.pendingRleSync.total; i++) {
            fullRle += this.pendingRleSync.parts.get(i) || '';
          }
          const payload = this.pendingRleSync.payload;
          this.applyIncomingLateSync(payload, fullRle);
        }
      }
      return;
    }

    if (this.mode === 'mp') {
      this.mp.handleRemoteMessage(msg);
    }
  }

  private renderLobbyRoomScreen() {
    if (!this.mpTransport) return;
    const isHost = this.mpTransport.isHost;
    const maxP = this.lobbyMpMode === 'coop' ? 10 : 2;
    const dims = computeCoopMapSize(this.lobbyPlayers.length, this.lobbyMpMode, this.lobbyMapSize);
    const en = getLang() === 'en';

    this.modalTitleEl.textContent = t('mpLobbyRoomTitle', { code: this.mpTransport.roomCode });
    this.modalBodyEl.innerHTML = '';

    // Room Code + Copy
    const codeBox = document.createElement('div');
    codeBox.className = 'mp-code-pill';
    codeBox.textContent = `${this.mpTransport.roomCode}  (${this.lobbyPlayers.length}/${maxP} • ${en ? 'Map' : 'Карта'} ${dims.width}×${dims.height})`;
    codeBox.title = en ? 'Click to copy room code' : 'Нажмите, чтобы скопировать код';
    codeBox.addEventListener('click', () => {
      navigator.clipboard?.writeText(this.mpTransport!.roomCode).catch(() => {});
      this.showToast(en ? `Copied ${this.mpTransport!.roomCode}!` : `Код ${this.mpTransport!.roomCode} скопирован!`);
    });
    this.modalBodyEl.appendChild(codeBox);

    // Map & Map Size selector INSIDE the created lobby!
    const settingsRow = document.createElement('div');
    settingsRow.className = 'card-row';
    settingsRow.style.flexWrap = 'wrap';
    if (isHost) {
      const mapSel = document.createElement('select');
      mapSel.className = 'mp-input';
      mapSel.style.textTransform = 'none';
      mapSel.style.letterSpacing = '0';
      mapSel.style.minWidth = '150px';
      for (const lvl of LEVELS) {
        const opt = document.createElement('option');
        opt.value = lvl.id;
        opt.textContent = `${en ? 'Map' : 'Карта'}: ${loc(lvl.name, lvl.nameEn)}`;
        if (lvl.id === this.lobbyLevelId) opt.selected = true;
        mapSel.appendChild(opt);
      }
      mapSel.addEventListener('change', () => {
        this.lobbyLevelId = mapSel.value;
        this.broadcastLobbyState();
        this.renderLobbyRoomScreen();
      });
      settingsRow.appendChild(mapSel);

      if (this.lobbyMpMode === 'coop') {
        const sizeSel = document.createElement('select');
        sizeSel.className = 'mp-input';
        sizeSel.style.textTransform = 'none';
        sizeSel.style.letterSpacing = '0';
        sizeSel.style.minWidth = '175px';
        const presets: { id: MpMapSizePreset; label: string }[] = [
          { id: 'auto', label: en ? 'Size: Auto (5+ players)' : 'Размер: Авто (от 5 игр.)' },
          { id: 'compact', label: en ? 'Size: Compact (400×250)' : 'Размер: Компактная (400×250)' },
          { id: 'large', label: en ? 'Size: Large (520×330)' : 'Размер: Большая (520×330)' },
          { id: 'huge', label: en ? 'Size: Huge (640×400)' : 'Размер: Гигантская (640×400)' }
        ];
        for (const pr of presets) {
          const opt = document.createElement('option');
          opt.value = pr.id;
          opt.textContent = pr.label;
          if (pr.id === this.lobbyMapSize) opt.selected = true;
          sizeSel.appendChild(opt);
        }
        sizeSel.addEventListener('change', () => {
          this.lobbyMapSize = sizeSel.value as MpMapSizePreset;
          this.broadcastLobbyState();
          this.renderLobbyRoomScreen();
        });
        settingsRow.appendChild(sizeSel);
      }
    } else {
      const lvlObj = LEVELS.find((l) => l.id === this.lobbyLevelId);
      const lvlName = lvlObj ? loc(lvlObj.name, lvlObj.nameEn) : this.lobbyLevelId;
      settingsRow.innerHTML = `<div class="card-row-desc">${en ? 'Map' : 'Карта'}: <strong>${lvlName}</strong> • ${en ? 'Size' : 'Размер'}: <strong>${dims.width}×${dims.height}</strong></div>`;
    }
    this.modalBodyEl.appendChild(settingsRow);

    if (this.lobbyStatus) {
      const st = document.createElement('div');
      st.className = 'card-row-desc';
      st.style.textAlign = 'center';
      st.style.color = 'var(--accent-cyan)';
      st.textContent = this.lobbyStatus;
      this.modalBodyEl.appendChild(st);
    }

    // Player roster
    const roster = document.createElement('div');
    roster.className = 'settings-group';
    roster.innerHTML = `<div class="settings-label">${t('mpPlayersInLobby')}</div>`;
    for (const pl of this.lobbyPlayers) {
      const col = PLAYER_COLORS[pl.colorIndex % PLAYER_COLORS.length];
      const skObj = SKIN_OPTIONS.find((s) => s.id === pl.skin);
      const skName = skObj ? loc(skObj.name, skObj.nameEn) : loc('Классик', 'Classic');
      const row = document.createElement('div');
      row.className = 'card-row';
      row.style.padding = '7px 12px';
      row.innerHTML = `
        <div class="card-row-title" style="font-size:13px;">
          <span style="width:11px;height:11px;border-radius:50%;background:${col.hex};display:inline-block;"></span>
          <span>${escapeHtml(pl.nick)} ${pl.isHost ? '👑' : ''}</span>
        </div>
        <span style="font-size:11px;color:var(--text-muted);">${skName} • ${loc(col.name, col.nameEn)}</span>
      `;
      roster.appendChild(row);
    }
    this.modalBodyEl.appendChild(roster);

    // Profile customizer inside lobby (with live taken colors!)
    const taken = new Set(
      this.lobbyPlayers.filter((p) => p.id !== this.mpTransport?.localId).map((p) => p.colorIndex)
    );
    this.renderProfileCustomizer(this.modalBodyEl, taken, () => {
      if (!this.mpTransport) return;
      const myId = this.mpTransport.localId;
      const me = this.lobbyPlayers.find((p) => p.id === myId);
      if (me) {
        me.nick = this.localNick;
        me.colorIndex = this.localColorIndex;
        me.skin = this.localSkin;
      }
      if (this.mpTransport.isHost) {
        this.broadcastLobbyState();
      } else {
        this.mpTransport.send({
          type: 'update_profile',
          playerId: myId,
          nick: this.localNick,
          colorIndex: this.localColorIndex,
          skin: this.localSkin
        });
      }
    });

    // LIVE LOBBY CHAT!
    const chatWrap = document.createElement('div');
    chatWrap.className = 'settings-group';
    chatWrap.innerHTML = `<div class="settings-label">${t('mpLobbyChat')}</div>`;
    const log = document.createElement('div');
    log.id = 'lobby-chat-log';
    log.className = 'lobby-chat-log';
    chatWrap.appendChild(log);

    const form = document.createElement('form');
    form.style.display = 'flex';
    form.style.gap = '6px';
    const inp = document.createElement('input');
    inp.className = 'mp-chat-input';
    inp.placeholder = t('mpLobbyChatPh');
    const sendBtn = document.createElement('button');
    sendBtn.type = 'submit';
    sendBtn.className = 'action-btn primary';
    sendBtn.textContent = t('mpSend');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const txt = inp.value.trim();
      if (!txt) return;
      inp.value = '';
      this.sendChatMessage(txt);
    });
    form.appendChild(inp);
    form.appendChild(sendBtn);
    chatWrap.appendChild(form);
    this.modalBodyEl.appendChild(chatWrap);
    this.renderChatLogs();

    // Footer buttons (Host Start / Leave)
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'space-between';
    actions.style.gap = '10px';

    const leaveBtn = document.createElement('button');
    leaveBtn.className = 'action-btn danger';
    leaveBtn.textContent = t('mpLeaveLobby');
    leaveBtn.addEventListener('click', () => {
      this.leaveMultiplayerRoom();
      this.renderMpBrowserScreen();
    });
    actions.appendChild(leaveBtn);

    if (isHost) {
      const startBtn = document.createElement('button');
      startBtn.className = 'action-btn primary';
      startBtn.textContent = t('mpStartGame');
      startBtn.addEventListener('click', () => {
        const seed = Math.floor(Math.random() * 1_000_000);
        const mapDims = computeCoopMapSize(this.lobbyPlayers.length, this.lobbyMpMode, this.lobbyMapSize);
        this.mpTransport!.send({
          type: 'start',
          seed,
          levelId: this.lobbyLevelId,
          mpMode: this.lobbyMpMode,
          players: this.lobbyPlayers,
          width: mapDims.width,
          height: mapDims.height
        });
        this.enterMultiplayerMatch({
          seed,
          levelId: this.lobbyLevelId,
          mpMode: this.lobbyMpMode,
          vsBot: false,
          localPlayerId: this.mpTransport!.localId,
          players: this.lobbyPlayers,
          width: mapDims.width,
          height: mapDims.height,
          transport: this.mpTransport
        });
      });
      actions.appendChild(startBtn);
    } else {
      // Guest: Force-Join button so mobile players NEVER get stuck in lobby!
      const forceBtn = document.createElement('button');
      forceBtn.className = 'action-btn primary';
      forceBtn.textContent = t('mpForceJoin');
      forceBtn.addEventListener('click', () => {
        if (!this.mpTransport) return;
        const me = this.makeLocalPlayerInfo(this.mpTransport.localId, false);
        this.mpSyncedWithHost = false;
        this.clearForceJoinRetry();
        // Ping host for full late_sync AND retry until Host's exact map arrives!
        this.mpTransport.send({ type: 'hello', player: me, password: '' });
        let tries = 0;
        this.forceJoinRetryTimer = window.setInterval(() => {
          tries++;
          if (this.mpSyncedWithHost || !this.mpTransport || this.mode !== 'mp' || tries > 6) {
            this.clearForceJoinRetry();
            return;
          }
          onlineDirectory.ensureLiveConnection();
          this.mpTransport.send({ type: 'hello', player: me, password: '' });
        }, 2500);

        const fallbackSeed = hashRoomCode(this.mpTransport.roomCode);
        const mapDims = computeCoopMapSize(Math.max(5, this.lobbyPlayers.length), this.lobbyMpMode, this.lobbyMapSize);
        const roster = this.lobbyPlayers.some((p) => p.id === me.id)
          ? this.lobbyPlayers
          : [...this.lobbyPlayers, me];
        this.enterMultiplayerMatch({
          seed: fallbackSeed,
          levelId: this.lobbyLevelId,
          mpMode: this.lobbyMpMode,
          vsBot: false,
          localPlayerId: me.id,
          players: roster,
          width: mapDims.width,
          height: mapDims.height,
          transport: this.mpTransport
        });
      });
      actions.appendChild(forceBtn);
    }

    this.modalBodyEl.appendChild(actions);
  }

  /* =========================================================
     IN-GAME MULTIPLAYER HUD & VOTING
     ========================================================= */
  syncMpHud() {
    if (this.mode !== 'mp') return;
    const st = this.mp.state;

    this.mpModeLabelEl.textContent =
      st.mpMode === 'coop'
        ? `${t('mpCoopShort')} • ${loc(st.level.name, st.level.nameEn)}`
        : st.vsBot
          ? t('mpRaceAi')
          : t('mpRace1v1');
    const digPct = Math.min(100, Math.round((st.dugBreakable / st.totalBreakable) * 100));
    this.mpDigPctEl.textContent = `${digPct}%`;
    this.mpPlayerCountEl.textContent = String(st.players.length);
    this.mpLocalSpEl.textContent = String(st.localSp);

    const rem = st.nextSpDropSec;
    this.mpSpTimerEl.textContent = `${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}`;

    this.mpBtnPingEl.classList.toggle('ping-active', st.pingMode);
    this.mpSkillBadgeEl.classList.toggle('hidden', !this.mp.hasAffordableSkill());

    this.mpAntBarEl.innerHTML = '';
    for (const id of PLAYABLE_ANTS) {
      const cfg = ANT_TYPES[id];
      const unlocked = this.mp.isAntUnlocked(id);
      const activeCount = this.mp.countAnts(st.localPlayerId, id);
      const maxCount = this.mp.getCap(id);

      let sub = unlocked ? `${activeCount}/${maxCount}` : '—';
      let onCooldown = false;
      if (id === 'compass') {
        if (st.compassCd > 0) {
          onCooldown = true;
          const s = Math.ceil(st.compassCd);
          sub = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        } else {
          sub = t('ready');
        }
      }

      const btn = document.createElement('button');
      btn.className = `ant-btn${st.selectedAnt === id && unlocked ? ' active' : ''}${!unlocked || onCooldown ? ' locked' : ''}`;
      btn.style.setProperty('--ant-color', cfg.color);
      const iconType: SkillIcon = id === 'queen' ? 'queen' : id === 'compass' ? 'compass' : 'ant';
      const shortNm = loc(cfg.shortName, cfg.shortNameEn);
      btn.innerHTML = `
        <span class="ant-icon-svg" style="color:${cfg.color}">${renderSkillSvg(iconType)}</span>
        <span class="ant-name">${unlocked ? shortNm : '🔒 ' + shortNm}</span>
        <span class="ant-count">${sub}</span>
      `;
      btn.addEventListener('click', () => {
        if (unlocked) this.mp.selectAnt(id);
        else this.openSkillTree();
      });
      this.mpAntBarEl.appendChild(btn);
    }

    if (this.skillTreeOpen && this.lastRenderedSp !== st.localSp) {
      this.renderSkillTree(false);
    }
  }

  syncMpVoteBanner() {
    const v = this.mp.state.vote;
    if (!v.active || this.mode !== 'mp') {
      this.mpVoteBannerEl.classList.add('hidden');
      return;
    }
    this.mpVoteBannerEl.classList.remove('hidden');
    this.mpVoteTextEl.textContent = v.reason;
    this.mpVoteActionsEl.innerHTML = '';

    const countFor = (ch: string) => Object.values(v.votes).filter((x) => x === ch).length;

    // Buttons for each candidate next map!
    for (const mapId of v.options) {
      const lvl = LEVELS.find((l) => l.id === mapId);
      if (!lvl) continue;
      const cnt = countFor(mapId);
      const btn = document.createElement('button');
      btn.className = `action-btn${v.myChoice === mapId ? ' primary' : ''}`;
      btn.disabled = v.myChoice !== null;
      btn.textContent = `${loc(lvl.name, lvl.nameEn)}${cnt > 0 ? ` (${cnt})` : ''}`;
      btn.addEventListener('click', () => this.mp.castVote(mapId));
      this.mpVoteActionsEl.appendChild(btn);
    }

    // Stay & keep digging button
    const stayCnt = countFor('stay');
    const stayBtn = document.createElement('button');
    stayBtn.className = `action-btn${v.myChoice === 'stay' ? ' primary' : ''}`;
    stayBtn.disabled = v.myChoice !== null;
    stayBtn.textContent = `${t('mpStayVote')}${stayCnt > 0 ? ` (${stayCnt})` : ''}`;
    stayBtn.addEventListener('click', () => this.mp.castVote('stay'));
    this.mpVoteActionsEl.appendChild(stayBtn);

    const totalHumans = Math.max(1, this.mp.state.players.filter((p) => !p.id.startsWith('bot_')).length);
    const castCount = Object.keys(v.votes).length;
    const secs = Math.max(0, Math.ceil(v.timeLeft));
    this.mpVoteTallyEl.textContent = `⏱ ${secs}${t('secShort')} • ${t('mpVoted')}: ${castCount}/${totalHumans}`;
  }

  openMpVersusEndModal(winnerNick: string, iWon: boolean) {
    this.openModal(iWon ? t('mpVsWinTitle') : t('mpVsLoseTitle'));
    this.modalBodyEl.innerHTML = `
      <div class="story-preview-box">
        <p><strong>${iWon ? t('mpVsWinBody') : t('mpVsLoseBody', { nick: escapeHtml(winnerNick) })}</strong></p>
      </div>
    `;
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'flex-end';

    const rematchBtn = document.createElement('button');
    rematchBtn.className = 'action-btn primary';
    rematchBtn.textContent = t('mpNewMap');
    rematchBtn.addEventListener('click', () => {
      this.closeModal();
      this.mp.advanceToNextCoopLevel();
    });

    const menuBtn = document.createElement('button');
    menuBtn.className = 'action-btn';
    menuBtn.textContent = t('mpToMenu');
    menuBtn.addEventListener('click', () => {
      this.leaveMultiplayerRoom();
      this.closeModal();
      this.showMainMenu();
    });

    actions.appendChild(menuBtn);
    actions.appendChild(rematchBtn);
    this.modalBodyEl.appendChild(actions);
  }

  showClassicEpicClearBanner(level: LevelDefinition) {
    const idx = LEVELS.findIndex((l) => l.id === level.id);
    const nextLvl = LEVELS[(idx + 1) % LEVELS.length];
    this.epicCurrentLevel = level;
    this.epicClearTitleEl.textContent = loc(level.name, level.nameEn);
    this.epicBtnNextEl.textContent = t('epicNextNamed', { name: loc(nextLvl.name, nextLvl.nameEn) });
    this.epicNextAction = () => {
      this.engine.loadLevel(nextLvl.id, true);
      this.engine.paused = true;
      this.playPreGameIntro(() => {
        this.enterClassicGame();
        this.engine.playNestRevealBurst();
      });
    };
    this.epicClearBannerEl.classList.remove('hidden');
  }

  showMpEpicClearBanner() {
    this.epicCurrentLevel = this.mp.state.level;
    this.epicClearTitleEl.textContent = loc(this.mp.state.level.name, this.mp.state.level.nameEn);
    this.epicBtnNextEl.textContent = t('epicNext');
    this.epicNextAction = () => {
      this.mp.advanceToNextCoopLevel();
    };
    this.epicClearBannerEl.classList.remove('hidden');
  }

  /* =========================================================
     SECRET COLLECTIBLE ARTIFACTS + GALLERY + STATS + CREDITS
     ========================================================= */
  openArtifactFoundModal(artifact: ArtifactDef) {
    this.openModal(t('artifactFoundTitle'));
    const artName = loc(artifact.name, artifact.nameEn);
    const artDesc = loc(artifact.description, artifact.descriptionEn);
    this.modalBodyEl.innerHTML = `
      <div class="artifact-hero">
        <div class="artifact-hero-icon" style="--art-color:${artifact.accent}">
          ${renderArtifactSvg(artifact.id)}
        </div>
        <h3 style="font-size:20px;color:${artifact.accent};margin:0;">${escapeHtml(artName)}</h3>
        <p style="font-size:13.5px;color:#d8eee2;line-height:1.5;max-width:340px;">
          ${escapeHtml(artDesc)}
        </p>
        <div class="badge-done" style="font-size:12.5px;padding:6px 14px;">
          ${t('artifactFoundBonus')}
        </div>
      </div>
    `;
    const btn = document.createElement('button');
    btn.className = 'action-btn primary';
    btn.style.marginTop = '10px';
    btn.style.width = '100%';
    btn.textContent = t('artifactCollectBtn');
    btn.addEventListener('click', () => this.closeModal());
    this.modalBodyEl.appendChild(btn);
  }

  openArtifactsModal() {
    const owned = this.engine.skillTree.state.artifacts;
    this.openModal(t('artifactsTitle', { n: owned.length, total: SECRET_ARTIFACTS.length }));
    this.modalBodyEl.innerHTML = '';

    const summary = document.createElement('div');
    summary.className = 'story-preview-box';
    summary.innerHTML = `
      <p><strong>${t('artifactsSummaryTitle', { n: owned.length })}</strong></p>
      <p style="margin-top:4px;font-size:12.5px;color:var(--text-muted);">
        ${t('artifactsSummaryDesc', { total: SECRET_ARTIFACTS.length })}
      </p>
    `;
    this.modalBodyEl.appendChild(summary);

    for (const art of SECRET_ARTIFACTS) {
      const found = owned.includes(art.id);
      const lvlObj = LEVELS.find((l) => l.id === art.levelId);
      const lvlName = lvlObj ? loc(lvlObj.name, lvlObj.nameEn) : art.levelId;
      const card = document.createElement('div');
      card.className = `artifact-card ${found ? 'found' : 'locked'}`;
      card.style.setProperty('--art-color', art.accent);
      card.innerHTML = `
        <div class="artifact-icon-box">${renderArtifactSvg(art.id)}</div>
        <div class="card-row-info">
          <div class="card-row-title">
            <span style="color:${found ? art.accent : 'var(--text-muted)'}">${found ? escapeHtml(loc(art.name, art.nameEn)) : t('artifactLockedName')}</span>
            ${found ? `<span class="badge-done">${t('artifactForeverBadge')}</span>` : ''}
          </div>
          <div class="card-row-desc">
            ${found ? escapeHtml(loc(art.description, art.descriptionEn)) : t('artifactHiddenOn', { name: lvlName })}
          </div>
        </div>
      `;
      this.modalBodyEl.appendChild(card);
    }
  }

  openGalleryModal() {
    const { skillTree } = this.engine;
    const discoveredCount = skillTree.getDiscoveredGalleryCount();
    this.openModal(t('galleryTitle', { n: discoveredCount, total: LEVELS.length }));
    this.modalBodyEl.innerHTML = '';

    const summary = document.createElement('div');
    summary.className = 'story-preview-box';
    summary.innerHTML = `<p style="font-size:12.5px;color:#d6ede0;line-height:1.45;">${t('gallerySummary')}</p>`;
    this.modalBodyEl.appendChild(summary);

    const grid = document.createElement('div');
    grid.className = 'gallery-grid';

    for (let i = 0; i < LEVELS.length; i++) {
      const lvl = LEVELS[i];
      const rec = skillTree.getRecord(lvl.id);
      const discovered = skillTree.isLevelDiscoveredInGallery(lvl.id);
      const cleared100 = Boolean(rec.cleared100);
      const lvlName = loc(lvl.name, lvl.nameEn);
      const diffBadge =
        lvl.difficultyLabel === 'extreme'
          ? `<span class="diff-badge extreme">${t('badgeExtreme')}</span>`
          : lvl.difficultyLabel === 'hard'
            ? `<span class="diff-badge hard">${t('badgeHard')}</span>`
            : '';

      const card = document.createElement('div');
      card.className = `gallery-card ${discovered ? 'discovered' : 'locked'}${cleared100 ? ' cleared100' : ''}`;
      card.style.setProperty('--gal-accent', lvl.palette.accentHex);

      if (discovered) {
        const previewWrap = document.createElement('div');
        previewWrap.className = 'gallery-canvas-wrap';
        const thumb = renderArtworkToCanvas(lvl, {
          cleared100,
          scale: 1.2,
          withFrame: false,
          lang: getLang()
        });
        previewWrap.appendChild(thumb);
        previewWrap.addEventListener('click', () => this.openGalleryLightbox(lvl, cleared100));
        card.appendChild(previewWrap);

        const body = document.createElement('div');
        body.className = 'gallery-card-body';
        body.innerHTML = `
          <div class="gallery-card-title">
            <span style="width:8px;height:8px;border-radius:50%;background:${lvl.palette.accentHex};display:inline-block;flex-shrink:0;"></span>
            <span>${i + 1}. ${escapeHtml(lvlName)}</span>
            ${diffBadge}
          </div>
          <div class="gallery-card-meta">
            ${cleared100 ? `<span style="color:#ffe26a;font-weight:700;">${t('galleryClearedBadge')}</span>` : t('galleryDiscoveredBadge')}
            ${rec.bestSugarSec ? ` • 🧊 ${formatRecordTime(rec.bestSugarSec)}` : ''}
            ${rec.bestClearSec ? ` • ✨ ${formatRecordTime(rec.bestClearSec)}` : ''}
          </div>
        `;

        const actions = document.createElement('div');
        actions.className = 'gallery-card-actions';

        const viewBtn = document.createElement('button');
        viewBtn.className = 'action-btn';
        viewBtn.textContent = t('galleryPreview');
        viewBtn.addEventListener('click', () => this.openGalleryLightbox(lvl, cleared100));

        const pngBtn = document.createElement('button');
        pngBtn.className = 'action-btn primary';
        pngBtn.textContent = t('gallerySavePng');
        pngBtn.addEventListener('click', () => {
          if (downloadArtworkPng(lvl, cleared100, getLang())) {
            this.showToast(t('gallerySavedToast', { name: lvlName }));
          }
        });

        actions.appendChild(viewBtn);
        actions.appendChild(pngBtn);
        body.appendChild(actions);
        card.appendChild(body);
      } else {
        const lockBox = document.createElement('div');
        lockBox.className = 'gallery-locked-box';
        lockBox.innerHTML = `<span>🔒</span><span style="font-size:11px;letter-spacing:1.5px;">#${i + 1}</span>`;
        card.appendChild(lockBox);

        const body = document.createElement('div');
        body.className = 'gallery-card-body';
        body.innerHTML = `
          <div class="gallery-card-title" style="color:var(--text-muted);">
            <span>${i + 1}. ${t('galleryLockedTitle')}</span>
            ${diffBadge}
          </div>
          <div class="gallery-card-meta">${t('galleryLockedHint', { name: lvlName })}</div>
        `;
        card.appendChild(body);
      }

      grid.appendChild(card);
    }

    this.modalBodyEl.appendChild(grid);
  }

  private openGalleryLightbox(level: LevelDefinition, cleared100: boolean) {
    const lvlName = loc(level.name, level.nameEn);
    this.openModal(`🖼 ${lvlName}`);
    this.modalBodyEl.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'gallery-lightbox';

    const frame = document.createElement('div');
    frame.className = 'gallery-lightbox-frame';
    const hiRes = renderArtworkToCanvas(level, {
      cleared100,
      scale: 2,
      withFrame: true,
      lang: getLang()
    });
    frame.appendChild(hiRes);
    wrap.appendChild(frame);

    const desc = document.createElement('div');
    desc.className = 'card-row-desc';
    desc.style.textAlign = 'center';
    desc.textContent = loc(level.subtitle, level.subtitleEn);
    wrap.appendChild(desc);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.width = '100%';

    const backBtn = document.createElement('button');
    backBtn.className = 'action-btn';
    backBtn.style.flex = '1';
    backBtn.textContent = t('galleryBack');
    backBtn.addEventListener('click', () => this.openGalleryModal());

    const pngBtn = document.createElement('button');
    pngBtn.className = 'action-btn primary';
    pngBtn.style.flex = '1';
    pngBtn.textContent = t('gallerySavePng');
    pngBtn.addEventListener('click', () => {
      if (downloadArtworkPng(level, cleared100, getLang())) {
        this.showToast(t('gallerySavedToast', { name: lvlName }));
      }
    });

    actions.appendChild(backBtn);
    actions.appendChild(pngBtn);
    wrap.appendChild(actions);
    this.modalBodyEl.appendChild(wrap);
  }

  openStatsModal() {
    const { skillTree } = this.engine;
    const st = skillTree.state;
    const c = st.career;

    // Determine favorite ant by spawn count
    let favAnt: PlayableAntId | null = null;
    let favCount = 0;
    for (const id of PLAYABLE_ANTS) {
      const cnt = c.antSpawnsByType[id] || 0;
      if (cnt > favCount) {
        favCount = cnt;
        favAnt = id;
      }
    }
    const favDisplay = favAnt
      ? `<span style="color:${ANT_TYPES[favAnt].color}">${escapeHtml(loc(ANT_TYPES[favAnt].name, ANT_TYPES[favAnt].nameEn))}</span> <small style="font-size:11px;color:var(--text-muted);">(${formatNum(favCount)})</small>`
      : `<span style="color:var(--text-muted);">${t('statNone')}</span>`;

    this.openModal(t('statsTitle'));
    this.modalBodyEl.innerHTML = '';

    // 1. Hero 6 KPI grid
    const kpi = document.createElement('div');
    kpi.className = 'stats-kpi-grid';
    kpi.innerHTML = `
      <div class="stat-kpi-card">
        <span class="stat-kpi-label">⛏ ${t('statTotalBlocks')}</span>
        <span class="stat-kpi-val" style="color:#ffad42;">${formatNum(c.blocksDug)}</span>
      </div>
      <div class="stat-kpi-card">
        <span class="stat-kpi-label">🐜 ${t('statTotalAnts')}</span>
        <span class="stat-kpi-val" style="color:#3ce87a;">${formatNum(c.antsSpawned)}</span>
      </div>
      <div class="stat-kpi-card">
        <span class="stat-kpi-label">⏱ ${t('statTotalTime')}</span>
        <span class="stat-kpi-val" style="color:#78e6ff;">${formatPlayTime(c.totalPlaySec)}</span>
      </div>
      <div class="stat-kpi-card">
        <span class="stat-kpi-label">💎 ${t('statTotalCrystals')}</span>
        <span class="stat-kpi-val" style="color:#5ce8ff;">${formatNum(c.crystalsCollected)}</span>
      </div>
      <div class="stat-kpi-card">
        <span class="stat-kpi-label">🧊 ${t('statTotalSugars')}</span>
        <span class="stat-kpi-val" style="color:#ffe26a;">${formatNum(c.sugarsFound)}</span>
      </div>
      <div class="stat-kpi-card">
        <span class="stat-kpi-label">★ ${t('statFavAnt')}</span>
        <span class="stat-kpi-val" style="font-size:14px;">${favDisplay}</span>
      </div>
    `;
    this.modalBodyEl.appendChild(kpi);

    // 2. Underground Finds & Permanent Bonuses
    const findsGroup = document.createElement('div');
    findsGroup.className = 'settings-group';
    findsGroup.innerHTML = `
      <div class="settings-label">${t('statUndergroundTitle')}</div>
      <div class="stats-mini-strip">
        <div class="stats-mini-item"><span>💥 ${t('statSpores')}</span><strong>${formatNum(c.sporesBlasted)}</strong></div>
        <div class="stats-mini-item"><span>✨ ${t('statDust')}</span><strong>${formatNum(c.sugarDustFound)}</strong></div>
        <div class="stats-mini-item"><span>🥚 ${t('statCocoons')}</span><strong>${formatNum(c.cocoonsHatched)}</strong></div>
        <div class="stats-mini-item"><span>⚡ ${t('statSpeedBonus')}</span><strong style="color:#ffe26a;">+${st.achievements.length}%</strong></div>
        <div class="stats-mini-item"><span>♦ ${t('statStartSpBonus')}</span><strong style="color:#ff8ea0;">+${st.artifacts.length}</strong></div>
        <div class="stats-mini-item"><span>✨ ${t('statClearedMaps')}</span><strong style="color:#42f5c5;">${c.mapsCleared}/${LEVELS.length}</strong></div>
      </div>
    `;
    this.modalBodyEl.appendChild(findsGroup);

    // 3. Personal Records by Map (All 8 Maps!)
    const recGroup = document.createElement('div');
    recGroup.className = 'settings-group';
    recGroup.innerHTML = `<div class="settings-label">${t('recordsTitle')}</div>`;

    const list = document.createElement('div');
    list.className = 'records-list';

    for (let i = 0; i < LEVELS.length; i++) {
      const lvl = LEVELS[i];
      const rec = skillTree.getRecord(lvl.id);
      const isDone = st.completedLevels.includes(lvl.id) || rec.sugarFound;
      const diffBadge =
        lvl.difficultyLabel === 'extreme'
          ? `<span class="diff-badge extreme">${t('badgeExtreme')}</span>`
          : lvl.difficultyLabel === 'hard'
            ? `<span class="diff-badge hard">${t('badgeHard')}</span>`
            : '';

      const row = document.createElement('div');
      row.className = 'record-row';
      row.innerHTML = `
        <div class="record-row-top">
          <div class="card-row-title" style="font-size:13px;">
            <span style="width:9px;height:9px;border-radius:50%;background:${lvl.palette.accentHex};display:inline-block;"></span>
            <span>${i + 1}. ${escapeHtml(loc(lvl.name, lvl.nameEn))}</span>
            ${diffBadge}
          </div>
          <div style="display:flex;gap:5px;align-items:center;">
            ${rec.cleared100 ? `<span class="badge-done" style="border-color:rgba(255,226,106,0.55);color:#ffe26a;">${t('badge100')}</span>` : isDone ? `<span class="badge-done">${t('badgeDone')}</span>` : ''}
          </div>
        </div>
        <div class="record-metrics">
          <div class="record-metric">
            <span>🧊 ${t('recSugarBest')}</span>
            <strong>${formatRecordTime(rec.bestSugarSec)}</strong>
          </div>
          <div class="record-metric">
            <span>✨ ${t('recClearBest')}</span>
            <strong>${formatRecordTime(rec.bestClearSec)}</strong>
          </div>
          <div class="record-metric">
            <span>▦ ${t('recMaxDig')}</span>
            <strong>${rec.maxDigPct}%</strong>
          </div>
          <div class="record-metric">
            <span>◈ ${t('recMaxArt')}</span>
            <strong>${rec.maxArtPct}%</strong>
          </div>
        </div>
      `;
      list.appendChild(row);
    }

    recGroup.appendChild(list);
    this.modalBodyEl.appendChild(recGroup);
  }

  openAchievementsModal() {
    const state = this.engine.skillTree.state;
    const unlockedIds = state.achievements;
    const unlockedCount = unlockedIds.length;
    const total = ACHIEVEMENTS.length;
    const pct = total > 0 ? Math.round((unlockedCount / total) * 100) : 0;

    this.openModal(t('achTitle', { n: unlockedCount, total }));
    this.modalBodyEl.innerHTML = '';

    const summary = document.createElement('div');
    summary.className = 'ach-summary-bar';
    summary.innerHTML = `
      <div class="ach-summary-top">
        <strong style="font-size:14px;color:#fff6cc;">${t('achSpeedTitle')}</strong>
        <span class="ach-bonus-pill">${t('achSpeedPill', { n: unlockedCount })}</span>
      </div>
      <div class="ach-progress-track">
        <div class="ach-progress-fill" style="width:${pct}%"></div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);line-height:1.4;">
        ${t('achSummaryDesc')}
      </div>
    `;
    this.modalBodyEl.appendChild(summary);

    for (const ach of ACHIEVEMENTS) {
      const isDone = unlockedIds.includes(ach.id);
      const rawProg = Math.max(0, Math.min(ach.goal, ach.getProgress(state)));
      const progPct = ach.goal > 0 ? Math.round((rawProg / ach.goal) * 100) : 0;

      const card = document.createElement('div');
      card.className = `ach-card ${isDone ? 'unlocked' : 'locked'}`;
      card.style.setProperty('--ach-color', ach.accent);
      const wipNote =
        !isDone && ach.id === 'coop_play'
          ? ` (${getLang() === 'en' ? 'in development' : 'в разработке'})`
          : '';
      card.innerHTML = `
        <div class="ach-icon-box">${ach.icon}</div>
        <div class="card-row-info" style="flex:1;min-width:0;">
          <div class="card-row-title">
            <span style="color:${isDone ? ach.accent : 'var(--text-main)'}">${escapeHtml(loc(ach.name, ach.nameEn))}</span>
            ${isDone ? '<span class="badge-done">✓ +1% ⚡</span>' : '<span style="font-size:11px;color:var(--text-muted);">+1% ⚡</span>'}
          </div>
          <div class="card-row-desc">${escapeHtml(loc(ach.description, ach.descriptionEn))}${wipNote}</div>
          ${
            !isDone && ach.goal > 1
              ? `<div class="ach-mini-bar">
                  <div class="ach-mini-track"><div class="ach-mini-fill" style="width:${progPct}%"></div></div>
                  <span class="ach-mini-num">${formatNum(rawProg)} / ${formatNum(ach.goal)}</span>
                </div>`
              : ''
          }
        </div>
      `;
      this.modalBodyEl.appendChild(card);
    }
  }

  openCreditsModal() {
    this.openModal(t('creditsTitle'));
    this.modalBodyEl.innerHTML = `
      <div class="credits-roll-box">
        <div class="credits-roll-inner">
          <div style="font-size:22px;font-weight:900;letter-spacing:4px;color:#7bffb3;">SUGAR ANTS</div>
          <div style="font-size:12px;color:var(--text-muted);">${t('creditsSub')}</div>
          <div style="margin-top:8px;font-size:11px;letter-spacing:2px;color:#ffe26a;">${t('creditsAuthorLbl')}</div>
          <div style="font-size:18px;font-weight:800;color:#ffffff;">GrAx</div>
          <div style="margin-top:8px;font-size:11px;letter-spacing:2px;color:#5ce8ff;">${t('creditsAudioLbl')}</div>
          <div style="font-size:13px;color:#d6ede0;">${t('creditsAudioVal')}</div>
          <div style="margin-top:8px;font-size:11px;letter-spacing:2px;color:#ff8ea0;">${t('creditsThanksLbl')}</div>
          <div style="font-size:14px;font-weight:700;color:#ffc2cb;">${t('creditsThanksName')}</div>
          <div style="font-size:12px;color:var(--text-muted);">${t('creditsThanksPlayers')}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:center;margin-top:12px;">
        <a href="https://t.me/alexstress1" target="_blank" rel="noopener noreferrer" class="tg-donate-btn" style="padding:8px 16px;font-size:13px;">
          <span>✈</span><span>${t('creditsTgBtn')}</span>
        </a>
      </div>
    `;
  }

  /* =========================================================
     CLASSIC MODE HUD SYNC
     ========================================================= */
  sync() {
    const { world, skillTree } = this.engine;
    const stats = world.stats;

    this.levelNameEl.textContent = loc(world.level.name, world.level.nameEn);
    this.statMutCountEl.textContent = String(skillTree.state.mutations.length);
    this.statArtifactsCountEl.textContent = `${skillTree.state.artifacts.length}/${SECRET_ARTIFACTS.length}`;
    this.statAchCountEl.textContent = `${skillTree.state.achievements.length}/${ACHIEVEMENTS.length}`;
    this.statSpEl.textContent = String(skillTree.state.skillPoints);

    const artPct = stats.mapCleared
      ? 100
      : stats.totalArt > 0
        ? Math.min(99, Math.floor((stats.revealedArt / stats.totalArt) * 100))
        : 0;
    const rawDigFrac = stats.totalBreakable > 0 ? (stats.dugBreakable / stats.totalBreakable) * 100 : 0;
    const digLabel = stats.mapCleared
      ? '100%'
      : rawDigFrac >= 99
        ? `${Math.min(99.9, Math.floor(rawDigFrac * 10) / 10).toFixed(1)}%`
        : `${Math.floor(rawDigFrac)}%`;

    this.statArtEl.textContent = `${artPct}%`;
    this.statDigEl.textContent = digLabel;

    if (stats.sugarFound) {
      this.sugarChipEl.classList.remove('sugar-searching');
      this.sugarChipEl.classList.add('sugar-found');
      this.statSugarEl.textContent = t('sugarFoundShort');
    } else {
      this.sugarChipEl.classList.add('sugar-searching');
      this.sugarChipEl.classList.remove('sugar-found');
      this.statSugarEl.textContent = t('sugarSearching');
    }

    const rushSec = Math.ceil(this.engine.sugarRushTimer);
    this.rushChipEl.classList.toggle('hidden', rushSec <= 0);
    if (rushSec > 0) this.statRushEl.textContent = `${rushSec}${t('secShort')}`;

    const autoOn = skillTree.state.settings.autoSummon;
    const autoMode = skillTree.state.settings.autoSummonMode || 'smart';
    const modeIcon = autoMode === 'beacon' ? '📍' : autoMode === 'nest' ? '🏠' : '🎯';
    this.btnAutoSummonEl.classList.toggle('auto-on', autoOn);
    this.btnAutoConfigEl.classList.toggle('active', this.autoPopoverOpen);
    this.autoFabStatusEl.textContent = autoOn ? `${modeIcon} ${t('setOn')}` : t('setOff');
    this.syncTouchPanButton();

    // Left-side Pheromone Beacon button (30s active duration -> 2m cooldown!)
    const beaconActive = Boolean(this.engine.beacon && this.engine.beacon.timeLeft > 0);
    const beaconCd = !beaconActive && this.engine.beaconCooldown > 0;
    this.btnBeaconEl.classList.toggle('beacon-active', this.engine.beaconMode);
    this.btnBeaconEl.classList.toggle('beacon-set', beaconActive && !this.engine.beaconMode);
    this.btnBeaconEl.classList.toggle('beacon-cooldown', beaconCd && !this.engine.beaconMode);
    if (this.engine.beaconMode) {
      this.beaconFabStatusEl.textContent = t('beaconAim');
    } else if (beaconActive && this.engine.beacon) {
      this.beaconFabStatusEl.textContent = `${Math.ceil(this.engine.beacon.timeLeft)}${t('secShort')}`;
    } else if (beaconCd) {
      const sec = Math.ceil(this.engine.beaconCooldown);
      this.beaconFabStatusEl.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    } else {
      this.beaconFabStatusEl.textContent = t('ready');
    }

    this.upgradeBadgeEl.classList.toggle('hidden', !skillTree.hasAffordableNode());

    this.renderAntBar();
    this.syncMenuSummary();

    if (this.skillTreeOpen && this.mode === 'classic' && this.lastRenderedSp !== skillTree.state.skillPoints) {
      this.renderSkillTree(false);
    }
  }

  private renderAntBar() {
    const { skillTree, selectedAnt, ants } = this.engine;
    const colStats = skillTree.getColonyStats();
    this.antBarEl.innerHTML = '';

    for (const id of PLAYABLE_ANTS) {
      const cfg = ANT_TYPES[id];
      const unlocked = skillTree.isAntUnlocked(id);
      const activeCount = ants.countPlayerByType(id);
      const queenBonus = ants.countQueenBornByType(id);
      const maxCount = ants.getMaxActive(id, colStats);

      let subText = unlocked
        ? queenBonus > 0
          ? `${activeCount}/${maxCount} +${queenBonus}♛`
          : `${activeCount}/${maxCount}`
        : '—';
      let onCooldown = false;
      if (id === 'compass') {
        if (ants.compassCooldown > 0) {
          onCooldown = true;
          const sec = Math.ceil(ants.compassCooldown);
          subText = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
        } else {
          subText = t('ready');
        }
      }

      const btn = document.createElement('button');
      btn.className = `ant-btn${selectedAnt === id ? ' active' : ''}${!unlocked || onCooldown ? ' locked' : ''}`;
      btn.style.setProperty('--ant-color', cfg.color);
      const iconType: SkillIcon = id === 'queen' ? 'queen' : id === 'compass' ? 'compass' : 'ant';
      const shortNm = loc(cfg.shortName, cfg.shortNameEn);
      btn.innerHTML = `
        <span class="ant-key">${cfg.hotkey}</span>
        <span class="ant-icon-svg" style="color:${cfg.color}">${renderSkillSvg(iconType)}</span>
        <span class="ant-name">${unlocked ? shortNm : '🔒 ' + shortNm}</span>
        <span class="ant-count">${subText}</span>
      `;
      btn.addEventListener('click', () => {
        if (unlocked) this.engine.selectAnt(id);
        else this.openSkillTree();
      });
      this.antBarEl.appendChild(btn);
    }
  }

  /* =========================================================
     ON-SCREEN SMART AUTO-SUMMON POPOVER
     ========================================================= */
  private toggleAutoPopover() {
    this.autoPopoverOpen = !this.autoPopoverOpen;
    this.autoPopoverEl.classList.toggle('hidden', !this.autoPopoverOpen);
    this.btnAutoConfigEl.classList.toggle('active', this.autoPopoverOpen);
    if (this.autoPopoverOpen) {
      this.renderAutoPopover();
    }
  }

  private closeAutoPopover() {
    if (!this.autoPopoverOpen) return;
    this.autoPopoverOpen = false;
    this.autoPopoverEl.classList.add('hidden');
    this.btnAutoConfigEl.classList.remove('active');
  }

  private renderAutoPopover() {
    const { skillTree } = this.engine;
    const s = skillTree.state.settings;
    const curMode: AutoSummonMode = s.autoSummonMode || 'smart';

    const modes: { id: AutoSummonMode; label: string; hint: string }[] = [
      { id: 'smart', label: t('autoModeSmart'), hint: t('autoModeSmartHint') },
      { id: 'beacon', label: t('autoModeBeacon'), hint: t('autoModeBeaconHint') },
      { id: 'nest', label: t('autoModeNest'), hint: t('autoModeNestHint') }
    ];

    this.autoPopModesEl.innerHTML = '';
    for (const m of modes) {
      const btn = document.createElement('button');
      btn.className = `auto-mode-chip${curMode === m.id ? ' active' : ''}`;
      btn.dataset.mode = m.id;
      btn.textContent = m.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        skillTree.updateSettings({ autoSummonMode: m.id, autoSummon: true });
        this.renderAutoPopover();
        this.sync();
      });
      this.autoPopModesEl.appendChild(btn);
    }

    const activeHint = modes.find((m) => m.id === curMode)?.hint || '';
    this.autoPopHintEl.textContent = activeHint;

    this.autoPopAntsEl.innerHTML = '';
    for (const id of PLAYABLE_ANTS) {
      const cfg = ANT_TYPES[id];
      const unlocked = skillTree.isAntUnlocked(id);
      const enabled = Boolean(s.autoSummonTypes[id]);
      const iconType: SkillIcon = id === 'queen' ? 'queen' : id === 'compass' ? 'compass' : 'ant';
      const chip = document.createElement('button');
      chip.className = `auto-ant-chip${enabled ? ' enabled' : ''}${unlocked ? '' : ' ant-locked'}`;
      chip.dataset.ant = id;
      chip.style.setProperty('--ant-color', cfg.color);
      chip.title = loc(cfg.name, cfg.nameEn);
      chip.innerHTML = `
        <span class="auto-ant-ico">${renderSkillSvg(iconType)}</span>
        <span class="auto-ant-name">${escapeHtml(loc(cfg.shortName, cfg.shortNameEn))}</span>
        <span class="auto-ant-state">${enabled ? '✓' : '—'}</span>
      `;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextTypes = { ...skillTree.state.settings.autoSummonTypes, [id]: !enabled };
        skillTree.updateSettings({ autoSummonTypes: nextTypes });
        this.renderAutoPopover();
        this.sync();
      });
      this.autoPopAntsEl.appendChild(chip);
    }
  }

  /* =========================================================
     SHARED VISUAL SKILL TREE (WORKS IN BOTH CLASSIC & CO-OP!)
     ========================================================= */
  openSkillTree() {
    this.closeModal();
    this.closeAutoPopover();
    this.skillTreeOpen = true;
    if (this.mode === 'classic') this.engine.paused = true;
    this.lastBoughtNodeId = null;
    this.stOverlayEl.classList.remove('hidden');
    this.renderSkillTree(true);
  }

  closeSkillTree() {
    this.skillTreeOpen = false;
    if (this.mode === 'classic') this.engine.paused = false;
    this.stOverlayEl.classList.add('hidden');
    if (this.mode === 'classic') this.sync();
    if (this.mode === 'mp') this.syncMpHud();
  }

  private getSkillAdapter() {
    if (this.mode === 'mp') {
      return {
        sp: this.mp.state.localSp,
        getRank: (id: string) => this.mp.getSkillRank(id),
        isVisible: (n: SkillNodeDef) => this.mp.isSkillVisible(n),
        getCost: (n: SkillNodeDef) => this.mp.getSkillCost(n),
        canBuy: (n: SkillNodeDef) => this.mp.canBuySkill(n),
        buy: (id: string) => this.mp.buySkill(id)
      };
    }
    const st = this.engine.skillTree;
    return {
      sp: st.state.skillPoints,
      getRank: (id: string) => st.getRank(id),
      isVisible: (n: SkillNodeDef) => st.isNodeVisible(n),
      getCost: (n: SkillNodeDef) => st.getNodeCost(n),
      canBuy: (n: SkillNodeDef) => st.canBuyNode(n),
      buy: (id: string) => st.buyNode(id)
    };
  }

  private tryBuySkillNode(nodeId: string) {
    const adapter = this.getSkillAdapter();
    if (adapter.buy(nodeId)) {
      this.lastBoughtNodeId = nodeId;
      this.engine.audio.playUpgrade();
      if (this.mode === 'classic') {
        if (nodeId === 'warrior_unlock') this.engine.selectAnt('warrior');
        if (nodeId === 'scout_unlock') this.engine.selectAnt('scout');
        if (nodeId === 'queen_unlock') this.engine.selectAnt('queen');
        this.engine.syncWorldUpgrades();
        this.sync();
      } else {
        this.syncMpHud();
      }
      this.renderSkillTree(false);
    }
  }

  private renderSkillTree(animateEnter = false) {
    const adapter = this.getSkillAdapter();
    this.lastRenderedSp = adapter.sp;
    this.stPointsNumEl.textContent = String(adapter.sp);
    this.stNodesEl.classList.toggle('st-entering', animateEnter);
    this.stNodesEl.innerHTML = '';
    this.stLinksEl.innerHTML = '';
    this.stGeneralNodesEl.innerHTML = '';

    const visibleNodes = SKILL_NODES.filter((n) => n.panel !== 'side' && adapter.isVisible(n));
    const sideNodes = SKILL_NODES.filter((n) => n.panel === 'side');
    const allDisplayed = [...visibleNodes, ...sideNodes];
    const visibleSet = new Set(visibleNodes.map((n) => n.id));
    if (!allDisplayed.some((n) => n.id === this.selectedNodeId)) this.selectedNodeId = 'worker_root';

    const clearSelectedHighlight = () => {
      this.stNodesEl.querySelectorAll('.st-node.selected').forEach((n) => n.classList.remove('selected'));
      this.stGeneralNodesEl.querySelectorAll('.st-node.selected').forEach((n) => n.classList.remove('selected'));
    };

    // Render General Colony Upgrades as matching glowing skill-tree cells (ячейки)!
    this.stGeneralNodesEl.classList.toggle('st-entering', animateEnter);
    sideNodes.forEach((node, idx) => {
      const rank = adapter.getRank(node.id);
      const isMaxed = rank >= node.maxRank;
      const canBuy = adapter.canBuy(node);
      const colors = BRANCH_COLORS[node.branch];
      let stateClass = 'state-locked';
      if (isMaxed) stateClass = 'state-maxed';
      else if (canBuy) stateClass = 'state-available';
      else if (rank > 0) stateClass = 'state-owned';

      const btn = document.createElement('button');
      btn.className = `st-node st-general-node shape-${node.shape} ${stateClass}${this.selectedNodeId === node.id ? ' selected' : ''}${this.lastBoughtNodeId === node.id ? ' just-bought' : ''}`;
      btn.style.setProperty('--node-color', colors.main);
      btn.style.setProperty('--node-glow', colors.glow);
      btn.style.setProperty('--node-bg', colors.bg);
      btn.style.setProperty('--enter-delay', `${Math.min(200, idx * 28)}ms`);
      btn.dataset.nodeId = node.id;
      btn.title = loc(node.title, node.titleEn);
      btn.innerHTML = `${renderSkillSvg(node.icon)}${node.maxRank > 1 ? `<span class="st-node-rank">${rank}/${node.maxRank}</span>` : ''}`;

      btn.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') {
          this.selectedNodeId = node.id;
          this.updateInspector(node);
          clearSelectedHighlight();
          btn.classList.add('selected');
        }
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isTouch = (e as PointerEvent).pointerType === 'touch';
        if ((!isTouch || this.selectedNodeId === node.id) && adapter.canBuy(node)) {
          this.selectedNodeId = node.id;
          this.tryBuySkillNode(node.id);
        } else {
          this.selectedNodeId = node.id;
          this.updateInspector(node);
          clearSelectedHighlight();
          btn.classList.add('selected');
        }
      });
      this.stGeneralNodesEl.appendChild(btn);
    });

    for (const node of visibleNodes) {
      const x1 = ORIGIN_X + node.gx * NODE_STEP;
      const y1 = ORIGIN_Y + node.gy * NODE_STEP;
      for (const reqId of node.requires) {
        if (!visibleSet.has(reqId)) continue;
        const parent = SKILL_NODES.find((p) => p.id === reqId);
        if (!parent) continue;
        const x2 = ORIGIN_X + parent.gx * NODE_STEP;
        const y2 = ORIGIN_Y + parent.gy * NODE_STEP;
        const bothOwned = adapter.getRank(node.id) > 0 && adapter.getRank(parent.id) > 0;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x2));
        line.setAttribute('y1', String(y2));
        line.setAttribute('x2', String(x1));
        line.setAttribute('y2', String(y1));
        line.setAttribute('stroke', bothOwned ? BRANCH_COLORS[node.branch].main : 'rgba(150, 185, 168, 0.25)');
        line.setAttribute('stroke-width', bothOwned ? '3' : '2');
        if (bothOwned) line.classList.add('st-link-flow');
        else line.setAttribute('stroke-dasharray', '4 4');
        this.stLinksEl.appendChild(line);
      }
    }

    visibleNodes.forEach((node, idx) => {
      const rank = adapter.getRank(node.id);
      const isMaxed = rank >= node.maxRank;
      const canBuy = adapter.canBuy(node);
      const colors = BRANCH_COLORS[node.branch];
      let stateClass = 'state-locked';
      if (isMaxed) stateClass = 'state-maxed';
      else if (canBuy) stateClass = 'state-available';
      else if (rank > 0) stateClass = 'state-owned';

      const el = document.createElement('button');
      el.className = `st-node shape-${node.shape} ${stateClass}${this.selectedNodeId === node.id ? ' selected' : ''}${this.lastBoughtNodeId === node.id ? ' just-bought' : ''}`;
      el.style.left = `${ORIGIN_X + node.gx * NODE_STEP}px`;
      el.style.top = `${ORIGIN_Y + node.gy * NODE_STEP}px`;
      el.style.setProperty('--node-color', colors.main);
      el.style.setProperty('--node-glow', colors.glow);
      el.style.setProperty('--node-bg', colors.bg);
      el.style.setProperty('--enter-delay', `${Math.min(240, idx * 22)}ms`);
      el.dataset.nodeId = node.id;
      el.innerHTML = `${renderSkillSvg(node.icon)}${node.maxRank > 1 ? `<span class="st-node-rank">${rank}/${node.maxRank}</span>` : ''}`;

      el.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') {
          this.selectedNodeId = node.id;
          this.updateInspector(node);
          clearSelectedHighlight();
          el.classList.add('selected');
        }
      });

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const isTouch = (e as PointerEvent).pointerType === 'touch';
        if ((!isTouch || this.selectedNodeId === node.id) && adapter.canBuy(node)) {
          this.selectedNodeId = node.id;
          this.tryBuySkillNode(node.id);
        } else {
          this.selectedNodeId = node.id;
          this.updateInspector(node);
          clearSelectedHighlight();
          el.classList.add('selected');
        }
      });

      this.stNodesEl.appendChild(el);
    });

    const sel = SKILL_NODES.find((n) => n.id === this.selectedNodeId) || visibleNodes[0];
    if (sel) this.updateInspector(sel);
  }

  private updateInspector(node: SkillNodeDef) {
    const adapter = this.getSkillAdapter();
    const rank = adapter.getRank(node.id);
    const isMaxed = rank >= node.maxRank;
    const cost = adapter.getCost(node);
    const canBuy = adapter.canBuy(node);
    const colors = BRANCH_COLORS[node.branch];
    const title = loc(node.title, node.titleEn);

    this.stTooltipEl.style.setProperty('--tt-color', colors.main);
    this.stTtCatEl.textContent = loc(node.category, node.categoryEn);
    this.stTtTitleEl.textContent = node.maxRank > 1 ? `${title} (${rank}/${node.maxRank})` : title;
    this.stTtDescEl.textContent = loc(node.description, node.descriptionEn);

    if (isMaxed) {
      this.stTtCostEl.textContent = t('stMaxed');
      this.stTtCostEl.className = 'st-tt-cost maxed';
      this.stTtBuyEl.classList.add('hidden');
    } else {
      this.stTtCostEl.textContent = `♦ ${cost}`;
      this.stTtCostEl.className = `st-tt-cost${canBuy ? ' affordable' : ''}`;
      this.stTtBuyEl.classList.remove('hidden');
      this.stTtBuyEl.textContent = rank === 0 ? t('stLearn') : t('stUpgrade');
      this.stTtBuyEl.disabled = !canBuy;
    }
  }

  /* =========================================================
     MODALS: LEVELS / SUGAR + MUTATIONS / MUTATIONS / SETTINGS
     ========================================================= */
  private openModal(title: string) {
    this.closeAutoPopover();
    this.modalTitleEl.textContent = title;
    this.modalBackdropEl.classList.remove('hidden');
  }

  closeModal() {
    this.lobbyBrowserOpen = false;
    this.stopLobbyBrowserRefresh();
    this.modalBackdropEl.classList.add('hidden');
  }

  openLevelsModal() {
    this.openModal(t('mapsTitle'));
    this.modalBodyEl.innerHTML = '';
    const savedRun = this.engine.getSavedRunSummary();

    for (let i = 0; i < LEVELS.length; i++) {
      const lvl = LEVELS[i];
      const unlocked = this.engine.skillTree.isLevelUnlocked(lvl.id);
      const isDone = this.engine.skillTree.state.completedLevels.includes(lvl.id);
      const rec = this.engine.skillTree.getRecord(lvl.id);
      const isSavedRun = Boolean(savedRun && savedRun.levelId === lvl.id);
      const lvlName = loc(lvl.name, lvl.nameEn);
      const lvlSub = loc(lvl.subtitle, lvl.subtitleEn);
      const diffBadge =
        lvl.difficultyLabel === 'extreme'
          ? `<span class="diff-badge extreme">${t('badgeExtreme')}</span>`
          : lvl.difficultyLabel === 'hard'
            ? `<span class="diff-badge hard">${t('badgeHard')}</span>`
            : '';

      const row = document.createElement('div');
      row.className = `card-row${unlocked ? '' : ' locked-row'}`;
      row.innerHTML = `
        <div class="card-row-info">
          <div class="card-row-title">
            <span style="width:9px;height:9px;border-radius:50%;background:${lvl.palette.accentHex};display:inline-block;"></span>
            <span>${i + 1}. ${unlocked ? escapeHtml(lvlName) : '🔒 ' + escapeHtml(lvlName)}</span>
            ${diffBadge}
            ${rec.cleared100 ? `<span class="badge-done" style="border-color:rgba(255,226,106,0.55);color:#ffe26a;">${t('badge100')}</span>` : isDone ? `<span class="badge-done">${t('badgeDone')}</span>` : ''}
            ${isSavedRun && savedRun ? `<span class="badge-done" style="border-color:rgba(53,214,255,0.45);color:#8ce8ff;">💾 ${savedRun.digPct}%</span>` : ''}
          </div>
          <div class="card-row-desc">${unlocked ? escapeHtml(lvlSub) : t('mapLockedDesc')}</div>
        </div>
      `;

      const actionsWrap = document.createElement('div');
      actionsWrap.style.display = 'flex';
      actionsWrap.style.gap = '6px';
      actionsWrap.style.flexShrink = '0';

      if (unlocked && isSavedRun) {
        const contBtn = document.createElement('button');
        contBtn.className = 'action-btn primary';
        contBtn.textContent = t('btnContinue');
        contBtn.addEventListener('click', () => {
          this.engine.audio.ensureStarted();
          this.closeModal();
          this.enterClassicGame();
        });
        actionsWrap.appendChild(contBtn);
      }

      const btn = document.createElement('button');
      btn.className = `action-btn${unlocked && !isSavedRun ? ' primary' : ''}`;
      btn.disabled = !unlocked;
      btn.textContent = !unlocked ? t('btnLocked') : isSavedRun ? t('btnRestart') : t('btnPlay');
      btn.addEventListener('click', () => {
        this.engine.audio.ensureStarted();
        this.closeModal();
        this.engine.loadLevel(lvl.id, true);
        this.engine.paused = true;
        this.menuBg.stop();
        this.mainMenuEl.classList.add('hidden');
        this.playPreGameIntro(() => {
          this.enterClassicGame();
          this.engine.playNestRevealBurst();
        });
      });
      actionsWrap.appendChild(btn);
      row.appendChild(actionsWrap);
      this.modalBodyEl.appendChild(row);
    }
  }

  /** Triggers sleek cinema letterbox bars & golden discovery banner right as Sugar is struck! */
  startSugarCinematic(level: LevelDefinition) {
    if (this.mode !== 'classic') return;
    this.closeAutoPopover();
    this.sugarCinemaBannerEl.textContent = t('sugarCinemaBanner');
    this.sugarCinemaSubEl.textContent = loc(level.name, level.nameEn);
    this.sugarCinemaOverlayEl.classList.remove('hidden', 'cinema-fade');
  }

  private hideSugarCinematic() {
    this.sugarCinemaOverlayEl.classList.add('hidden');
    this.sugarCinemaOverlayEl.classList.remove('cinema-fade');
  }

  /** Epic Cinematic "Found a Diamond!" celebration showcase before transitioning to Mutation choice! */
  openSugarFoundModal(level: LevelDefinition, isNewRecord = false) {
    if (this.mode !== 'classic') return;
    this.pendingSugarLevel = level;
    this.sugarCinemaOverlayEl.classList.add('cinema-fade');
    window.setTimeout(() => this.hideSugarCinematic(), 380);

    const { world, skillTree } = this.engine;
    const stats = world.stats;
    const digPct =
      stats.totalBreakable > 0
        ? Math.min(100, Math.round((stats.dugBreakable / stats.totalBreakable) * 100))
        : 0;
    const artPct =
      stats.totalArt > 0 ? Math.min(100, Math.round((stats.revealedArt / stats.totalArt) * 100)) : 0;

    this.sugarRecordBadgeEl.textContent = t('sugarNewRecord');
    this.sugarRecordBadgeEl.classList.toggle('hidden', !isNewRecord);
    this.sugarFoundSubEl.textContent = t('sugarSub', { name: loc(level.name, level.nameEn) });
    this.sugarFoundStatsEl.innerHTML = `
      <div class="sugar-stat-pill" style="--st-idx:0"><strong>${digPct}%</strong><small>${t('statDug')}</small></div>
      <div class="sugar-stat-pill" style="--st-idx:1"><strong>${artPct}%</strong><small>${t('statArt')}</small></div>
      <div class="sugar-stat-pill" style="--st-idx:2"><strong>${stats.crystalsCollected}</strong><small>${t('statCrystals')}</small></div>
      <div class="sugar-stat-pill" style="--st-idx:3"><strong>${formatRecordTime(this.engine.runElapsedSec)}</strong><small>${t('statTime')}</small></div>
    `;

    const hasChoices = pickMutationChoices(skillTree.state.mutations, 3).length > 0;
    this.sugarFoundCtaEl.textContent = hasChoices ? t('chooseMutationBtn') : t('continueBtn');
    // Gentle 850ms settle protection so an accidental click right as the card blooms never skips the celebration!
    this.sugarFoundCtaEl.disabled = true;
    this.sugarFoundCtaEl.classList.add('cta-settling');
    this.sugarFoundOverlayEl.classList.remove('hidden');
    window.setTimeout(() => {
      this.sugarFoundCtaEl.disabled = false;
      this.sugarFoundCtaEl.classList.remove('cta-settling');
    }, 850);
  }

  private openSugarMutationModal(level: LevelDefinition) {
    const { skillTree } = this.engine;
    const choices = pickMutationChoices(skillTree.state.mutations, 3);
    const lvlName = loc(level.name, level.nameEn);

    if (choices.length > 0) {
      this.openModal(t('mutChoiceTitle'));
      this.modalBodyEl.innerHTML = '';

      const intro = document.createElement('div');
      intro.className = 'card-row-desc';
      intro.innerHTML = t('mutChoiceIntro', { name: escapeHtml(lvlName) });
      this.modalBodyEl.appendChild(intro);

      const grid = document.createElement('div');
      grid.className = 'mutation-grid';
      for (const mut of choices) {
        const mutName = loc(mut.name, mut.nameEn);
        const mutDesc = loc(mut.description, mut.descriptionEn);
        const card = document.createElement('button');
        card.className = 'mutation-choice';
        card.style.setProperty('--mut-color', mut.accent);
        card.innerHTML = `
          <div class="mutation-icon" style="--mut-color:${mut.accent}">${renderMutationSvg(mut.id)}</div>
          <div class="card-row-info">
            <div class="card-row-title">${escapeHtml(mutName)}</div>
            <div class="card-row-desc">${escapeHtml(mutDesc)}</div>
          </div>
        `;
        card.addEventListener('click', () => {
          skillTree.addMutation(mut.id, level.id);
          this.engine.audio.playUpgrade();
          this.showToast(t('mutGotToast', { name: mutName }));
          this.sync();
          this.openPostSugarNextModal(level);
        });
        grid.appendChild(card);
      }
      this.modalBodyEl.appendChild(grid);
    } else {
      this.openPostSugarNextModal(level);
    }
  }

  private openPostSugarNextModal(level: LevelDefinition) {
    this.openModal(t('postSugarTitle'));
    this.modalBodyEl.innerHTML = '';
    const idx = LEVELS.findIndex((l) => l.id === level.id);
    const nextLevel = idx >= 0 && idx + 1 < LEVELS.length ? LEVELS[idx + 1] : null;

    const box = document.createElement('div');
    box.className = 'story-preview-box';
    box.innerHTML = `<p>${t('postSugarText', { name: escapeHtml(loc(level.name, level.nameEn)) })}</p>`;
    this.modalBodyEl.appendChild(box);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'flex-end';

    const stayBtn = document.createElement('button');
    stayBtn.className = 'action-btn';
    stayBtn.textContent = t('stayAndDig');
    stayBtn.addEventListener('click', () => this.closeModal());
    actions.appendChild(stayBtn);

    if (nextLevel) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'action-btn primary';
      nextBtn.textContent = t('epicNextNamed', { name: loc(nextLevel.name, nextLevel.nameEn) });
      nextBtn.addEventListener('click', () => {
        this.engine.loadLevel(nextLevel.id, true);
        this.closeModal();
      });
      actions.appendChild(nextBtn);
    }
    this.modalBodyEl.appendChild(actions);
  }

  openMutationsModal() {
    const owned = this.engine.skillTree.state.mutations;
    const en = getLang() === 'en';
    this.openModal(`${t('mutTitle')} (${owned.length}/${MUTATIONS.length})`);
    this.modalBodyEl.innerHTML = '';

    if (owned.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'story-preview-box';
      hint.innerHTML = `<p><strong>${t('mutEmptyTitle')}</strong></p><p style="margin-top:4px;color:var(--text-muted);font-size:12.5px;">${t('mutEmptyDesc')}</p>`;
      this.modalBodyEl.appendChild(hint);
    }

    // Active owned mutations first (bright glowing animated icons!), then discoverable mutations below!
    const sorted = [
      ...MUTATIONS.filter((m) => owned.includes(m.id)),
      ...MUTATIONS.filter((m) => !owned.includes(m.id))
    ];
    for (const mut of sorted) {
      const isOwned = owned.includes(mut.id);
      const row = document.createElement('div');
      row.className = `card-row${isOwned ? '' : ' locked-row'}`;
      if (isOwned) {
        row.style.borderColor = mut.accent;
        row.style.boxShadow = `0 6px 20px color-mix(in srgb, ${mut.accent} 22%, transparent)`;
      }
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;width:100%;">
          <div class="mutation-icon" style="--mut-color:${mut.accent}${isOwned ? '' : ';opacity:0.65;filter:saturate(0.55);'}">${renderMutationSvg(mut.id)}</div>
          <div class="card-row-info" style="flex:1;">
            <div class="card-row-title">
              <span style="color:${isOwned ? mut.accent : 'var(--text-main)'}">${escapeHtml(loc(mut.name, mut.nameEn))}</span>
              ${isOwned ? `<span class="badge-done">✓ ${en ? 'Active' : 'Активна'}</span>` : `<span style="font-size:10.5px;color:var(--text-muted);">🔒 ${en ? 'Find Sugar' : 'За сахар'}</span>`}
            </div>
            <div class="card-row-desc">${escapeHtml(loc(mut.description, mut.descriptionEn))}</div>
          </div>
        </div>
      `;
      this.modalBodyEl.appendChild(row);
    }
  }

  openSettingsModal() {
    this.openModal(t('settingsTitle'));
    this.renderSettingsContent();
  }

  private renderSettingsContent() {
    const { skillTree, audio } = this.engine;
    const s = skillTree.state.settings;
    this.modalTitleEl.textContent = t('settingsTitle');
    this.modalBodyEl.innerHTML = '';

    // 1. Language Switcher (RU / EN) right at the top of Settings!
    const langRow = document.createElement('div');
    langRow.className = 'card-row';
    langRow.innerHTML = `<div class="card-row-info"><div class="card-row-title">${t('setLangTitle')}</div><div class="card-row-desc">${t('setLangDesc')}</div></div>`;
    const langWrap = document.createElement('div');
    langWrap.className = 'lang-seg-wrap';
    for (const opt of [
      { id: 'ru' as Language, label: 'Русский' },
      { id: 'en' as Language, label: 'English' }
    ]) {
      const btn = document.createElement('button');
      btn.className = `action-btn${s.language === opt.id ? ' primary' : ''}`;
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        if (s.language === opt.id) return;
        this.setLanguage(opt.id);
        this.renderSettingsContent();
      });
      langWrap.appendChild(btn);
    }
    langRow.appendChild(langWrap);
    this.modalBodyEl.appendChild(langRow);

    // 2. Separate Volume Controls: Music Volume & SFX Volume!
    const addSliderRow = (
      title: string,
      val: number,
      onChange: (nextVal: number) => void
    ) => {
      const row = document.createElement('div');
      row.className = 'card-row';
      row.innerHTML = `<div class="card-row-info"><div class="card-row-title">${title}</div><div class="card-row-desc">${Math.round(val * 100)}%</div></div>`;
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0';
      slider.max = '100';
      slider.value = String(Math.round(val * 100));
      slider.className = 'range-slider';
      slider.addEventListener('input', () => {
        const next = Number(slider.value) / 100;
        onChange(next);
        row.querySelector('.card-row-desc')!.textContent = `${Math.round(next * 100)}%`;
      });
      row.appendChild(slider);
      this.modalBodyEl.appendChild(row);
    };

    const musicVol = typeof s.musicVolume === 'number' ? s.musicVolume : (s.volume ?? 0.65);
    const sfxVol = typeof s.sfxVolume === 'number' ? s.sfxVolume : (s.volume ?? 0.75);

    addSliderRow(t('setMusicVol'), musicVol, (v) => {
      skillTree.updateSettings({ musicVolume: v });
      audio.ensureStarted();
      audio.applySettings(skillTree.state.settings);
    });

    addSliderRow(t('setSfxVol'), sfxVol, (v) => {
      skillTree.updateSettings({ sfxVolume: v });
      audio.ensureStarted();
      audio.applySettings(skillTree.state.settings);
    });

    const addToggle = (title: string, desc: string, val: boolean, onToggle: () => void) => {
      const row = document.createElement('div');
      row.className = 'card-row';
      row.innerHTML = `<div class="card-row-info"><div class="card-row-title">${title}</div><div class="card-row-desc">${desc}</div></div>`;
      const btn = document.createElement('button');
      btn.className = `action-btn${val ? ' primary' : ''}`;
      btn.textContent = val ? t('setOn') : t('setOff');
      btn.addEventListener('click', onToggle);
      row.appendChild(btn);
      this.modalBodyEl.appendChild(row);
    };

    addToggle(t('setMusicToggle'), t('setMusicDesc'), s.musicEnabled, () => {
      skillTree.updateSettings({ musicEnabled: !s.musicEnabled });
      audio.ensureStarted();
      audio.applySettings(skillTree.state.settings);
      this.renderSettingsContent();
    });

    addToggle(t('setSfxToggle'), t('setSfxDesc'), s.sfxEnabled, () => {
      skillTree.updateSettings({ sfxEnabled: !s.sfxEnabled });
      audio.ensureStarted();
      audio.applySettings(skillTree.state.settings);
      this.renderSettingsContent();
    });

    addToggle(t('setAutoTrack'), t('setAutoTrackDesc'), s.autoSwitchTrack, () => {
      skillTree.updateSettings({ autoSwitchTrack: !s.autoSwitchTrack });
      audio.applySettings(skillTree.state.settings);
      this.renderSettingsContent();
    });

    // 3. Soundtracks Grid
    const trackGroup = document.createElement('div');
    trackGroup.className = 'settings-group';
    trackGroup.innerHTML = `<div class="settings-label">${t('setSoundtrack')}</div>`;
    const grid = document.createElement('div');
    grid.className = 'track-grid';
    for (const track of SOUNDTRACKS) {
      const card = document.createElement('button');
      card.className = `track-card${s.soundtrack === track.id ? ' active' : ''}`;
      card.innerHTML = `<strong>${escapeHtml(loc(track.name, track.nameEn))}</strong><small>${escapeHtml(loc(track.subtitle, track.subtitleEn))}</small>`;
      card.addEventListener('click', () => {
        skillTree.updateSettings({ soundtrack: track.id, musicEnabled: true });
        audio.ensureStarted();
        audio.applySettings(skillTree.state.settings);
        this.renderSettingsContent();
      });
      grid.appendChild(card);
    }
    trackGroup.appendChild(grid);
    this.modalBodyEl.appendChild(trackGroup);

    // 4. Smart Auto-Summon Controls (Toggle + Strategy + Per-Ant Filters)
    addToggle(t('setAutoSummon'), t('setAutoSummonDesc'), s.autoSummon, () => {
      skillTree.updateSettings({ autoSummon: !s.autoSummon });
      this.renderSettingsContent();
      if (this.autoPopoverOpen) this.renderAutoPopover();
      this.sync();
      this.showToast(
        skillTree.state.settings.autoSummon ? t('setAutoSummonOn') : t('setAutoSummonOff')
      );
    });

    const autoGroup = document.createElement('div');
    autoGroup.className = 'settings-group';
    const curMode: AutoSummonMode = s.autoSummonMode || 'smart';
    autoGroup.innerHTML = `<div class="settings-label">${t('autoModeLabel')} • ${t('autoAntsLabel')}</div>`;

    const modesRow = document.createElement('div');
    modesRow.className = 'auto-pop-modes';
    for (const m of [
      { id: 'smart' as AutoSummonMode, label: t('autoModeSmart') },
      { id: 'beacon' as AutoSummonMode, label: t('autoModeBeacon') },
      { id: 'nest' as AutoSummonMode, label: t('autoModeNest') }
    ]) {
      const mBtn = document.createElement('button');
      mBtn.className = `auto-mode-chip${curMode === m.id ? ' active' : ''}`;
      mBtn.textContent = m.label;
      mBtn.addEventListener('click', () => {
        skillTree.updateSettings({ autoSummonMode: m.id });
        this.renderSettingsContent();
        if (this.autoPopoverOpen) this.renderAutoPopover();
        this.sync();
      });
      modesRow.appendChild(mBtn);
    }
    autoGroup.appendChild(modesRow);

    const antsRow = document.createElement('div');
    antsRow.className = 'auto-pop-ants';
    for (const id of PLAYABLE_ANTS) {
      const cfg = ANT_TYPES[id];
      const enabled = Boolean(s.autoSummonTypes[id]);
      const iconType: SkillIcon = id === 'queen' ? 'queen' : id === 'compass' ? 'compass' : 'ant';
      const chip = document.createElement('button');
      chip.className = `auto-ant-chip${enabled ? ' enabled' : ''}`;
      chip.style.setProperty('--ant-color', cfg.color);
      chip.innerHTML = `
        <span class="auto-ant-ico">${renderSkillSvg(iconType)}</span>
        <span class="auto-ant-name">${escapeHtml(loc(cfg.shortName, cfg.shortNameEn))}</span>
        <span class="auto-ant-state">${enabled ? '✓' : '—'}</span>
      `;
      chip.addEventListener('click', () => {
        const nextTypes = { ...skillTree.state.settings.autoSummonTypes, [id]: !enabled };
        skillTree.updateSettings({ autoSummonTypes: nextTypes });
        this.renderSettingsContent();
        if (this.autoPopoverOpen) this.renderAutoPopover();
        this.sync();
      });
      antsRow.appendChild(chip);
    }
    autoGroup.appendChild(antsRow);
    this.modalBodyEl.appendChild(autoGroup);

    // 5. Reset Progress
    const resetRow = document.createElement('div');
    resetRow.className = 'card-row';
    resetRow.innerHTML = `<div class="card-row-info"><div class="card-row-title">${t('setResetTitle')}</div><div class="card-row-desc">${t('setResetDesc')}</div></div>`;
    const resetBtn = document.createElement('button');
    resetBtn.className = 'action-btn danger';
    resetBtn.textContent = t('setResetBtn');
    resetBtn.addEventListener('click', () => {
      skillTree.resetAllProgress();
      this.engine.clearSavedRun();
      this.tutorialStep = 'launch';
      try {
        localStorage.removeItem(HINTS_DONE_KEY);
      } catch {
        // Ignore
      }
      this.engine.loadLevel(LEVELS[0].id, true);
      this.engine.clearSavedRun();
      this.showToast(t('setResetToast'));
      this.sync();
      this.closeModal();
    });
    resetRow.appendChild(resetBtn);
    this.modalBodyEl.appendChild(resetRow);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function hashRoomCode(code: string): number {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1_000_000;
}
