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

interface SkinTypePalette {
  body: [number, number, number];
  gaster: string;
  accent: string;
  trim: string;
  glow: string;
  eyePrimary: string;
  eyeSecondary: string;
}

/** Distinct per-ant-type color palettes for the Alien Swarm skin (every ant class is instantly recognizable!) */
const ALIEN_SKIN_PALETTES: Record<AntTypeId, SkinTypePalette> = {
  worker: {
    body: [42, 224, 118],
    gaster: '#143d25',
    accent: '#baff4d',
    trim: '#42ff88',
    glow: 'rgba(64, 245, 126, 0.28)',
    eyePrimary: '#d8ff42',
    eyeSecondary: '#38ff9c'
  },
  warrior: {
    body: [255, 62, 54],
    gaster: '#4a0f14',
    accent: '#ffae38',
    trim: '#ff425e',
    glow: 'rgba(255, 58, 48, 0.32)',
    eyePrimary: '#ffd845',
    eyeSecondary: '#ff3b5c'
  },
  scout: {
    body: [36, 232, 222],
    gaster: '#0c3a40',
    accent: '#8cff4d',
    trim: '#35f2e6',
    glow: 'rgba(42, 235, 225, 0.30)',
    eyePrimary: '#a6ff45',
    eyeSecondary: '#45f5ff'
  },
  queen: {
    body: [232, 72, 255],
    gaster: '#430e4f',
    accent: '#ffe26a',
    trim: '#ff52d8',
    glow: 'rgba(232, 72, 255, 0.34)',
    eyePrimary: '#ffe866',
    eyeSecondary: '#ff47b8'
  },
  compass: {
    body: [255, 212, 68],
    gaster: '#4a350a',
    accent: '#fff5a8',
    trim: '#ffba38',
    glow: 'rgba(255, 214, 72, 0.34)',
    eyePrimary: '#ffffff',
    eyeSecondary: '#ff9d2e'
  },
  phantom: {
    body: [152, 112, 255],
    gaster: '#1f124a',
    accent: '#6ef7ff',
    trim: '#b882ff',
    glow: 'rgba(130, 125, 255, 0.34)',
    eyePrimary: '#6ef7ff',
    eyeSecondary: '#e08cff'
  },
  brood: {
    body: [255, 122, 206],
    gaster: '#3e1638',
    accent: '#ffb8eb',
    trim: '#ff6bc9',
    glow: 'rgba(255, 118, 205, 0.25)',
    eyePrimary: '#ffe878',
    eyeSecondary: '#ff66c4'
  },
  beetle: {
    body: [255, 92, 36],
    gaster: '#59160a',
    accent: '#ffe866',
    trim: '#ff5e2b',
    glow: 'rgba(255, 98, 36, 0.36)',
    eyePrimary: '#fff6a8',
    eyeSecondary: '#ff451a'
  }
};

/** Distinct per-ant-type color palettes for the Cosmic Fleet skin (high-contrast sci-fi hull classes!) */
const COSMIC_SKIN_PALETTES: Record<AntTypeId, SkinTypePalette> = {
  worker: {
    body: [56, 236, 152],
    gaster: '#0e2d24',
    accent: '#5effb4',
    trim: '#2ed98a',
    glow: 'rgba(56, 236, 152, 0.28)',
    eyePrimary: '#78ffc4',
    eyeSecondary: '#d6ffea'
  },
  warrior: {
    body: [255, 96, 56],
    gaster: '#3a1314',
    accent: '#ffcf52',
    trim: '#ff5c38',
    glow: 'rgba(255, 92, 52, 0.34)',
    eyePrimary: '#ffdd66',
    eyeSecondary: '#ff5e3a'
  },
  scout: {
    body: [64, 224, 255],
    gaster: '#0c233c',
    accent: '#82f5ff',
    trim: '#38c8ff',
    glow: 'rgba(64, 224, 255, 0.32)',
    eyePrimary: '#9ef8ff',
    eyeSecondary: '#ffffff'
  },
  queen: {
    body: [228, 102, 255],
    gaster: '#2a1044',
    accent: '#ffe478',
    trim: '#e472ff',
    glow: 'rgba(228, 102, 255, 0.34)',
    eyePrimary: '#ffe87c',
    eyeSecondary: '#f09cff'
  },
  compass: {
    body: [255, 224, 96],
    gaster: '#382b0c',
    accent: '#fff7bd',
    trim: '#ffd04d',
    glow: 'rgba(255, 224, 96, 0.34)',
    eyePrimary: '#ffffff',
    eyeSecondary: '#ffe066'
  },
  phantom: {
    body: [176, 134, 255],
    gaster: '#16113a',
    accent: '#78f6ff',
    trim: '#c490ff',
    glow: 'rgba(155, 140, 255, 0.34)',
    eyePrimary: '#80f8ff',
    eyeSecondary: '#d8a6ff'
  },
  brood: {
    body: [255, 136, 226],
    gaster: '#311338',
    accent: '#ffc2f0',
    trim: '#ff82dc',
    glow: 'rgba(255, 136, 226, 0.25)',
    eyePrimary: '#ffd6f5',
    eyeSecondary: '#ffffff'
  },
  beetle: {
    body: [255, 114, 48],
    gaster: '#42160c',
    accent: '#fff080',
    trim: '#ff7038',
    glow: 'rgba(255, 114, 48, 0.36)',
    eyePrimary: '#fff6b8',
    eyeSecondary: '#ff6629'
  }
};

/** Shared detailed articulated ant renderer (supports Classic, Cyber, Royal, Alien & Cosmic skins with unique per-ant palettes + spectral clones!) */
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
  evolved = false,
  isClone = false
) {
  const cfg = ANT_TYPES[type];
  // Scale smoothly up to 28x close-up zoom while staying crisp and proportional to individual pixel blocks!
  const zoomScale = zoom <= 8 ? zoom * 0.62 : 4.96 + (zoom - 8) * 0.24;
  const cloneScale = isClone ? 0.84 : 1;
  const s = Math.max(1.8, zoomScale) * cfg.scale * (evolved ? 1.12 : 1) * cloneScale;

  const skinPal: SkinTypePalette | null =
    !colorOverride && skin === 'alien'
      ? ALIEN_SKIN_PALETTES[type]
      : !colorOverride && skin === 'cosmic'
        ? COSMIC_SKIN_PALETTES[type]
        : null;

  let baseRgb: [number, number, number] =
    colorOverride || (skinPal ? skinPal.body : evolved && type === 'worker' ? [115, 255, 165] : cfg.rgb);
  if (isClone && type === 'warrior') {
    // Distinct spectral molten-cyan/amber skin for Evolved Warrior clones!
    baseRgb = skin === 'alien' ? [255, 152, 72] : skin === 'cosmic' ? [110, 245, 220] : [130, 224, 255];
  }
  const [r, g, b] = baseRgb;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  if (isClone) ctx.globalAlpha = 0.86;

  // Distinct fiery armored Exploding Beetle silhouette (Queen Evolution 5% spawn!)
  if (type === 'beetle') {
    const pulse = 0.72 + 0.28 * Math.sin(legPhase * 1.4);
    ctx.fillStyle = skinPal ? skinPal.glow : `rgba(255, 110, 40, ${0.32 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, s * 3.1, 0, Math.PI * 2);
    ctx.fill();

    // 6 stubby legs
    ctx.strokeStyle = skinPal ? skinPal.trim : 'rgba(255, 155, 90, 0.9)';
    ctx.lineWidth = Math.max(1.0, s * 0.28);
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      const lx = i * 0.75 * s;
      const sw = Math.sin(legPhase + i * 1.6) * 0.35 * s;
      ctx.moveTo(lx, -0.7 * s);
      ctx.lineTo(lx + sw, -1.75 * s);
      ctx.moveTo(lx, 0.7 * s);
      ctx.lineTo(lx - sw, 1.75 * s);
    }
    ctx.stroke();

    // Round explosive carapace
    ctx.fillStyle = skinPal ? skinPal.gaster : '#c8261a';
    ctx.beginPath();
    ctx.ellipse(-0.15 * s, 0, 1.65 * s, 1.28 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Glowing molten fissure down the shell
    ctx.strokeStyle = skinPal ? skinPal.accent : `rgba(255, 232, 110, ${pulse})`;
    ctx.lineWidth = Math.max(1.2, s * 0.34);
    ctx.beginPath();
    ctx.moveTo(-1.5 * s, 0);
    ctx.lineTo(0.85 * s, 0);
    ctx.stroke();
    // Glowing head & core
    ctx.fillStyle = skinPal ? skinPal.trim : '#ff9848';
    ctx.beginPath();
    ctx.arc(1.35 * s, 0, 0.65 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff9cc';
    ctx.beginPath();
    ctx.arc(-0.25 * s, 0, 0.42 * s * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Soft colored underglow (unique per-ant-class aura in every skin!)
  if (isClone && type === 'warrior') {
    ctx.fillStyle = skin === 'alien' ? 'rgba(255, 152, 72, 0.28)' : 'rgba(110, 232, 255, 0.28)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 178, 92, 0.65)';
    ctx.lineWidth = Math.max(0.9, s * 0.22);
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(0, 0, s * 2.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (type === 'phantom') {
    const pulse = 0.72 + 0.28 * Math.sin(legPhase * 1.1);
    ctx.fillStyle = skinPal ? skinPal.glow : `rgba(110, 245, 255, ${0.26 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, s * (evolved ? 4.2 : 3.7), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = skinPal ? skinPal.accent : `rgba(195, 125, 255, ${0.75 * pulse})`;
    ctx.lineWidth = Math.max(1.0, s * 0.22);
    ctx.beginPath();
    ctx.arc(0, 0, s * 2.9, legPhase * 0.25, legPhase * 0.25 + Math.PI * 1.25);
    ctx.stroke();
    if (evolved) {
      ctx.strokeStyle = `rgba(110, 250, 255, ${0.82 * pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, s * 3.35, -legPhase * 0.32, -legPhase * 0.32 + Math.PI * 0.9);
      ctx.stroke();
    }
  } else if (skin === 'cosmic' && skinPal) {
    ctx.fillStyle = skinPal.glow;
    ctx.beginPath();
    ctx.arc(0, 0, s * (evolved ? 4.0 : 3.5), 0, Math.PI * 2);
    ctx.fill();
    // Per-class plasma thruster flame behind cosmic starship-ant
    ctx.fillStyle = skinPal.accent;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.moveTo(-2.7 * s, -0.45 * s);
    ctx.lineTo((-3.9 - 0.55 * Math.sin(legPhase * 1.6)) * s, 0);
    ctx.lineTo(-2.7 * s, 0.45 * s);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = isClone ? 0.86 : 1;
  } else if (skin === 'alien' && skinPal) {
    ctx.fillStyle = skinPal.glow;
    ctx.beginPath();
    ctx.arc(0, 0, s * (evolved ? 4.0 : 3.5), 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = evolved ? 'rgba(255, 228, 110, 0.32)' : `rgba(${r}, ${g}, ${b}, 0.2)`;
    ctx.beginPath();
    ctx.arc(0, 0, s * (evolved ? 3.8 : 3.2), 0, Math.PI * 2);
    ctx.fill();
  }

  // 1. Six 2-jointed (bent) articulated legs with realistic tripod gait!
  ctx.strokeStyle = `rgba(${Math.round(r * 0.85)}, ${Math.round(g * 0.85)}, ${Math.round(b * 0.85)}, 0.92)`;
  ctx.lineWidth = Math.max(1.0, s * 0.28);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const legAnchors = [-0.55 * s, 0.1 * s, 0.72 * s];
  const femurAngles = [2.32, 1.58, 0.88];
  const tibiaBends = [0.48, 0.22, -0.35];
  const femurLen = (type === 'scout' ? 1.35 : 1.08) * s;
  const tibiaLen = (type === 'scout' ? 1.4 : 1.05) * s;

  ctx.beginPath();
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
    ctx.moveTo(ax, -0.32 * s);
    ctx.lineTo(kxL, kyL);
    ctx.lineTo(fxL, fyL);

    // Right leg
    const faR = femurAngles[i] - swingR;
    const kxR = ax + Math.cos(faR) * femurLen;
    const kyR = 0.32 * s + Math.sin(faR) * femurLen;
    const taR = faR + tibiaBends[i];
    const fxR = kxR + Math.cos(taR) * tibiaLen;
    const fyR = kyR + Math.sin(taR) * tibiaLen;
    ctx.moveTo(ax, 0.32 * s);
    ctx.lineTo(kxR, kyR);
    ctx.lineTo(fxR, fyR);
  }
  ctx.stroke();

  // 2. Segmented Gaster (abdomen) with chitin highlight
  const abdRx = (type === 'queen' ? 2.05 : type === 'scout' ? 1.2 : skin === 'alien' ? 1.72 : 1.48) * s;
  const abdRy = (type === 'queen' ? 1.38 : type === 'scout' ? 0.68 : skin === 'alien' ? 0.86 : 0.96) * s;
  const abdX = (type === 'queen' ? -2.05 : skin === 'alien' ? -1.92 : -1.75) * s;

  ctx.fillStyle = skinPal
    ? skinPal.gaster
    : `rgb(${Math.round(r * 0.58)}, ${Math.round(g * 0.58)}, ${Math.round(b * 0.58)})`;
  ctx.beginPath();
  ctx.ellipse(abdX, 0, abdRx, abdRy, 0, 0, Math.PI * 2);
  ctx.fill();

  // Creepy xenomorph dorsal spines & tail stinger on Alien skin (per-class accent colors!)
  if (skin === 'alien') {
    ctx.strokeStyle = skinPal ? skinPal.trim : '#ff3b6b';
    ctx.lineWidth = Math.max(0.9, s * 0.24);
    ctx.beginPath();
    for (const frac of [-0.45, -0.05, 0.35]) {
      const bx = abdX + frac * abdRx;
      ctx.moveTo(bx, -abdRy * 0.72);
      ctx.lineTo(bx - 0.52 * s, -abdRy * 1.42);
      ctx.moveTo(bx, abdRy * 0.72);
      ctx.lineTo(bx - 0.52 * s, abdRy * 1.42);
    }
    // Tail barb
    ctx.moveTo(abdX - abdRx, 0);
    ctx.lineTo(abdX - abdRx - 0.85 * s, 0);
    ctx.stroke();
  }

  // Sleek swept energy-fins & glowing starlight rings on Cosmic skin (per-class hull colors!)
  if (skin === 'cosmic') {
    ctx.strokeStyle = skinPal ? skinPal.accent : '#7cf5ff';
    ctx.lineWidth = Math.max(1.0, s * 0.22);
    ctx.beginPath();
    ctx.moveTo(abdX + 0.4 * abdRx, -abdRy * 0.85);
    ctx.lineTo(abdX - 0.9 * abdRx, -abdRy * 1.55);
    ctx.lineTo(abdX - 0.5 * abdRx, -abdRy * 0.6);
    ctx.moveTo(abdX + 0.4 * abdRx, abdRy * 0.85);
    ctx.lineTo(abdX - 0.9 * abdRx, abdRy * 1.55);
    ctx.lineTo(abdX - 0.5 * abdRx, abdRy * 0.6);
    ctx.stroke();
  }

  // Subtle chitin segments on abdomen (batched into 1 stroke!)
  if (s >= 2.2 || skin !== 'classic') {
    ctx.strokeStyle =
      skinPal
        ? skinPal.accent
        : skin === 'cyber'
          ? '#70ffff'
          : skin === 'royal'
            ? '#ffd966'
            : `rgba(${r}, ${g}, ${b}, 0.55)`;
    ctx.lineWidth = Math.max(0.8, s * (skin === 'classic' ? 0.22 : 0.28));
    ctx.beginPath();
    for (const frac of [-0.32, 0.05, 0.38]) {
      const bx = abdX + frac * abdRx;
      const halfH = Math.sqrt(Math.max(0.05, 1 - frac * frac)) * abdRy * 0.88;
      ctx.moveTo(bx, -halfH);
      ctx.lineTo(bx, halfH);
    }
    ctx.stroke();
  }

  // Skin-specific armor outline on abdomen
  if (skin === 'cyber' || skin === 'royal' || skin === 'cosmic') {
    ctx.strokeStyle =
      skin === 'cosmic' && skinPal
        ? skinPal.trim
        : skin === 'cyber'
          ? 'rgba(112, 255, 255, 0.75)'
          : 'rgba(255, 217, 102, 0.85)';
    ctx.lineWidth = Math.max(0.9, s * 0.22);
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

  // Compound eyes (4 glowing per-class eyes on Alien skin, per-class glowing visor on Cosmic!)
  if (skin === 'alien') {
    const eyeR = Math.max(0.75, 0.25 * s);
    ctx.fillStyle = skinPal ? skinPal.eyePrimary : '#ff2a5f';
    ctx.beginPath();
    ctx.arc(headX + 0.28 * headRx, -0.52 * headRy, eyeR, 0, Math.PI * 2);
    ctx.arc(headX + 0.28 * headRx, 0.52 * headRy, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skinPal ? skinPal.eyeSecondary : '#c8ff3d';
    ctx.beginPath();
    ctx.arc(headX - 0.16 * headRx, -0.34 * headRy, eyeR * 0.72, 0, Math.PI * 2);
    ctx.arc(headX - 0.16 * headRx, 0.34 * headRy, eyeR * 0.72, 0, Math.PI * 2);
    ctx.fill();
  } else if (skin === 'cosmic') {
    ctx.strokeStyle = skinPal ? skinPal.eyePrimary : '#70ffff';
    ctx.lineWidth = Math.max(1.1, 0.34 * s);
    ctx.beginPath();
    ctx.arc(headX + 0.12 * headRx, 0, headRy * 0.72, -0.95, 0.95);
    ctx.stroke();
  } else {
    ctx.fillStyle = skin === 'cyber' ? '#00ffff' : skin === 'royal' ? '#ffe066' : '#07100c';
    const eyeR = Math.max(0.7, (skin === 'cyber' ? 0.28 : 0.22) * s);
    ctx.beginPath();
    ctx.arc(headX + 0.25 * headRx, -0.52 * headRy, eyeR, 0, Math.PI * 2);
    ctx.arc(headX + 0.25 * headRx, 0.52 * headRy, eyeR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Phase Ant quantum core diamond on thorax
  if (type === 'phantom') {
    ctx.fillStyle = '#d9b3ff';
    ctx.beginPath();
    ctx.moveTo(0.8 * s, 0);
    ctx.lineTo(0.18 * s, -0.45 * s);
    ctx.lineTo(-0.35 * s, 0);
    ctx.lineTo(0.18 * s, 0.45 * s);
    ctx.closePath();
    ctx.fill();
  }

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

  // 6. Curved Mandibles (animated snap when biting! Per-class accent fangs/plasma blades!)
  const openAmt = biteFlash > 0 ? 0.1 : 0.42;
  const mandLen = (type === 'warrior' ? 1.55 : skin === 'alien' ? 1.38 : evolved ? 1.15 : 0.82) * s;
  ctx.strokeStyle =
    skinPal
      ? skinPal.accent
      : isClone
        ? '#ffd890'
        : type === 'warrior' || evolved
          ? '#ffd859'
          : '#e8fff2';
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

  // Fast dual-scale hardware-filtered bloom canvases (zero ctx.filter='blur()' GPU stalls or black-buffer glitches!)
  private bloomCanvas: HTMLCanvasElement;
  private bloomCtx: CanvasRenderingContext2D;
  private bloomW = 1;
  private bloomH = 1;
  private bloomWideCanvas: HTMLCanvasElement;
  private bloomWideCtx: CanvasRenderingContext2D;
  private bloomWideW = 1;
  private bloomWideH = 1;

  private width = 0;
  private height = 0;
  private mobile = isMobileDevice();
  private lastWorldRef: World | null = null;
  private lastVisualVersion = -1;
  private lastRebuildMs = 0;
  private lastPulseMs = 0;

  // Pre-baked GPU-friendly dark atmospheric fractal backdrops per map (0 per-frame CPU cost on 100% cleared maps!)
  private darkBackdropCache = new Map<string, HTMLCanvasElement>();
  private cosmicStars: HTMLCanvasElement;

  constructor(width: number, height: number) {
    this.offscreen = document.createElement('canvas');
    this.offCtx = this.offscreen.getContext('2d')!;
    this.glowCanvas = document.createElement('canvas');
    this.glowCtx = this.glowCanvas.getContext('2d')!;
    this.bloomCanvas = document.createElement('canvas');
    this.bloomCtx = this.bloomCanvas.getContext('2d')!;
    this.bloomWideCanvas = document.createElement('canvas');
    this.bloomWideCtx = this.bloomWideCanvas.getContext('2d')!;
    this.imgData = this.offCtx.createImageData(1, 1);
    this.imgData32 = new Uint32Array(this.imgData.data.buffer);
    this.glowImgData = this.glowCtx.createImageData(1, 1);
    this.glowData32 = new Uint32Array(this.glowImgData.data.buffer);
    this.cosmicStars = this.buildStarfieldTile(256);
    this.resizeWorld(width, height);
  }

  /** Pre-renders a seamless tileable DARK atmospheric fractal backdrop tailored to each map's mood! */
  private getDarkBackdropTile(levelId: string): HTMLCanvasElement {
    const cached = this.darkBackdropCache.get(levelId);
    if (cached) return cached;

    const themes: Record<
      string,
      { base: [number, number, number]; mid: [number, number, number]; vein: [number, number, number]; mode: number }
    > = {
      prism: { base: [2, 6, 5], mid: [7, 22, 16], vein: [22, 68, 48], mode: 0 },
      galaxy: { base: [2, 3, 9], mid: [8, 13, 30], vein: [24, 48, 86], mode: 1 },
      'ant-crown': { base: [7, 4, 2], mid: [22, 13, 6], vein: [68, 42, 18], mode: 2 },
      'moon-temple': { base: [5, 3, 10], mid: [17, 10, 30], vein: [56, 26, 82], mode: 3 },
      'tree-of-life': { base: [2, 7, 7], mid: [8, 22, 20], vein: [22, 66, 56], mode: 4 },
      'crystal-hydra': { base: [2, 5, 10], mid: [7, 18, 32], vein: [24, 62, 92], mode: 5 },
      'ember-phoenix': { base: [9, 3, 2], mid: [28, 9, 7], vein: [84, 28, 16], mode: 6 },
      'void-leviathan': { base: [3, 2, 8], mid: [13, 7, 26], vein: [52, 20, 78], mode: 7 }
    };
    const th = themes[levelId] || themes.prism;
    const size = 256;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d')!;
    const img = g.createImageData(size, size);
    const d = img.data;
    const tau = Math.PI * 2;
    const m = th.mode;

    for (let y = 0; y < size; y++) {
      const ny = (y / size) * tau;
      for (let x = 0; x < size; x++) {
        const nx = (x / size) * tau;
        let f1 = 0;
        let f2 = 0;
        let filament = 0;
        if (m === 0 || m === 4) {
          // Deep organic subterranean smoke & moss filaments
          const wx = nx + Math.sin(ny * 2 + Math.cos(nx)) * 0.9;
          const wy = ny + Math.cos(nx * 2 - Math.sin(ny)) * 0.9;
          f1 = Math.sin(wx * 2 + wy) * 0.5 + 0.5;
          f2 = Math.cos(wx * 3 - wy * 2) * 0.5 + 0.5;
          filament = Math.pow(Math.max(0, 1 - Math.abs(f1 - f2) * 2.8), 3.4);
        } else if (m === 1 || m === 7) {
          // Dark cosmic void swirl & obsidian rift veins
          const wx = nx + Math.sin(ny * 3 + Math.sin(nx * 2)) * 0.7;
          const wy = ny + Math.cos(nx * 3 + Math.cos(ny * 2)) * 0.7;
          f1 = Math.sin(wx + wy * 2) * 0.5 + 0.5;
          f2 = Math.sin(wx * 2 - wy * 3 + Math.cos(wx)) * 0.5 + 0.5;
          filament = Math.pow(Math.max(0, 1 - Math.abs(f1 - 0.5) * 3.2), 3.6);
        } else if (m === 2 || m === 6) {
          // Dark ember / volcanic obsidian magma cracks
          const wx = nx + Math.cos(ny * 2 - nx) * 0.8;
          const wy = ny + Math.sin(nx * 2 + ny) * 0.8;
          f1 = Math.abs(Math.sin(wx * 2 + wy * 2));
          f2 = Math.abs(Math.cos(wx * 3 - wy));
          filament = Math.pow(Math.max(0, 1 - Math.min(f1, f2) * 3.1), 4.0);
        } else {
          // Crystalline lunar / glacial dark facet interference
          const wx = nx + Math.sin(ny * 2) * 0.55;
          const wy = ny + Math.sin(nx * 2) * 0.55;
          f1 = Math.cos(wx * 3 + wy * 3) * 0.5 + 0.5;
          f2 = Math.sin(wx * 4 - wy * 2) * 0.5 + 0.5;
          filament = Math.pow(Math.max(0, 1 - Math.abs(f1 - f2) * 3.0), 3.5);
        }

        const v = f1 * 0.55 + f2 * 0.45;
        const p = (y * size + x) * 4;
        d[p] = Math.min(255, Math.round(th.base[0] + v * th.mid[0] + filament * th.vein[0]));
        d[p + 1] = Math.min(255, Math.round(th.base[1] + v * th.mid[1] + filament * th.vein[1]));
        d[p + 2] = Math.min(255, Math.round(th.base[2] + v * th.mid[2] + filament * th.vein[2]));
        d[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    this.darkBackdropCache.set(levelId, c);
    return c;
  }

  private buildStarfieldTile(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d')!;
    let seed = 133791;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };
    for (let i = 0; i < 62; i++) {
      const sx = Math.floor(rnd() * size);
      const sy = Math.floor(rnd() * size);
      const bright = 0.14 + rnd() * 0.44;
      const huePick = i % 4;
      g.fillStyle =
        huePick === 0
          ? `rgba(155, 210, 235, ${bright})`
          : huePick === 1
            ? `rgba(195, 160, 235, ${bright})`
            : huePick === 2
              ? `rgba(140, 215, 185, ${bright})`
              : `rgba(235, 215, 175, ${bright})`;
      const r = rnd() > 0.88 ? 2 : 1;
      g.fillRect(sx, sy, r, r);
    }
    return c;
  }

  private drawCosmicClearBackdrop(
    ctx: CanvasRenderingContext2D,
    viewW: number,
    viewH: number,
    camera: Camera,
    time: number,
    levelId: string
  ) {
    const tex = this.getDarkBackdropTile(levelId);
    const tile = tex.width;
    const scale = 1.45;
    const step = tile * scale;

    // Layer 1: deep dark drifting fractal abyss
    const ox1 = (((-camera.x * 0.4 + time * 5.5) % step) + step) % step;
    const oy1 = (((-camera.y * 0.4 + time * 3.8) % step) + step) % step;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    for (let y = oy1 - step; y < viewH; y += step) {
      for (let x = ox1 - step; x < viewW; x += step) {
        ctx.drawImage(tex, x, y, step + 1, step + 1);
      }
    }

    // Layer 2: subtle counter-drifting dark veil interference (moody & restrained!)
    const step2 = tile * 2.05;
    const ox2 = (((-camera.x * 0.22 - time * 4.2) % step2) + step2) % step2;
    const oy2 = (((-camera.y * 0.22 + time * 5.0) % step2) + step2) % step2;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18 + 0.05 * Math.sin(time * 0.7);
    for (let y = oy2 - step2; y < viewH; y += step2) {
      for (let x = ox2 - step2; x < viewW; x += step2) {
        ctx.drawImage(tex, x, y, step2 + 1, step2 + 1);
      }
    }

    // Layer 3: dim distant atmospheric dust/starlight
    const ox3 = (((-camera.x * 0.65 + time * 2.6) % tile) + tile) % tile;
    const oy3 = (((-camera.y * 0.65 - time * 1.8) % tile) + tile) % tile;
    ctx.globalAlpha = 0.34 + 0.12 * Math.sin(time * 1.5);
    for (let y = oy3 - tile; y < viewH; y += tile) {
      for (let x = ox3 - tile; x < viewW; x += tile) {
        ctx.drawImage(this.cosmicStars, x, y);
      }
    }

    // Soft dark vignette framing the cleared artwork so the glowing picture pops dramatically!
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const vig = ctx.createRadialGradient(
      viewW * 0.5,
      viewH * 0.5,
      Math.min(viewW, viewH) * 0.22,
      viewW * 0.5,
      viewH * 0.5,
      Math.max(viewW, viewH) * 0.72
    );
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.56)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.restore();
  }

  resizeWorld(width: number, height: number) {
    this.mobile = isMobileDevice();
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

    this.bloomW = Math.max(1, Math.ceil(width * 0.36));
    this.bloomH = Math.max(1, Math.ceil(height * 0.36));
    this.bloomCanvas.width = this.bloomW;
    this.bloomCanvas.height = this.bloomH;

    this.bloomWideW = Math.max(1, Math.ceil(width * 0.15));
    this.bloomWideH = Math.max(1, Math.ceil(height * 0.15));
    this.bloomWideCanvas.width = this.bloomWideW;
    this.bloomWideCanvas.height = this.bloomWideH;
    this.lastVisualVersion = -1;
  }

  private rebuildWorldTextures(world: World, time: number, minX = 0, minY = 0, maxX = world.width - 1, maxY = world.height - 1) {
    const w = world.width;
    const h = world.height;
    const rx0 = Math.max(0, Math.min(w - 1, minX | 0));
    const ry0 = Math.max(0, Math.min(h - 1, minY | 0));
    const rx1 = Math.max(rx0, Math.min(w - 1, maxX | 0));
    const ry1 = Math.max(ry0, Math.min(h - 1, maxY | 0));
    const data = this.imgData.data;
    const data32 = this.imgData32;
    const glow = this.glowImgData.data;
    const glow32 = this.glowData32;
    const cells = world.cells;
    const hp = world.hp;
    const maxHp = world.maxHp;
    const isEdge = world.isEdge;
    const revealed = world.revealedMask;
    const interior = world.interiorMask;
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
    // When the map is 100% cleared, exterior pixels outside HiddenArt become transparent (alpha=0) so the animated cosmic fractal backdrop shines through!
    const exteriorPacked = cleared ? 0 : bgPacked;
    const sugarExp = world.sugarExposed;
    const artDefExp = world.artifactExposed;

    for (let y = ry0; y <= ry1; y++) {
      const row = y * w;
      for (let x = rx0; x <= rx1; x++) {
        const idx = row + x;
        const cell = cells[idx] as CellType;
        glow32[idx] = 0;

        // Exterior void or sealed art interior silhouettes NEVER display stray terrain crumbs or edges!
        if (
          cell !== CellType.HiddenArt &&
          cell !== CellType.Sugar &&
          cell !== CellType.Artifact &&
          interior[idx] === 0
        ) {
          data32[idx] = exteriorPacked;
          continue;
        }

        if (cell === CellType.Empty) {
          data32[idx] = emptyPacked;
          continue;
        }

        // Belt-and-suspenders guarantee: on 100% map clear, ONLY HiddenArt, Sugar & uncollected Artifact render!
        if (cleared && cell !== CellType.HiddenArt && cell !== CellType.Sugar && cell !== CellType.Artifact) {
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

    const rw = rx1 - rx0 + 1;
    const rh = ry1 - ry0 + 1;
    this.offCtx.putImageData(this.imgData, 0, 0, rx0, ry0, rw, rh);
    this.glowCtx.putImageData(this.glowImgData, 0, 0, rx0, ry0, rw, rh);

    // Fast hardware bilinear downsample bloom (single pass on mobile, dual-scale on desktop — zero ctx.filter stalls!)
    this.bloomCtx.clearRect(0, 0, this.bloomW, this.bloomH);
    this.bloomCtx.imageSmoothingEnabled = true;
    this.bloomCtx.drawImage(this.glowCanvas, 0, 0, this.bloomW, this.bloomH);

    if (!this.mobile) {
      this.bloomWideCtx.clearRect(0, 0, this.bloomWideW, this.bloomWideH);
      this.bloomWideCtx.imageSmoothingEnabled = true;
      this.bloomWideCtx.drawImage(this.bloomCanvas, 0, 0, this.bloomWideW, this.bloomWideH);
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
    evos: boolean | { worker?: boolean; warrior?: boolean; scout?: boolean; queen?: boolean; phantom?: boolean; phantomSparkRadius?: number } = false,
    skin: AntSkinId = 'classic'
  ) {
    const workerEvo = typeof evos === 'boolean' ? evos : Boolean(evos.worker);
    const warriorEvo = typeof evos === 'boolean' ? false : Boolean(evos.warrior);
    const scoutEvo = typeof evos === 'boolean' ? false : Boolean(evos.scout);
    const queenEvo = typeof evos === 'boolean' ? false : Boolean(evos.queen);
    const phantomEvo = typeof evos === 'boolean' ? false : Boolean(evos.phantom);
    const phantomSparkRadius = typeof evos === 'boolean' ? 5.4 : evos.phantomSparkRadius || 5.4;
    if (world.width !== this.width || world.height !== this.height) {
      this.resizeWorld(world.width, world.height);
    }

    const w = world.width;
    const h = world.height;
    const pal = world.level.palette;
    const mobile = this.mobile;
    const now = performance.now();

    const z = camera.zoom;
    const drawX = viewW * 0.5 - camera.x * z;
    const drawY = viewH * 0.5 - camera.y * z;

    // 9-arg viewport-clipped bounds: used both for GPU blit AND zero-lag viewport-clipped pulse updates on huge 930x608 maps!
    const srcX = Math.max(0, Math.floor(-drawX / z) - 1);
    const srcY = Math.max(0, Math.floor(-drawY / z) - 1);
    const srcX2 = Math.min(w, Math.ceil((viewW - drawX) / z) + 1);
    const srcY2 = Math.min(h, Math.ceil((viewH - drawY) / z) + 1);
    const srcW = srcX2 - srcX;
    const srcH = srcY2 - srcY;

    const worldChanged = this.lastWorldRef !== world;
    const dirty = world.visualVersion !== this.lastVisualVersion;
    const elapsedSinceRebuild = now - this.lastRebuildMs;
    const elapsedSincePulse = now - this.lastPulseMs;
    const isLargeMap = w * h > 260000;
    const animInterval = mobile
      ? world.stats.mapCleared ? 115 : isLargeMap ? 220 : 165
      : world.stats.mapCleared ? 42 : isLargeMap ? 95 : 62;
    const dirtyInterval = mobile ? 42 : 14;
    const forceBurstRebuild = dirty && sugarBurst !== null && sugarBurst.progress < 0.08;

    if (worldChanged || forceBurstRebuild) {
      world.consumeDirtyRect();
      this.rebuildWorldTextures(world, time, 0, 0, w - 1, h - 1);
      this.lastWorldRef = world;
      this.lastVisualVersion = world.visualVersion;
      this.lastRebuildMs = now;
      this.lastPulseMs = now;
    } else if (dirty && elapsedSinceRebuild >= dirtyInterval) {
      const rect = world.consumeDirtyRect();
      if (!rect || rect.full) {
        this.rebuildWorldTextures(world, time, 0, 0, w - 1, h - 1);
      } else {
        this.rebuildWorldTextures(world, time, rect.minX, rect.minY, rect.maxX, rect.maxY);
      }
      this.lastVisualVersion = world.visualVersion;
      this.lastRebuildMs = now;
    } else if (elapsedSincePulse >= animInterval && srcW > 0 && srcH > 0) {
      // Shimmer pulse ONLY inside visible viewport pixels -> blazing fast even on 930x608 maps!
      this.rebuildWorldTextures(world, time, srcX, srcY, Math.min(w - 1, srcX2), Math.min(h - 1, srcY2));
      this.lastPulseMs = now;
    }

    // Fill outer canvas with exact level palette OR moody dark animated fractal backdrop tailored to each map on 100% clear!
    if (world.stats.mapCleared) {
      this.drawCosmicClearBackdrop(ctx, viewW, viewH, camera, time, world.level.id);
    } else {
      ctx.fillStyle = pal.bgHex;
      ctx.fillRect(0, 0, viewW, viewH);
    }

    ctx.save();
    if (srcW > 0 && srcH > 0) {
      const dstX = drawX + srcX * z;
      const dstY = drawY + srcY * z;
      const dstW = srcW * z;
      const dstH = srcH * z;

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.offscreen, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);

      // Hardware bilinear bloom pass (single-pass on mobile cuts fullscreen overdraw in half!)
      ctx.globalCompositeOperation = 'lighter';
      ctx.imageSmoothingEnabled = true;

      const bSx = (srcX / w) * this.bloomW;
      const bSy = (srcY / h) * this.bloomH;
      const bSw = (srcW / w) * this.bloomW;
      const bSh = (srcH / h) * this.bloomH;

      if (mobile) {
        ctx.globalAlpha = world.stats.mapCleared ? 0.72 : 0.48;
        ctx.drawImage(this.bloomCanvas, bSx, bSy, bSw, bSh, dstX, dstY, dstW, dstH);
      } else {
        const bwSx = (srcX / w) * this.bloomWideW;
        const bwSy = (srcY / h) * this.bloomWideH;
        const bwSw = (srcW / w) * this.bloomWideW;
        const bwSh = (srcH / h) * this.bloomWideH;
        ctx.globalAlpha = world.stats.mapCleared ? 0.62 : 0.42;
        ctx.drawImage(this.bloomWideCanvas, bwSx, bwSy, bwSw, bwSh, dstX, dstY, dstW, dstH);

        ctx.globalAlpha = world.stats.mapCleared ? 0.56 : 0.38;
        ctx.drawImage(this.bloomCanvas, bSx, bSy, bSw, bSh, dstX, dstY, dstW, dstH);

        ctx.globalAlpha = world.stats.mapCleared ? 0.34 : 0.22;
        ctx.drawImage(this.glowCanvas, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
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

    // Epic Cinematic Diamond-Sugar Discovery Sequence: Impact Flash + Cathedral God-Rays + 4 Prismatic Shockwaves + Levitating Shards!
    if (sugarBurst && sugarBurst.progress >= 0 && sugarBurst.progress < 1) {
      const p = sugarBurst.progress;
      const sx = drawX + (sugarBurst.x + 0.5) * camera.zoom;
      const sy = drawY + (sugarBurst.y + 0.5) * camera.zoom;
      const fade = Math.pow(1 - p, 1.25);

      // 1. Brief dramatic golden-white full-screen impact flash veil (p = 0..0.24)
      if (p < 0.24) {
        const flashAlpha = Math.pow(1 - p / 0.24, 1.6) * 0.42;
        const flashGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(viewW, viewH) * 0.82);
        flashGrad.addColorStop(0, `rgba(255, 255, 240, ${Math.min(0.65, flashAlpha * 1.4)})`);
        flashGrad.addColorStop(0.35, `rgba(255, 232, 130, ${flashAlpha})`);
        flashGrad.addColorStop(1, 'rgba(255, 210, 90, 0)');
        ctx.fillStyle = flashGrad;
        ctx.fillRect(0, 0, viewW, viewH);
      }

      // 2. 12 rotating golden & diamond-cyan cathedral god-rays reusing ONLY 2 radial gradients (zero GC/GPU churn!)
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(time * 0.62);
      const beamLen = Math.max(140, Math.min(Math.max(viewW, viewH) * 0.8, camera.zoom * (20 + p * 42)));
      const minorLen = beamLen * 0.78;
      const majorPulse = 0.88 + 0.12 * Math.sin(time * 5.2);
      const minorPulse = 0.88 + 0.12 * Math.cos(time * 6.0);

      const majorGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, beamLen);
      majorGrad.addColorStop(0, `rgba(255, 254, 232, ${0.68 * fade * majorPulse})`);
      majorGrad.addColorStop(0.42, `rgba(255, 224, 102, ${0.34 * fade * majorPulse})`);
      majorGrad.addColorStop(1, 'rgba(255, 224, 102, 0)');

      ctx.fillStyle = majorGrad;
      ctx.beginPath();
      for (let r = 0; r < 6; r++) {
        const ang = (r / 6) * Math.PI * 2;
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, beamLen, ang - 0.105, ang + 0.105);
        ctx.closePath();
      }
      ctx.fill();

      const minorGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, minorLen);
      minorGrad.addColorStop(0, `rgba(215, 252, 255, ${0.5 * fade * minorPulse})`);
      minorGrad.addColorStop(0.45, `rgba(110, 234, 255, ${0.24 * fade * minorPulse})`);
      minorGrad.addColorStop(1, 'rgba(110, 234, 255, 0)');

      ctx.fillStyle = minorGrad;
      ctx.beginPath();
      for (let r = 0; r < 6; r++) {
        const ang = ((r + 0.5) / 6) * Math.PI * 2;
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, minorLen, ang - 0.055, ang + 0.055);
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();

      // 3. 4 staggered chromatic shockwave rings (white flash -> gold -> ice cyan -> prism violet!)
      const ringColors: [number, number, number][] = [
        [255, 255, 240],
        [255, 228, 112],
        [145, 245, 255],
        [226, 155, 255]
      ];
      for (let wIdx = 0; wIdx < 4; wIdx++) {
        const wp = Math.max(0, Math.min(1, (p - wIdx * 0.095) / 0.68));
        if (wp <= 0 || wp >= 1) continue;
        const eased = 1 - Math.pow(1 - wp, 2.5);
        const rad = Math.max(14, camera.zoom * (2.5 + eased * (26 + wIdx * 11)));
        const alpha = (1 - wp) * (wIdx === 0 ? 0.96 : 0.72);
        const [rr, rg, rb] = ringColors[wIdx];
        ctx.strokeStyle = `rgba(${rr}, ${rg}, ${rb}, ${alpha})`;
        ctx.lineWidth = Math.max(1.6, (1 - wp) * (wIdx === 0 ? 5.5 : 4.0));
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 4. Levitating diamond crystal shards rising majestically from the Sugar cube!
      const shardCount = 12;
      for (let k = 0; k < shardCount; k++) {
        const seed = k * 2.39996;
        const rise = ((p * 2.4 + (k % 5) * 0.17) % 1);
        const driftX = Math.cos(seed + time * 1.4) * camera.zoom * (1.8 + rise * 4.6);
        const driftY = -rise * camera.zoom * 14.5 + Math.sin(seed) * camera.zoom * 1.8;
        const shAlpha = Math.sin(rise * Math.PI) * fade * 0.95;
        if (shAlpha <= 0.02) continue;
        const sz = Math.max(2.6, camera.zoom * (0.48 + (k % 3) * 0.16));
        const px = sx + driftX;
        const py = sy + driftY;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(time * 2.4 + seed);
        ctx.fillStyle = k % 3 === 0 ? `rgba(175, 248, 255, ${shAlpha})` : `rgba(255, 242, 168, ${shAlpha})`;
        ctx.beginPath();
        ctx.moveTo(0, -sz * 1.35);
        ctx.lineTo(sz * 0.75, 0);
        ctx.lineTo(0, sz * 1.35);
        ctx.lineTo(-sz * 0.75, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 5. Cut-diamond diffraction starburst cross (+ and × spikes) + radiant core!
      const coreR = Math.max(22, camera.zoom * (6.2 + Math.sin(p * Math.PI) * 5.8));
      const coreGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, coreR);
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.95 * fade})`);
      coreGrad.addColorStop(0.38, `rgba(255, 238, 148, ${0.52 * fade})`);
      coreGrad.addColorStop(1, 'rgba(255, 234, 138, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, coreR, 0, Math.PI * 2);
      ctx.fill();

      const spikeLen = Math.max(36, camera.zoom * (8.5 + Math.sin(p * Math.PI) * 8.5));
      const spGrad = ctx.createLinearGradient(-spikeLen, 0, spikeLen, 0);
      spGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      spGrad.addColorStop(0.5, `rgba(255, 254, 235, ${0.92 * fade})`);
      spGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.sin(time * 2.2) * 0.12);
      ctx.fillStyle = spGrad;
      for (let sp = 0; sp < 4; sp++) {
        ctx.rotate(Math.PI * 0.25);
        const len = sp % 2 === 0 ? spikeLen : spikeLen * 0.62;
        const wHalf = Math.max(1.8, camera.zoom * (sp % 2 === 0 ? 0.34 : 0.22));
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(0, -wHalf);
        ctx.lineTo(len, 0);
        ctx.lineTo(0, wHalf);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
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

    // Pulsing Pheromone Beacon (attracts free Workers & Queen Brood for 30s with radial countdown ring!)
    if (beacon) {
      const bx = drawX + beacon.x * camera.zoom;
      const by = drawY + beacon.y * camera.zoom;
      const frac = Math.max(0, Math.min(1, beacon.timeLeft / Math.max(1, beacon.maxDuration)));
      const fade = beacon.timeLeft < 3 ? Math.max(0.25, beacon.timeLeft / 3) : 1;
      const wave1 = (time * 0.75) % 1;
      const wave2 = (time * 0.75 + 0.5) % 1;
      for (const wv of [wave1, wave2]) {
        const rad = Math.max(8, camera.zoom * (2.5 + wv * 10));
        ctx.strokeStyle = `rgba(66, 245, 197, ${(1 - wv) * 0.7 * fade})`;
        ctx.lineWidth = Math.max(1.4, (1 - wv) * 2.6);
        ctx.beginPath();
        ctx.arc(bx, by, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Crisp radial remaining-time arc right around the beacon!
      const ringR = Math.max(11, camera.zoom * 3.1);
      ctx.strokeStyle = `rgba(66, 245, 197, ${0.22 * fade})`;
      ctx.lineWidth = Math.max(1.8, camera.zoom * 0.32);
      ctx.beginPath();
      ctx.arc(bx, by, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(145, 255, 224, ${0.92 * fade})`;
      ctx.lineWidth = Math.max(2.2, camera.zoom * 0.38);
      ctx.beginPath();
      ctx.arc(bx, by, ringR, -Math.PI * 0.5, -Math.PI * 0.5 + frac * Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(66, 245, 197, ${0.26 * fade})`;
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(7, camera.zoom * 2.2), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(168, 255, 234, ${fade})`;
      ctx.beginPath();
      ctx.arc(bx, by, Math.max(2.6, camera.zoom * 0.75), 0, Math.PI * 2);
      ctx.fill();
    }

    // Queen royal buff aura rings (visualizes exact 13px or 26px Evolved Queen buff radius!)
    for (let i = 0; i < ants.length; i++) {
      const ant = ants[i];
      if (ant.type !== 'queen') continue;
      const qx = drawX + ant.x * camera.zoom;
      const qy = drawY + ant.y * camera.zoom;
      const auraR = (queenEvo ? QUEEN_AURA_RADIUS * 2 : QUEEN_AURA_RADIUS) * camera.zoom;
      if (qx + auraR < -10 || qx - auraR > viewW + 10 || qy + auraR < -10 || qy - auraR > viewH + 10) continue;
      const pulse = 0.22 + 0.12 * Math.sin(time * 3.4 + ant.id);
      ctx.fillStyle = queenEvo ? `rgba(240, 105, 255, ${pulse * 0.34})` : `rgba(224, 75, 255, ${pulse * 0.28})`;
      ctx.beginPath();
      ctx.arc(qx, qy, auraR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = queenEvo ? `rgba(255, 224, 120, ${pulse + 0.22})` : `rgba(255, 200, 120, ${pulse + 0.14})`;
      ctx.lineWidth = Math.max(1.1, camera.zoom * (queenEvo ? 0.26 : 0.22));
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(qx, qy, auraR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Phase Ant Quantum Sparks field (40 SP mutation): calm, sleek quantum arcs (no visual noise!) scaling with Spark Overload!
    if (phantomEvo) {
      const sparkFieldR = phantomSparkRadius * camera.zoom;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let i = 0; i < ants.length; i++) {
        const ant = ants[i];
        if (ant.type !== 'phantom') continue;
        const px = drawX + ant.x * camera.zoom;
        const py = drawY + ant.y * camera.zoom;
        if (px + sparkFieldR < -12 || px - sparkFieldR > viewW + 12 || py + sparkFieldR < -12 || py - sparkFieldR > viewH + 12) continue;

        const pulse = 0.78 + 0.22 * Math.sin(time * 3.8 + ant.id);
        // Subtle calm quantum field rim
        ctx.fillStyle = `rgba(98, 224, 245, ${0.06 * pulse})`;
        ctx.beginPath();
        ctx.arc(px, py, sparkFieldR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(130, 232, 255, ${0.24 * pulse})`;
        ctx.lineWidth = Math.max(0.8, camera.zoom * 0.13);
        ctx.beginPath();
        ctx.arc(px, py, sparkFieldR, 0, Math.PI * 2);
        ctx.stroke();

        // 3 calm smoothly rotating electric arcs (gentle cadence, easy on the eyes!)
        const tickBucket = Math.floor(time * 5.5);
        for (let b = 0; b < 3; b++) {
          const seed = ant.id * 29 + b * 19 + tickBucket * 11;
          const h1 = Math.sin(seed * 12.9898) * 43758.5453;
          const f1 = h1 - Math.floor(h1);
          const h2 = Math.sin((seed + 7) * 78.233) * 43758.5453;
          const f2 = h2 - Math.floor(h2);
          const ang = (b / 3) * Math.PI * 2 + time * 0.9 + f1 * 0.55;
          const reach = sparkFieldR * (0.68 + f2 * 0.3);
          const midAng = ang + (f1 - 0.5) * 0.36;
          const midR = reach * 0.54;
          const mx = px + Math.cos(midAng) * midR;
          const my = py + Math.sin(midAng) * midR;
          const ex = px + Math.cos(ang) * reach;
          const ey = py + Math.sin(ang) * reach;

          ctx.strokeStyle = `rgba(145, 240, 255, ${0.56 * pulse})`;
          ctx.lineWidth = Math.max(0.9, camera.zoom * 0.15);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(mx, my);
          ctx.lineTo(ex, ey);
          ctx.stroke();

          ctx.fillStyle = `rgba(220, 252, 255, ${0.72 * pulse})`;
          ctx.beginPath();
          ctx.arc(ex, ey, Math.max(0.9, camera.zoom * 0.17), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Floating particles (fast crisp pixel squares on mobile, soft circles on desktop)
    for (let i = 0; i < particles.particles.length; i++) {
      const pt = particles.particles[i];
      const alpha = Math.max(0, Math.min(1, pt.life / pt.maxLife));
      const sx = drawX + pt.x * camera.zoom;
      const sy = drawY + pt.y * camera.zoom;
      if (sx < -12 || sx > viewW + 12 || sy < -12 || sy > viewH + 12) continue;
      const rad = Math.max(1.4, pt.size * camera.zoom * 0.4);
      ctx.fillStyle = `rgba(${pt.r}, ${pt.g}, ${pt.b}, ${alpha})`;
      if (mobile) {
        const d = rad * 2;
        ctx.fillRect(sx - rad, sy - rad, d, d);
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalCompositeOperation = 'source-over';

    // Draw detailed articulated ants
    for (let i = 0; i < ants.length; i++) {
      const ant = ants[i];
      const sx = drawX + ant.x * camera.zoom;
      const sy = drawY + ant.y * camera.zoom;
      if (sx < -36 || sx > viewW + 36 || sy < -36 || sy > viewH + 36) continue;
      const isEvo =
        (ant.type === 'worker' && workerEvo) ||
        (ant.type === 'warrior' && warriorEvo && !ant.isWarriorClone) ||
        (ant.type === 'scout' && scoutEvo) ||
        (ant.type === 'queen' && queenEvo) ||
        (ant.type === 'phantom' && phantomEvo);
      drawDetailedAnt(
        ctx,
        ant.type,
        sx,
        sy,
        ant.angle,
        ant.legPhase,
        ant.biteFlash,
        camera.zoom,
        skin,
        undefined,
        isEvo,
        Boolean(ant.isWarriorClone)
      );
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
