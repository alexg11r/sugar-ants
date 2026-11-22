import './style.css';
import { MeditativeAudio } from './core/audio';
import { GameEngine } from './game/engine';
import { MenuBackground } from './game/menuBg';
import { SkillTreeManager } from './game/skillTree';
import { MultiplayerEngine } from './multiplayer/mpEngine';
import { StoryEngine } from './story/storyEngine';
import { HudController } from './ui/hud';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const storyCanvas = document.getElementById('story-canvas') as HTMLCanvasElement;
const mpCanvas = document.getElementById('mp-canvas') as HTMLCanvasElement;
const menuBgCanvas = document.getElementById('menu-bg-canvas') as HTMLCanvasElement;

const skillTree = new SkillTreeManager();
const audio = new MeditativeAudio(skillTree.state.settings);
const menuBg = new MenuBackground(menuBgCanvas);

let hud: HudController;

const engine = new GameEngine(canvas, skillTree, audio, {
  onHudSync: () => hud?.sync(),
  onSugarFound: (level) => hud?.openSugarFoundModal(level),
  onToast: (msg) => hud?.showToast(msg),
  onFirstInteract: () => hud?.hideHint()
});

const story = new StoryEngine(storyCanvas, audio, {
  onHudSync: () => hud?.syncStoryHud(),
  onToast: (msg) => hud?.showToast(msg),
  onVictory: (level, hasNext) => hud?.openStoryVictoryModal(level, hasNext)
});

const mp = new MultiplayerEngine(mpCanvas, audio, {
  onHudSync: () => hud?.syncMpHud(),
  onToast: (msg) => hud?.showToast(msg),
  onSystemChat: (text) => hud?.pushSystemChat(text),
  onVersusEnd: (winnerNick, iWon) => hud?.openMpVersusEndModal(winnerNick, iWon),
  onVoteUpdate: () => hud?.syncMpVoteBanner(),
  onAllBlocksCleared: () => hud?.openMpAllClearedModal()
});

hud = new HudController(engine, story, mp, menuBg);
engine.start();
