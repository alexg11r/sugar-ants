import { loc } from './i18n';
import { Language, LevelDefinition } from './types';

export interface ArtworkRenderOptions {
  cleared100?: boolean;
  scale?: number;
  withFrame?: boolean;
  lang?: Language;
}

/**
 * Deterministically renders any Sugar Ants map's hidden pixel artwork onto a crisp,
 * luminous Canvas (with optional iridescent rainbow shimmer when 100% cleared!).
 */
export function renderArtworkToCanvas(
  level: LevelDefinition,
  options: ArtworkRenderOptions = {}
): HTMLCanvasElement {
  const { cleared100 = false, scale = 2, withFrame = false, lang } = options;
  const w = level.width;
  const h = level.height;
  const mask = level.generateArt(w, h);
  const pal = level.palette;

  const padX = withFrame ? Math.round(20 * scale) : 0;
  const padTop = withFrame ? Math.round(16 * scale) : 0;
  const footerH = withFrame ? Math.round(36 * scale) : 0;
  const artW = Math.round(w * scale);
  const artH = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = artW + padX * 2;
  canvas.height = artH + padTop + footerH;
  const ctx = canvas.getContext('2d')!;

  // 1. Deep atmospheric subterranean backdrop gradient
  const [er, eg, eb] = pal.emptyRgb;
  const [br, bg, bb] = pal.bgRgb;
  const grad = ctx.createRadialGradient(
    canvas.width * 0.5,
    padTop + artH * 0.5,
    Math.min(artW, artH) * 0.08,
    canvas.width * 0.5,
    padTop + artH * 0.5,
    Math.max(artW, artH) * 0.68
  );
  grad.addColorStop(0, `rgb(${Math.min(255, br + 12)}, ${Math.min(255, bg + 14)}, ${Math.min(255, bb + 14)})`);
  grad.addColorStop(0.65, `rgb(${Math.round((er + br) * 0.55)}, ${Math.round((eg + bg) * 0.55)}, ${Math.round((eb + bb) * 0.55)})`);
  grad.addColorStop(1, `rgb(${er}, ${eg}, ${eb})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle ambient starfield dust speckles (deterministic per level)
  ctx.save();
  let seed = 2166136261;
  for (let i = 0; i < level.id.length; i++) {
    seed ^= level.id.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const rand = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const [gr, gg, gb] = pal.artGlowRgb;
  for (let i = 0; i < 90; i++) {
    const sx = rand() * canvas.width;
    const sy = rand() * (padTop + artH);
    const alpha = 0.08 + rand() * 0.24;
    const sz = Math.max(1, Math.round(scale * (0.45 + rand() * 0.55)));
    ctx.fillStyle = `rgba(${gr}, ${gg}, ${gb}, ${alpha.toFixed(2)})`;
    ctx.fillRect(sx, sy, sz, sz);
  }
  ctx.restore();

  // 2. Build 1px native offscreen art layer (standard luminous white-tint OR 100% prismatic iridescent!)
  const artCanvas = document.createElement('canvas');
  artCanvas.width = w;
  artCanvas.height = h;
  const actx = artCanvas.getContext('2d')!;
  const img = actx.createImageData(w, h);
  const d = img.data;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      if (mask[idx] !== 1) continue;
      const p = idx * 4;
      if (cleared100) {
        const wave = x * 0.028 + y * 0.022;
        const r = Math.min(255, Math.round(205 + 50 * Math.sin(wave)));
        const g = Math.min(255, Math.round(205 + 50 * Math.sin(wave + 2.094)));
        const b = Math.min(255, Math.round(205 + 50 * Math.sin(wave + 4.188)));
        d[p] = r;
        d[p + 1] = g;
        d[p + 2] = b;
        d[p + 3] = 255;
      } else {
        d[p] = Math.min(255, Math.round(gr * 0.45 + 145));
        d[p + 1] = Math.min(255, Math.round(gg * 0.45 + 145));
        d[p + 2] = Math.min(255, Math.round(gb * 0.45 + 145));
        d[p + 3] = 255;
      }
    }
  }
  actx.putImageData(img, 0, 0);

  // 3. Soft multi-pass neon bloom halo + razor-sharp pixel art foreground!
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.filter = `blur(${Math.max(4, Math.round(4.5 * scale))}px)`;
  ctx.globalAlpha = cleared100 ? 0.85 : 0.65;
  ctx.drawImage(artCanvas, padX, padTop, artW, artH);

  ctx.filter = `blur(${Math.max(2, Math.round(1.6 * scale))}px)`;
  ctx.globalAlpha = cleared100 ? 0.65 : 0.45;
  ctx.drawImage(artCanvas, padX, padTop, artW, artH);
  ctx.restore();

  // Sharp crisp pixel layer
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(artCanvas, padX, padTop, artW, artH);
  ctx.restore();

  // 4. Optional sleek collector's frame & title plaque for PNG export
  if (withFrame) {
    ctx.save();
    // Subtle corner border frame
    ctx.strokeStyle = cleared100 ? 'rgba(255, 232, 136, 0.45)' : 'rgba(140, 230, 185, 0.25)';
    ctx.lineWidth = Math.max(1, scale * 0.6);
    ctx.strokeRect(
      Math.round(padX * 0.45),
      Math.round(padTop * 0.45),
      canvas.width - Math.round(padX * 0.9),
      canvas.height - Math.round(padTop * 0.9)
    );

    const isEnglish = lang ? lang === 'en' : false;
    const title = isEnglish ? level.nameEn : loc(level.name, level.nameEn);
    const sub = isEnglish ? level.subtitleEn : loc(level.subtitle, level.subtitleEn);
    const baseY = padTop + artH + Math.round(footerH * 0.56);

    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(11 * scale)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`SUGAR ANTS  •  ${title.toUpperCase()}`, padX, baseY - Math.round(3 * scale));

    ctx.font = `500 ${Math.round(6.8 * scale)}px "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(196, 224, 210, 0.78)';
    ctx.fillText(sub, padX, baseY + Math.round(8 * scale));

    if (cleared100) {
      const badge = '★ 100% MASTERPIECE';
      ctx.font = `800 ${Math.round(8.5 * scale)}px "Segoe UI", system-ui, sans-serif`;
      const bw = ctx.measureText(badge).width;
      ctx.fillStyle = '#ffe26a';
      ctx.fillText(badge, canvas.width - padX - bw, baseY);
    }
    ctx.restore();
  }

  return canvas;
}

/** Exports the map's glowing pixel artwork directly as a crisp high-resolution PNG file! */
export function downloadArtworkPng(
  level: LevelDefinition,
  cleared100: boolean,
  lang: Language
): boolean {
  try {
    const canvas = renderArtworkToCanvas(level, {
      cleared100,
      scale: 3,
      withFrame: true,
      lang
    });
    const filename = `sugar-ants-${level.id}${cleared100 ? '-100pct' : ''}.png`;
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }, 'image/png');
    } else {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    return true;
  } catch {
    return false;
  }
}
