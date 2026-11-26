import { getOptimalDpr, isMobileDevice } from '../core/device';
import { drawDetailedAnt, UNEXPLORED_BG_HEX } from '../core/renderer';
import { AntSkinId, AntTypeId } from '../core/types';

interface MenuAnt {
  type: AntTypeId;
  x: number;
  y: number;
  angle: number;
  speed: number;
  legPhase: number;
  turnTimer: number;
  trail: { x: number; y: number }[];
}

export class MenuBackground {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bgCache: HTMLCanvasElement;
  private bgCacheCtx: CanvasRenderingContext2D;
  private ants: MenuAnt[] = [];
  private rafId = 0;
  private running = false;
  private lastTime = 0;
  private lastRenderMs = 0;
  private elapsed = 0;
  private viewW = 1;
  private viewH = 1;
  private mobile = false;
  private skin: AntSkinId = 'classic';
  private pointer: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };
  private motes: { x: number; y: number; r: number; spd: number; phase: number; gold: boolean }[] = [];
  private boopSparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.bgCache = document.createElement('canvas');
    this.bgCacheCtx = this.bgCache.getContext('2d', { alpha: false })!;
    this.resize();
    this.spawnAnts();

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.pointer.active = true;
    });
    window.addEventListener('pointerleave', () => {
      this.pointer.active = false;
    });
  }

  private resize() {
    this.mobile = isMobileDevice();
    const dpr = getOptimalDpr();
    this.viewW = Math.max(1, window.innerWidth);
    this.viewH = Math.max(1, window.innerHeight);
    this.canvas.width = Math.floor(this.viewW * dpr);
    this.canvas.height = Math.floor(this.viewH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.rebuildBgCache();
  }

  /** Pre-renders the expensive full-screen radial gradient (and static strata on mobile) ONCE on resize */
  private rebuildBgCache() {
    const w = this.viewW;
    const h = this.viewH;
    this.bgCache.width = w;
    this.bgCache.height = h;
    const bctx = this.bgCacheCtx;

    bctx.fillStyle = UNEXPLORED_BG_HEX;
    bctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.48;
    const maxR = Math.hypot(w, h) * 0.72;
    const grad = bctx.createRadialGradient(cx, cy, 30, cx, cy, maxR);
    grad.addColorStop(0, 'rgba(20, 68, 42, 0.34)');
    grad.addColorStop(0.55, 'rgba(6, 18, 12, 0.62)');
    grad.addColorStop(1, 'rgba(2, 6, 4, 0.95)');
    bctx.fillStyle = grad;
    bctx.fillRect(0, 0, w, h);

    // On mobile, bake calm subterranean strata directly into the cached backdrop (0 per-frame wave cost!)
    if (this.mobile) {
      const strataCount = 5;
      bctx.lineWidth = 1;
      for (let s = 0; s < strataCount; s++) {
        const baseY = (s / Math.max(1, strataCount - 1)) * h;
        bctx.beginPath();
        for (let x = 0; x <= w; x += 48) {
          const wave = Math.sin(x * 0.005 + s * 1.1) * 18 + Math.cos(x * 0.01 - s * 0.7) * 8;
          const y = baseY + wave;
          if (x === 0) bctx.moveTo(x, y);
          else bctx.lineTo(x, y);
        }
        bctx.strokeStyle = s % 3 === 0 ? 'rgba(60, 232, 122, 0.065)' : 'rgba(255, 224, 130, 0.032)';
        bctx.stroke();
      }
    }
  }

  private spawnAnts() {
    const w = this.viewW;
    const h = this.viewH;
    const mobile = this.mobile;
    const roster: AntTypeId[] = mobile
      ? ['worker', 'worker', 'scout', 'warrior', 'queen', 'brood']
      : [
          'worker', 'worker', 'worker', 'worker', 'worker', 'worker',
          'scout', 'scout', 'scout', 'scout',
          'warrior', 'warrior', 'warrior',
          'queen', 'brood', 'brood', 'brood'
        ];

    this.ants = roster.map((type) => ({
      type,
      x: Math.random() * w,
      y: Math.random() * h,
      angle: Math.random() * Math.PI * 2,
      speed: type === 'scout' ? 85 : type === 'queen' ? 24 : type === 'warrior' ? 38 : 48,
      legPhase: Math.random() * Math.PI * 2,
      turnTimer: 0.6 + Math.random() * 1.4,
      trail: []
    }));

    this.motes = Array.from({ length: mobile ? 10 : 34 }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1.2 + Math.random() * 2.2,
      spd: 7 + Math.random() * 14,
      phase: Math.random() * Math.PI * 2,
      gold: i % 4 === 0
    }));
  }

  setSkin(skin: AntSkinId) {
    this.skin = skin;
  }

  /** Secret achievement interaction: boops a crawling background ant when clicked! */
  hitTestAndBoop(clientX: number, clientY: number): boolean {
    for (const ant of this.ants) {
      if (Math.hypot(clientX - ant.x, clientY - ant.y) <= 28) {
        ant.angle += Math.PI + (Math.random() - 0.5) * 0.8;
        ant.turnTimer = 0.25;
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 + Math.random() * 0.4;
          const sp = 40 + Math.random() * 65;
          this.boopSparks.push({ x: ant.x, y: ant.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7 });
        }
        return true;
      }
    }
    return false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.lastRenderMs = 0;
    const tick = (now: number) => {
      if (!this.running) return;
      // On mobile, cap menu ambient canvas to ~30 FPS so menu interactions & WebView UI stay butter-smooth!
      if (this.mobile && now - this.lastRenderMs < 32) {
        this.rafId = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
      this.lastRenderMs = now;
      this.update(dt);
      this.render();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private update(dt: number) {
    this.elapsed += dt;
    const w = this.viewW;
    const h = this.viewH;
    const recordTrails = !this.mobile;

    for (let i = this.boopSparks.length - 1; i >= 0; i--) {
      const sp = this.boopSparks[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.life -= dt;
      if (sp.life <= 0) this.boopSparks.splice(i, 1);
    }

    for (const m of this.motes) {
      m.y -= m.spd * dt;
      m.x += Math.sin(this.elapsed * 0.8 + m.phase) * 8 * dt;
      if (m.y < -12) {
        m.y = h + 12;
        m.x = Math.random() * w;
      }
    }

    for (const ant of this.ants) {
      ant.turnTimer -= dt;
      if (ant.turnTimer <= 0) {
        ant.angle += (Math.random() - 0.5) * 1.1;
        ant.turnTimer = 0.7 + Math.random() * 1.6;
      }

      if (this.pointer.active) {
        const dx = this.pointer.x - ant.x;
        const dy = this.pointer.y - ant.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 45 && dist < 240) {
          const desired = Math.atan2(dy, dx);
          let diff = desired - ant.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ant.angle += diff * dt * 1.1;
        }
      }

      ant.x += Math.cos(ant.angle) * ant.speed * dt;
      ant.y += Math.sin(ant.angle) * ant.speed * dt;
      ant.legPhase += dt * ant.speed * 0.28;

      if (ant.x < -30) {
        ant.x = w + 28;
        ant.trail.length = 0;
      } else if (ant.x > w + 30) {
        ant.x = -28;
        ant.trail.length = 0;
      }
      if (ant.y < -30) {
        ant.y = h + 28;
        ant.trail.length = 0;
      } else if (ant.y > h + 30) {
        ant.y = -28;
        ant.trail.length = 0;
      }

      if (recordTrails) {
        const last = ant.trail[ant.trail.length - 1];
        if (!last || Math.hypot(ant.x - last.x, ant.y - last.y) > 7) {
          ant.trail.push({ x: ant.x, y: ant.y });
          if (ant.trail.length > 26) ant.trail.shift();
        }
      }
    }
  }

  private render() {
    const w = this.viewW;
    const h = this.viewH;
    const ctx = this.ctx;

    // 1 single fast blit of the cached radial-gradient subterranean backdrop (zero per-frame gradient allocation!)
    ctx.drawImage(this.bgCache, 0, 0, w, h);

    // Desktop gets gentle flowing strata + pheromone filaments + trails; mobile keeps it super lean & snappy
    if (!this.mobile) {
      const strataCount = 9;
      ctx.lineWidth = 1;
      for (let s = 0; s < strataCount; s++) {
        const baseY = (s / Math.max(1, strataCount - 1)) * h;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 28) {
          const wave =
            Math.sin(x * 0.0045 + s * 1.1 + this.elapsed * 0.14) * 22 +
            Math.cos(x * 0.009 - s * 0.7 + this.elapsed * 0.09) * 10;
          const y = baseY + wave;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = s % 3 === 0 ? 'rgba(60, 232, 122, 0.065)' : 'rgba(255, 224, 130, 0.032)';
        ctx.stroke();
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < this.ants.length; i++) {
        for (let j = i + 1; j < this.ants.length; j++) {
          const d = Math.hypot(this.ants[i].x - this.ants[j].x, this.ants[i].y - this.ants[j].y);
          if (d < 130) {
            ctx.strokeStyle = `rgba(90, 240, 155, ${(1 - d / 130) * 0.12})`;
            ctx.beginPath();
            ctx.moveTo(this.ants[i].x, this.ants[i].y);
            ctx.lineTo(this.ants[j].x, this.ants[j].y);
            ctx.stroke();
          }
        }
      }

      for (const ant of this.ants) {
        if (ant.trail.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(ant.trail[0].x, ant.trail[0].y);
        for (let i = 1; i < ant.trail.length; i++) {
          ctx.lineTo(ant.trail[i].x, ant.trail[i].y);
        }
        ctx.strokeStyle = 'rgba(60, 232, 122, 0.09)';
        ctx.lineWidth = ant.type === 'queen' ? 8 : 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }
    }

    // Floating bioluminescent spore motes (crisp pixel rectangles)
    for (const m of this.motes) {
      const a = 0.22 + 0.25 * Math.sin(this.elapsed * 2.1 + m.phase);
      ctx.fillStyle = m.gold ? `rgba(255, 232, 135, ${a})` : `rgba(88, 245, 155, ${a})`;
      const s = Math.max(2, Math.round(m.r * 1.7));
      ctx.fillRect(Math.round(m.x), Math.round(m.y), s, s);
    }

    // Draw articulated crawling ants in player's chosen cosmetic skin!
    for (const ant of this.ants) {
      drawDetailedAnt(ctx, ant.type, ant.x, ant.y, ant.angle, ant.legPhase, 0, this.mobile ? 4.4 : 5.2, this.skin);
    }

    for (const sp of this.boopSparks) {
      ctx.fillStyle = `rgba(255, 232, 120, ${Math.max(0, sp.life / 0.7)})`;
      ctx.fillRect(Math.round(sp.x), Math.round(sp.y), 4, 4);
    }
  }
}
