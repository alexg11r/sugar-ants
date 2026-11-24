import { ColonyStats } from '../game/skillTree';
import {
  Ant,
  AntTypeConfig,
  AntTypeId,
  ArtifactDef,
  CellType,
  PheromoneBeacon,
  PlayableAntId,
  ScentPoint
} from './types';
import { World } from './world';
import { ParticleSystem } from './particles';

/** Tiny aura radius (in world pixels) within which a Queen buffs all nearby allied ants! */
export const QUEEN_AURA_RADIUS = 13;

export const ANT_TYPES: Record<AntTypeId, AntTypeConfig> = {
  worker: {
    id: 'worker',
    name: 'Рабочий',
    nameEn: 'Worker',
    shortName: 'Рабочий',
    shortNameEn: 'Worker',
    description: 'Медленно и методично грызёт блоки, живёт долго и прокладывает уютные туннели.',
    descriptionEn: 'Slowly and methodically chews blocks, lives long, and carves cozy tunnels.',
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
    nameEn: 'Warrior',
    shortName: 'Воин',
    shortNameEn: 'Warrior',
    description: 'Тяжёлый таран: идёт строго в выбранном направлении и крушит несколько блоков сразу.',
    descriptionEn: 'Heavy battering ram: charges straight in your aimed direction and crushes multiple blocks.',
    color: '#ff6b2b',
    rgb: [255, 107, 43],
    hotkey: '2',
    baseSpeed: 9.2,
    baseDamage: 2,
    baseBiteInterval: 0.54,
    baseLifespan: 72,
    baseMaxActive: 2,
    baseRadius: 1.95,
    scale: 1.28
  },
  scout: {
    id: 'scout',
    name: 'Разведчик',
    nameEn: 'Scout',
    shortName: 'Разведчик',
    shortNameEn: 'Scout',
    description: 'Стремительный рикошетчик! Быстро разведывает карту и может отравлять блоки кислотой.',
    descriptionEn: 'Rapid ricochet explorer! Maps tunnels quickly and can corrode blocks with acid poison.',
    color: '#35d6ff',
    rgb: [53, 214, 255],
    hotkey: '3',
    baseSpeed: 27,
    baseDamage: 1,
    baseBiteInterval: 0.1,
    baseLifespan: 75,
    baseMaxActive: 4,
    baseRadius: 1.0,
    scale: 0.92
  },
  queen: {
    id: 'queen',
    name: 'Матка',
    nameEn: 'Queen',
    shortName: 'Матка',
    shortNameEn: 'Queen',
    description: 'Выпускает выводок и усиливает всех союзных муравьёв в малом радиусе вокруг себя (+35% скорости, +1 урон).',
    descriptionEn: 'Spawns brood and empowers all nearby allied ants in a small aura (+35% speed, +1 damage).',
    color: '#e04bff',
    rgb: [224, 75, 255],
    hotkey: '4',
    baseSpeed: 2.6,
    baseDamage: 1,
    baseBiteInterval: 0.85,
    baseLifespan: 135,
    baseMaxActive: 1,
    baseRadius: 1.3,
    scale: 1.55
  },
  compass: {
    id: 'compass',
    name: 'Ищейка',
    nameEn: 'Bloodhound',
    shortName: 'Ищейка',
    shortNameEn: 'Hound',
    description: 'Идёт по запаху прямо в сторону сахара! Оставляет яркий золотой след траектории и уверенно прогрызает тоннель (кулдаун 2 мин).',
    descriptionEn: 'Tracks Sugar directly by scent! Leaves a bright lingering golden trail and chews strong tunnels (2 min CD).',
    color: '#ffe07d',
    rgb: [255, 224, 125],
    hotkey: '5',
    baseSpeed: 26,
    baseDamage: 3,
    baseBiteInterval: 0.24,
    baseLifespan: 6.5,
    baseMaxActive: 1,
    baseRadius: 1.65,
    scale: 1.08,
    cooldownSec: 120
  },
  brood: {
    id: 'brood',
    name: 'Мини-муравей',
    nameEn: 'Mini-Ant',
    shortName: 'Выводок',
    shortNameEn: 'Brood',
    description: 'Маленький слабый муравей, рождённый Маткой.',
    descriptionEn: 'A tiny nimble ant hatched by the Queen.',
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
  sporeBlasts: { x: number; y: number }[];
  sugarDustHits: { x: number; y: number }[];
  cocoonHatches: { x: number; y: number }[];
}

export class AntManager {
  ants: Ant[] = [];
  /** Lingering golden trajectory breadcrumbs left behind by Ищейка (fades smoothly over ~16s!) */
  scentTrail: ScentPoint[] = [];
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
    world: World,
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

    const candX = x + Math.cos(angle) * 2.2;
    const candY = y + Math.sin(angle) * 2.2;
    const safePos = world.canAntStep(x, y, candX, candY)
      ? { x: candX, y: candY }
      : world.isInsidePlayable(x, y)
        ? { x, y }
        : world.findNearestEmpty(x, y, 16) || { x: world.nestX, y: world.nestY };

    this.ants.push({
      id: this.nextId++,
      type: spawnedType,
      x: safePos.x,
      y: safePos.y,
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
    this.scentTrail = [];
    this.compassCooldown = 0;
  }

  /** Releases 3 free allied bonus ants from an Ancient Cocoon (strictly inside playable cavity!) */
  spawnFreeAlliesAt(x: number, y: number, world: World, stats: ColonyStats, particles: ParticleSystem) {
    const trio: PlayableAntId[] = ['worker', 'scout', 'warrior'];
    const baseSafe = world.isInsidePlayable(x, y)
      ? { x, y }
      : world.findNearestEmpty(x, y, 20) || { x: world.nestX, y: world.nestY };

    for (let i = 0; i < trio.length; i++) {
      const type = trio[i];
      const cfg = ANT_TYPES[type];
      const angle = (i / trio.length) * Math.PI * 2 + Math.random() * 0.6;
      const lifeMult =
        stats.globalLifeMult * (type === 'worker' ? stats.worker.lifeMult : type === 'scout' ? stats.scout.lifeMult : 1);
      const candX = baseSafe.x + Math.cos(angle) * 2.0;
      const candY = baseSafe.y + Math.sin(angle) * 2.0;
      const spawnPos = world.canAntStep(baseSafe.x, baseSafe.y, candX, candY) ? { x: candX, y: candY } : baseSafe;

      this.ants.push({
        id: this.nextId++,
        type,
        x: spawnPos.x,
        y: spawnPos.y,
        angle,
        fixedAngle: angle,
        age: 0,
        maxAge: cfg.baseLifespan * lifeMult * 0.85,
        biteTimer: 0,
        biteFlash: 0,
        turnTimer: 0.4 + Math.random() * 0.4,
        spawnTimer: 0,
        legPhase: Math.random() * Math.PI * 2,
        trailTimer: 0,
        fromQueen: true
      });
    }
    particles.spawn(baseSafe.x, baseSafe.y, 200, 120, 255, 18, 30, 1.3, 1.9);
    particles.spawn(baseSafe.x, baseSafe.y, 105, 255, 175, 14, 24, 1.1, 1.6);
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
    stats: ColonyStats,
    beacon: PheromoneBeacon | null = null,
    rushMult = 1
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
      expiredPoints: [],
      sporeBlasts: [],
      sugarDustHits: [],
      cocoonHatches: []
    };

    if (this.compassCooldown > 0) {
      this.compassCooldown = Math.max(0, this.compassCooldown - dt);
    }

    // Decay lingering Bloodhound (Ищейка) golden scent trail breadcrumbs
    for (let i = this.scentTrail.length - 1; i >= 0; i--) {
      this.scentTrail[i].life -= dt;
      if (this.scentTrail[i].life <= 0) {
        this.scentTrail.splice(i, 1);
      }
    }

    // Tick Scout poison corrosion on blocks (can dissolve terrain, crystals, finds & reveal art!)
    const poisonRes = world.updatePoison(dt);
    if (
      poisonRes.dugCount > 0 ||
      poisonRes.damagedCount > 0 ||
      poisonRes.crystalsBroken > 0 ||
      poisonRes.artRevealed > 0 ||
      poisonRes.sugarHit ||
      poisonRes.artifactFound ||
      poisonRes.sporeBlasts.length > 0 ||
      poisonRes.sugarDustHits.length > 0 ||
      poisonRes.cocoonHatches.length > 0
    ) {
      this.applyDigEvents(poisonRes, world.nestX, world.nestY, [115, 255, 95], world, particles, events, true);
    }

    // Collect active Queen coordinates for tiny royal aura buffing!
    const queens: { x: number; y: number }[] = [];
    for (let i = 0; i < this.ants.length; i++) {
      if (this.ants[i].type === 'queen') {
        queens.push({ x: this.ants[i].x, y: this.ants[i].y });
      }
    }
    const queenAuraSq = QUEEN_AURA_RADIUS * QUEEN_AURA_RADIUS;

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

      // Watertight containment safeguard: pull any stray/legacy-saved ant strictly inside interiorMask!
      if (
        !world.isInsidePlayable(ant.x, ant.y) ||
        world.getCell(Math.round(ant.x), Math.round(ant.y)) === CellType.HiddenArt
      ) {
        const safe = world.findNearestEmpty(ant.x, ant.y, 36) || { x: world.nestX, y: world.nestY };
        ant.x = safe.x;
        ant.y = safe.y;
      }

      // Check if inside any Queen's tiny buff aura!
      ant.queenBuffed = false;
      if (ant.type !== 'queen' && queens.length > 0) {
        for (let q = 0; q < queens.length; q++) {
          const dx = ant.x - queens[q].x;
          const dy = ant.y - queens[q].y;
          if (dx * dx + dy * dy <= queenAuraSq) {
            ant.queenBuffed = true;
            break;
          }
        }
      }

      if (ant.type === 'scout') {
        this.updateScout(ant, dt, world, particles, stats, events, rushMult);
      } else if (ant.type === 'warrior') {
        this.updateWarrior(ant, dt, world, particles, stats, events, rushMult);
      } else if (ant.type === 'queen') {
        this.updateQueen(ant, dt, world, particles, stats, events, rushMult);
      } else if (ant.type === 'compass') {
        this.updateCompass(ant, dt, world, particles, stats, events, rushMult);
      } else {
        this.updateWorkerOrBrood(ant, dt, world, particles, stats, events, beacon, rushMult);
      }

      ant.trailTimer += dt;
      if (ant.type === 'compass') {
        if (ant.trailTimer >= 0.11) {
          ant.trailTimer = 0;
          const lastPt = this.scentTrail[this.scentTrail.length - 1];
          if (!lastPt || Math.hypot(ant.x - lastPt.x, ant.y - lastPt.y) >= 2.2) {
            this.scentTrail.push({ x: ant.x, y: ant.y, angle: ant.angle, life: 16, maxLife: 16 });
            if (this.scentTrail.length > 180) this.scentTrail.shift();
          }
          particles.spawn(ant.x, ant.y, 255, 224, 125, 1, 8, 0.85, 1.5);
        }
      } else if (ant.trailTimer > (rushMult > 1 ? 0.35 : 1.35)) {
        ant.trailTimer = 0;
        if (rushMult > 1) {
          particles.spawn(ant.x, ant.y, 255, 226, 106, 1, 10, 0.5, 1.3);
        } else if (ant.queenBuffed && Math.random() < 0.55) {
          particles.spawn(ant.x, ant.y, 240, 145, 255, 1, 8, 0.45, 1.2);
        } else if (Math.random() < 0.22) {
          particles.spawnAmbientSpore(ant.x, ant.y);
        }
      }
    }

    return events;
  }

  private computeDamage(baseDmg: number, cell: CellType, stats: ColonyStats): number {
    let dmg = baseDmg + (stats.globalDmgBonus || 0);
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
    events: AntUpdateEvents,
    silentDig = false
  ) {
    events.dugPixels += res.dugCount;
    events.damagedPixels += res.damagedCount;
    if (!silentDig && (res.dugCount > 0 || res.damagedCount > 0)) {
      events.dugPoints.push({ x, y });
    }
    events.crystalsBroken += res.crystalsBroken;
    events.artRevealed += res.artRevealed;
    if (!silentDig && res.artRevealed > 0) {
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
    for (let i = 0; i < res.sporeBlasts.length; i++) {
      const sp = res.sporeBlasts[i];
      events.sporeBlasts.push(sp);
      particles.spawn(sp.x, sp.y, 255, 118, 68, 28, 44, 1.4, 2.3);
      particles.spawn(sp.x, sp.y, 255, 226, 128, 16, 32, 1.1, 1.8);
    }
    for (let i = 0; i < res.sugarDustHits.length; i++) {
      const sd = res.sugarDustHits[i];
      events.sugarDustHits.push(sd);
      particles.spawn(sd.x, sd.y, 255, 232, 110, 22, 34, 1.5, 2.0);
    }
    for (let i = 0; i < res.cocoonHatches.length; i++) {
      events.cocoonHatches.push(res.cocoonHatches[i]);
    }
    if (res.crystalsBroken > 0) {
      particles.spawn(x, y, 75, 235, 255, 16, 30, 1.3, 2.0);
    } else if (!silentDig && res.dugCount > 0) {
      particles.spawn(x, y, rgb[0], rgb[1], rgb[2], 2, 14, 0.55, 1.3);
    } else if (!silentDig && res.damagedCount > 0 && Math.random() < 0.35) {
      particles.spawn(x, y, 255, 190, 90, 1, 10, 0.35, 1.0);
    }
  }

  /** Bloodhound ("Ищейка"): tracks Sugar with a glowing lingering golden trajectory ribbon & strong tunneling bite! */
  private updateCompass(
    ant: Ant,
    dt: number,
    world: World,
    particles: ParticleSystem,
    stats: ColonyStats,
    events: AntUpdateEvents,
    rushMult: number
  ) {
    const cfg = ANT_TYPES.compass;
    const auraSpd = ant.queenBuffed ? 1.35 : 1;
    const auraDmg = ant.queenBuffed ? 1 : 0;
    const speed = cfg.baseSpeed * stats.globalSpeedMult * auraSpd * rushMult;
    const biteInterval = cfg.baseBiteInterval / (stats.globalSpeedMult * auraSpd * rushMult);

    if (ant.turnTimer <= 0) {
      const toSugar = Math.atan2(world.sugarY - ant.y, world.sugarX - ant.x);
      // Gentle natural sniff wobble ±0.22 rad while clearly indicating the direction of Sugar!
      const jitter = (Math.random() - 0.5) * 0.44;
      ant.fixedAngle = toSugar + jitter;
      ant.turnTimer = 0.4 + Math.random() * 0.3;
    }

    // Smoothly turn toward sugar bearing
    let diff = ant.fixedAngle - ant.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ant.angle += diff * Math.min(1, dt * 6.5);

    const probeX = ant.x + Math.cos(ant.angle) * 1.5;
    const probeY = ant.y + Math.sin(ant.angle) * 1.5;
    const ix = Math.round(probeX);
    const iy = Math.round(probeY);

    if (!world.inBounds(ix, iy)) return;

    const ahead = world.getCell(ix, iy);
    const blockedWall = ahead === CellType.HiddenArt || !world.isInsidePlayable(ix, iy);
    if (ahead === CellType.Empty && !blockedWall) {
      const nx = ant.x + Math.cos(ant.angle) * speed * dt;
      const ny = ant.y + Math.sin(ant.angle) * speed * dt;
      if (world.canAntStep(ant.x, ant.y, nx, ny)) {
        ant.x = nx;
        ant.y = ny;
        ant.legPhase += dt * speed * 1.4;
      } else {
        const slideDir = ant.wallSlideDir || (Math.random() < 0.5 ? 1 : -1);
        ant.wallSlideDir = slideDir;
        ant.angle += slideDir * 0.85;
        ant.fixedAngle = ant.angle;
        ant.turnTimer = 0.6;
      }
    } else if (blockedWall) {
      if (ahead === CellType.HiddenArt) {
        const res = world.dig(ix, iy, cfg.baseRadius, 1, ant.x, ant.y);
        this.applyDigEvents(res, ix, iy, cfg.rgb, world, particles, events);
      }
      const slideDir = ant.wallSlideDir || (Math.random() < 0.5 ? 1 : -1);
      ant.wallSlideDir = slideDir;
      ant.angle += slideDir * 0.85;
      ant.fixedAngle = ant.angle;
      ant.turnTimer = 0.65;
    } else {
      ant.legPhase += dt * 5.2;
      if (ant.biteTimer <= 0) {
        ant.biteTimer = biteInterval;
        ant.biteFlash = 1;
        const dmg = this.computeDamage(cfg.baseDamage + auraDmg, ahead, stats);
        const res = world.dig(probeX, probeY, cfg.baseRadius, dmg, ant.x, ant.y);
        this.applyDigEvents(res, probeX, probeY, cfg.rgb, world, particles, events);
      }
    }
  }

  /** Helper: tests whether moving along `angle` hits HiddenArt or leaves interiorMask within `dist` px */
  private hitsArtAlong(world: World, x: number, y: number, angle: number, dist: number): boolean {
    const steps = Math.max(1, Math.ceil(dist / 1.2));
    for (let s = 1; s <= steps; s++) {
      const d = (dist * s) / steps;
      const px = Math.round(x + Math.cos(angle) * d);
      const py = Math.round(y + Math.sin(angle) * d);
      if (!world.inBounds(px, py) || world.getCell(px, py) === CellType.HiddenArt || !world.isInsidePlayable(px, py)) {
        return true;
      }
    }
    return false;
  }

  private updateWorkerOrBrood(
    ant: Ant,
    dt: number,
    world: World,
    particles: ParticleSystem,
    stats: ColonyStats,
    events: AntUpdateEvents,
    beacon: PheromoneBeacon | null,
    rushMult: number
  ) {
    const isWorker = ant.type === 'worker';
    const isEvolved = isWorker && stats.worker.evolved;
    const cfg = ANT_TYPES[ant.type];
    const auraSpd = ant.queenBuffed ? 1.35 : 1;
    const auraDmg = ant.queenBuffed ? 1 : 0;
    const baseSpdMult = (isWorker ? stats.worker.speedMult : stats.globalSpeedMult) * auraSpd * rushMult;
    const speed = cfg.baseSpeed * baseSpdMult;
    const biteInterval = cfg.baseBiteInterval / baseSpdMult;
    const rawDmg = cfg.baseDamage + (isWorker ? stats.worker.dmgBonus : stats.queen.broodDmgBonus) + auraDmg;
    const digRadius = isEvolved ? cfg.baseRadius + 0.8 : cfg.baseRadius;

    if (ant.wallSlideTimer && ant.wallSlideTimer > 0) {
      ant.wallSlideTimer = Math.max(0, ant.wallSlideTimer - dt);
    }

    if (ant.turnTimer <= 0) {
      const sliding = (ant.wallSlideTimer || 0) > 0;
      const cleanupActive = !beacon && world.isEndgameCleanup();
      if (sliding) {
        // Check if path toward beacon (or >=98% endgame cleanup pocket) has opened up past the obstacle!
        if (beacon) {
          const toBeacon = Math.atan2(beacon.y - ant.y, beacon.x - ant.x);
          if ((ant.wallSlideTimer || 0) < 1.3 && !this.hitsArtAlong(world, ant.x, ant.y, toBeacon, 5.5)) {
            ant.wallSlideTimer = 0;
            ant.angle = toBeacon + (Math.random() - 0.5) * 0.45;
          } else {
            ant.angle += (Math.random() - 0.5) * 0.24;
          }
        } else if (cleanupActive && (ant.wallSlideTimer || 0) < 0.95) {
          const target = world.getCleanupTarget(ant.x, ant.y);
          if (target) {
            const toTarget = Math.atan2(target.y - ant.y, target.x - ant.x);
            if (!this.hitsArtAlong(world, ant.x, ant.y, toTarget, 5.0)) {
              ant.wallSlideTimer = 0;
              ant.angle = toTarget + (Math.random() - 0.5) * 0.42;
            } else {
              ant.angle += (Math.random() - 0.5) * 0.28;
            }
          } else {
            ant.angle += (Math.random() - 0.5) * 0.35;
          }
        } else {
          ant.angle += (Math.random() - 0.5) * 0.35;
        }
        ant.turnTimer = 0.28 + Math.random() * 0.25;
      } else if (beacon) {
        const dxB = beacon.x - ant.x;
        const dyB = beacon.y - ant.y;
        const distB = Math.hypot(dxB, dyB);
        if (distB > 11) {
          const toBeacon = Math.atan2(dyB, dxB);
          // Look ahead for indestructible HiddenArt walls BEFORE colliding so ants glide cleanly around curves!
          if (this.hitsArtAlong(world, ant.x, ant.y, toBeacon, 4.0)) {
            const leftA = toBeacon - Math.PI * 0.48;
            const rightA = toBeacon + Math.PI * 0.48;
            const leftBlocked = this.hitsArtAlong(world, ant.x, ant.y, leftA, 4.0);
            const rightBlocked = this.hitsArtAlong(world, ant.x, ant.y, rightA, 4.0);
            const dir = !leftBlocked && rightBlocked ? -1 : leftBlocked && !rightBlocked ? 1 : ant.wallSlideDir || (Math.random() < 0.5 ? 1 : -1);
            ant.wallSlideDir = dir;
            ant.wallSlideTimer = 1.65 + Math.random() * 0.55;
            ant.angle = toBeacon + dir * (Math.PI * 0.48);
          } else {
            let diff = toBeacon - ant.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            ant.angle += diff * 0.58 + (Math.random() - 0.5) * (isWorker ? 0.52 : 0.72);
          }
        } else {
          // Arrived inside the beacon zone — scatter naturally & dig all around it!
          ant.angle += (Math.random() - 0.5) * 1.35;
        }
        ant.turnTimer = (isWorker ? 0.55 : 0.35) + Math.random() * 0.5;
      } else if (cleanupActive && Math.random() < 0.72) {
        // Endgame cleanup shift (>= 98% dug): Workers & Brood subtly bias toward leftover un-dug interior blocks!
        const target = world.getCleanupTarget(ant.x, ant.y);
        if (target) {
          const dxT = target.x - ant.x;
          const dyT = target.y - ant.y;
          const distT = Math.hypot(dxT, dyT);
          const toTarget = Math.atan2(dyT, dxT);
          if (distT > 2.5 && this.hitsArtAlong(world, ant.x, ant.y, toTarget, 4.0)) {
            const leftA = toTarget - Math.PI * 0.48;
            const rightA = toTarget + Math.PI * 0.48;
            const leftBlocked = this.hitsArtAlong(world, ant.x, ant.y, leftA, 4.0);
            const rightBlocked = this.hitsArtAlong(world, ant.x, ant.y, rightA, 4.0);
            const dir =
              !leftBlocked && rightBlocked
                ? -1
                : leftBlocked && !rightBlocked
                  ? 1
                  : ant.wallSlideDir || (Math.random() < 0.5 ? 1 : -1);
            ant.wallSlideDir = dir;
            ant.wallSlideTimer = 1.2 + Math.random() * 0.45;
            ant.angle = toTarget + dir * (Math.PI * 0.48);
          } else {
            let diff = toTarget - ant.angle;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            ant.angle += diff * 0.62 + (Math.random() - 0.5) * (isWorker ? 0.44 : 0.6);
          }
          ant.turnTimer = (isWorker ? 0.46 : 0.32) + Math.random() * 0.42;
        } else {
          ant.angle += (Math.random() - 0.5) * (isWorker ? 1.05 : 1.5);
          ant.turnTimer = (isWorker ? 0.65 : 0.35) + Math.random() * 0.7;
        }
      } else {
        ant.angle += (Math.random() - 0.5) * (isWorker ? 1.05 : 1.5);
        ant.turnTimer = (isWorker ? 0.65 : 0.35) + Math.random() * 0.7;
      }
    }

    const lookDist = 1.35;
    const probeX = ant.x + Math.cos(ant.angle) * lookDist;
    const probeY = ant.y + Math.sin(ant.angle) * lookDist;
    const ix = Math.round(probeX);
    const iy = Math.round(probeY);

    if (!world.inBounds(ix, iy)) {
      const dir = ant.wallSlideDir || (Math.random() < 0.5 ? 1 : -1);
      ant.wallSlideDir = dir;
      ant.wallSlideTimer = 1.4;
      ant.angle += dir * (Math.PI * 0.65);
      return;
    }

    const ahead = world.getCell(ix, iy);
    const nx = ant.x + Math.cos(ant.angle) * speed * dt;
    const ny = ant.y + Math.sin(ant.angle) * speed * dt;
    const hitBarrier = ahead === CellType.HiddenArt || !world.isInsidePlayable(ix, iy);

    if (ahead === CellType.Empty && !hitBarrier && world.canAntStep(ant.x, ant.y, nx, ny)) {
      ant.x = nx;
      ant.y = ny;
      ant.legPhase += dt * speed * 1.45;
    } else if (hitBarrier || ahead === CellType.Empty) {
      if (ahead === CellType.HiddenArt) {
        const res = world.dig(ix, iy, digRadius, 1, ant.x, ant.y);
        this.applyDigEvents(res, ix, iy, cfg.rgb, world, particles, events);
      }

      // Smart wall-following obstacle avoidance: keep sliding consistently along the curve without getting stuck!
      const alreadySliding = (ant.wallSlideTimer || 0) > 0.25;
      let dir = ant.wallSlideDir || (Math.random() < 0.5 ? 1 : -1);
      if (!alreadySliding) {
        const leftAng = ant.angle - Math.PI * 0.5;
        const rightAng = ant.angle + Math.PI * 0.5;
        const leftBlocked = this.hitsArtAlong(world, ant.x, ant.y, leftAng, 3.5);
        const rightBlocked = this.hitsArtAlong(world, ant.x, ant.y, rightAng, 3.5);
        if (!leftBlocked && rightBlocked) {
          dir = -1;
        } else if (leftBlocked && !rightBlocked) {
          dir = 1;
        } else if (beacon) {
          const toB = Math.atan2(beacon.y - ant.y, beacon.x - ant.x);
          const lScore = Math.cos(leftAng - toB);
          const rScore = Math.cos(rightAng - toB);
          dir = rScore >= lScore ? 1 : -1;
        }
        ant.wallSlideDir = dir;
      }
      ant.wallSlideTimer = 1.9 + Math.random() * 0.65;
      ant.angle += dir * (alreadySliding ? 0.62 : Math.PI * 0.48 + Math.random() * 0.16);
      ant.turnTimer = 0.32;
    } else {
      ant.legPhase += dt * 4.5;
      if (ant.biteTimer <= 0) {
        ant.biteTimer = biteInterval;
        ant.biteFlash = 1;
        const dmg = this.computeDamage(rawDmg, ahead, stats);
        const res = world.dig(probeX, probeY, digRadius, dmg, ant.x, ant.y);
        this.applyDigEvents(res, probeX, probeY, isEvolved ? [125, 255, 170] : cfg.rgb, world, particles, events);

        // Worker Evolution Capstone (10 SP): 25% chance Emerald Seismic Micro-Pulse on nearby blocks!
        if (isEvolved && Math.random() < 0.25) {
          const pulseRes = world.dig(probeX, probeY, 3.2, 2, ant.x, ant.y);
          this.applyDigEvents(pulseRes, probeX, probeY, [255, 232, 120], world, particles, events);
          particles.spawn(probeX, probeY, 95, 255, 175, 5, 22, 0.55, 1.6);
        }
      }
    }
  }

  private updateScout(
    ant: Ant,
    dt: number,
    world: World,
    particles: ParticleSystem,
    stats: ColonyStats,
    events: AntUpdateEvents,
    rushMult: number
  ) {
    const cfg = ANT_TYPES.scout;
    const auraSpd = ant.queenBuffed ? 1.35 : 1;
    const auraDmg = ant.queenBuffed ? 1 : 0;
    const speed = cfg.baseSpeed * stats.scout.speedMult * auraSpd * rushMult;
    const rawDmg = cfg.baseDamage + stats.scout.dmgBonus + auraDmg;

    const totalDist = speed * dt;
    // Fine 0.5px micro-stepping guarantees high-speed Scouts NEVER tunnel across 1px HiddenArt walls!
    const steps = Math.max(1, Math.ceil(totalDist / 0.5));
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

      if (world.canAntStep(ant.x, ant.y, nx, ny)) {
        ant.x = nx;
        ant.y = ny;
      } else {
        const cell = world.getCell(ix, iy);
        if (ant.biteTimer <= 0 && cell !== CellType.Empty && (cell === CellType.HiddenArt || world.isInsidePlayable(ix, iy))) {
          ant.biteTimer = cfg.baseBiteInterval;
          ant.biteFlash = 1;
          const dmg = this.computeDamage(rawDmg, cell, stats);
          const res = world.dig(ix, iy, cfg.baseRadius, dmg, ant.x, ant.y);
          this.applyDigEvents(res, ix, iy, cfg.rgb, world, particles, events);

          // Scout Skill: "Ядовитый рикошет" — applies lingering acid corrosion on ricochet!
          if (stats.scout.poisonRank > 0 && cell !== CellType.HiddenArt && cell !== CellType.Sugar) {
            const dps = [0, 1.3, 2.3, 3.5][Math.min(3, stats.scout.poisonRank)];
            const pRad = 1.6 + stats.scout.poisonRank * 0.45;
            world.applyPoison(ix, iy, pRad, dps, 4.5, ant.x, ant.y);
            particles.spawn(ix, iy, 125, 255, 95, 4, 18, 0.65, 1.4);
          }
        }

        const solidX = !world.canAntStep(ant.x, ant.y, nx, ant.y);
        const solidY = !world.canAntStep(ant.x, ant.y, ant.x, ny);
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
    events: AntUpdateEvents,
    rushMult: number
  ) {
    const cfg = ANT_TYPES.warrior;
    const auraSpd = ant.queenBuffed ? 1.35 : 1;
    const auraDmg = ant.queenBuffed ? 1 : 0;
    const spdMult = stats.warrior.speedMult * auraSpd * rushMult;
    const speed = cfg.baseSpeed * spdMult;
    const biteInterval = cfg.baseBiteInterval / spdMult;
    const rawDmg = cfg.baseDamage + stats.warrior.dmgBonus + auraDmg;
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
    const nx = ant.x + Math.cos(ant.angle) * speed * dt;
    const ny = ant.y + Math.sin(ant.angle) * speed * dt;
    const hitBarrier = ahead === CellType.HiddenArt || !world.isInsidePlayable(ix, iy);

    if (ahead === CellType.Empty && !hitBarrier && world.canAntStep(ant.x, ant.y, nx, ny)) {
      ant.x = nx;
      ant.y = ny;
      ant.legPhase += dt * speed * 1.45;
    } else if (hitBarrier || ahead === CellType.Empty) {
      if (ahead === CellType.HiddenArt) {
        const res = world.dig(ix, iy, radius, 1, ant.x, ant.y);
        this.applyDigEvents(res, ix, iy, cfg.rgb, world, particles, events);
      }
      ant.fixedAngle += (Math.random() < 0.5 ? 1 : -1) * (Math.PI * 0.35);
      ant.angle = ant.fixedAngle;
    } else {
      ant.legPhase += dt * 3.8;
      if (ant.biteTimer <= 0) {
        ant.biteTimer = biteInterval;
        ant.biteFlash = 1;
        const dmg = this.computeDamage(rawDmg, ahead, stats);
        const res = world.dig(probeX, probeY, radius, dmg, ant.x, ant.y);
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
    events: AntUpdateEvents,
    rushMult: number
  ) {
    const cfg = ANT_TYPES.queen;

    ant.spawnTimer -= dt * stats.queen.spawnRateMult * rushMult;
    if (ant.spawnTimer <= 0) {
      ant.spawnTimer = 3.2;
      this.spawnBrood(ant.x, ant.y, world, stats, particles, events);
      this.spawnBrood(ant.x, ant.y, world, stats, particles, events);
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

    if (!world.inBounds(ix, iy) || world.getCell(ix, iy) === CellType.HiddenArt || !world.isInsidePlayable(ix, iy)) {
      ant.angle += Math.PI * 0.65;
      return;
    }

    const ahead = world.getCell(ix, iy);
    const nx = ant.x + Math.cos(ant.angle) * cfg.baseSpeed * stats.globalSpeedMult * rushMult * dt;
    const ny = ant.y + Math.sin(ant.angle) * cfg.baseSpeed * stats.globalSpeedMult * rushMult * dt;
    if (ahead === CellType.Empty) {
      if (world.canAntStep(ant.x, ant.y, nx, ny)) {
        ant.x = nx;
        ant.y = ny;
        ant.legPhase += dt * cfg.baseSpeed * 1.5;
      } else {
        ant.angle += Math.PI * 0.65;
      }
    } else {
      if (ant.biteTimer <= 0) {
        ant.biteTimer = cfg.baseBiteInterval / (stats.globalSpeedMult * rushMult);
        ant.biteFlash = 1;
        const dmg = this.computeDamage(cfg.baseDamage, ahead, stats);
        const res = world.dig(probeX, probeY, cfg.baseRadius, dmg, ant.x, ant.y);
        this.applyDigEvents(res, probeX, probeY, cfg.rgb, world, particles, events);
      }
      if (Math.random() < 0.04) {
        ant.angle += (Math.random() < 0.5 ? 1 : -1) * 0.9;
      }
    }
  }
}
