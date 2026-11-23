import { getOptimalDpr, isMobileDevice } from '../core/device';
import { drawDetailedAnt, UNEXPLORED_BG_HEX } from '../core/renderer';
import { AntTypeId } from '../core/types';

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
  private ants: MenuAnt[] = [];
  private rafId = 0;
  private running = false;
  private lastTime = 0;
  private elapsed = 0;
  private pointer: { x: number; y: number; active: boolean } = { x: 0, y: 0, active: false };
  private motes: { x: number; y: number; r: number; spd: number; phase: number; gold: boolean }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    this.spawnAnts();

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.pointer.active = true;
    });
    window.addEventListener('pointerleave', () => {
      this.pointer.active = false;
    });
  }

  private resize() {
    const dpr = getOptimalDpr();
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private spawnAnts() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const mobile = isMobileDevice();
    const roster: AntTypeId[] = mobile
      ? ['worker', 'worker', 'worker', 'scout', 'scout', 'warrior', 'queen', 'brood']
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

    this.motes = Array.from({ length: mobile ? 14 : 34 }, (_, i) => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 1.2 + Math.random() * 2.2,
      spd: 7 + Math.random() * 14,
      phase: Math.random() * Math.PI * 2,
      gold: i % 4 === 0
    }));
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.lastTime) / 1000);
      this.lastTime = now;
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
    const w = window.innerWidth;
    const h = window.innerHeight;

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

      // Subtle playful curiosity toward cursor (gentle orbit / attraction)
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

      // Wrap smoothly around screen edges
      if (ant.x < -30) {
        ant.x = w + 28;
        ant.trail = [];
      } else if (ant.x > w + 30) {
        ant.x = -28;
        ant.trail = [];
      }
      if (ant.y < -30) {
        ant.y = h + 28;
        ant.trail = [];
      } else if (ant.y > h + 30) {
        ant.y = -28;
        ant.trail = [];
      }

      // Record faint pheromone tunnel trail
      const last = ant.trail[ant.trail.length - 1];
      if (!last || Math.hypot(ant.x - last.x, ant.y - last.y) > 7) {
        ant.trail.push({ x: ant.x, y: ant.y });
        if (ant.trail.length > 26) ant.trail.shift();
      }
    }
  }

  private render() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ctx = this.ctx;

    // Deep subterranean ant-sanctuary backdrop with subtle flowing geological strata (100% original Sugar Ants vibe!)
    ctx.fillStyle = UNEXPLORED_BG_HEX;
    ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.48;
    const maxR = Math.hypot(w, h) * 0.72;
    const grad = ctx.createRadialGradient(cx, cy, 30, cx, cy, maxR);
    grad.addColorStop(0, 'rgba(20, 68, 42, 0.34)');
    grad.addColorStop(0.55, 'rgba(6, 18, 12, 0.62)');
    grad.addColorStop(1, 'rgba(2, 6, 4, 0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle curved subterranean contour strata lines
    const mobile = isMobileDevice();
    const strataCount = mobile ? 5 : 9;
    const stepX = mobile ? 44 : 28;
    ctx.lineWidth = 1;
    for (let s = 0; s < strataCount; s++) {
      const baseY = (s / Math.max(1, strataCount - 1)) * h;
      ctx.beginPath();
      for (let x = 0; x <= w; x += stepX) {
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

    // Delicate glowing pheromone filaments connecting nearby crawling ants
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

    // Floating bioluminescent spore motes
    for (const m of this.motes) {
      const a = 0.22 + 0.25 * Math.sin(this.elapsed * 2.1 + m.phase);
      ctx.fillStyle = m.gold ? `rgba(255, 232, 135, ${a})` : `rgba(88, 245, 155, ${a})`;
      const s = Math.max(2, Math.round(m.r * 1.7));
      ctx.fillRect(Math.round(m.x), Math.round(m.y), s, s);
    }

    // Subtle glowing faint pheromone trails
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

    // Draw detailed crawling ants
    for (const ant of this.ants) {
      drawDetailedAnt(ctx, ant.type, ant.x, ant.y, ant.angle, ant.legPhase, 0, 5.2);
    }
  }
}
