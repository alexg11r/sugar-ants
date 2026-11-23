import { ANT_TYPES, QUEEN_AURA_RADIUS } from './ants';
import { isMobileDevice } from './device';
import { Ant, AntSkinId, AntTypeId, CellType, PheromoneBeacon, ScentPoint } from './types';
import { World } from './world';
import { ParticleSystem } from './particles';

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface AimPreview {
  fromX: number;
  fromY: number;
  angle: number;
  color: string;
}

/** Default background hex used for menu & initial CSS theme */
export const UNEXPLORED_BG_HEX = '#0b1d13';

/** Shared detailed articulated ant renderer (supports 3 skins + optional player color tint!) */
export function drawDetailedAnt(
  ctx: CanvasRenderingContext2D,
  type: AntTypeId,
  sx: number,
  sy: number,
  angle: number,
  legPhase: number,
  biteFlash: number,
  zoom: number,
  skin: AntSkinId = 'classic',
  colorOverride?: [number, number, number],
  evolved = false
) {
  const cfg = ANT_TYPES[type];
  // Scale smoothly up to 28x close-up zoom while staying crisp and proportional to individual pixel blocks!
  const zoomScale = zoom <= 8 ? zoom * 0.62 : 4.96 + (zoom - 8) * 0.24;
  const s = Math.max(1.8, zoomScale) * cfg.scale * (evolved ? 1.12 : 1);
  const [r, g, b] = colorOverride || (evolved ? [115, 255, 165] : cfg.rgb);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);

  // Soft colored underglow (golden-emerald halo for Evolved Titan Workers!)
  ctx.fillStyle = evolved ? 'rgba(255, 228, 110, 0.28)' : `rgba(${r}, ${g}, ${b}, 0.2)`;
  ctx.beginPath();
  ctx.arc(0, 0, s * (evolved ? 3.8 : 3.2), 0, Math.PI * 2);
  ctx.fill();

  // 1. Six 2-jointed (bent) articulated legs with realistic tripod gait!
  ctx.strokeStyle = `rgba(${Math.round(r * 0.85)}, ${Math.round(g * 0.85)}, ${Math.round(b * 0.85)}, 0.9)`;
  ctx.lineWidth = Math.max(1.0, s * 0.28);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const legAnchors = [-0.55 * s, 0.1 * s, 0.72 * s];
  const femurAngles = [2.32, 1.58, 0.88];
  const tibiaBends = [0.48, 0.22, -0.35];
  const femurLen = (type === 'scout' ? 1.35 : 1.08) * s;
  const tibiaLen = (type === 'scout' ? 1.4 : 1.05) * s;

  for (let i = 0; i < 3; i++) {
    // Tripod gait: left-front + right-mid + left-back move together
    const tripod = i === 1 ? Math.PI : 0;
    const swingL = Math.sin(legPhase + tripod) * 0.26;
    const swingR = Math.sin(legPhase + tripod + Math.PI) * 0.26;
    const ax = legAnchors[i];

    // Left leg
    const faL = -femurAngles[i] + swingL;
    const kxL = ax + Math.cos(faL) * femurLen;
    const kyL = -0.32 * s + Math.sin(faL) * femurLen;
    const taL = faL - tibiaBends[i];
    const fxL = kxL + Math.cos(taL) * tibiaLen;
    const fyL = kyL + Math.sin(taL) * tibiaLen;
    ctx.beginPath();
    ctx.moveTo(ax, -0.32 * s);
    ctx.lineTo(kxL, kyL);
    ctx.lineTo(fxL, fyL);
    ctx.stroke();

    // Right leg
    const faR = femurAngles[i] - swingR;
    const kxR = ax + Math.cos(faR) * femurLen;
    const kyR = 0.32 * s + Math.sin(faR) * femurLen;
    const taR = faR + tibiaBends[i];
    const fxR = kxR + Math.cos(taR) * tibiaLen;
    const fyR = kyR + Math.sin(taR) * tibiaLen;
    ctx.beginPath();
    ctx.moveTo(ax, 0.32 * s);
    ctx.lineTo(kxR, kyR);
    ctx.lineTo(fxR, fyR);
    ctx.stroke();
  }

  // 2. Segmented Gaster (abdomen) with chitin highlight
  const abdRx = (type === 'queen' ? 2.05 : type === 'scout' ? 1.2 : 1.48) * s;
  const abdRy = (type === 'queen' ? 1.38 : type === 'scout' ? 0.68 : 0.96) * s;
  const abdX = (type === 'queen' ? -2.05 : -1.75) * s;

  ctx.fillStyle = `rgb(${Math.round(r * 0.58)}, ${Math.round(g * 0.58)}, ${Math.round(b * 0.58)})`;
  ctx.beginPath();
  ctx.ellipse(abdX, 0, abdRx, abdRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // Subtle chitin segments on abdomen (enhanced by skin!)
  ctx.strokeStyle =
    skin === 'cyber'
      ? '#70ffff'
      : skin === 'royal'
        ? '#ffd966'
        : `rgba(${r}, ${g}, ${b}, 0.55)`;
  ctx.lineWidth = Math.max(0.8, s * (skin === 'classic' ? 0.22 : 0.28));
  for (const frac of [-0.32, 0.05, 0.38]) {
    const bx = abdX + frac * abdRx;
    const halfH = Math.sqrt(Math.max(0.05, 1 - frac * frac)) * abdRy * 0.88;
    ctx.beginPath();
    ctx.moveTo(bx, -halfH);
    ctx.lineTo(bx, halfH);
    ctx.stroke();
  }

  // Skin-specific armor outline on abdomen
  if (skin === 'cyber' || skin === 'royal') {
    ctx.strokeStyle = skin === 'cyber' ? 'rgba(112, 255, 255, 0.75)' : 'rgba(255, 217, 102, 0.85)';
    ctx.lineWidth = Math.max(0.9, s * 0.2);
    ctx.beginPath();
    ctx.ellipse(abdX, 0, abdRx * 1.04, abdRy * 1.04, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Glossy dorsal sheen on abdomen
  ctx.fillStyle = type === 'queen' ? 'rgba(255, 225, 255, 0.42)' : 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.ellipse(abdX + 0.15 * abdRx, -abdRy * 0.3, abdRx * 0.48, abdRy * 0.22, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // 3. Petiole (classic narrow ant waist)
  ctx.fillStyle = `rgb(${Math.round(r * 0.75)}, ${Math.round(g * 0.75)}, ${Math.round(b * 0.75)})`;
  ctx.beginPath();
  ctx.arc(-0.62 * s, 0, 0.32 * s, 0, Math.PI * 2);
  ctx.fill();

  // 4. Sculpted Thorax
  ctx.fillStyle = `rgb(${Math.round(r * 0.88)}, ${Math.round(g * 0.88)}, ${Math.round(b * 0.88)})`;
  ctx.beginPath();
  ctx.ellipse(0.22 * s, 0, 0.92 * s, 0.62 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Queen royal crest or Compass golden beacon on thorax
  if (type === 'queen') {
    ctx.fillStyle = '#ffe580';
    ctx.beginPath();
    ctx.arc(0.22 * s, 0, 0.34 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'compass') {
    ctx.fillStyle = '#fff6c4';
    ctx.beginPath();
    ctx.moveTo(0.85 * s, 0);
    ctx.lineTo(0.15 * s, -0.4 * s);
    ctx.lineTo(-0.4 * s, 0);
    ctx.lineTo(0.15 * s, 0.4 * s);
    ctx.closePath();
    ctx.fill();
  }

  // 5. Head
  const headRx = (type === 'warrior' ? 1.05 : 0.78) * s;
  const headRy = (type === 'warrior' ? 0.95 : 0.68) * s;
  const headX = 1.42 * s;
  ctx.fillStyle = `rgb(${Math.min(255, r + 55)}, ${Math.min(255, g + 55)}, ${Math.min(255, b + 55)})`;
  ctx.beginPath();
  ctx.ellipse(headX, 0, headRx, headRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // Compound eyes (glowing visor on Cyber skin!)
  ctx.fillStyle = skin === 'cyber' ? '#00ffff' : skin === 'royal' ? '#ffe066' : '#07100c';
  const eyeR = Math.max(0.7, (skin === 'cyber' ? 0.28 : 0.22) * s);
  ctx.beginPath();
  ctx.arc(headX + 0.25 * headRx, -0.52 * headRy, eyeR, 0, Math.PI * 2);
  ctx.arc(headX + 0.25 * headRx, 0.52 * headRy, eyeR, 0, Math.PI * 2);
  ctx.fill();

  // Royal skin tiny crown crest on thorax
  if (skin === 'royal' && type !== 'queen') {
    ctx.fillStyle = '#ffd966';
    ctx.beginPath();
    ctx.moveTo(0.6 * s, 0);
    ctx.lineTo(0.05 * s, -0.36 * s);
    ctx.lineTo(-0.25 * s, 0);
    ctx.lineTo(0.05 * s, 0.36 * s);
    ctx.closePath();
    ctx.fill();
  }

  // 6. Curved Mandibles (animated snap when biting! Golden-glowing on Evolved Workers!)
  const openAmt = biteFlash > 0 ? 0.1 : 0.42;
  const mandLen = (type === 'warrior' ? 1.55 : evolved ? 1.15 : 0.82) * s;
  ctx.strokeStyle = type === 'warrior' || evolved ? '#ffd859' : '#e8fff2';
  ctx.lineWidth = Math.max(1.1, (type === 'warrior' ? 0.44 : evolved ? 0.34 : 0.26) * s);

  const mBaseX = headX + headRx * 0.72;
  ctx.beginPath();
  ctx.moveTo(mBaseX, -0.34 * s);
  ctx.quadraticCurveTo(
    mBaseX + mandLen * 0.75,
    -0.34 * s - Math.sin(openAmt) * mandLen * 0.9,
    mBaseX + mandLen,
    -0.1 * s - openAmt * 0.35 * s
  );
  ctx.moveTo(mBaseX, 0.34 * s);
  ctx.quadraticCurveTo(
    mBaseX + mandLen * 0.75,
    0.34 * s + Math.sin(openAmt) * mandLen * 0.9,
    mBaseX + mandLen,
    0.1 * s + openAmt * 0.35 * s
  );
  ctx.stroke();

  // 7. Elbowed 2-segment Antennae
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;
  ctx.lineWidth = Math.max(0.8, s * 0.2);
  const antWiggle = Math.sin(legPhase * 0.6) * 0.14;
  ctx.beginPath();
  // Left antenna
  ctx.moveTo(mBaseX - 0.15 * s, -0.26 * s);
  ctx.lineTo(mBaseX + 0.55 * s, -0.88 * s + antWiggle * s);
  ctx.lineTo(mBaseX + 1.35 * s, -1.15 * s + antWiggle * s);
  // Right antenna
  ctx.moveTo(mBaseX - 0.15 * s, 0.26 * s);
  ctx.lineTo(mBaseX + 0.55 * s, 0.88 * s - antWiggle * s);
  ctx.lineTo(mBaseX + 1.35 * s, 1.15 * s - antWiggle * s);
  ctx.stroke();

  ctx.restore();
}

export class WorldRenderer {
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private imgData: ImageData;
  private imgData32: Uint32Array;

  private glowCanvas: HTMLCanvasElement;
  private glowCtx: CanvasRenderingContext2D;
  private glowImgData: ImageData;
  private glowData32: Uint32Array;

  // Fast quarter-res hardware-filtered bloom canvas (replaces slow CPU ctx.filter='blur()' on mobile!)
  private bloomCanvas: HTMLCanvasElement;
  private bloomCtx: CanvasRenderingContext2D;
  private bloomW = 1;
  private bloomH = 1;

  private width = 0;
  private height = 0;
  private lastWorldRef: World | null = null;
  private lastVisualVersion = -1;
  private lastRebuildMs = 0;

  constructor(width: number, height: number) {
    this.offscreen = document.createElement('canvas');
    this.offCtx = this.offscreen.getContext('2d')!;
    this.glowCanvas = document.createElement('canvas');
    this.glowCtx = this.glowCanvas.getContext('2d')!;
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCtx = this.bloomCanvas.getContext('2d')!;
    this.imgData = this.offCtx.createImageData(1, 1);
    this.imgData32 = new Uint32Array(this.imgData.data.buffer);
    this.glowImgData = this.glowCtx.createImageData(1, 1);
    this.glowData32 = new Uint32Array(this.glowImgData.data.buffer);
    this.resizeWorld(width, height);
  }

  resizeWorld(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.offscreen.width = width;
    this.offscreen.height = height;
    this.imgData = this.offCtx.createImageData(width, height);
    this.imgData32 = new Uint32Array(this.imgData.data.buffer);

    this.glowCanvas.width = width;
    this.glowCanvas.height = height;
    this.glowImgData = this.glowCtx.createImageData(width, height);
    this.glowData32 = new Uint32Array(this.glowImgData.data.buffer);

    this.bloomW = Math.max(1, Math.ceil(width * 0.35));
    this.bloomH = Math.max(1, Math.ceil(height * 0.35));
    this.bloomCanvas.width = this.bloomW;
    this.bloomCanvas.height = this.bloomH;
    this.lastVisualVersion = -1;
  }

  private rebuildWorldTextures(world: World, time: number, mobile: boolean) {
    const w = world.width;
    const h = world.height;
    const data = this.imgData.data;
    const data32 = this.imgData32;
    const glow = this.glowImgData.data;
    const glow32 = this.glowData32;
    const cells = world.cells;
    const hp = world.hp;
    const maxHp = world.maxHp;
    const isEdge = world.isEdge;
    const revealed = world.revealedMask;
    const poison = world.poisonMask;
    const noise = world.noise;
    const artExposed = world.artExposed;

    const pal = world.level.palette;
    const [bR, bG, bB] = pal.bgRgb;
    const [eR, eG, eB] = pal.emptyRgb;
    const [sR, sG, sB] = pal.softRgb;
    const [cR, cG, cB] = pal.clayRgb;
    const [stR, stG, stB] = pal.stoneRgb;
    const [oR, oG, oB] = pal.obsidianRgb;
    const [agR, agG, agB] = pal.artGlowRgb;

    const bgPacked = ((255 << 24) | (bB << 16) | (bG << 8) | bR) >>> 0;
    const emptyPacked = ((255 << 24) | (eB << 16) | (eG << 8) | eR) >>> 0;
    const cleared = world.stats.mapCleared;
    const sugarExp = world.sugarExposed;
    const artDefExp = world.artifactExposed;

    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const idx = row + x;
        const cell = cells[idx] as CellType;
        glow32[idx] = 0;

        if (cell === CellType.Empty) {
          data32[idx] = emptyPacked;
          continue;
        }

        const revByte = revealed[idx];
        // Ultra-fast early exit for unexplored dark rock (skips 60-90% of pixels in 2 integer ops!)
        if (revByte === 0 && !cleared && !(cell === CellType.HiddenArt && artExposed[idx] === 1) && !(cell === CellType.Sugar && sugarExp) && !(cell === CellType.Artifact && artDefExp)) {
          data32[idx] = bgPacked;
          continue;
        }

        const p = idx * 4;
        const n = noise[idx];
        const vis = revByte / 255;

        if (cell === CellType.HiddenArt) {
          if (artExposed[idx] === 1 || cleared) {
            if (cleared) {
              const phase = x * 0.032 + y * 0.022 - time * 2.6;
              const gleam = Math.pow(Math.max(0, Math.sin(x * 0.028 - y * 0.018 - time * 3.4)), 8);
              const irR = Math.min(255, Math.round(188 + 67 * Math.sin(phase) + gleam * 115));
              const irG = Math.min(255, Math.round(192 + 63 * Math.sin(phase + 2.094) + gleam * 115));
              const irB = Math.min(255, Math.round(198 + 57 * Math.sin(phase + 4.188) + gleam * 115));
              data[p] = irR;
              data[p + 1] = irG;
              data[p + 2] = irB;
              data[p + 3] = 255;

              glow[p] = irR;
              glow[p + 1] = irG;
              glow[p + 2] = irB;
              glow[p + 3] = Math.min(255, Math.round(215 + gleam * 40));
            } else {
              data[p] = 255;
              data[p + 1] = 255;
              data[p + 2] = 255;
              data[p + 3] = 255;

              glow[p] = agR;
              glow[p + 1] = agG;
              glow[p + 2] = agB;
              glow[p + 3] = 220;
            }
          } else {
            const shade = Math.round(((n & 7) - 3) * vis);
            data[p] = bR + shade;
            data[p + 1] = bG + shade;
            data[p + 2] = bB + shade;
            data[p + 3] = 255;
          }
          continue;
        }

        if (cell === CellType.Artifact) {
          if (vis > 0.1 || artDefExp) {
            const [ar, ag, ab] = world.artifactDef ? world.artifactDef.rgb : [255, 130, 148];
            const pulse = 0.78 + 0.22 * Math.sin(time * 5.2 + x * 0.6 + y * 0.6);
            const alpha = artDefExp ? 1 : Math.min(1, (vis - 0.1) / 0.45);
            const cr = Math.min(255, Math.round(ar * pulse + 35));
            const cg = Math.min(255, Math.round(ag * pulse + 25));
            const cb = Math.min(255, Math.round(ab * pulse + 25));

            data[p] = Math.round(bR + (cr - bR) * alpha);
            data[p + 1] = Math.round(bG + (cg - bG) * alpha);
            data[p + 2] = Math.round(bB + (cb - bB) * alpha);
            data[p + 3] = 255;

            glow[p] = cr;
            glow[p + 1] = cg;
            glow[p + 2] = cb;
            glow[p + 3] = Math.round(245 * alpha);
          } else {
            data32[idx] = bgPacked;
          }
          continue;
        }

        if (cell === CellType.Sugar) {
          if (sugarExp) {
            const pulse = 0.88 + 0.12 * Math.sin(time * 4.5 + x * 0.5 + y * 0.5);
            data[p] = Math.round(255 * pulse);
            data[p + 1] = Math.round(244 * pulse);
            data[p + 2] = Math.round(170 * pulse);
            data[p + 3] = 255;

            glow[p] = 255;
            glow[p + 1] = 230;
            glow[p + 2] = 120;
            glow[p + 3] = 255;
          } else {
            const shade = Math.round(((n & 7) - 3) * vis);
            data[p] = bR + shade;
            data[p + 1] = bG + shade;
            data[p + 2] = bB + shade;
            data[p + 3] = 255;
          }
          continue;
        }

        if (cell === CellType.SkillCrystal) {
          if (vis > 0.12) {
            const isAlt = (n & 1) === 1;
            const pulse = 0.8 + 0.2 * Math.sin(time * 3.2 + n * 0.1);
            const cr = Math.round((isAlt ? 220 : 65) * pulse);
            const cg = Math.round((isAlt ? 85 : 235) * pulse);
            const cb = Math.round(255 * pulse);
            const alpha = Math.min(1, (vis - 0.12) / 0.55);

            data[p] = Math.round(bR + (cr - bR) * alpha);
            data[p + 1] = Math.round(bG + (cg - bG) * alpha);
            data[p + 2] = Math.round(bB + (cb - bB) * alpha);
            data[p + 3] = 255;

            glow[p] = cr;
            glow[p + 1] = cg;
            glow[p + 2] = cb;
            glow[p + 3] = Math.round(185 * alpha);
          } else {
            data32[idx] = bgPacked;
          }
          continue;
        }

        if (cell === CellType.ExplosiveSpore) {
          if (vis > 0.14) {
            const pulse = 0.78 + 0.22 * Math.sin(time * 6.0 + n * 0.2);
            const alpha = Math.min(1, (vis - 0.14) / 0.5);
            const cr = Math.round(255 * pulse);
            const cg = Math.round(108 * pulse);
            const cb = Math.round(52 * pulse);
            data[p] = Math.round(bR + (cr - bR) * alpha);
            data[p + 1] = Math.round(bG + (cg - bG) * alpha);
            data[p + 2] = Math.round(bB + (cb - bB) * alpha);
            data[p + 3] = 255;
            glow[p] = cr; glow[p + 1] = cg; glow[p + 2] = cb;
            glow[p + 3] = Math.round(215 * alpha);
          } else {
            data32[idx] = bgPacked;
          }
          continue;
        }

        if (cell === CellType.SugarDust) {
          if (vis > 0.14) {
            const pulse = 0.8 + 0.2 * Math.sin(time * 5.2 + x * 0.7 + y * 0.7);
            const alpha = Math.min(1, (vis - 0.14) / 0.5);
            const cr = Math.round(255 * pulse);
            const cg = Math.round(226 * pulse);
            const cb = Math.round(92 * pulse);
            data[p] = Math.round(bR + (cr - bR) * alpha);
            data[p + 1] = Math.round(bG + (cg - bG) * alpha);
            data[p + 2] = Math.round(bB + (cb - bB) * alpha);
            data[p + 3] = 255;
            glow[p] = cr; glow[p + 1] = cg; glow[p + 2] = cb;
            glow[p + 3] = Math.round(220 * alpha);
          } else {
            data32[idx] = bgPacked;
          }
          continue;
        }

        if (cell === CellType.AncientCocoon) {
          if (vis > 0.14) {
            const wave = 0.5 + 0.5 * Math.sin(time * 4.2 + n * 0.15);
            const alpha = Math.min(1, (vis - 0.14) / 0.5);
            const cr = Math.round(115 + 105 * wave);
            const cg = Math.round(245 - 110 * wave);
            const cb = Math.round(185 + 70 * wave);
            data[p] = Math.round(bR + (cr - bR) * alpha);
            data[p + 1] = Math.round(bG + (cg - bG) * alpha);
            data[p + 2] = Math.round(bB + (cb - bB) * alpha);
            data[p + 3] = 255;
            glow[p] = cr; glow[p + 1] = cg; glow[p + 2] = cb;
            glow[p + 3] = Math.round(215 * alpha);
          } else {
            data32[idx] = bgPacked;
          }
          continue;
        }

        if (vis <= 0.004) {
          data32[idx] = bgPacked;
          continue;
        }

        const shade = (n & 7) - 3;
        let tr = sR + shade;
        let tg = sG + shade;
        let tb = sB + shade;

        if (cell === CellType.Clay) {
          tr = cR + shade;
          tg = cG + shade;
          tb = cB + shade;
        } else if (cell === CellType.Stone) {
          const speck = (n & 31) === 0 ? 12 : 0;
          tr = stR + shade + speck;
          tg = stG + shade + speck;
          tb = stB + shade + speck;
        } else if (cell === CellType.Obsidian) {
          const glint = (n & 31) === 0 ? 16 : 0;
          tr = oR + shade + glint;
          tg = oG + shade;
          tb = oB + shade + glint;
        }

        let r = Math.round(bR + (tr - bR) * vis);
        let g = Math.round(bG + (tg - bG) * vis);
        let b = Math.round(bB + (tb - bB) * vis);

        if (isEdge[idx] === 1) {
          const rimGrain = (n & 15) - 6;
          r = Math.min(255, Math.max(0, r + 32 + rimGrain));
          g = Math.min(255, Math.max(0, g + 38 + rimGrain));
          b = Math.min(255, Math.max(0, b + 30 + rimGrain));
          if (cell === CellType.SoftSoil && (n & 7) === 0) {
            g = Math.min(255, g + 26);
          } else if (cell === CellType.Clay && (n & 7) === 1) {
            r = Math.min(255, r + 28);
            g = Math.min(255, g + 16);
          } else if (cell === CellType.Obsidian && (n & 7) === 2) {
            r = Math.min(255, r + 24);
            b = Math.min(255, b + 30);
          }
        }

        const mHp = maxHp[idx] || 1;
        const dmgRatio = Math.max(0, (mHp - hp[idx]) / mHp);
        if (dmgRatio > 0) {
          if (dmgRatio < 0.5) {
            const t = dmgRatio * 2;
            r = Math.round(r + (225 - r) * t * 0.78);
            g = Math.round(g + (165 - g) * t * 0.72);
            b = Math.round(b + (45 - b) * t * 0.65);
          } else {
            const t = (dmgRatio - 0.5) * 2;
            r = Math.round(225 + (245 - 225) * t);
            g = Math.round(165 - (165 - 48) * t);
            b = Math.round(45 - (45 - 32) * t);
          }

          if (dmgRatio >= 0.45) {
            glow[p] = r;
            glow[p + 1] = g;
            glow[p + 2] = b;
            glow[p + 3] = Math.round(125 * dmgRatio);
          }
        }

        // Toxic-lime acid shimmer on blocks corroded by Scout "Ядовитый рикошет"!
        if (poison[idx] === 1) {
          const acid = 0.58 + 0.25 * Math.sin(time * 7.5 + x * 0.7 + y * 0.7);
          r = Math.round(r * (1 - acid * 0.55) + 115 * acid * 0.55);
          g = Math.min(255, Math.round(g + (255 - g) * acid * 0.72));
          b = Math.round(b * (1 - acid * 0.5) + 80 * acid * 0.5);
          glow[p] = 115;
          glow[p + 1] = 255;
          glow[p + 2] = 95;
          glow[p + 3] = Math.max(glow[p + 3], 185);
        }

        data[p] = r;
        data[p + 1] = g;
        data[p + 2] = b;
        data[p + 3] = 255;
      }
    }

    this.offCtx.putImageData(this.imgData, 0, 0);
    this.glowCtx.putImageData(this.glowImgData, 0, 0);

    // Pre-downsample glow onto quarter-res hardware canvas for ultra-fast mobile bloom (zero CPU blur!)
    if (mobile) {
      this.bloomCtx.clearRect(0, 0, this.bloomW, this.bloomH);
      this.bloomCtx.imageSmoothingEnabled = true;
      this.bloomCtx.drawImage(this.glowCanvas, 0, 0, this.bloomW, this.bloomH);
    }
  }

  render(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    camera: Camera,
    world: World,
    ants: Ant[],
    particles: ParticleSystem,
    time: number,
    aimPreview: AimPreview | null,
    sugarBurst: { x: number; y: number; progress: number } | null = null,
    scentTrail: ScentPoint[] = [],
    beacon: PheromoneBeacon | null = null,
    workerEvolved = false
  ) {
    if (world.width !== this.width || world.height !== this.height) {
      this.resizeWorld(world.width, world.height);
    }

    const w = world.width;
    const h = world.height;
    const pal = world.level.palette;
    const mobile = isMobileDevice();
    const now = performance.now();

    const worldChanged = this.lastWorldRef !== world;
    const dirty = world.visualVersion !== this.lastVisualVersion;
    const elapsedSinceRebuild = now - this.lastRebuildMs;
    const animInterval = mobile ? (world.stats.mapCleared ? 60 : 95) : (world.stats.mapCleared ? 34 : 55);
    const dirtyInterval = mobile ? 26 : 14;

    if (worldChanged || (dirty && elapsedSinceRebuild >= dirtyInterval) || elapsedSinceRebuild >= animInterval) {
      this.rebuildWorldTextures(world, time, mobile);
      this.lastWorldRef = world;
      this.lastVisualVersion = world.visualVersion;
      this.lastRebuildMs = now;
    }

    // Fill outer canvas with exact level palette background color (100% seamless!)
    ctx.fillStyle = pal.bgHex;
    ctx.fillRect(0, 0, viewW, viewH);

    const z = camera.zoom;
    const drawX = viewW * 0.5 - camera.x * z;
    const drawY = viewH * 0.5 - camera.y * z;

    // 9-arg viewport-clipped blit: draws ONLY visible map pixels (massive GPU fill-rate win when zoomed in!)
    const srcX = Math.max(0, Math.floor(-drawX / z) - 1);
    const srcY = Math.max(0, Math.floor(-drawY / z) - 1);
    const srcX2 = Math.min(w, Math.ceil((viewW - drawX) / z) + 1);
    const srcY2 = Math.min(h, Math.ceil((viewH - drawY) / z) + 1);
    const srcW = srcX2 - srcX;
    const srcH = srcY2 - srcY;

    ctx.save();
    if (srcW > 0 && srcH > 0) {
      const dstX = drawX + srcX * z;
      const dstY = drawY + srcY * z;
      const dstW = srcW * z;
      const dstH = srcH * z;

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.offscreen, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);

      // Soft bloom pass: ultra-fast hardware downsampled bloom on mobile (ZERO CPU blur stall!), full blur on desktop!
      ctx.globalCompositeOperation = 'lighter';
      ctx.imageSmoothingEnabled = true;
      if (mobile) {
        const bSx = (srcX / w) * this.bloomW;
        const bSy = (srcY / h) * this.bloomH;
        const bSw = (srcW / w) * this.bloomW;
        const bSh = (srcH / h) * this.bloomH;
        ctx.globalAlpha = world.stats.mapCleared ? 0.72 : 0.48;
        ctx.drawImage(this.bloomCanvas, bSx, bSy, bSw, bSh, dstX, dstY, dstW, dstH);
        ctx.globalAlpha = world.stats.mapCleared ? 0.45 : 0.28;
        ctx.drawImage(this.glowCanvas, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
      } else {
        ctx.filter = `blur(${Math.max(4, Math.min(12, z * (world.stats.mapCleared ? 1.9 : 1.5)))}px)`;
        ctx.globalAlpha = world.stats.mapCleared ? 0.85 : 0.58;
        ctx.drawImage(this.glowCanvas, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
        ctx.filter = 'none';
      }
      ctx.globalAlpha = 1;
    }

    // Magical pulsing halo around a revealed uncollected Secret Artifact!
    if (
      world.artifactDef &&
      !world.stats.artifactCollected &&
      world.artifactX > 0 &&
      (world.artifactExposed || world.revealedMask[world.artifactY * w + world.artifactX] > 55)
    ) {
      const ax = drawX + (world.artifactX + 0.5) * camera.zoom;
      const ay = drawY + (world.artifactY + 0.5) * camera.zoom;
      const [ar, ag, ab] = world.artifactDef.rgb;
      const ringR = Math.max(8, camera.zoom * (2.6 + 0.65 * Math.sin(time * 4)));
      ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, 0.72)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(ax, ay, ringR, 0, Math.PI * 2);
      ctx.stroke();

      // Orbiting golden sparkle dots
      for (let s = 0; s < 3; s++) {
        const ang = time * 2.6 + (s * Math.PI * 2) / 3;
        ctx.fillStyle = '#fff5c2';
        ctx.beginPath();
        ctx.arc(ax + Math.cos(ang) * ringR, ay + Math.sin(ang) * ringR, Math.max(1.5, camera.zoom * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Nest pulse ring
    const nestScreenX = drawX + world.nestX * camera.zoom;
    const nestScreenY = drawY + world.nestY * camera.zoom;
    const nestPulse = 0.22 + 0.1 * Math.sin(time * 2.2);
    ctx.strokeStyle = `rgba(60, 232, 122, ${nestPulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(nestScreenX, nestScreenY, Math.max(10, camera.zoom * 4), 0, Math.PI * 2);
    ctx.stroke();

    // Epic Diamond-Sugar Discovery Shockwaves + Rotating Light Beams right on the canvas!
    if (sugarBurst && sugarBurst.progress >= 0 && sugarBurst.progress < 1) {
      const p = sugarBurst.progress;
      const sx = drawX + (sugarBurst.x + 0.5) * camera.zoom;
      const sy = drawY + (sugarBurst.y + 0.5) * camera.zoom;
      const fade = Math.pow(1 - p, 1.35);

      // 12 rotating golden-diamond sunbeams radiating out from the Sugar cube
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(time * 0.9);
      const beamLen = Math.max(90, camera.zoom * (16 + p * 34));
      for (let r = 0; r < 12; r++) {
        const ang = (r / 12) * Math.PI * 2;
        const spread = r % 2 === 0 ? 0.11 : 0.06;
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, beamLen);
        if (r % 2 === 0) {
          grad.addColorStop(0, `rgba(255, 252, 224, ${0.55 * fade})`);
          grad.addColorStop(0.45, `rgba(255, 224, 102, ${0.28 * fade})`);
          grad.addColorStop(1, 'rgba(255, 224, 102, 0)');
        } else {
          grad.addColorStop(0, `rgba(210, 250, 255, ${0.42 * fade})`);
          grad.addColorStop(0.5, `rgba(110, 232, 255, ${0.18 * fade})`);
          grad.addColorStop(1, 'rgba(110, 232, 255, 0)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, beamLen, ang - spread, ang + spread);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 3 staggered expanding diamond-gold shockwave rings
      for (let wIdx = 0; wIdx < 3; wIdx++) {
        const wp = Math.max(0, Math.min(1, (p - wIdx * 0.12) / 0.72));
        if (wp <= 0 || wp >= 1) continue;
        const eased = 1 - Math.pow(1 - wp, 2.4);
        const rad = Math.max(12, camera.zoom * (2.5 + eased * (26 + wIdx * 10)));
        const alpha = (1 - wp) * (wIdx === 0 ? 0.95 : 0.65);
        ctx.strokeStyle =
          wIdx === 1
            ? `rgba(175, 246, 255, ${alpha})`
            : `rgba(255, 236, 130, ${alpha})`;
        ctx.lineWidth = Math.max(1.5, (1 - wp) * 4.5);
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Radiant diamond core glow flash
      const coreR = Math.max(18, camera.zoom * (5.5 + Math.sin(p * Math.PI) * 5));
      const coreGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, coreR);
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.85 * fade})`);
      coreGrad.addColorStop(0.45, `rgba(255, 234, 138, ${0.42 * fade})`);
      coreGrad.addColorStop(1, 'rgba(255, 234, 138, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, coreR, 0, Math.PI * 2);
      ctx.fill();
    } else if (world.stats.sugarFound) {
      // Ongoing subtle jewel shimmer halo on the discovered Sugar cube
      const sx = drawX + (world.sugarX + 0.5) * camera.zoom;
      const sy = drawY + (world.sugarY + 0.5) * camera.zoom;
      const pulseR = Math.max(10, camera.zoom * (3.2 + 0.6 * Math.sin(time * 3.8)));
      ctx.strokeStyle = 'rgba(255, 236, 138, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(sx, sy, pulseR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Lingering golden trajectory ribbon left by Ищейка (clearly shows direction toward Sugar!)
    if (scentTrail.length >= 2) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 1; i < scentTrail.length; i++) {
        const a = scentTrail[i - 1];
        const b = scentTrail[i];
        if (Math.hypot(b.x - a.x, b.y - a.y) > 16) continue;
        const alpha = Math.max(0, Math.min(1, b.life / b.maxLife));
        const ax = drawX + a.x * camera.zoom;
        const ay = drawY + a.y * camera.zoom;
        const bx = drawX + b.x * camera.zoom;
        const by = drawY + b.y * camera.zoom;

        ctx.strokeStyle = `rgba(255, 224, 110, ${alpha * 0.72})`;
        ctx.lineWidth = Math.max(1.8, camera.zoom * 0.55);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();

        // Crisp golden chevron direction tick every 4 segments so vector toward Sugar is unmistakable!
        if (i % 4 === 0 && alpha > 0.12) {
          const ang = Math.atan2(by - ay, bx - ax);
          const sz = Math.max(4, camera.zoom * 1.15);
          ctx.strokeStyle = `rgba(255, 248, 195, ${alpha * 0.9})`;
          ctx.lineWidth = Math.max(1.3, camera.zoom * 0.3);
          ctx.beginPath();
          ctx.moveTo(bx - Math.cos(ang - 0.55) * sz, by - Math.sin(ang - 0.55) * sz);
          ctx.lineTo(bx, by);
          ctx.lineTo(bx - Math.cos(ang + 0.55) * sz, by - Math.sin(ang + 0.55) * sz);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Pulsing Pheromone Beacon (attracts free Workers & Queen Brood!)
    if (beacon) {
      const bx = drawX + beacon.x * camera.zoom;
      const by = drawY + beacon.y * camera.zoom;
      const wave1 = (time * 0.75) % 1;
      const wave2 = (time * 0.75 + 0.5) % 1;
      for (const wv of [wave1, wave2]) {
        const rad = Math.max(8, camera.zoom * (2.5 + wv * 10));
        ctx.strokeStyle = `rgba(66, 245, 197, ${(1 - wv) * 0.72})`;
        ctx.lineWidth = Math.max(1.4, (1 - wv) * 2.6);
        ctx.beginPath();
        ctx.arc(bx, by, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(66, 245, 197, 0.25)';
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(7, camera.zoom * 2.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a8ffea';
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(2.6, camera.zoom * 0.75), 0, Math.PI * 2);
      ctx.fill();
    }

    // Queen tiny royal buff aura rings (visualizes exact 13px buff radius!)
    for (let i = 0; i < ants.length; i++) {
      const ant = ants[i];
      if (ant.type !== 'queen') continue;
      const qx = drawX + ant.x * camera.zoom;
      const qy = drawY + ant.y * camera.zoom;
      const auraR = QUEEN_AURA_RADIUS * camera.zoom;
      if (qx + auraR < -10 || qx - auraR > viewW + 10 || qy + auraR < -10 || qy - auraR > viewH + 10) continue;
      const pulse = 0.22 + 0.12 * Math.sin(time * 3.4 + ant.id);
      ctx.fillStyle = `rgba(224, 75, 255, ${pulse * 0.28})`;
      ctx.beginPath();
      ctx.arc(qx, qy, auraR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 200, 120, ${pulse + 0.14})`;
      ctx.lineWidth = Math.max(1.1, camera.zoom * 0.22);
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(qx, qy, auraR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Floating particles
    for (let i = 0; i < particles.particles.length; i++) {
      const pt = particles.particles[i];
      const alpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
      const sx = drawX + pt.x * camera.zoom;
      const sy = drawY + pt.y * camera.zoom;
      const rad = Math.max(1.4, pt.size * camera.zoom * 0.4);
      ctx.fillStyle = `rgba(${pt.r}, ${pt.g}, ${pt.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';

    // Draw detailed articulated ants
    for (let i = 0; i < ants.length; i++) {
      const ant = ants[i];
      const sx = drawX + ant.x * camera.zoom;
      const sy = drawY + ant.y * camera.zoom;
      if (sx < -36 || sx > viewW + 36 || sy < -36 || sy > viewH + 36) continue;
      const isEvoWorker = ant.type === 'worker' && workerEvolved;
      drawDetailedAnt(ctx, ant.type, sx, sy, ant.angle, ant.legPhase, ant.biteFlash, camera.zoom, 'classic', undefined, isEvoWorker);
    }

    // Warrior directional aiming preview
    if (aimPreview) {
      const ax = drawX + aimPreview.fromX * camera.zoom;
      const ay = drawY + aimPreview.fromY * camera.zoom;
      const len = Math.max(36, camera.zoom * 14);
      const ex = ax + Math.cos(aimPreview.angle) * len;
      const ey = ay + Math.sin(aimPreview.angle) * len;

      ctx.strokeStyle = aimPreview.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);

      const headLen = 9;
      ctx.fillStyle = aimPreview.color;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(
        ex - Math.cos(aimPreview.angle - 0.45) * headLen,
        ey - Math.sin(aimPreview.angle - 0.45) * headLen
      );
      ctx.lineTo(
        ex - Math.cos(aimPreview.angle + 0.45) * headLen,
        ey - Math.sin(aimPreview.angle + 0.45) * headLen
      );
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}
