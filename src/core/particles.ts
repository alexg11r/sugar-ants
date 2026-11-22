import { Particle } from './types';

export class ParticleSystem {
  particles: Particle[] = [];
  private readonly maxParticles = 320;

  spawn(
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    count = 4,
    speed = 16,
    life = 0.9,
    size = 1.4
  ) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.25 + Math.random() * 0.75) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        r,
        g,
        b,
        life: life * (0.65 + Math.random() * 0.55),
        maxLife: life,
        size
      });
    }
  }

  /** Subtle floating neon spore in dug void (matches the purple/cyan dots in reference) */
  spawnAmbientSpore(x: number, y: number) {
    if (this.particles.length >= this.maxParticles) return;
    const palette: [number, number, number][] = [
      [80, 240, 255],
      [215, 90, 255],
      [120, 255, 190]
    ];
    const [r, g, b] = palette[Math.floor(Math.random() * palette.length)];
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 2.5,
      vy: (Math.random() - 0.5) * 2.5,
      r,
      g,
      b,
      life: 2.2 + Math.random() * 2.4,
      maxLife: 4.2,
      size: 1.5
    });
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }
}
