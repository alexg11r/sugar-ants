import './style.css';
import { MeditativeAudio } from './core/audio';
import { GameEngine } from './game/engine';
import { MenuBackground } from './game/menuBg';
import { SkillTreeManager } from './game/skillTree';
import { MultiplayerEngine } from './multiplayer/mpEngine';
import { HudController } from './ui/hud';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const mpCanvas = document.getElementById('mp-canvas') as HTMLCanvasElement;
const menuBgCanvas = document.getElementById('menu-bg-canvas') as HTMLCanvasElement;

const skillTree = new SkillTreeManager();
const audio = new MeditativeAudio(skillTree.state.settings);
const menuBg = new MenuBackground(menuBgCanvas);

let hud: HudController;

const engine = new GameEngine(canvas, skillTree, audio, {
  onHudSync: () => hud?.sync(),
  onSugarCinematicStart: (level) => hud?.startSugarCinematic(level),
  onSugarFound: (level, isNewRecord) => hud?.openSugarFoundModal(level, isNewRecord),
  onArtifactFound: (artifact) => hud?.openArtifactFoundModal(artifact),
  onMapCleared: (level) => hud?.showClassicEpicClearBanner(level),
  onToast: (msg) => hud?.showToast(msg),
  onFirstInteract: () => hud?.notifyTutorialAction('launch'),
  onZoomInteract: () => hud?.notifyTutorialAction('zoom'),
  onPanInteract: () => hud?.notifyTutorialAction('pan')
});

const mp = new MultiplayerEngine(mpCanvas, audio, {
  onHudSync: () => hud?.syncMpHud(),
  onToast: (msg) => hud?.showToast(msg),
  onSystemChat: (text) => hud?.pushSystemChat(text),
  onVersusEnd: (winnerNick, iWon) => hud?.openMpVersusEndModal(winnerNick, iWon),
  onVoteUpdate: () => hud?.syncMpVoteBanner(),
  onAllBlocksCleared: () => hud?.showMpEpicClearBanner()
});

hud = new HudController(engine, mp, menuBg);
engine.start();
