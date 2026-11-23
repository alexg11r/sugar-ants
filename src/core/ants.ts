import { ColonyStats } from '../game/skillTree';
import { Ant, AntTypeConfig, AntTypeId, ArtifactDef, CellType, PlayableAntId } from './types';
import { World } from './world';
import { ParticleSystem } from './particles';

export const ANT_TYPES: Record<AntTypeId, AntTypeConfig> = {
  worker: {
    id: 'worker',
    name: 'Рабочий',
    shortName: 'Рабочий',
    description: 'Медленно и методично грызёт блоки, живёт долго и прокладывает уютные туннели.',
    color: '#3ce87a',
    rgb: [60, 232, 122],
    hotkey: '1',
    baseSpeed: 12.5,
    baseDamage: 1,
    baseBiteInterval: 0.34,
    baseLifespan: 75,
    baseMaxActive: 6,
    baseRadius: 1.15,
    scale: 1.0
  },
  warrior: {
    id: 'warrior',
    name: 'Воин',
    shortName: 'Воин',
    description: 'Идёт строго в выбранном направлении и бьёт сразу по нескольким блокам.',
    color: '#ff6b2b',
    rgb: [255, 107, 43],
    hotkey: '2',
    baseSpeed: 10.5,
    baseDamage: 3,
    baseBiteInterval: 0.44,
    baseLifespan: 85,
    baseMaxActive: 2,
    baseRadius: 2.25,
    scale: 1.28
  },
  scout: {
    id: 'scout',
    name: 'Разведчик',
    shortName: 'Разведчик',
    description: 'Очень быстрый! Отскакивает от блоков, нанося им лёгкую тычку при каждом ударе.',
    color: '#35d6ff',
    rgb: [53, 214, 255],
    hotkey: '3',
    baseSpeed: 46,
    baseDamage: 1,
    baseBiteInterval: 0.08,
    baseLifespan: 65,
    baseMaxActive: 4,
    baseRadius: 1.0,
    scale: 0.92
  },
  queen: {
    id: 'queen',
    name: 'Матка',
    shortName: 'Матка',
    description: 'Неспешно ползёт и выпускает вокруг себя маленьких муравьёв, которые кушают блоки рядом.',
    color: '#e04bff',
    rgb: [224, 75, 255],
    hotkey: '4',
    baseSpeed: 5.2,
    baseDamage: 1,
    baseBiteInterval: 0.65,
    baseLifespan: 130,
    baseMaxActive: 1,
    baseRadius: 1.3,
    scale: 1.55
  },
  compass: {
    id: 'compass',
    name: 'Компас',
    shortName: 'Компас',
    description: 'Особый муравей: 5 секунд бежит в сторону сахара с небольшим разбросом (слабый урон, кулдаун 2 мин).',
    color: '#ffe07d',
    rgb: [255, 224, 125],
    hotkey: '5',
    baseSpeed: 24,
    baseDamage: 1,
    baseBiteInterval: 0.35,
    baseLifespan: 5.0,
    baseMaxActive: 1,
    baseRadius: 1.1,
    scale: 1.05,
    cooldownSec: 120
  },
  brood: {
    id: 'brood',
    name: 'Мини-муравей',
    shortName: 'Выводок',
    description: 'Маленький слабый муравей, рождённый Маткой.',
    color: '#f09bff',
    rgb: [240, 155, 255],
    hotkey: '',
    baseSpeed: 15,
    baseDamage: 1,
    baseBiteInterval: 0.45,
    baseLifespan: 20,
    baseMaxActive: 52,
    baseRadius: 0.9,
    scale: 0.65
  }
};

export const PLAYABLE_ANTS: PlayableAntId[] = ['worker', 'warrior', 'scout', 'queen', 'compass'];

export interface AntUpdateEvents {
  crystalsBroken: number;
  sugarHit: boolean;
  artifactFound: ArtifactDef | null;
  artRevealed: number;
  artPoints: { x: number; y: number }[];
  dugPixels: number;
  damagedPixels: number;
  dugPoints: { x: number; y: number }[];
  anomalySpawned: number;
  anomalyPoints: { x: number; y: number }[];
  antsExpired: number;
  expiredPoints: { x: number; y: number }[];
}

export class AntManager {
  ants: Ant[] = [];
  private nextId = 1;
  compassCooldown = 0; // remaining seconds

  countByType(type: AntTypeId): number {
    let count = 0;
    for (let i = 0; i < this.ants.length; i++) {
      if (this.ants[i].type === type) count++;
    }
    return count;
  }

  /** Counts ONLY player-summoned ants of a type so Queen-born anomaly ants NEVER block player slots! */
  countPlayerByType(type: AntTypeId): number {
    let count = 0;
    for (let i = 0; i < this.ants.length; i++) {
      const a = this.ants[i];
      if (a.type === type && !a.fromQueen) count++;
    }
    return count;
  }

  /** Counts bonus ants of a playable type spawned by a Queen (e.g. Royal Anomaly mutation) */
  countQueenBornByType(type: AntTypeId): number {
    let count = 0;
    for (let i = 0; i < this.ants.length; i++) {
      const a = this.ants[i];
      if (a.type === type && a.fromQueen) count++;
    }
    return count;
  }

  getMaxActive(type: PlayableAntId, stats: ColonyStats): number {
    switch (type) {
      case 'worker':
        return stats.worker.maxActive;
      case 'warrior':
        return stats.warrior.maxActive;
      case 'scout':
        return stats.scout.maxActive;
      case 'queen':
        return stats.queen.maxActive;
      case 'compass':
        return 1;
    }
  }

  spawnAnt(
    type: PlayableAntId,
    x: number,
    y: number,
    angle: number,
    stats: ColonyStats
  ): { ok: boolean; reason?: 'cap' | 'cooldown' } {
    if (type === 'compass' && this.compassCooldown > 0) {
      return { ok: false, reason: 'cooldown' };
    }

    const cap = this.getMaxActive(type, stats);
    if (this.countPlayerByType(type) >= cap) return { ok: false, reason: 'cap' };

    const cfg = ANT_TYPES[type];
    let maxAge = cfg.baseLifespan;
    if (type === 'compass') {
      maxAge = stats.compassDuration;
      this.compassCooldown = stats.compassCooldownSec;
    } else {
      let lifeMult = stats.globalLifeMult;
      if (type === 'worker') lifeMult *= stats.worker.lifeMult;
      if (type === 'scout') lifeMult *= stats.scout.lifeMult;
      maxAge = cfg.baseLifespan * lifeMult;
    }

    this.ants.push({
      id: this.nextId++,
      type,
      x,
      y,
      angle,
      fixedAngle: angle,
      age: 0,
      maxAge,
      biteTimer: 0,
      biteFlash: 0,
      turnTimer: 0.4 + Math.random() * 0.6,
      spawnTimer: 1.4,
      legPhase: Math.random() * Math.PI * 2,
      trailTimer: 0,
      fromQueen: false
    });
    return { ok: true };
  }

  private spawnBrood(
    x: number,
    y: number,
    stats: ColonyStats,
    particles: ParticleSystem,
    events: AntUpdateEvents
  ) {
    if (this.countByType('brood') >= ANT_TYPES.brood.baseMaxActive) return;
    const angle = Math.random() * Math.PI * 2;
    const broodCfg = ANT_TYPES.brood;
    const broodLife = broodCfg.baseLifespan * stats.queen.broodLifeMult * stats.globalLifeMult;

    let spawnedType: AntTypeId = 'brood';
    if (stats.queenAnomaly && Math.random() < 0.05) {
      const anomalyPool: PlayableAntId[] = ['worker', 'warrior', 'scout'];
      spawnedType = anomalyPool[Math.floor(Math.random() * anomalyPool.length)];
      const rgb = ANT_TYPES[spawnedType].rgb;
      particles.spawn(x, y, rgb[0], rgb[1], rgb[2], 12, 24, 1.0, 1.9);
      events.anomalySpawned++;
      events.anomalyPoints.push({ x, y });
    }

    this.ants.push({
      id: this.nextId++,
      type: spawnedType,
      x: x + Math.cos(angle) * 2.2,
      y: y + Math.sin(angle) * 2.2,
      angle,
      fixedAngle: angle,
      age: 0,
      maxAge: broodLife,
      biteTimer: 0,
      biteFlash: 0,
      turnTimer: 0.4 + Math.random() * 0.6,
      spawnTimer: 0,
      legPhase: Math.random() * Math.PI * 2,
      trailTimer: 0,
      fromQueen: true
    });
  }

  clear() {
    this.ants = [];
    this.compassCooldown = 0;
  }

  restoreState(savedAnts: Ant[], compassCooldown: number) {
    this.ants = savedAnts.map((a) => ({ ...a }));
    this.compassCooldown = Math.max(0, compassCooldown || 0);
    let maxId = 0;
    for (let i = 0; i < this.ants.length; i++) {
      if (this.ants[i].id > maxId) maxId = this.ants[i].id;
    }
    this.nextId = maxId + 1;
  }

  update(
    dt: number,
    world: World,
    particles: ParticleSystem,
    stats: ColonyStats
  ): AntUpdateEvents {
    const events: AntUpdateEvents = {
      crystalsBroken: 0,
      sugarHit: false,
      artifactFound: null,
      artRevealed: 0,
      artPoints: [],
      dugPixels: 0,
      damagedPixels: 0,
      dugPoints: [],
      anomalySpawned: 0,
      anomalyPoints: [],
      antsExpired: 0,
      expiredPoints: []
    };

    if (this.compassCooldown > 0) {
      this.compassCooldown = Math.max(0, this.compassCooldown - dt);
    }

    for (let i = this.ants.length - 1; i >= 0; i--) {
      const ant = this.ants[i];
      const cfg = ANT_TYPES[ant.type];

      ant.age += dt;
      if (ant.biteTimer > 0) ant.biteTimer -= dt;
      if (ant.biteFlash > 0) ant.biteFlash = Math.max(0, ant.biteFlash - dt * 5);
      ant.turnTimer -= dt;

      if (ant.age >= ant.maxAge) {
        particles.spawn(ant.x, ant.y, cfg.rgb[0], cfg.rgb[1], cfg.rgb[2], 5, 14, 0.75, 1.4);
        if (ant.type !== 'brood') {
          events.antsExpired++;
          events.expiredPoints.push({ x: ant.x, y: ant.y });
        }
        this.ants.splice(i, 1);
        continue;
      }

      if (ant.type === 'scout') {
        this.updateScout(ant, dt, world, particles, stats, events);
      } else if (ant.type === 'warrior') {
        this.updateWarrior(ant, dt, world, particles, stats, events);
      } else if (ant.type === 'queen') {
        this.updateQueen(ant, dt, world, particles, stats, events);
      } else if (ant.type === 'compass') {
        this.updateCompass(ant, dt, world, particles, stats, events);
      } else {
        this.updateWorkerOrBrood(ant, dt, world, particles, stats, events);
      }

      ant.trailTimer += dt;
      if (ant.trailTimer > (ant.type === 'compass' ? 0.14 : 1.35)) {
        ant.trailTimer = 0;
        if (ant.type === 'compass') {
          particles.spawn(ant.x, ant.y, 255, 224, 125, 1, 6, 0.75, 1.4);
        } else if (Math.random() < 0.22) {
          particles.spawnAmbientSpore(ant.x, ant.y);
        }
      }
    }

    return events;
  }

  private computeDamage(baseDmg: number, cell: CellType, stats: ColonyStats): number {
    let dmg = baseDmg;
    if (
      stats.hardBlockBonusDmg > 0 &&
      (cell === CellType.Clay || cell === CellType.Stone || cell === CellType.Obsidian)
    ) {
      dmg += stats.hardBlockBonusDmg;
    }
    return dmg;
  }

  private applyDigEvents(
    res: ReturnType<World['dig']>,
    x: number,
    y: number,
    rgb: [number, number, number],
    world: World,
    particles: ParticleSystem,
    events: AntUpdateEvents
  ) {
    events.dugPixels += res.dugCount;
    events.damagedPixels += res.damagedCount;
    if (res.dugCount > 0 || res.damagedCount > 0) {
      events.dugPoints.push({ x, y });
    }
    events.crystalsBroken += res.crystalsBroken;
    events.artRevealed += res.artRevealed;
    if (res.artRevealed > 0) {
      events.artPoints.push({ x, y });
    }
    if (res.sugarHit) {
      events.sugarHit = true;
      particles.spawn(world.sugarX, world.sugarY, 255, 245, 175, 32, 42, 2.0, 2.4);
    }
    if (res.artifactFound) {
      events.artifactFound = res.artifactFound;
      const [ar, ag, ab] = res.artifactFound.rgb;
      particles.spawn(x, y, ar, ag, ab, 36, 46, 2.2, 2.6);
      particles.spawn(x, y, 255, 245, 185, 22, 34, 1.8, 2.0);
    }
    if (res.crystalsBroken > 0) {
      particles.spawn(x, y, 75, 235, 255, 16, 30, 1.3, 2.0);
    } else if (res.dugCount > 0) {
      particles.spawn(x, y, rgb[0], rgb[1], rgb[2], 2, 14, 0.55, 1.3);
    } else if (res.damagedCount > 0 && Math.random() < 0.35) {
      particles.spawn(x, y, 255, 190, 90, 1, 10, 0.35, 1.0);
    }
  }

  /** Special Compass ant: steers toward Sugar with slight organic spread for 5s, light damage! */
  private updateCompass(
    ant: Ant,
    dt: number,
    world: World,
    particles: ParticleSystem,
    stats: ColonyStats,
    events: AntUpdateEvents
  ) {
    const cfg = ANT_TYPES.compass;
    const speed = cfg.baseSpeed * stats.globalSpeedMult;

    if (ant.turnTimer <= 0) {
      const toSugar = Math.atan2(world.sugarY - ant.y, world.sugarX - ant.x);
      // Slight organic spread ±0.32 rad so it points the general direction without spoiling exact pixel
      const jitter = (Math.random() - 0.5) * 0.64;
      ant.fixedAngle = toSugar + jitter;
      ant.turnTimer = 0.45 + Math.random() * 0.35;
    }

    // Smoothly turn toward sugar bearing
    let diff = ant.fixedAngle - ant.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ant.angle += diff * Math.min(1, dt * 6);

    const probeX = ant.x + Math.cos(ant.angle) * 1.4;
    const probeY = ant.y + Math.sin(ant.angle) * 1.4;
    const ix = Math.round(probeX);
    const iy = Math.round(probeY);

    if (!world.inBounds(ix, iy)) return;

    const ahead = world.getCell(ix, iy);
    if (ahead === CellType.Empty) {
      ant.x += Math.cos(ant.angle) * speed * dt;
      ant.y += Math.sin(ant.angle) * speed * dt;
      ant.legPhase += dt * speed * 1.4;
    } else if (ahead === CellType.HiddenArt) {
      const res = world.dig(ix, iy, cfg.baseRadius, 1);
      this.applyDigEvents(res, ix, iy, cfg.rgb, world, particles, events);
      ant.angle += (Math.random() < 0.5 ? 1 : -1) * 0.9;
      ant.fixedAngle = ant.angle;
    } else {
      ant.legPhase += dt * 5;
      if (ant.biteTimer <= 0) {
        ant.biteTimer = cfg.baseBiteInterval;
        ant.biteFlash = 1;
        // Small damage (1)
        const res = world.dig(probeX, probeY, cfg.baseRadius, 1);
        this.applyDigEvents(res, probeX, probeY, cfg.rgb, world, particles, events);
      }
    }
  }

  private updateWorkerOrBrood(
    ant: Ant,
    dt: number,
    world: World,
    particles: ParticleSystem,
    stats: ColonyStats,
    events: AntUpdateEvents
  ) {
    const isWorker = ant.type === 'worker';
    const cfg = ANT_TYPES[ant.type];
    const speed = cfg.baseSpeed * (isWorker ? stats.worker.speedMult : stats.globalSpeedMult);
    const biteInterval = cfg.baseBiteInterval / (isWorker ? stats.worker.speedMult : stats.globalSpeedMult);
    const rawDmg = cfg.baseDamage + (isWorker ? stats.worker.dmgBonus : stats.queen.broodDmgBonus);

    if (ant.turnTimer <= 0) {
      ant.angle += (Math.random() - 0.5) * (isWorker ? 1.05 : 1.5);
      ant.turnTimer = (isWorker ? 0.65 : 0.35) + Math.random() * 0.7;
    }

    const lookDist = 1.35;
    const probeX = ant.x + Math.cos(ant.angle) * lookDist;
    const probeY = ant.y + Math.sin(ant.angle) * lookDist;
    const ix = Math.round(probeX);
    const iy = Math.round(probeY);

    if (!world.inBounds(ix, iy)) {
      ant.angle += Math.PI * 0.75 + (Math.random() - 0.5) * 0.6;
      return;
    }

    const ahead = world.getCell(ix, iy);
    if (ahead === CellType.Empty) {
      ant.x += Math.cos(ant.angle) * speed * dt;
      ant.y += Math.sin(ant.angle) * speed * dt;
      ant.legPhase += dt * speed * 1.45;
    } else if (ahead === CellType.HiddenArt) {
      const res = world.dig(ix, iy, cfg.baseRadius, 1);
      this.applyDigEvents(res, ix, iy, cfg.rgb, world, particles, events);
      ant.angle += (Math.random() < 0.5 ? 1 : -1) * (Math.PI * 0.45 + Math.random() * 0.35);
    } else {
      ant.legPhase += dt * 4.5;
      if (ant.biteTimer <= 0) {
        ant.biteTimer = biteInterval;
        ant.biteFlash = 1;
        const dmg = this.computeDamage(rawDmg, ahead, stats);
        const res = world.dig(probeX, probeY, cfg.baseRadius, dmg);
        this.applyDigEvents(res, probeX, probeY, cfg.rgb, world, particles, events);
      }
    }
  }

  private updateScout(
    ant: Ant,
    dt: number,
    world: World,
    particles: ParticleSystem,
    stats: ColonyStats,
    events: AntUpdateEvents
  ) {
    const cfg = ANT_TYPES.scout;
    const speed = cfg.baseSpeed * stats.scout.speedMult;
    const rawDmg = cfg.baseDamage + stats.scout.dmgBonus;

    const totalDist = speed * dt;
    const steps = Math.max(1, Math.ceil(totalDist / 0.85));
    const stepDist = totalDist / steps;

    for (let s = 0; s < steps; s++) {
      const nx = ant.x + Math.cos(ant.angle) * stepDist;
      const ny = ant.y + Math.sin(ant.angle) * stepDist;
      const ix = Math.round(nx);
      const iy = Math.round(ny);

      if (!world.inBounds(ix, iy)) {
        if (ix < 1 || ix >= world.width - 1) ant.angle = Math.PI - ant.angle;
        if (iy < 1 || iy >= world.height - 1) ant.angle = -ant.angle;
        ant.angle += (Math.random() - 0.5) * 0.2;
        break;
      }

      const cell = world.getCell(ix, iy);
      if (cell === CellType.Empty) {
        ant.x = nx;
        ant.y = ny;
      } else {
        if (ant.biteTimer <= 0) {
          ant.biteTimer = cfg.baseBiteInterval;
          ant.biteFlash = 1;
          const dmg = this.computeDamage(rawDmg, cell, stats);
          const res = world.dig(ix, iy, cfg.baseRadius, dmg);
          this.applyDigEvents(res, ix, iy, cfg.rgb, world, particles, events);
        }

        const solidX = world.getCell(Math.round(nx), Math.round(ant.y)) !== CellType.Empty;
        const solidY = world.getCell(Math.round(ant.x), Math.round(ny)) !== CellType.Empty;
        if (solidX && !solidY) {
          ant.angle = Math.PI - ant.angle;
        } else if (solidY && !solidX) {
          ant.angle = -ant.angle;
        } else {
          ant.angle += Math.PI;
        }
        ant.angle += (Math.random() - 0.5) * 0.28;
        break;
      }
    }

    ant.legPhase += dt * speed * 1.1;
  }

  private updateWarrior(
    ant: Ant,
    dt: number,
    world: World,
    particles: ParticleSystem,
    stats: ColonyStats,
    events: AntUpdateEvents
  ) {
    const cfg = ANT_TYPES.warrior;
    const speed = cfg.baseSpeed * stats.warrior.speedMult;
    const biteInterval = cfg.baseBiteInterval / stats.warrior.speedMult;
    const rawDmg = cfg.baseDamage + stats.warrior.dmgBonus;
    const radius = cfg.baseRadius + stats.warrior.radiusBonus;

    ant.angle = ant.fixedAngle;

    const probeDist = 1.7;
    const probeX = ant.x + Math.cos(ant.angle) * probeDist;
    const probeY = ant.y + Math.sin(ant.angle) * probeDist;
    const ix = Math.round(probeX);
    const iy = Math.round(probeY);

    if (!world.inBounds(ix, iy)) {
      if (ix < 2 || ix >= world.width - 2) ant.fixedAngle = Math.PI - ant.fixedAngle;
      if (iy < 2 || iy >= world.height - 2) ant.fixedAngle = -ant.fixedAngle;
      ant.angle = ant.fixedAngle;
      return;
    }

    const ahead = world.getCell(ix, iy);
    if (ahead === CellType.Empty) {
      ant.x += Math.cos(ant.angle) * speed * dt;
      ant.y += Math.sin(ant.angle) * speed * dt;
      ant.legPhase += dt * speed * 1.45;
    } else if (ahead === CellType.HiddenArt) {
      const res = world.dig(ix, iy, radius, 1);
      this.applyDigEvents(res, ix, iy, cfg.rgb, world, particles, events);
      ant.fixedAngle += (Math.random() < 0.5 ? 1 : -1) * (Math.PI * 0.35);
      ant.angle = ant.fixedAngle;
    } else {
      ant.legPhase += dt * 3.8;
      if (ant.biteTimer <= 0) {
        ant.biteTimer = biteInterval;
        ant.biteFlash = 1;
        const dmg = this.computeDamage(rawDmg, ahead, stats);
        const res = world.dig(probeX, probeY, radius, dmg);
        this.applyDigEvents(res, probeX, probeY, cfg.rgb, world, particles, events);
      }
    }
  }

  private updateQueen(
    ant: Ant,
    dt: number,
    world: World,
    particles: ParticleSystem,
    stats: ColonyStats,
    events: AntUpdateEvents
  ) {
    const cfg = ANT_TYPES.queen;

    ant.spawnTimer -= dt * stats.queen.spawnRateMult;
    if (ant.spawnTimer <= 0) {
      ant.spawnTimer = 2.6;
      this.spawnBrood(ant.x, ant.y, stats, particles, events);
      this.spawnBrood(ant.x, ant.y, stats, particles, events);
      particles.spawn(ant.x, ant.y, 235, 120, 255, 5, 16, 0.7, 1.5);
    }

    if (ant.turnTimer <= 0) {
      ant.angle += (Math.random() - 0.5) * 0.85;
      ant.turnTimer = 1.4 + Math.random() * 1.4;
    }

    const probeX = ant.x + Math.cos(ant.angle) * 2.0;
    const probeY = ant.y + Math.sin(ant.angle) * 2.0;
    const ix = Math.round(probeX);
    const iy = Math.round(probeY);

    if (!world.inBounds(ix, iy) || world.getCell(ix, iy) === CellType.HiddenArt) {
      ant.angle += Math.PI * 0.65;
      return;
    }

    const ahead = world.getCell(ix, iy);
    if (ahead === CellType.Empty) {
      ant.x += Math.cos(ant.angle) * cfg.baseSpeed * stats.globalSpeedMult * dt;
      ant.y += Math.sin(ant.angle) * cfg.baseSpeed * stats.globalSpeedMult * dt;
      ant.legPhase += dt * cfg.baseSpeed * 1.5;
    } else {
      if (ant.biteTimer <= 0) {
        ant.biteTimer = cfg.baseBiteInterval / stats.globalSpeedMult;
        ant.biteFlash = 1;
        const dmg = this.computeDamage(cfg.baseDamage, ahead, stats);
        const res = world.dig(probeX, probeY, cfg.baseRadius, dmg);
        this.applyDigEvents(res, probeX, probeY, cfg.rgb, world, particles, events);
      }
      if (Math.random() < 0.04) {
        ant.angle += (Math.random() < 0.5 ? 1 : -1) * 0.9;
      }
    }
  }
}
