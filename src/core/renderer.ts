import { ANT_TYPES } from './ants';
import { Ant, AntSkinId, AntTypeId, CellType } from './types';
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
  colorOverride?: [number, number, number]
) {
  const cfg = ANT_TYPES[type];
  const s = Math.max(1.8, zoom * 0.65) * cfg.scale;
  const [r, g, b] = colorOverride || cfg.rgb;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);

  // Soft colored underglow
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.2)`;
  ctx.beginPath();
  ctx.arc(0, 0, s * 3.2, 0, Math.PI * 2);
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

  // 6. Curved Mandibles (animated snap when biting!)
  const openAmt = biteFlash > 0 ? 0.1 : 0.42;
  const mandLen = (type === 'warrior' ? 1.55 : 0.82) * s;
  ctx.strokeStyle = type === 'warrior' ? '#ffd166' : '#e8fff2';
  ctx.lineWidth = Math.max(1.1, (type === 'warrior' ? 0.44 : 0.26) * s);

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

  private glowCanvas: HTMLCanvasElement;
  private glowCtx: CanvasRenderingContext2D;
  private glowImgData: ImageData;

  private width = 0;
  private height = 0;

  constructor(width: number, height: number) {
    this.offscreen = document.createElement('canvas');
    this.offCtx = this.offscreen.getContext('2d')!;
    this.glowCanvas = document.createElement('canvas');
    this.glowCtx = this.glowCanvas.getContext('2d')!;
    this.imgData = this.offCtx.createImageData(1, 1);
    this.glowImgData = this.glowCtx.createImageData(1, 1);
    this.resizeWorld(width, height);
  }

  resizeWorld(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.offscreen.width = width;
    this.offscreen.height = height;
    this.imgData = this.offCtx.createImageData(width, height);

    this.glowCanvas.width = width;
    this.glowCanvas.height = height;
    this.glowImgData = this.glowCtx.createImageData(width, height);
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
    aimPreview: AimPreview | null
  ) {
    if (world.width !== this.width || world.height !== this.height) {
      this.resizeWorld(world.width, world.height);
    }

    const w = world.width;
    const h = world.height;
    const data = this.imgData.data;
    const glow = this.glowImgData.data;
    const cells = world.cells;
    const hp = world.hp;
    const maxHp = world.maxHp;
    const isEdge = world.isEdge;
    const revealed = world.revealedMask;
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

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const p = idx * 4;
        const cell = cells[idx] as CellType;
        const n = noise[idx];
        const vis = revealed[idx] / 255;

        glow[p] = 0;
        glow[p + 1] = 0;
        glow[p + 2] = 0;
        glow[p + 3] = 0;

        if (cell === CellType.Empty) {
          data[p] = eR;
          data[p + 1] = eG;
          data[p + 2] = eB;
          data[p + 3] = 255;
          continue;
        }

        if (cell === CellType.HiddenArt) {
          if (artExposed[idx] === 1) {
            data[p] = 255;
            data[p + 1] = 255;
            data[p + 2] = 255;
            data[p + 3] = 255;

            glow[p] = agR;
            glow[p + 1] = agG;
            glow[p + 2] = agB;
            glow[p + 3] = 220;
          } else {
            const shade = Math.round(((n & 7) - 3) * vis);
            data[p] = bR + shade;
            data[p + 1] = bG + shade;
            data[p + 2] = bB + shade;
            data[p + 3] = 255;
          }
          continue;
        }

        if (cell === CellType.Sugar) {
          if (world.sugarExposed) {
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

        // SkillCrystal: smoothly fades into view only inside tunnel reveal radius!
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
            data[p] = bR;
            data[p + 1] = bG;
            data[p + 2] = bB;
            data[p + 3] = 255;
          }
          continue;
        }

        // Unexplored terrain outside tunnel vision blends 100% seamlessly into level palette bg!
        if (vis <= 0.004) {
          data[p] = bR;
          data[p + 1] = bG;
          data[p + 2] = bB;
          data[p + 3] = 255;
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
          r = Math.min(255, r + 18);
          g = Math.min(255, g + 24);
          b = Math.min(255, b + 20);
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

        data[p] = r;
        data[p + 1] = g;
        data[p + 2] = b;
        data[p + 3] = 255;
      }
    }

    this.offCtx.putImageData(this.imgData, 0, 0);
    this.glowCtx.putImageData(this.glowImgData, 0, 0);

    // Fill outer canvas with exact level palette background color (100% seamless!)
    ctx.fillStyle = pal.bgHex;
    ctx.fillRect(0, 0, viewW, viewH);

    const drawW = w * camera.zoom;
    const drawH = h * camera.zoom;
    const drawX = viewW * 0.5 - camera.x * camera.zoom;
    const drawY = viewH * 0.5 - camera.y * camera.zoom;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.offscreen, drawX, drawY, drawW, drawH);

    // Soft bloom pass for HiddenArt, revealed SkillCrystals, Sugar & heavy damage
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.filter = `blur(${Math.max(4, Math.min(10, camera.zoom * 1.5))}px)`;
    ctx.globalAlpha = 0.58;
    ctx.drawImage(this.glowCanvas, drawX, drawY, drawW, drawH);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;

    // Nest pulse ring
    const nestScreenX = drawX + world.nestX * camera.zoom;
    const nestScreenY = drawY + world.nestY * camera.zoom;
    const nestPulse = 0.22 + 0.1 * Math.sin(time * 2.2);
    ctx.strokeStyle = `rgba(60, 232, 122, ${nestPulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(nestScreenX, nestScreenY, Math.max(10, camera.zoom * 4), 0, Math.PI * 2);
    ctx.stroke();

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
      drawDetailedAnt(ctx, ant.type, sx, sy, ant.angle, ant.legPhase, ant.biteFlash, camera.zoom);
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
