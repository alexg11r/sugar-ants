import { ANT_TYPES, PLAYABLE_ANTS } from '../core/ants';
import { SOUNDTRACKS } from '../core/audio';
import { LEVELS } from '../core/levels';
import { LevelDefinition, SkillIcon, SkillNodeDef } from '../core/types';
import { GameEngine } from '../game/engine';
import { MenuBackground } from '../game/menuBg';
import { getMutationDef, pickMutationChoices } from '../game/mutations';
import { BRANCH_COLORS, SKILL_NODES } from '../game/skillTree';
import { MultiplayerEngine } from '../multiplayer/mpEngine';
import { MpMode, MpTransport } from '../multiplayer/mpTransport';
import { StoryEngine } from '../story/storyEngine';

const NODE_STEP = 74;
const ORIGIN_X = 268;
const ORIGIN_Y = 192;

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
  private mpP1ScoreEl = document.getElementById('mp-p1-score')!;
  private mpP2ScoreEl = document.getElementById('mp-p2-score')!;
  private mpLocalSpEl = document.getElementById('mp-local-sp')!;
  private mpAntBarEl = document.getElementById('mp-ant-bar')!;
  private mpDmgCostEl = document.getElementById('mp-dmg-cost')!;
  private mpBtnDmgEl = document.getElementById('mp-btn-dmg') as HTMLButtonElement;

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
  private selectedNodeId: string = 'worker_root';
  private lastBoughtNodeId: string | null = null;
  private hasStartedOnce = false;
  private lobbyMpMode: MpMode = 'versus';
  private lobbyLevelId: string = LEVELS[0].id;

  constructor(engine: GameEngine, story: StoryEngine, mp: MultiplayerEngine, menuBg: MenuBackground) {
    this.engine = engine;
    this.story = story;
    this.mp = mp;
    this.menuBg = menuBg;

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
      this.enterStoryMode();
    });

    document.getElementById('menu-play-mp')!.addEventListener('click', () => {
      this.engine.audio.ensureStarted();
      this.openMultiplayerLobbyModal();
    });

    document.getElementById('menu-btn-levels')!.addEventListener('click', () => {
      this.openLevelsModal();
    });

    document.getElementById('menu-btn-mutations')!.addEventListener('click', () => {
      this.openMutationsModal();
    });

    document.getElementById('menu-btn-settings')!.addEventListener('click', () => {
      this.openSettingsModal();
    });

    // Classic HUD buttons
    document.getElementById('btn-menu')!.addEventListener('click', () => this.showMainMenu());
    document.getElementById('btn-settings-hud')!.addEventListener('click', () => this.openSettingsModal());
    document.getElementById('btn-reset-cam')!.addEventListener('click', () => this.engine.resetCamera());
    document.getElementById('btn-upgrades')!.addEventListener('click', () => this.openSkillTree());
    document.getElementById('btn-mutations')!.addEventListener('click', () => this.openMutationsModal());
    document.getElementById('btn-levels')!.addEventListener('click', () => this.openLevelsModal());

    // Story HUD buttons
    document.getElementById('story-btn-menu')!.addEventListener('click', () => this.showMainMenu());
    document.getElementById('story-btn-settings')!.addEventListener('click', () => this.openSettingsModal());
    document.getElementById('story-btn-reset-cam')!.addEventListener('click', () => this.story.resetCamera());

    // Multiplayer HUD buttons
    document.getElementById('mp-btn-menu')!.addEventListener('click', () => {
      this.mpTransport?.close();
      this.mpTransport = null;
      this.showMainMenu();
    });
    document.getElementById('mp-btn-settings')!.addEventListener('click', () => this.openSettingsModal());
    document.getElementById('mp-btn-reset-cam')!.addEventListener('click', () => this.mp.resetCamera());
    this.mpBtnDmgEl.addEventListener('click', () => this.mp.buyInMatchUpgrade('dmg'));

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
    this.mpCanvasEl.classList.add('hidden');

    this.gameCanvasEl.classList.remove('hidden');
    this.hudTopEl.classList.remove('hidden');
    this.hudBottomEl.classList.remove('hidden');
    this.hintBannerEl.classList.remove('hidden');
    this.engine.paused = false;
    this.sync();
  }

  enterStoryMode() {
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
    this.mpCanvasEl.classList.add('hidden');

    this.storyCanvasEl.classList.remove('hidden');
    this.storyHudTopEl.classList.remove('hidden');
    this.storyHudBottomEl.classList.remove('hidden');

    this.story.startNewGame();
    this.syncStoryHud();
  }

  enterMultiplayerMatch(opts: {
    seed: number;
    levelId: string;
    mpMode: MpMode;
    vsBot: boolean;
    localPlayer: 1 | 2;
    transport: MpTransport | null;
  }) {
    this.mode = 'mp';
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

    this.mp.startMatch(opts);
    this.syncMpHud();
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
     MULTIPLAYER LOBBY & HUD
     ========================================================= */
  openMultiplayerLobbyModal() {
    this.openModal('⚔ Мультиплеер — Битва за Сахар');
    this.renderMpLobbyContent();
  }

  private renderMpLobbyContent(statusText = '', roomCode = '') {
    this.modalBodyEl.innerHTML = '';

    // 1. Sub-mode selector (Versus 1v1 vs Co-op)
    const modeGroup = document.createElement('div');
    modeGroup.className = 'settings-group';
    modeGroup.innerHTML = `<div class="settings-label">Режим матча</div>`;
    const modeGrid = document.createElement('div');
    modeGrid.className = 'track-grid';

    const vCard = document.createElement('button');
    vCard.className = `track-card${this.lobbyMpMode === 'versus' ? ' active' : ''}`;
    vCard.innerHTML = `<strong>⚔ Гонка 1 на 1</strong><small>Кто первый докопается до сахара</small>`;
    vCard.addEventListener('click', () => {
      this.lobbyMpMode = 'versus';
      this.renderMpLobbyContent(statusText, roomCode);
    });

    const cCard = document.createElement('button');
    cCard.className = `track-card${this.lobbyMpMode === 'coop' ? ' active' : ''}`;
    cCard.innerHTML = `<strong>🤝 Кооператив</strong><small>Вместе открывайте картину и сахар</small>`;
    cCard.addEventListener('click', () => {
      this.lobbyMpMode = 'coop';
      this.renderMpLobbyContent(statusText, roomCode);
    });

    modeGrid.appendChild(vCard);
    modeGrid.appendChild(cCard);
    modeGroup.appendChild(modeGrid);
    this.modalBodyEl.appendChild(modeGroup);

    // 2. Map selector
    const mapRow = document.createElement('div');
    mapRow.className = 'card-row';
    mapRow.innerHTML = `<div class="card-row-info"><div class="card-row-title">Карта матча</div></div>`;
    const mapSel = document.createElement('select');
    mapSel.className = 'mp-input';
    mapSel.style.maxWidth = '220px';
    mapSel.style.textTransform = 'none';
    mapSel.style.letterSpacing = '0';
    for (const lvl of LEVELS) {
      const opt = document.createElement('option');
      opt.value = lvl.id;
      opt.textContent = lvl.name;
      if (lvl.id === this.lobbyLevelId) opt.selected = true;
      mapSel.appendChild(opt);
    }
    mapSel.addEventListener('change', () => {
      this.lobbyLevelId = mapSel.value;
    });
    mapRow.appendChild(mapSel);
    this.modalBodyEl.appendChild(mapRow);

    // 3. Instant Solo vs AI Rival Colony
    const botRow = document.createElement('div');
    botRow.className = 'card-row';
    botRow.innerHTML = `
      <div class="card-row-info">
        <div class="card-row-title">🤖 Против ИИ-колонии</div>
        <div class="card-row-desc">Мгновенный старт 1v1 против соперника-бота</div>
      </div>
    `;
    const botBtn = document.createElement('button');
    botBtn.className = 'action-btn primary';
    botBtn.textContent = 'Играть';
    botBtn.addEventListener('click', () => {
      this.mpTransport?.close();
      this.mpTransport = null;
      this.enterMultiplayerMatch({
        seed: Math.floor(Math.random() * 1_000_000),
        levelId: this.lobbyLevelId,
        mpMode: this.lobbyMpMode,
        vsBot: true,
        localPlayer: 1,
        transport: null
      });
    });
    botRow.appendChild(botBtn);
    this.modalBodyEl.appendChild(botRow);

    // 4. Host Online / 2-Tab Room (PeerJS WebRTC + Local BroadcastChannel)
    const hostRow = document.createElement('div');
    hostRow.className = 'card-row';
    hostRow.innerHTML = `
      <div class="card-row-info">
        <div class="card-row-title">🌐 Создать комнату (P2P / 2 вкладки)</div>
        <div class="card-row-desc">Отправьте код другу или откройте вторую вкладку браузера</div>
      </div>
    `;
    const hostBtn = document.createElement('button');
    hostBtn.className = 'action-btn';
    hostBtn.textContent = 'Создать';
    hostBtn.addEventListener('click', () => {
      this.mpTransport?.close();
      const transport = new MpTransport({
        onStatus: (st) => this.renderMpLobbyContent(st, transport.roomCode),
        onMessage: (msg) => this.mp.handleRemoteMessage(msg),
        onPeerConnected: () => {
          const seed = Math.floor(Math.random() * 1_000_000);
          transport.send({
            type: 'start',
            seed,
            levelId: this.lobbyLevelId,
            mpMode: this.lobbyMpMode
          });
          this.enterMultiplayerMatch({
            seed,
            levelId: this.lobbyLevelId,
            mpMode: this.lobbyMpMode,
            vsBot: false,
            localPlayer: 1,
            transport
          });
        },
        onPeerDisconnected: () => this.showToast('Соперник отключился')
      });
      this.mpTransport = transport;
      const code = transport.createRoom();
      this.renderMpLobbyContent(`Ожидание игрока…`, code);
    });
    hostRow.appendChild(hostBtn);
    this.modalBodyEl.appendChild(hostRow);

    if (roomCode) {
      const codeBox = document.createElement('div');
      codeBox.className = 'mp-code-pill';
      codeBox.textContent = roomCode;
      codeBox.title = 'Нажмите, чтобы скопировать код комнаты';
      codeBox.addEventListener('click', () => {
        navigator.clipboard?.writeText(roomCode).catch(() => {});
        this.showToast(`Код ${roomCode} скопирован!`);
      });
      this.modalBodyEl.appendChild(codeBox);
    }

    if (statusText) {
      const stEl = document.createElement('div');
      stEl.className = 'card-row-desc';
      stEl.style.textAlign = 'center';
      stEl.style.color = 'var(--accent-cyan)';
      stEl.textContent = statusText;
      this.modalBodyEl.appendChild(stEl);
    }

    // 5. Join Room by Code
    const joinRow = document.createElement('div');
    joinRow.className = 'card-row';
    const input = document.createElement('input');
    input.className = 'mp-input';
    input.placeholder = 'Код комнаты (ANT-XXXX)';
    const joinBtn = document.createElement('button');
    joinBtn.className = 'action-btn primary';
    joinBtn.textContent = 'Войти';
    joinBtn.addEventListener('click', () => {
      const code = input.value.trim();
      if (!code) return;
      this.mpTransport?.close();
      const transport = new MpTransport({
        onStatus: (st) => this.renderMpLobbyContent(st, ''),
        onMessage: (msg) => {
          if (msg.type === 'start') {
            this.enterMultiplayerMatch({
              seed: msg.seed,
              levelId: msg.levelId,
              mpMode: msg.mpMode,
              vsBot: false,
              localPlayer: 2,
              transport
            });
          } else {
            this.mp.handleRemoteMessage(msg);
          }
        },
        onPeerConnected: () => {},
        onPeerDisconnected: () => this.showToast('Хост отключился')
      });
      this.mpTransport = transport;
      transport.joinRoom(code);
    });
    joinRow.appendChild(input);
    joinRow.appendChild(joinBtn);
    this.modalBodyEl.appendChild(joinRow);
  }

  syncMpHud() {
    if (this.mode !== 'mp') return;
    const st = this.mp.state;
    const localSp = st.localPlayer === 1 ? st.p1Sp : st.p2Sp;

    this.mpModeLabelEl.textContent =
      st.mpMode === 'coop' ? '🤝 Кооп-раскопки' : st.vsBot ? '⚔ Гонка vs ИИ' : '⚔ Гонка 1v1';
    this.mpP1ScoreEl.textContent = String(st.p1Dug);
    this.mpP2ScoreEl.textContent = String(st.p2Dug);
    this.mpLocalSpEl.textContent = String(localSp);

    const dmgCost = 2 + st.dmgLevel * 2;
    this.mpDmgCostEl.textContent = `♦ ${dmgCost}`;
    this.mpBtnDmgEl.disabled = localSp < dmgCost;

    this.mpAntBarEl.innerHTML = '';
    for (const id of PLAYABLE_ANTS) {
      const cfg = ANT_TYPES[id];
      const unlocked =
        id === 'worker' ||
        id === 'compass' ||
        (id === 'warrior' && st.unlockedWarriors) ||
        (id === 'scout' && st.unlockedScouts) ||
        (id === 'queen' && st.unlockedQueens);

      let sub = unlocked ? 'Готов' : id === 'queen' ? '🔒 ♦ 4' : '🔒 ♦ 2';
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
        <span class="ant-name">${cfg.shortName}</span>
        <span class="ant-count">${sub}</span>
      `;
      btn.addEventListener('click', () => this.mp.selectAnt(id));
      this.mpAntBarEl.appendChild(btn);
    }
  }

  openMpMatchEndModal(winner: 1 | 2, isCoop: boolean) {
    const st = this.mp.state;
    const iWon = winner === st.localPlayer;
    this.openModal(isCoop ? '🤝 Сахар найден вместе!' : iWon ? '🏆 Победа вашей колонии!' : '⚔ Соперник оказался быстрее!');
    this.modalBodyEl.innerHTML = `
      <div class="story-preview-box">
        <p><strong>${
          isCoop
            ? 'Обе колонии объединились и нашли заветный сахар!'
            : iWon
              ? 'Ваши муравьи первыми добрались до кусочка сахара!'
              : 'Колония соперника первой нашла сахар. Попробуете реванш?'
        }</strong></p>
        <p style="margin-top:10px;font-size:13px;color:var(--text-muted);">
          🟢 Изумрудная колония: <strong>${st.p1Dug}</strong> блоков • 🔴 Алая колония: <strong>${st.p2Dug}</strong> блоков
        </p>
      </div>
    `;

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'flex-end';

    const rematchBtn = document.createElement('button');
    rematchBtn.className = 'action-btn primary';
    rematchBtn.textContent = 'Реванш';
    rematchBtn.addEventListener('click', () => {
      const seed = Math.floor(Math.random() * 1_000_000);
      if (this.mpTransport) {
        this.mpTransport.send({
          type: 'rematch',
          seed,
          levelId: st.level.id,
          mpMode: st.mpMode
        });
      }
      this.enterMultiplayerMatch({
        seed,
        levelId: st.level.id,
        mpMode: st.mpMode,
        vsBot: st.vsBot,
        localPlayer: st.localPlayer,
        transport: this.mpTransport
      });
    });

    const menuBtn = document.createElement('button');
    menuBtn.className = 'action-btn';
    menuBtn.textContent = 'В меню';
    menuBtn.addEventListener('click', () => {
      this.mpTransport?.close();
      this.mpTransport = null;
      this.closeModal();
      this.showMainMenu();
    });

    actions.appendChild(menuBtn);
    actions.appendChild(rematchBtn);
    this.modalBodyEl.appendChild(actions);
  }

  /* =========================================================
     STORY MODE HUD SYNC
     ========================================================= */
  syncStoryHud() {
    if (this.mode !== 'story') return;
    const st = this.story.state;

    this.storyNectarEl.textContent = String(Math.floor(st.nectar));
    this.storyLarvaeEl.textContent = String(Math.floor(st.larvae));
    this.storyMineralsEl.textContent = String(Math.floor(st.minerals));
    this.storySatietyEl.textContent = `${Math.round(st.satiety)}%`;

    // Diggers selector
    this.storyDiggersEl.innerHTML = '';
    const diggerList: { id: 'worker' | 'warrior' | 'scout'; unlocked: boolean; cost: string }[] = [
      { id: 'worker', unlocked: true, cost: '1🥚 2🍯' },
      { id: 'warrior', unlocked: st.warriorUnlocked, cost: st.warriorUnlocked ? '3🥚 4🍯' : '🔒16🍯 6🥚' },
      { id: 'scout', unlocked: st.scoutUnlocked, cost: st.scoutUnlocked ? '2🥚 2🍯' : '🔒12🍯 4🥚' }
    ];

    for (const d of diggerList) {
      const cfg = ANT_TYPES[d.id];
      const btn = document.createElement('button');
      btn.className = `ant-btn${st.selectedDigger === d.id && d.unlocked ? ' active' : ''}${d.unlocked ? '' : ' locked'}`;
      btn.style.setProperty('--ant-color', cfg.color);
      btn.innerHTML = `
        <span class="ant-icon-svg" style="color:${cfg.color}">${renderSkillSvg('ant')}</span>
        <span class="ant-name">${d.unlocked ? cfg.shortName : '🔒 ' + cfg.shortName}</span>
        <span class="ant-count">${d.cost}</span>
      `;
      btn.addEventListener('click', () => {
        if (d.unlocked) {
          this.story.selectDigger(d.id);
        } else if (d.id === 'warrior') {
          if (!this.story.unlockWarrior()) {
            this.showToast('Нужно 16 🍯 и 6 🥚, чтобы открыть Воина');
          }
        } else if (d.id === 'scout') {
          if (!this.story.unlockScout()) {
            this.showToast('Нужно 12 🍯 и 4 🥚, чтобы открыть Разведчика');
          }
        }
      });
      this.storyDiggersEl.appendChild(btn);
    }

    // Colony economy actions
    this.storyEconomyEl.innerHTML = '';
    const aphidMin = 6 + st.aphidHerders * 5;
    const aphidLarv = 2 + st.aphidHerders;
    const nurseNec = 10 + st.nurses * 8;
    const nurseMin = 4 + st.nurses * 4;
    const jawNec = 12 + st.jawLevel * 12;
    const jawMin = 10 + st.jawLevel * 10;

    const ecoActions = [
      {
        title: `🌿 Тли ×${st.aphidHerders}`,
        sub: `${aphidMin}🪨 ${aphidLarv}🥚`,
        canAfford: st.minerals >= aphidMin && st.larvae >= aphidLarv,
        onClick: () => this.story.hireAphidHerder()
      },
      {
        title: `🥚 Няньки ×${st.nurses}`,
        sub: `${nurseNec}🍯 ${nurseMin}🪨`,
        canAfford: st.nectar >= nurseNec && st.minerals >= nurseMin,
        onClick: () => this.story.hireNurse()
      },
      {
        title: `⚡ Жвалы +${st.jawLevel}`,
        sub: `${jawNec}🍯 ${jawMin}🪨`,
        canAfford: st.nectar >= jawNec && st.minerals >= jawMin,
        onClick: () => this.story.upgradeJaws()
      }
    ];

    for (const eco of ecoActions) {
      const btn = document.createElement('button');
      btn.className = 'eco-btn';
      btn.disabled = !eco.canAfford;
      btn.innerHTML = `<strong>${eco.title}</strong><small>${eco.sub}</small>`;
      btn.addEventListener('click', eco.onClick);
      this.storyEconomyEl.appendChild(btn);
    }
  }

  openStoryVictoryModal() {
    this.openModal('🎉 Колония спасена!');
    this.modalBodyEl.innerHTML = `
      <div class="story-preview-box">
        <p><strong>Муравьи вырвались из забытой фермы и добрались до кусочка сахара!</strong></p>
        <p style="margin-top:8px;color:var(--text-muted);font-size:13px;">
          Благодаря пастухам тлей и нянькам личинок колония пережила голод, прогрызла пробку и нашла сладкое спасение на подоконнике.
        </p>
      </div>
    `;
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'flex-end';

    const stayBtn = document.createElement('button');
    stayBtn.className = 'action-btn';
    stayBtn.textContent = 'Продолжить играть';
    stayBtn.addEventListener('click', () => this.closeModal());

    const menuBtn = document.createElement('button');
    menuBtn.className = 'action-btn primary';
    menuBtn.textContent = 'В главное меню';
    menuBtn.addEventListener('click', () => {
      this.closeModal();
      this.showMainMenu();
    });

    actions.appendChild(stayBtn);
    actions.appendChild(menuBtn);
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

    if (skillTree.hasAffordableNode()) {
      this.upgradeBadgeEl.classList.remove('hidden');
    } else {
      this.upgradeBadgeEl.classList.add('hidden');
    }

    this.renderAntBar();
    this.syncMenuSummary();

    if (this.skillTreeOpen) {
      this.renderSkillTree();
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
          const m = Math.floor(sec / 60);
          const s = String(sec % 60).padStart(2, '0');
          subText = `${m}:${s}`;
        } else {
          subText = 'Готов';
        }
      }

      const btn = document.createElement('button');
      btn.className = `ant-btn${selectedAnt === id ? ' active' : ''}${!unlocked || onCooldown ? ' locked' : ''}`;
      btn.style.setProperty('--ant-color', cfg.color);
      btn.title = unlocked ? `${cfg.name}: ${cfg.description}` : 'Откройте в Дереве навыков';

      const iconType: SkillIcon = id === 'queen' ? 'queen' : id === 'compass' ? 'compass' : 'ant';

      btn.innerHTML = `
        <span class="ant-key">${cfg.hotkey}</span>
        <span class="ant-icon-svg" style="color:${cfg.color}">${renderSkillSvg(iconType)}</span>
        <span class="ant-name">${unlocked ? cfg.shortName : '🔒 ' + cfg.shortName}</span>
        <span class="ant-count">${subText}</span>
      `;

      btn.addEventListener('click', () => {
        if (unlocked) {
          this.engine.selectAnt(id);
        } else {
          this.openSkillTree();
        }
      });

      this.antBarEl.appendChild(btn);
    }
  }

  /* =========================================================
     NON-OVERLAPPING VISUAL SKILL TREE WITH ANIMATIONS
     ========================================================= */
  openSkillTree() {
    this.closeModal();
    this.skillTreeOpen = true;
    this.engine.paused = true;
    this.lastBoughtNodeId = null;
    this.stOverlayEl.classList.remove('hidden');
    this.renderSkillTree();
  }

  closeSkillTree() {
    this.skillTreeOpen = false;
    if (this.mode === 'classic') {
      this.engine.paused = false;
    }
    this.stOverlayEl.classList.add('hidden');
    this.sync();
  }

  private tryBuySkillNode(nodeId: string) {
    const { skillTree } = this.engine;
    const node = SKILL_NODES.find((n) => n.id === nodeId);
    if (!node) return;
    if (skillTree.buyNode(nodeId)) {
      this.lastBoughtNodeId = nodeId;
      this.engine.audio.playUpgrade();
      if (nodeId === 'warrior_unlock') {
        this.engine.selectAnt('warrior');
        this.showToast('Открыт Муравей-воин!');
      } else if (nodeId === 'scout_unlock') {
        this.engine.selectAnt('scout');
        this.showToast('Открыт Муравей-разведчик!');
      } else if (nodeId === 'queen_unlock') {
        this.engine.selectAnt('queen');
        this.showToast('Открыта Матка колонии!');
      }
      this.sync();
    }
  }

  private renderSkillTree() {
    const { skillTree } = this.engine;
    this.stPointsNumEl.textContent = String(skillTree.state.skillPoints);
    this.stNodesEl.innerHTML = '';
    this.stLinksEl.innerHTML = '';

    const visibleNodes = SKILL_NODES.filter((n) => skillTree.isNodeVisible(n));
    const visibleSet = new Set(visibleNodes.map((n) => n.id));

    if (!visibleSet.has(this.selectedNodeId)) {
      this.selectedNodeId = 'worker_root';
    }

    // Animated SVG connector lines
    for (const node of visibleNodes) {
      const x1 = ORIGIN_X + node.gx * NODE_STEP;
      const y1 = ORIGIN_Y + node.gy * NODE_STEP;

      for (const reqId of node.requires) {
        if (!visibleSet.has(reqId)) continue;
        const parent = SKILL_NODES.find((p) => p.id === reqId);
        if (!parent) continue;
        const x2 = ORIGIN_X + parent.gx * NODE_STEP;
        const y2 = ORIGIN_Y + parent.gy * NODE_STEP;

        const bothOwned = skillTree.getRank(node.id) > 0 && skillTree.getRank(parent.id) > 0;
        const branchColor = BRANCH_COLORS[node.branch].main;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(x2));
        line.setAttribute('y1', String(y2));
        line.setAttribute('x2', String(x1));
        line.setAttribute('y2', String(y1));
        line.setAttribute('stroke', bothOwned ? branchColor : 'rgba(150, 185, 168, 0.25)');
        line.setAttribute('stroke-width', bothOwned ? '3' : '2');
        if (bothOwned) {
          line.classList.add('st-link-flow');
        } else {
          line.setAttribute('stroke-dasharray', '4 4');
        }
        this.stLinksEl.appendChild(line);
      }
    }

    // Spatial nodes with staggered entrance & purchase shockwave
    visibleNodes.forEach((node, idx) => {
      const rank = skillTree.getRank(node.id);
      const isMaxed = rank >= node.maxRank;
      const canBuy = skillTree.canBuyNode(node);
      const isOwned = rank > 0;
      const colors = BRANCH_COLORS[node.branch];

      const el = document.createElement('button');
      let stateClass = 'state-locked';
      if (isMaxed) stateClass = 'state-maxed';
      else if (canBuy) stateClass = 'state-available';
      else if (isOwned) stateClass = 'state-owned';

      const boughtClass = this.lastBoughtNodeId === node.id ? ' just-bought' : '';

      el.className = `st-node shape-${node.shape} ${stateClass}${this.selectedNodeId === node.id ? ' selected' : ''}${boughtClass}`;
      el.style.left = `${ORIGIN_X + node.gx * NODE_STEP}px`;
      el.style.top = `${ORIGIN_Y + node.gy * NODE_STEP}px`;
      el.style.setProperty('--node-color', colors.main);
      el.style.setProperty('--node-glow', colors.glow);
      el.style.setProperty('--node-bg', colors.bg);
      el.style.setProperty('--enter-delay', `${Math.min(260, idx * 24)}ms`);
      el.dataset.nodeId = node.id;

      el.innerHTML = `
        ${renderSkillSvg(node.icon)}
        ${node.maxRank > 1 ? `<span class="st-node-rank">${rank}/${node.maxRank}</span>` : ''}
      `;

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
        if (!isTouch && skillTree.canBuyNode(node)) {
          this.selectedNodeId = node.id;
          this.tryBuySkillNode(node.id);
        } else if (this.selectedNodeId === node.id && skillTree.canBuyNode(node)) {
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

    const selNode = SKILL_NODES.find((n) => n.id === this.selectedNodeId) || visibleNodes[0];
    if (selNode) {
      this.updateInspector(selNode);
    }
  }

  private updateInspector(node: SkillNodeDef) {
    const { skillTree } = this.engine;
    const rank = skillTree.getRank(node.id);
    const isMaxed = rank >= node.maxRank;
    const cost = skillTree.getNodeCost(node);
    const canBuy = skillTree.canBuyNode(node);
    const colors = BRANCH_COLORS[node.branch];

    this.stTooltipEl.style.setProperty('--tt-color', colors.main);
    this.stTtCatEl.textContent = node.category;
    this.stTtTitleEl.textContent =
      node.maxRank > 1 ? `${node.title} (${rank}/${node.maxRank})` : node.title;
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
    this.modalBackdropEl.classList.add('hidden');
  }

  openLevelsModal() {
    this.openModal('🗺 Карты — Классический режим');
    this.modalBodyEl.innerHTML = '';

    const note = document.createElement('div');
    note.className = 'card-row-desc';
    note.style.marginBottom = '4px';
    note.textContent =
      'Каждый уровень открывается после нахождения сахара на предыдущем. За прохождение КАЖДОГО уровня даётся новая постоянная Мутация, а древо навыков начинается заново.';
    this.modalBodyEl.appendChild(note);

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

  /** Always grants a Mutation choice on completing ANY level! */
  openSugarFoundModal(level: LevelDefinition) {
    const { skillTree } = this.engine;
    const choices = pickMutationChoices(skillTree.state.mutations, 3);

    if (choices.length > 0) {
      this.openModal('🧊 Сахар найден! Выберите Мутацию');
      this.modalBodyEl.innerHTML = '';

      const intro = document.createElement('div');
      intro.className = 'card-row-desc';
      intro.innerHTML = `Уровень <strong>«${level.name}»</strong> пройден! Выберите 1 постоянную мутацию — она усиливает колонию на всех следующих уровнях:`;
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
    const hasNext = idx >= 0 && idx + 1 < LEVELS.length;
    const nextLevel = hasNext ? LEVELS[idx + 1] : null;

    const box = document.createElement('div');
    box.className = 'story-preview-box';
    box.innerHTML = `
      <p>Сахар на карте <strong>«${level.name}»</strong> найден!</p>
      <p style="margin-top:8px;color:var(--text-muted);font-size:12.5px;">
        Вы можете остаться здесь и медитативно открыть всю скрытую картину и пасхалки${nextLevel ? `, или перейти на следующий уровень «${nextLevel.name}» (древо навыков сбросится, мутации сохранятся)` : ''}.
      </p>
    `;
    this.modalBodyEl.appendChild(box);

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'flex-end';
    actions.style.marginTop = '6px';

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
      const empty = document.createElement('div');
      empty.className = 'story-preview-box';
      empty.innerHTML = `
        <p><strong>Пока нет активных мутаций</strong></p>
        <p style="margin-top:6px;color:var(--text-muted);font-size:12.5px;">
          Найдите спрятанный кусочек сахара на уровне, чтобы выбрать постоянную мутацию для всех будущих уровней!
        </p>
      `;
      this.modalBodyEl.appendChild(empty);
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

    // 1. Soundtrack selector (8 tracks including 3 Trip-Hop & Aphex Twin IDM!)
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

    // 2. Auto-switch toggle
    const autoRow = document.createElement('div');
    autoRow.className = 'card-row';
    autoRow.innerHTML = `
      <div class="card-row-info">
        <div class="card-row-title">Автосмена саундтреков</div>
        <div class="card-row-desc">Плавно переключать треки каждые ~1.5 минуты</div>
      </div>
    `;
    const autoBtn = document.createElement('button');
    autoBtn.className = `action-btn${s.autoSwitchTrack ? ' primary' : ''}`;
    autoBtn.textContent = s.autoSwitchTrack ? 'Вкл' : 'Выкл';
    autoBtn.addEventListener('click', () => {
      skillTree.updateSettings({ autoSwitchTrack: !s.autoSwitchTrack });
      audio.applySettings(skillTree.state.settings);
      this.renderSettingsContent();
    });
    autoRow.appendChild(autoBtn);
    this.modalBodyEl.appendChild(autoRow);

    // 3. Volume & Music/SFX Toggles
    const volRow = document.createElement('div');
    volRow.className = 'card-row';
    volRow.innerHTML = `
      <div class="card-row-info">
        <div class="card-row-title">Общая громкость</div>
        <div class="card-row-desc">${Math.round(s.volume * 100)}%</div>
      </div>
    `;
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

    const musicRow = document.createElement('div');
    musicRow.className = 'card-row';
    musicRow.innerHTML = `
      <div class="card-row-info">
        <div class="card-row-title">Фоновая музыка</div>
        <div class="card-row-desc">Эмбиент, трип-хоп и IDM-синтез</div>
      </div>
    `;
    const musicBtn = document.createElement('button');
    musicBtn.className = `action-btn${s.musicEnabled ? ' primary' : ''}`;
    musicBtn.textContent = s.musicEnabled ? 'Вкл' : 'Выкл';
    musicBtn.addEventListener('click', () => {
      skillTree.updateSettings({ musicEnabled: !s.musicEnabled });
      audio.ensureStarted();
      audio.applySettings(skillTree.state.settings);
      this.renderSettingsContent();
    });
    musicRow.appendChild(musicBtn);
    this.modalBodyEl.appendChild(musicRow);

    const sfxRow = document.createElement('div');
    sfxRow.className = 'card-row';
    sfxRow.innerHTML = `
      <div class="card-row-info">
        <div class="card-row-title">Звуковые эффекты</div>
        <div class="card-row-desc">Выпуск муравьёв, аномалии, окончание жизни, находки</div>
      </div>
    `;
    const sfxBtn = document.createElement('button');
    sfxBtn.className = `action-btn${s.sfxEnabled ? ' primary' : ''}`;
    sfxBtn.textContent = s.sfxEnabled ? 'Вкл' : 'Выкл';
    sfxBtn.addEventListener('click', () => {
      skillTree.updateSettings({ sfxEnabled: !s.sfxEnabled });
      audio.ensureStarted();
      audio.applySettings(skillTree.state.settings);
      this.renderSettingsContent();
    });
    sfxRow.appendChild(sfxBtn);
    this.modalBodyEl.appendChild(sfxRow);

    // 4. Reset Progress
    const resetRow = document.createElement('div');
    resetRow.className = 'card-row';
    resetRow.innerHTML = `
      <div class="card-row-info">
        <div class="card-row-title">Сброс прогресса</div>
        <div class="card-row-desc">Очистить пройденные уровни и мутации</div>
      </div>
    `;
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
