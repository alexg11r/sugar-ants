import { ANT_TYPES, PLAYABLE_ANTS } from '../core/ants';
import { SOUNDTRACKS } from '../core/audio';
import { LEVELS } from '../core/levels';
import {
  AntSkinId,
  LevelDefinition,
  PLAYER_COLORS,
  SkillIcon,
  SkillNodeDef
} from '../core/types';
import { GameEngine } from '../game/engine';
import { MenuBackground } from '../game/menuBg';
import { getMutationDef, pickMutationChoices } from '../game/mutations';
import { BRANCH_COLORS, SKILL_NODES } from '../game/skillTree';
import { computeCoopMapSize, MultiplayerEngine } from '../multiplayer/mpEngine';
import {
  ChatMessage,
  listOpenLobbies,
  MpMapSizePreset,
  MpMessage,
  MpMode,
  MpPlayerInfo,
  MpTransport
} from '../multiplayer/mpTransport';
import { onlineDirectory } from '../multiplayer/onlineDirectory';
import { STORY_LEVELS, StoryEngine, StoryLevelDef } from '../story/storyEngine';

const NODE_STEP = 74;
const ORIGIN_X = 268;
const ORIGIN_Y = 192;
const NICK_STORAGE_KEY = 'sugar_ants_nick_v1';

const SKIN_OPTIONS: { id: AntSkinId; name: string }[] = [
  { id: 'classic', name: 'Классик' },
  { id: 'cyber', name: 'Кибер' },
  { id: 'royal', name: 'Король' }
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
  }
}

export class HudController {
  private engine: GameEngine;
  private story: StoryEngine;
  private mp: MultiplayerEngine;
  private menuBg: MenuBackground;
  private mpTransport: MpTransport | null = null;

  private gameCanvasEl = document.getElementById('game-canvas')!;
  private storyCanvasEl = document.getElementById('story-canvas')!;
  private mpCanvasEl = document.getElementById('mp-canvas')!;

  // Main Menu elements
  private mainMenuEl = document.getElementById('main-menu')!;
  private menuContinueSubEl = document.getElementById('menu-continue-sub')!;
  private menuProgressCountEl = document.getElementById('menu-progress-count')!;
  private menuMutCountEl = document.getElementById('menu-mut-count')!;

  // Classic HUD elements
  private hudTopEl = document.getElementById('hud-top')!;
  private hudBottomEl = document.getElementById('hud-bottom')!;
  private levelNameEl = document.getElementById('level-name')!;
  private statMutCountEl = document.getElementById('stat-mut-count')!;
  private statSpEl = document.getElementById('stat-sp')!;
  private statArtEl = document.getElementById('stat-art')!;
  private statDigEl = document.getElementById('stat-dig')!;
  private statSugarEl = document.getElementById('stat-sugar')!;
  private sugarChipEl = document.getElementById('sugar-chip')!;
  private antBarEl = document.getElementById('ant-bar')!;
  private upgradeBadgeEl = document.getElementById('upgrade-badge')!;
  private hintBannerEl = document.getElementById('hint-banner')!;
  private toastContainerEl = document.getElementById('toast-container')!;

  // Story Mode HUD elements
  private storyHudTopEl = document.getElementById('story-hud-top')!;
  private storyHudBottomEl = document.getElementById('story-hud-bottom')!;
  private storyChapterNameEl = document.getElementById('story-chapter-name')!;
  private storyNectarEl = document.getElementById('story-nectar')!;
  private storyLarvaeEl = document.getElementById('story-larvae')!;
  private storyMineralsEl = document.getElementById('story-minerals')!;
  private storySatietyEl = document.getElementById('story-satiety')!;
  private storyDiggersEl = document.getElementById('story-diggers')!;
  private storyEconomyEl = document.getElementById('story-economy')!;

  // Multiplayer HUD elements
  private mpHudTopEl = document.getElementById('mp-hud-top')!;
  private mpHudBottomEl = document.getElementById('mp-hud-bottom')!;
  private mpModeLabelEl = document.getElementById('mp-mode-label')!;
  private mpDigPctEl = document.getElementById('mp-dig-pct')!;
  private mpPlayerCountEl = document.getElementById('mp-player-count')!;
  private mpLocalSpEl = document.getElementById('mp-local-sp')!;
  private mpSpTimerEl = document.getElementById('mp-sp-timer')!;
  private mpBtnPingEl = document.getElementById('mp-btn-ping')!;
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

  private mode: 'menu' | 'classic' | 'story' | 'mp' = 'menu';
  private skillTreeOpen = false;
  private lastRenderedSp = -1;
  private selectedNodeId: string = 'worker_root';
  private lastBoughtNodeId: string | null = null;
  private hasStartedOnce = false;

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
  private unsubOnlineLobbies: (() => void) | null = null;
  private chatMessages: ChatMessage[] = [];
  private chatOpen = true;

  constructor(engine: GameEngine, story: StoryEngine, mp: MultiplayerEngine, menuBg: MenuBackground) {
    this.engine = engine;
    this.story = story;
    this.mp = mp;
    this.menuBg = menuBg;

    this.localNick =
      localStorage.getItem(NICK_STORAGE_KEY) || `Муравей-${Math.floor(10 + Math.random() * 89)}`;

    this.engine.audio.onTrackAutoSwitch = (track) => {
      this.engine.skillTree.updateSettings({ soundtrack: track.id });
      this.showToast(`♪ Саундтрек: ${track.name}`);
    };

    this.bindButtons();
    this.syncMenuSummary();
    this.showMainMenu();
  }

  private bindButtons() {
    // Main menu buttons
    document.getElementById('menu-play-classic')!.addEventListener('click', () => {
      this.engine.audio.ensureStarted();
      if (!this.hasStartedOnce) {
        this.hasStartedOnce = true;
        const targetLvl = this.engine.skillTree.state.currentLevelId;
        this.engine.loadLevel(
          this.engine.skillTree.isLevelUnlocked(targetLvl) ? targetLvl : LEVELS[0].id,
          true
        );
      }
      this.enterClassicGame();
    });

    document.getElementById('menu-play-story')!.addEventListener('click', () => {
      this.engine.audio.ensureStarted();
      this.enterStoryMode(0);
    });

    document.getElementById('menu-play-mp')!.addEventListener('click', () => {
      this.engine.audio.ensureStarted();
      this.openMultiplayerLobbyModal();
    });

    document.getElementById('menu-btn-levels')!.addEventListener('click', () => this.openLevelsModal());
    document.getElementById('menu-btn-mutations')!.addEventListener('click', () => this.openMutationsModal());
    document.getElementById('menu-btn-settings')!.addEventListener('click', () => this.openSettingsModal());

    // Classic HUD buttons
    document.getElementById('btn-menu')!.addEventListener('click', () => this.showMainMenu());
    document.getElementById('btn-settings-hud')!.addEventListener('click', () => this.openSettingsModal());
    document.getElementById('btn-reset-cam')!.addEventListener('click', () => this.engine.resetCamera());
    document.getElementById('btn-upgrades')!.addEventListener('click', () => this.openSkillTree());
    document.getElementById('btn-mutations')!.addEventListener('click', () => this.openMutationsModal());
    document.getElementById('btn-levels')!.addEventListener('click', () => this.openLevelsModal());

    // Story HUD buttons
    document.getElementById('story-btn-menu')!.addEventListener('click', () => this.showMainMenu());
    document.getElementById('story-btn-chapters')!.addEventListener('click', () => this.openStoryChaptersModal());
    document.getElementById('story-btn-settings')!.addEventListener('click', () => this.openSettingsModal());
    document.getElementById('story-btn-reset-cam')!.addEventListener('click', () => this.story.resetCamera());

    // Multiplayer HUD buttons
    document.getElementById('mp-btn-menu')!.addEventListener('click', () => {
      this.leaveMultiplayerRoom();
      this.showMainMenu();
    });
    document.getElementById('mp-btn-ping')!.addEventListener('click', () => this.mp.togglePingMode());
    document.getElementById('mp-btn-chat-toggle')!.addEventListener('click', () => {
      this.chatOpen = !this.chatOpen;
      this.mpChatBoxEl.classList.toggle('hidden', !this.chatOpen);
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
      if (e.key === 'Escape') {
        if (!this.modalBackdropEl.classList.contains('hidden')) {
          this.closeModal();
        } else if (this.skillTreeOpen) {
          this.closeSkillTree();
        } else if (this.mode !== 'menu') {
          this.showMainMenu();
        }
      }
    });
  }

  private leaveMultiplayerRoom() {
    this.mpTransport?.close();
    this.mpTransport = null;
    this.inLobbyRoom = false;
    this.lobbyPlayers = [];
  }

  showMainMenu() {
    this.mode = 'menu';
    this.closeSkillTree();
    this.engine.paused = true;
    this.story.stop();
    this.mp.stop();

    this.hudTopEl.classList.add('hidden');
    this.hudBottomEl.classList.add('hidden');
    this.hintBannerEl.classList.add('hidden');
    this.storyHudTopEl.classList.add('hidden');
    this.storyHudBottomEl.classList.add('hidden');
    this.storyCanvasEl.classList.add('hidden');
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
    this.story.stop();
    this.mp.stop();
    this.menuBg.stop();

    this.mainMenuEl.classList.add('hidden');
    this.storyHudTopEl.classList.add('hidden');
    this.storyHudBottomEl.classList.add('hidden');
    this.storyCanvasEl.classList.add('hidden');
    this.mpHudTopEl.classList.add('hidden');
    this.mpHudBottomEl.classList.add('hidden');
    this.mpVoteBannerEl.classList.add('hidden');
    this.mpChatBoxEl.classList.add('hidden');
    this.mpCanvasEl.classList.add('hidden');

    this.gameCanvasEl.classList.remove('hidden');
    this.hudTopEl.classList.remove('hidden');
    this.hudBottomEl.classList.remove('hidden');
    this.hintBannerEl.classList.remove('hidden');
    this.engine.paused = false;
    this.sync();
  }

  enterStoryMode(levelIndex = 0) {
    this.mode = 'story';
    this.closeModal();
    this.closeSkillTree();
    this.engine.paused = true;
    this.mp.stop();
    this.menuBg.stop();

    this.mainMenuEl.classList.add('hidden');
    this.hudTopEl.classList.add('hidden');
    this.hudBottomEl.classList.add('hidden');
    this.hintBannerEl.classList.add('hidden');
    this.gameCanvasEl.classList.add('hidden');
    this.mpHudTopEl.classList.add('hidden');
    this.mpHudBottomEl.classList.add('hidden');
    this.mpVoteBannerEl.classList.add('hidden');
    this.mpChatBoxEl.classList.add('hidden');
    this.mpCanvasEl.classList.add('hidden');

    this.storyCanvasEl.classList.remove('hidden');
    this.storyHudTopEl.classList.remove('hidden');
    this.storyHudBottomEl.classList.remove('hidden');

    this.story.startLevel(levelIndex);
    this.syncStoryHud();
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
    lateDugEvents?: [number, number, number, number][];
    startingSp?: number;
  }) {
    this.mode = 'mp';
    this.inLobbyRoom = false;
    this.closeModal();
    this.closeSkillTree();
    this.engine.paused = true;
    this.story.stop();
    this.menuBg.stop();

    this.mainMenuEl.classList.add('hidden');
    this.hudTopEl.classList.add('hidden');
    this.hudBottomEl.classList.add('hidden');
    this.hintBannerEl.classList.add('hidden');
    this.gameCanvasEl.classList.add('hidden');
    this.storyHudTopEl.classList.add('hidden');
    this.storyHudBottomEl.classList.add('hidden');
    this.storyCanvasEl.classList.add('hidden');

    this.mpCanvasEl.classList.remove('hidden');
    this.mpHudTopEl.classList.remove('hidden');
    this.mpHudBottomEl.classList.remove('hidden');
    this.mpChatBoxEl.classList.toggle('hidden', !this.chatOpen);

    this.mp.startMatch(opts);
    this.syncMpHud();
    this.renderChatLogs();
  }

  private syncMenuSummary() {
    const { skillTree } = this.engine;
    const lvl = LEVELS.find((l) => l.id === skillTree.state.currentLevelId) || LEVELS[0];
    this.menuContinueSubEl.textContent = `${this.hasStartedOnce ? 'Продолжить' : 'Начать'} • ${lvl.name}`;
    this.menuProgressCountEl.textContent = `${skillTree.state.completedLevels.length}/${LEVELS.length}`;
    this.menuMutCountEl.textContent = String(skillTree.state.mutations.length);
  }

  hideHint() {
    this.hintBannerEl.classList.add('fade-out');
  }

  showToast(message: string) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    this.toastContainerEl.appendChild(el);
    setTimeout(() => el.remove(), 3100);
  }

  /* =========================================================
     MULTIPLAYER CHAT (LOBBY + IN-GAME!)
     ========================================================= */
  pushSystemChat(text: string) {
    this.chatMessages.push({
      id: `sys_${Date.now()}_${Math.random()}`,
      senderNick: 'Система',
      senderColor: '#88d9c4',
      text,
      system: true,
      ts: Date.now()
    });
    if (this.chatMessages.length > 60) this.chatMessages.shift();
    this.renderChatLogs();
  }

  private sendChatMessage(text: string) {
    const col = PLAYER_COLORS[this.localColorIndex % PLAYER_COLORS.length].hex;
    const msg: ChatMessage = {
      id: `m_${Date.now()}_${Math.random()}`,
      senderNick: this.localNick,
      senderColor: col,
      text,
      ts: Date.now()
    };
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 60) this.chatMessages.shift();
    this.mpTransport?.send({ type: 'chat', msg });
    this.renderChatLogs();
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
    this.openModal(this.inLobbyRoom ? `🌐 Лобби • ${this.mpTransport?.roomCode || ''}` : '🌐 Онлайн-лобби');
    if (this.inLobbyRoom) {
      this.lobbyBrowserOpen = false;
      this.renderLobbyRoomScreen();
    } else {
      this.lobbyBrowserOpen = true;
      if (!this.unsubOnlineLobbies) {
        this.unsubOnlineLobbies = onlineDirectory.onLobbiesUpdated(() => {
          if (this.lobbyBrowserOpen && !this.inLobbyRoom && !this.modalBackdropEl.classList.contains('hidden')) {
            this.renderMpBrowserScreen();
          }
        });
      }
      this.renderMpBrowserScreen();
    }
  }

  private renderProfileCustomizer(container: HTMLElement, takenColors: Set<number>, onUpdate?: () => void) {
    const wrap = document.createElement('div');
    wrap.className = 'settings-group';
    wrap.innerHTML = `<div class="settings-label">Ваш профиль (Ник, Скин, Цвет)</div>`;

    // Nick input
    const nickRow = document.createElement('div');
    nickRow.style.display = 'flex';
    nickRow.style.gap = '8px';
    const nickInput = document.createElement('input');
    nickInput.className = 'mp-input';
    nickInput.style.textTransform = 'none';
    nickInput.style.letterSpacing = '0';
    nickInput.placeholder = 'Ваш ник…';
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
      btn.innerHTML = `<strong style="margin:0">${sk.name}</strong>`;
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
      sw.title = isTaken ? `${col.name} (занят)` : col.name;
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
    this.modalTitleEl.textContent = '⚔ Мультиплеер — Список лобби';
    this.modalBodyEl.innerHTML = '';

    // 1. Player Profile (Nick + 3 Skins + 10 Colors)
    this.renderProfileCustomizer(this.modalBodyEl, new Set());

    // 2. Mode & Map selector for creating a room
    const modeGrid = document.createElement('div');
    modeGrid.className = 'track-grid';
    const coopCard = document.createElement('button');
    coopCard.className = `track-card${this.lobbyMpMode === 'coop' ? ' active' : ''}`;
    coopCard.innerHTML = `<strong>🤝 Кооператив (до 10)</strong><small>Древо навыков, голосование, чат</small>`;
    coopCard.addEventListener('click', () => {
      this.lobbyMpMode = 'coop';
      this.renderMpBrowserScreen();
    });

    const vsCard = document.createElement('button');
    vsCard.className = `track-card${this.lobbyMpMode === 'versus' ? ' active' : ''}`;
    vsCard.innerHTML = `<strong>⚔ Гонка 1 на 1</strong><small>Кто первым найдёт сахар</small>`;
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
      opt.textContent = lvl.name;
      if (lvl.id === this.lobbyLevelId) opt.selected = true;
      mapSel.appendChild(opt);
    }
    mapSel.addEventListener('change', () => (this.lobbyLevelId = mapSel.value));

    const passInput = document.createElement('input');
    passInput.className = 'mp-input';
    passInput.style.textTransform = 'none';
    passInput.style.letterSpacing = '0';
    passInput.style.maxWidth = '150px';
    passInput.placeholder = 'Пароль (необяз.)';

    const createBtn = document.createElement('button');
    createBtn.className = 'action-btn primary';
    createBtn.textContent = '🌐 Создать лобби';
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
        <div class="card-row-title">🤖 Быстрый матч против ИИ</div>
        <div class="card-row-desc">Запустить гонку 1v1 против соперника-бота прямо сейчас</div>
      </div>
    `;
    const botBtn = document.createElement('button');
    botBtn.className = 'action-btn';
    botBtn.textContent = 'Старт vs ИИ';
    botBtn.addEventListener('click', () => {
      this.leaveMultiplayerRoom();
      this.chatMessages = [];
      const me = this.makeLocalPlayerInfo('local_1', true);
      const botColor = this.pickFreeColorIndex([me], 1);
      const bot: MpPlayerInfo = {
        id: 'bot_rival',
        nick: 'ИИ-Колония',
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

    // 4. Open Online Lobbies List!
    const listHeader = document.createElement('div');
    listHeader.style.display = 'flex';
    listHeader.style.justifyContent = 'space-between';
    listHeader.style.alignItems = 'center';
    const isOnline = onlineDirectory.isConnected();
    listHeader.innerHTML = `<div class="settings-label">Открытые онлайн-лобби • <span style="color:${isOnline ? '#3ce87a' : '#ffd845'}">${isOnline ? '🟢 Онлайн' : '🟡 Подключение…'}</span></div>`;
    const refBtn = document.createElement('button');
    refBtn.className = 'action-btn';
    refBtn.style.padding = '4px 10px';
    refBtn.textContent = '↻ Обновить';
    refBtn.addEventListener('click', () => {
      onlineDirectory.ensureConnected();
      this.renderMpBrowserScreen();
    });
    listHeader.appendChild(refBtn);
    this.modalBodyEl.appendChild(listHeader);

    const lobbies = listOpenLobbies();
    if (lobbies.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'card-row-desc';
      empty.textContent = isOnline
        ? 'Пока нет активных онлайн-лобби — создайте своё, и оно сразу появится в списке у всех игроков!'
        : 'Подключаемся к онлайн-серверу лобби… Вы также можете создать комнату или войти по коду.';
      this.modalBodyEl.appendChild(empty);
    } else {
      for (const lob of lobbies) {
        const lvlName = LEVELS.find((l) => l.id === lob.levelId)?.name || lob.levelId;
        const row = document.createElement('div');
        row.className = 'card-row';
        row.innerHTML = `
          <div class="card-row-info">
            <div class="card-row-title">
              <span>${lob.hasPassword ? '🔒 ' : ''}${lob.code} • ${escapeHtml(lob.hostNick)}</span>
              <span class="badge-done">${lob.playerCount}/${lob.maxPlayers}</span>
            </div>
            <div class="card-row-desc">${lob.mpMode === 'coop' ? '🤝 Кооп' : '⚔ 1v1'} • ${lvlName} • ${lob.inGame ? 'В игре (можно войти!)' : 'В лобби'}</div>
          </div>
        `;
        const jBtn = document.createElement('button');
        jBtn.className = 'action-btn primary';
        jBtn.textContent = 'Войти';
        jBtn.addEventListener('click', () => {
          const pw = lob.hasPassword ? window.prompt('Введите пароль лобби:') || '' : '';
          this.joinExistingLobby(lob.code, pw);
        });
        row.appendChild(jBtn);
        this.modalBodyEl.appendChild(row);
      }
    }

    // 5. Direct Join by Room Code
    const joinRow = document.createElement('div');
    joinRow.className = 'card-row';
    const codeInput = document.createElement('input');
    codeInput.className = 'mp-input';
    codeInput.placeholder = 'Код комнаты (ANT-XXXX)';
    const joinBtn = document.createElement('button');
    joinBtn.className = 'action-btn primary';
    joinBtn.textContent = 'Войти';
    joinBtn.addEventListener('click', () => {
      if (codeInput.value.trim()) {
        this.joinExistingLobby(codeInput.value.trim(), passInput.value);
      }
    });
    joinRow.appendChild(codeInput);
    joinRow.appendChild(joinBtn);
    this.modalBodyEl.appendChild(joinRow);
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
      onPeerDisconnected: () => {
        this.showToast('Хост закрыл лобби');
        this.pushSystemChat('Соединение с хостом потеряно.');
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
      code: this.mpTransport.roomCode
    });
  }

  private handleHostMessage(msg: MpMessage, fromPeerId: string) {
    if (!this.mpTransport) return;

    if (msg.type === 'hello') {
      if (this.mpTransport.password && msg.password !== this.mpTransport.password) {
        this.mpTransport.sendTo(fromPeerId, { type: 'reject', reason: 'Неверный пароль лобби!' });
        return;
      }
      const maxP = this.lobbyMpMode === 'coop' ? 10 : 2;
      const activeList = this.mode === 'mp' ? this.mp.state.players : this.lobbyPlayers;
      if (activeList.length >= maxP) {
        this.mpTransport.sendTo(fromPeerId, { type: 'reject', reason: `Лобби заполнено (${maxP}/${maxP})` });
        return;
      }

      const assignedColor = this.pickFreeColorIndex(activeList, msg.player.colorIndex);
      const joined: MpPlayerInfo = { ...msg.player, colorIndex: assignedColor, isHost: false };

      if (this.mode === 'mp') {
        // MID-GAME LATE JOIN! Carve their base & send full state sync!
        const added = this.mp.addLateJoinPlayer(joined);
        this.lobbyPlayers = this.mp.state.players;
        this.mpTransport.sendTo(fromPeerId, {
          type: 'late_sync',
          seed: this.mp.seed,
          levelId: this.mp.state.level.id,
          mpMode: this.mp.state.mpMode,
          players: this.mp.state.players,
          width: this.mp.width,
          height: this.mp.height,
          dugEvents: this.mp.dugHistory
        });
        this.broadcastLobbyState();
        this.showToast(`${added.nick} вошёл в идущую игру!`);
      } else {
        this.lobbyPlayers = this.lobbyPlayers.filter((p) => p.id !== joined.id);
        this.lobbyPlayers.push(joined);
        this.pushSystemChat(`${joined.nick} вошёл в лобби!`);
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
      this.chatMessages.push(msg.msg);
      if (this.chatMessages.length > 60) this.chatMessages.shift();
      this.renderChatLogs();
      return;
    }

    // All peers receive room pub/sub directly — apply locally without re-broadcasting!
    this.mp.handleRemoteMessage(msg);
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
      if (this.inLobbyRoom) this.renderLobbyRoomScreen();
      return;
    }
    if (msg.type === 'chat') {
      this.chatMessages.push(msg.msg);
      if (this.chatMessages.length > 60) this.chatMessages.shift();
      this.renderChatLogs();
      return;
    }
    if (msg.type === 'start') {
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
      this.enterMultiplayerMatch({
        seed: msg.seed,
        levelId: msg.levelId,
        mpMode: msg.mpMode,
        vsBot: false,
        localPlayerId: this.mpTransport!.localId,
        players: msg.players,
        width: msg.width,
        height: msg.height,
        transport: this.mpTransport,
        lateDugEvents: msg.dugEvents,
        startingSp: 5 // Catch-up SP for late joiners!
      });
      return;
    }

    this.mp.handleRemoteMessage(msg);
  }

  private renderLobbyRoomScreen() {
    if (!this.mpTransport) return;
    const isHost = this.mpTransport.isHost;
    const maxP = this.lobbyMpMode === 'coop' ? 10 : 2;
    const dims = computeCoopMapSize(this.lobbyPlayers.length, this.lobbyMpMode, this.lobbyMapSize);

    this.modalTitleEl.textContent = `🌐 Лобби • ${this.mpTransport.roomCode}`;
    this.modalBodyEl.innerHTML = '';

    // Room Code + Copy
    const codeBox = document.createElement('div');
    codeBox.className = 'mp-code-pill';
    codeBox.textContent = `${this.mpTransport.roomCode}  (${this.lobbyPlayers.length}/${maxP} • Карта ${dims.width}×${dims.height})`;
    codeBox.title = 'Нажмите, чтобы скопировать код';
    codeBox.addEventListener('click', () => {
      navigator.clipboard?.writeText(this.mpTransport!.roomCode).catch(() => {});
      this.showToast(`Код ${this.mpTransport!.roomCode} скопирован!`);
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
        opt.textContent = `Карта: ${lvl.name}`;
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
          { id: 'auto', label: 'Размер: Авто (от 5 игр.)' },
          { id: 'compact', label: 'Размер: Компактная (400×250)' },
          { id: 'large', label: 'Размер: Большая (520×330)' },
          { id: 'huge', label: 'Размер: Гигантская (640×400)' }
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
      const lvlName = LEVELS.find((l) => l.id === this.lobbyLevelId)?.name || this.lobbyLevelId;
      settingsRow.innerHTML = `<div class="card-row-desc">Карта: <strong>${lvlName}</strong> • Размер: <strong>${dims.width}×${dims.height}</strong></div>`;
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
    roster.innerHTML = `<div class="settings-label">Игроки в лобби</div>`;
    for (const pl of this.lobbyPlayers) {
      const col = PLAYER_COLORS[pl.colorIndex % PLAYER_COLORS.length];
      const skName = SKIN_OPTIONS.find((s) => s.id === pl.skin)?.name || 'Классик';
      const row = document.createElement('div');
      row.className = 'card-row';
      row.style.padding = '7px 12px';
      row.innerHTML = `
        <div class="card-row-title" style="font-size:13px;">
          <span style="width:11px;height:11px;border-radius:50%;background:${col.hex};display:inline-block;"></span>
          <span>${escapeHtml(pl.nick)} ${pl.isHost ? '👑' : ''}</span>
        </div>
        <span style="font-size:11px;color:var(--text-muted);">${skName} • ${col.name}</span>
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
    chatWrap.innerHTML = `<div class="settings-label">Чат лобби</div>`;
    const log = document.createElement('div');
    log.id = 'lobby-chat-log';
    log.className = 'lobby-chat-log';
    chatWrap.appendChild(log);

    const form = document.createElement('form');
    form.style.display = 'flex';
    form.style.gap = '6px';
    const inp = document.createElement('input');
    inp.className = 'mp-chat-input';
    inp.placeholder = 'Сообщение в чат лобби…';
    const sendBtn = document.createElement('button');
    sendBtn.type = 'submit';
    sendBtn.className = 'action-btn primary';
    sendBtn.textContent = 'Отправить';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = inp.value.trim();
      if (!t) return;
      inp.value = '';
      this.sendChatMessage(t);
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
    leaveBtn.textContent = 'Покинуть лобби';
    leaveBtn.addEventListener('click', () => {
      this.leaveMultiplayerRoom();
      this.renderMpBrowserScreen();
    });
    actions.appendChild(leaveBtn);

    if (isHost) {
      const startBtn = document.createElement('button');
      startBtn.className = 'action-btn primary';
      startBtn.textContent = '▶ Начать игру';
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
      st.mpMode === 'coop' ? `🤝 Кооп • ${st.level.name}` : st.vsBot ? '⚔ Гонка vs ИИ' : '⚔ Гонка 1v1';
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
      let sub = unlocked ? 'Готов' : '🔒';
      if (id === 'compass' && st.compassCd > 0) {
        const s = Math.ceil(st.compassCd);
        sub = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      }

      const btn = document.createElement('button');
      btn.className = `ant-btn${st.selectedAnt === id && unlocked ? ' active' : ''}${unlocked ? '' : ' locked'}`;
      btn.style.setProperty('--ant-color', cfg.color);
      const iconType: SkillIcon = id === 'queen' ? 'queen' : id === 'compass' ? 'compass' : 'ant';
      btn.innerHTML = `
        <span class="ant-icon-svg" style="color:${cfg.color}">${renderSkillSvg(iconType)}</span>
        <span class="ant-name">${unlocked ? cfg.shortName : '🔒 ' + cfg.shortName}</span>
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
      btn.textContent = `${lvl.name}${cnt > 0 ? ` (${cnt})` : ''}`;
      btn.addEventListener('click', () => this.mp.castVote(mapId));
      this.mpVoteActionsEl.appendChild(btn);
    }

    // Stay & keep digging button
    const stayCnt = countFor('stay');
    const stayBtn = document.createElement('button');
    stayBtn.className = `action-btn${v.myChoice === 'stay' ? ' primary' : ''}`;
    stayBtn.disabled = v.myChoice !== null;
    stayBtn.textContent = `✕ Остаться${stayCnt > 0 ? ` (${stayCnt})` : ''}`;
    stayBtn.addEventListener('click', () => this.mp.castVote('stay'));
    this.mpVoteActionsEl.appendChild(stayBtn);

    const totalHumans = Math.max(1, this.mp.state.players.filter((p) => !p.id.startsWith('bot_')).length);
    const castCount = Object.keys(v.votes).length;
    this.mpVoteTallyEl.textContent = `Проголосовало: ${castCount}/${totalHumans}`;
  }

  openMpVersusEndModal(winnerNick: string, iWon: boolean) {
    this.openModal(iWon ? '🏆 Победа вашей колонии!' : '⚔ Соперник оказался быстрее!');
    this.modalBodyEl.innerHTML = `
      <div class="story-preview-box">
        <p><strong>${iWon ? 'Ваши муравьи первыми добрались до сахара!' : `Победил ${escapeHtml(winnerNick)}!`}</strong></p>
      </div>
    `;
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'flex-end';

    const rematchBtn = document.createElement('button');
    rematchBtn.className = 'action-btn primary';
    rematchBtn.textContent = 'Новая карта';
    rematchBtn.addEventListener('click', () => {
      this.closeModal();
      this.mp.advanceToNextCoopLevel();
    });

    const menuBtn = document.createElement('button');
    menuBtn.className = 'action-btn';
    menuBtn.textContent = 'В меню';
    menuBtn.addEventListener('click', () => {
      this.leaveMultiplayerRoom();
      this.closeModal();
      this.showMainMenu();
    });

    actions.appendChild(menuBtn);
    actions.appendChild(rematchBtn);
    this.modalBodyEl.appendChild(actions);
  }

  openMpAllClearedModal() {
    this.openModal('🌟 Карта очищена на 100%!');
    this.modalBodyEl.innerHTML = `
      <div class="story-preview-box">
        <p><strong>Невероятно! Ваши колонии съели все блоки и полностью открыли скрытый узор!</strong></p>
      </div>
    `;
    const nextBtn = document.createElement('button');
    nextBtn.className = 'action-btn primary';
    nextBtn.textContent = 'Перейти на следующую карту →';
    nextBtn.addEventListener('click', () => {
      this.closeModal();
      this.mp.advanceToNextCoopLevel();
    });
    this.modalBodyEl.appendChild(nextBtn);
  }

  /* =========================================================
     STORY MODE HUD (3 CHAPTERS + DEEP ECONOMY!)
     ========================================================= */
  syncStoryHud() {
    if (this.mode !== 'story') return;
    const st = this.story.state;
    const lvl = this.story.getCurrentLevel();

    this.storyChapterNameEl.textContent = lvl.name;
    this.storyNectarEl.textContent = String(Math.floor(st.nectar));
    this.storyLarvaeEl.textContent = String(Math.floor(st.larvae));
    this.storyMineralsEl.textContent = String(Math.floor(st.minerals));
    this.storySatietyEl.textContent = `${Math.round(st.satiety)}%`;

    this.storyDiggersEl.innerHTML = '';
    const diggers: { id: 'worker' | 'warrior' | 'scout' | 'queen'; unlocked: boolean; cost: string }[] = [
      { id: 'worker', unlocked: true, cost: '1🥚 2🍯' },
      { id: 'warrior', unlocked: st.warriorUnlocked, cost: st.warriorUnlocked ? '3🥚 4🍯' : '🔒14🍯 5🥚' },
      { id: 'scout', unlocked: st.scoutUnlocked, cost: st.scoutUnlocked ? '2🥚 2🍯' : '🔒11🍯 4🥚' },
      { id: 'queen', unlocked: st.queenUnlocked, cost: st.queenUnlocked ? '5🥚 8🍯' : '🔒22🍯 8🥚' }
    ];

    for (const d of diggers) {
      const cfg = ANT_TYPES[d.id];
      const btn = document.createElement('button');
      btn.className = `ant-btn${st.selectedDigger === d.id && d.unlocked ? ' active' : ''}${d.unlocked ? '' : ' locked'}`;
      btn.style.setProperty('--ant-color', cfg.color);
      btn.innerHTML = `
        <span class="ant-icon-svg" style="color:${cfg.color}">${renderSkillSvg(d.id === 'queen' ? 'queen' : 'ant')}</span>
        <span class="ant-name">${d.unlocked ? cfg.shortName : '🔒 ' + cfg.shortName}</span>
        <span class="ant-count">${d.cost}</span>
      `;
      btn.addEventListener('click', () => {
        if (d.unlocked) this.story.selectDigger(d.id);
        else if (d.id !== 'worker' && !this.story.unlockDigger(d.id)) {
          this.showToast(`Недостаточно ресурсов для открытия «${cfg.name}»`);
        }
      });
      this.storyDiggersEl.appendChild(btn);
    }

    this.storyEconomyEl.innerHTML = '';
    const aphidMin = 5 + st.aphidHerders * 5;
    const aphidLarv = 2 + st.aphidHerders;
    const nurseNec = 9 + st.nurses * 7;
    const nurseMin = 4 + st.nurses * 4;
    const panNec = 8 + st.pantryLevel * 8;
    const panMin = 8 + st.pantryLevel * 8;
    const jawNec = 10 + st.jawLevel * 10;
    const jawMin = 8 + st.jawLevel * 9;
    const pherNec = 12 + st.pheromoneLevel * 12;
    const pherLarv = 3 + st.pheromoneLevel * 2;

    const ecoActions = [
      { title: `🌿 Тли ×${st.aphidHerders}`, sub: `${aphidMin}🪨 ${aphidLarv}🥚`, ok: st.minerals >= aphidMin && st.larvae >= aphidLarv, fn: () => this.story.hireAphidHerder() },
      { title: `🥚 Няньки ×${st.nurses}`, sub: `${nurseNec}🍯 ${nurseMin}🪨`, ok: st.nectar >= nurseNec && st.minerals >= nurseMin, fn: () => this.story.hireNurse() },
      { title: `🏠 Склад +${st.pantryLevel}`, sub: `${panNec}🍯 ${panMin}🪨`, ok: st.nectar >= panNec && st.minerals >= panMin, fn: () => this.story.upgradePantry() },
      { title: `⚡ Жвалы +${st.jawLevel}`, sub: `${jawNec}🍯 ${jawMin}🪨`, ok: st.nectar >= jawNec && st.minerals >= jawMin, fn: () => this.story.upgradeJaws() },
      { title: `🏃 Скорость +${st.pheromoneLevel}`, sub: `${pherNec}🍯 ${pherLarv}🥚`, ok: st.nectar >= pherNec && st.larvae >= pherLarv, fn: () => this.story.upgradePheromones() }
    ];

    for (const eco of ecoActions) {
      const btn = document.createElement('button');
      btn.className = 'eco-btn';
      btn.disabled = !eco.ok;
      btn.innerHTML = `<strong>${eco.title}</strong><small>${eco.sub}</small>`;
      btn.addEventListener('click', eco.fn);
      this.storyEconomyEl.appendChild(btn);
    }
  }

  openStoryChaptersModal() {
    this.openModal('🌿 Главы сюжетного режима');
    this.modalBodyEl.innerHTML = '';

    STORY_LEVELS.forEach((lvl, idx) => {
      const isCur = this.story.state.levelIndex === idx;
      const row = document.createElement('div');
      row.className = 'card-row';
      row.innerHTML = `
        <div class="card-row-info">
          <div class="card-row-title">${lvl.name}</div>
          <div class="card-row-desc">${lvl.intro}</div>
        </div>
      `;
      const btn = document.createElement('button');
      btn.className = `action-btn${isCur ? '' : ' primary'}`;
      btn.textContent = isCur ? 'Заново' : 'Играть';
      btn.addEventListener('click', () => {
        this.closeModal();
        this.enterStoryMode(idx);
      });
      row.appendChild(btn);
      this.modalBodyEl.appendChild(row);
    });
  }

  openStoryVictoryModal(level: StoryLevelDef, hasNext: boolean) {
    this.openModal(`🎉 ${level.name} — пройдена!`);
    this.modalBodyEl.innerHTML = `
      <div class="story-preview-box">
        <p><strong>Муравьи выбрались из фермы и добрались до кусочка сахара!</strong></p>
        <p style="margin-top:8px;color:var(--text-muted);font-size:13px;">
          ${hasNext ? 'Впереди следующая глава с более глубокой фермой и новыми преградами!' : 'Вы прошли все 3 главы сюжетного режима — колония полностью спасена!'}
        </p>
      </div>
    `;
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'flex-end';

    const menuBtn = document.createElement('button');
    menuBtn.className = 'action-btn';
    menuBtn.textContent = 'В меню';
    menuBtn.addEventListener('click', () => {
      this.closeModal();
      this.showMainMenu();
    });
    actions.appendChild(menuBtn);

    if (hasNext) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'action-btn primary';
      nextBtn.textContent = `Далее: Глава ${level.chapter + 1} →`;
      nextBtn.addEventListener('click', () => {
        this.closeModal();
        this.enterStoryMode(level.chapter); // chapter is 1-based, so next index = chapter
      });
      actions.appendChild(nextBtn);
    }

    this.modalBodyEl.appendChild(actions);
  }

  /* =========================================================
     CLASSIC MODE HUD SYNC
     ========================================================= */
  sync() {
    const { world, skillTree } = this.engine;
    const stats = world.stats;

    this.levelNameEl.textContent = world.level.name;
    this.statMutCountEl.textContent = String(skillTree.state.mutations.length);
    this.statSpEl.textContent = String(skillTree.state.skillPoints);

    const artPct =
      stats.totalArt > 0 ? Math.min(100, Math.round((stats.revealedArt / stats.totalArt) * 100)) : 0;
    const digPct =
      stats.totalBreakable > 0
        ? Math.min(100, Math.round((stats.dugBreakable / stats.totalBreakable) * 100))
        : 0;

    this.statArtEl.textContent = `${artPct}%`;
    this.statDigEl.textContent = `${digPct}%`;

    if (stats.sugarFound) {
      this.sugarChipEl.classList.remove('sugar-searching');
      this.sugarChipEl.classList.add('sugar-found');
      this.statSugarEl.textContent = 'Сахар найден!';
    } else {
      this.sugarChipEl.classList.add('sugar-searching');
      this.sugarChipEl.classList.remove('sugar-found');
      this.statSugarEl.textContent = 'Поиск сахара';
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
      const activeCount = ants.countByType(id);
      const maxCount = ants.getMaxActive(id, colStats);

      let subText = unlocked ? `${activeCount}/${maxCount}` : '—';
      let onCooldown = false;
      if (id === 'compass') {
        if (ants.compassCooldown > 0) {
          onCooldown = true;
          const sec = Math.ceil(ants.compassCooldown);
          subText = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
        } else {
          subText = 'Готов';
        }
      }

      const btn = document.createElement('button');
      btn.className = `ant-btn${selectedAnt === id ? ' active' : ''}${!unlocked || onCooldown ? ' locked' : ''}`;
      btn.style.setProperty('--ant-color', cfg.color);
      const iconType: SkillIcon = id === 'queen' ? 'queen' : id === 'compass' ? 'compass' : 'ant';
      btn.innerHTML = `
        <span class="ant-key">${cfg.hotkey}</span>
        <span class="ant-icon-svg" style="color:${cfg.color}">${renderSkillSvg(iconType)}</span>
        <span class="ant-name">${unlocked ? cfg.shortName : '🔒 ' + cfg.shortName}</span>
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
     SHARED VISUAL SKILL TREE (WORKS IN BOTH CLASSIC & CO-OP!)
     ========================================================= */
  openSkillTree() {
    this.closeModal();
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

    const visibleNodes = SKILL_NODES.filter((n) => adapter.isVisible(n));
    const visibleSet = new Set(visibleNodes.map((n) => n.id));
    if (!visibleSet.has(this.selectedNodeId)) this.selectedNodeId = 'worker_root';

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
          this.stNodesEl.querySelectorAll('.st-node.selected').forEach((n) => n.classList.remove('selected'));
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
          this.stNodesEl.querySelectorAll('.st-node.selected').forEach((n) => n.classList.remove('selected'));
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

    this.stTooltipEl.style.setProperty('--tt-color', colors.main);
    this.stTtCatEl.textContent = node.category;
    this.stTtTitleEl.textContent = node.maxRank > 1 ? `${node.title} (${rank}/${node.maxRank})` : node.title;
    this.stTtDescEl.textContent = node.description;

    if (isMaxed) {
      this.stTtCostEl.textContent = '✓ Изучено';
      this.stTtCostEl.className = 'st-tt-cost maxed';
      this.stTtBuyEl.classList.add('hidden');
    } else {
      this.stTtCostEl.textContent = `♦ ${cost}`;
      this.stTtCostEl.className = `st-tt-cost${canBuy ? ' affordable' : ''}`;
      this.stTtBuyEl.classList.remove('hidden');
      this.stTtBuyEl.textContent = rank === 0 ? 'Изучить' : 'Улучшить';
      this.stTtBuyEl.disabled = !canBuy;
    }
  }

  /* =========================================================
     MODALS: LEVELS / SUGAR + MUTATIONS / MUTATIONS / SETTINGS
     ========================================================= */
  private openModal(title: string) {
    this.modalTitleEl.textContent = title;
    this.modalBackdropEl.classList.remove('hidden');
  }

  closeModal() {
    this.lobbyBrowserOpen = false;
    this.modalBackdropEl.classList.add('hidden');
  }

  openLevelsModal() {
    this.openModal('🗺 Карты — Классический режим');
    this.modalBodyEl.innerHTML = '';

    for (let i = 0; i < LEVELS.length; i++) {
      const lvl = LEVELS[i];
      const unlocked = this.engine.skillTree.isLevelUnlocked(lvl.id);
      const isDone = this.engine.skillTree.state.completedLevels.includes(lvl.id);
      const isCurrent = this.mode === 'classic' && this.engine.world.level.id === lvl.id;

      const row = document.createElement('div');
      row.className = `card-row${unlocked ? '' : ' locked-row'}`;
      row.innerHTML = `
        <div class="card-row-info">
          <div class="card-row-title">
            <span style="width:9px;height:9px;border-radius:50%;background:${lvl.palette.accentHex};display:inline-block;"></span>
            <span>${i + 1}. ${unlocked ? lvl.name : '🔒 ' + lvl.name}</span>
            ${isDone ? '<span class="badge-done">🧊 Пройден</span>' : ''}
          </div>
          <div class="card-row-desc">${unlocked ? lvl.subtitle : 'Найдите сахар на предыдущем уровне, чтобы открыть'}</div>
        </div>
      `;
      const btn = document.createElement('button');
      btn.className = `action-btn${unlocked && !isCurrent ? ' primary' : ''}`;
      btn.disabled = !unlocked;
      btn.textContent = !unlocked ? 'Закрыт' : isCurrent ? 'Заново' : 'Играть';
      btn.addEventListener('click', () => {
        this.engine.audio.ensureStarted();
        this.hasStartedOnce = true;
        this.engine.loadLevel(lvl.id, true);
        this.enterClassicGame();
      });
      row.appendChild(btn);
      this.modalBodyEl.appendChild(row);
    }
  }

  openSugarFoundModal(level: LevelDefinition) {
    const { skillTree } = this.engine;
    const choices = pickMutationChoices(skillTree.state.mutations, 3);

    if (choices.length > 0) {
      this.openModal('🧊 Сахар найден! Выберите Мутацию');
      this.modalBodyEl.innerHTML = '';

      const intro = document.createElement('div');
      intro.className = 'card-row-desc';
      intro.innerHTML = `Уровень <strong>«${level.name}»</strong> пройден! Выберите 1 постоянную мутацию:`;
      this.modalBodyEl.appendChild(intro);

      const grid = document.createElement('div');
      grid.className = 'mutation-grid';
      for (const mut of choices) {
        const card = document.createElement('button');
        card.className = 'mutation-choice';
        card.style.setProperty('--mut-color', mut.accent);
        card.innerHTML = `
          <div class="mutation-icon">${mut.icon}</div>
          <div class="card-row-info">
            <div class="card-row-title">${mut.name}</div>
            <div class="card-row-desc">${mut.description}</div>
          </div>
        `;
        card.addEventListener('click', () => {
          skillTree.addMutation(mut.id, level.id);
          this.engine.audio.playUpgrade();
          this.showToast(`Мутация получена: ${mut.name}!`);
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
    this.openModal('🧊 Уровень пройден!');
    this.modalBodyEl.innerHTML = '';
    const idx = LEVELS.findIndex((l) => l.id === level.id);
    const nextLevel = idx >= 0 && idx + 1 < LEVELS.length ? LEVELS[idx + 1] : null;

    const box = document.createElement('div');
    box.className = 'story-preview-box';
    box.innerHTML = `<p>Сахар на карте <strong>«${level.name}»</strong> найден!</p>`;
    this.modalBodyEl.appendChild(box);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'flex-end';

    const stayBtn = document.createElement('button');
    stayBtn.className = 'action-btn';
    stayBtn.textContent = 'Остаться и копать';
    stayBtn.addEventListener('click', () => this.closeModal());
    actions.appendChild(stayBtn);

    if (nextLevel) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'action-btn primary';
      nextBtn.textContent = `Далее: ${nextLevel.name} →`;
      nextBtn.addEventListener('click', () => {
        this.engine.loadLevel(nextLevel.id, true);
        this.closeModal();
      });
      actions.appendChild(nextBtn);
    }
    this.modalBodyEl.appendChild(actions);
  }

  openMutationsModal() {
    this.openModal('🧬 Мутации колонии');
    this.modalBodyEl.innerHTML = '';
    const owned = this.engine.skillTree.state.mutations;
    if (owned.length === 0) {
      this.modalBodyEl.innerHTML = `<div class="story-preview-box"><p><strong>Пока нет мутаций</strong></p><p style="margin-top:6px;color:var(--text-muted);font-size:12.5px;">Найдите сахар на уровне, чтобы выбрать постоянную мутацию!</p></div>`;
      return;
    }
    for (const id of owned) {
      const mut = getMutationDef(id);
      if (!mut) continue;
      const row = document.createElement('div');
      row.className = 'card-row';
      row.style.borderColor = mut.accent;
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="mutation-icon" style="--mut-color:${mut.accent}">${mut.icon}</div>
          <div class="card-row-info">
            <div class="card-row-title">${mut.name}</div>
            <div class="card-row-desc">${mut.description}</div>
          </div>
        </div>
      `;
      this.modalBodyEl.appendChild(row);
    }
  }

  openSettingsModal() {
    this.openModal('⚙ Настройки и саундтрек');
    this.renderSettingsContent();
  }

  private renderSettingsContent() {
    const { skillTree, audio } = this.engine;
    const s = skillTree.state.settings;
    this.modalBodyEl.innerHTML = '';

    const trackGroup = document.createElement('div');
    trackGroup.className = 'settings-group';
    trackGroup.innerHTML = `<div class="settings-label">Саундтрек</div>`;
    const grid = document.createElement('div');
    grid.className = 'track-grid';
    for (const track of SOUNDTRACKS) {
      const card = document.createElement('button');
      card.className = `track-card${s.soundtrack === track.id ? ' active' : ''}`;
      card.innerHTML = `<strong>${track.name}</strong><small>${track.subtitle}</small>`;
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

    const addToggle = (title: string, desc: string, val: boolean, onToggle: () => void) => {
      const row = document.createElement('div');
      row.className = 'card-row';
      row.innerHTML = `<div class="card-row-info"><div class="card-row-title">${title}</div><div class="card-row-desc">${desc}</div></div>`;
      const btn = document.createElement('button');
      btn.className = `action-btn${val ? ' primary' : ''}`;
      btn.textContent = val ? 'Вкл' : 'Выкл';
      btn.addEventListener('click', onToggle);
      row.appendChild(btn);
      this.modalBodyEl.appendChild(row);
    };

    addToggle('Автосмена саундтреков', 'Плавно переключать треки каждые ~1.5 минуты', s.autoSwitchTrack, () => {
      skillTree.updateSettings({ autoSwitchTrack: !s.autoSwitchTrack });
      audio.applySettings(skillTree.state.settings);
      this.renderSettingsContent();
    });

    const volRow = document.createElement('div');
    volRow.className = 'card-row';
    volRow.innerHTML = `<div class="card-row-info"><div class="card-row-title">Общая громкость</div><div class="card-row-desc">${Math.round(s.volume * 100)}%</div></div>`;
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(s.volume * 100));
    slider.className = 'range-slider';
    slider.addEventListener('input', () => {
      const val = Number(slider.value) / 100;
      skillTree.updateSettings({ volume: val });
      audio.ensureStarted();
      audio.applySettings(skillTree.state.settings);
      volRow.querySelector('.card-row-desc')!.textContent = `${Math.round(val * 100)}%`;
    });
    volRow.appendChild(slider);
    this.modalBodyEl.appendChild(volRow);

    addToggle('Фоновая музыка', 'Эмбиент, трип-хоп и IDM-синтез', s.musicEnabled, () => {
      skillTree.updateSettings({ musicEnabled: !s.musicEnabled });
      audio.ensureStarted();
      audio.applySettings(skillTree.state.settings);
      this.renderSettingsContent();
    });

    addToggle('Звуковые эффекты', 'Выпуск муравьёв, аномалии, окончание жизни', s.sfxEnabled, () => {
      skillTree.updateSettings({ sfxEnabled: !s.sfxEnabled });
      audio.ensureStarted();
      audio.applySettings(skillTree.state.settings);
      this.renderSettingsContent();
    });

    const resetRow = document.createElement('div');
    resetRow.className = 'card-row';
    resetRow.innerHTML = `<div class="card-row-info"><div class="card-row-title">Сброс прогресса</div><div class="card-row-desc">Очистить пройденные уровни и мутации</div></div>`;
    const resetBtn = document.createElement('button');
    resetBtn.className = 'action-btn danger';
    resetBtn.textContent = 'Сбросить';
    resetBtn.addEventListener('click', () => {
      skillTree.resetAllProgress();
      this.hasStartedOnce = false;
      this.engine.loadLevel(LEVELS[0].id, true);
      this.showToast('Прогресс сброшен');
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
