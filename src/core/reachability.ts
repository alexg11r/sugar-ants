import { CellType } from './types';

export interface ReachabilityResult {
  reachable: Uint8Array;
  /** Exact 4-connected BFS step distance from the nearest seed (-1 if unreachable) */
  dist: Int32Array;
  maxDist: number;
}

/**
 * Computes a 4-connected BFS flood-fill mask AND exact shortest-path distance map
 * from one or more seed points, requiring a 3x3 clearance from indestructible HiddenArt
 * walls so ants can never be blocked by tight 1px diagonal pinches or sealed art pockets.
 */
export function computeReachableWithDist(
  cells: Uint8Array,
  width: number,
  height: number,
  seeds: { x: number; y: number }[]
): ReachabilityResult {
  const size = width * height;
  const passable = new Uint8Array(size);

  // Mark cells with at least 1px clearance (3x3 footprint) free of HiddenArt
  for (let y = 2; y < height - 2; y++) {
    const row = y * width;
    for (let x = 2; x < width - 2; x++) {
      let blocked = false;
      for (let dy = -1; dy <= 1 && !blocked; dy++) {
        const nRow = (y + dy) * width;
        for (let dx = -1; dx <= 1; dx++) {
          if (cells[nRow + (x + dx)] === CellType.HiddenArt) {
            blocked = true;
            break;
          }
        }
      }
      if (!blocked) {
        passable[row + x] = 1;
      }
    }
  }

  const reachable = new Uint8Array(size);
  const dist = new Int32Array(size);
  dist.fill(-1);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;
  let maxDist = 0;

  const enqueueSeed = (sx: number, sy: number) => {
    const cx = Math.round(sx);
    const cy = Math.round(sy);
    let seededAny = false;
    for (let r = 0; r <= 12; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (r > 0 && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 2 || nx >= width - 2 || ny < 2 || ny >= height - 2) continue;
          const idx = ny * width + nx;
          if (passable[idx] === 1 && cells[idx] === CellType.Empty && reachable[idx] === 0) {
            reachable[idx] = 1;
            dist[idx] = 0;
            queue[tail++] = idx;
            seededAny = true;
          }
        }
      }
      if (seededAny) break;
    }

    if (!seededAny) {
      for (let r = 0; r <= 18 && !seededAny; r++) {
        for (let dy = -r; dy <= r && !seededAny; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 2 || nx >= width - 2 || ny < 2 || ny >= height - 2) continue;
            const idx = ny * width + nx;
            if (passable[idx] === 1 && reachable[idx] === 0) {
              reachable[idx] = 1;
              dist[idx] = 0;
              queue[tail++] = idx;
              seededAny = true;
              break;
            }
          }
        }
      }
    }
  };

  for (const s of seeds) {
    enqueueSeed(s.x, s.y);
  }

  while (head < tail) {
    const idx = queue[head++];
    const nextD = dist[idx] + 1;
    const x = idx % width;
    const y = (idx - x) / width;

    if (x > 2) {
      const n = idx - 1;
      if (passable[n] === 1 && reachable[n] === 0) {
        reachable[n] = 1;
        dist[n] = nextD;
        if (nextD > maxDist) maxDist = nextD;
        queue[tail++] = n;
      }
    }
    if (x < width - 3) {
      const n = idx + 1;
      if (passable[n] === 1 && reachable[n] === 0) {
        reachable[n] = 1;
        dist[n] = nextD;
        if (nextD > maxDist) maxDist = nextD;
        queue[tail++] = n;
      }
    }
    if (y > 2) {
      const n = idx - width;
      if (passable[n] === 1 && reachable[n] === 0) {
        reachable[n] = 1;
        dist[n] = nextD;
        if (nextD > maxDist) maxDist = nextD;
        queue[tail++] = n;
      }
    }
    if (y < height - 3) {
      const n = idx + width;
      if (passable[n] === 1 && reachable[n] === 0) {
        reachable[n] = 1;
        dist[n] = nextD;
        if (nextD > maxDist) maxDist = nextD;
        queue[tail++] = n;
      }
    }
  }

  return { reachable, dist, maxDist };
}

export function computeReachableMask(
  cells: Uint8Array,
  width: number,
  height: number,
  seeds: { x: number; y: number }[]
): Uint8Array {
  return computeReachableWithDist(cells, width, height, seeds).reachable;
}

/**
 * Exact 4-connected interior flood-fill from seeds through ALL cells except indestructible HiddenArt!
 * Unlike computeReachableMask (which keeps a 1px margin away from art walls for safe item spawning),
 * interiorMask includes EVERY diggable pixel right up to the 1px face of HiddenArt lines & dots,
 * while strictly sealing off everything outside the outer medallion or inside closed art loops!
 */
export function computeInteriorMask(
  cells: Uint8Array,
  width: number,
  height: number,
  seeds: { x: number; y: number }[]
): Uint8Array {
  const size = width * height;
  const interior = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;

  for (const s of seeds) {
    const cx = Math.max(1, Math.min(width - 2, Math.round(s.x)));
    const cy = Math.max(1, Math.min(height - 2, Math.round(s.y)));
    let seeded = false;
    for (let r = 0; r <= 12 && !seeded; r++) {
      for (let dy = -r; dy <= r && !seeded; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) continue;
          const idx = y * width + x;
          if (cells[idx] !== CellType.HiddenArt && interior[idx] === 0) {
            interior[idx] = 1;
            queue[tail++] = idx;
            seeded = true;
            break;
          }
        }
      }
    }
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;

    if (x > 1) {
      const n = idx - 1;
      if (interior[n] === 0 && cells[n] !== CellType.HiddenArt) {
        interior[n] = 1;
        queue[tail++] = n;
      }
    }
    if (x < width - 2) {
      const n = idx + 1;
      if (interior[n] === 0 && cells[n] !== CellType.HiddenArt) {
        interior[n] = 1;
        queue[tail++] = n;
      }
    }
    if (y > 1) {
      const n = idx - width;
      if (interior[n] === 0 && cells[n] !== CellType.HiddenArt) {
        interior[n] = 1;
        queue[tail++] = n;
      }
    }
    if (y < height - 2) {
      const n = idx + width;
      if (interior[n] === 0 && cells[n] !== CellType.HiddenArt) {
        interior[n] = 1;
        queue[tail++] = n;
      }
    }
  }

  return interior;
}

/**
 * Checks whether an entire (2*margin+1)x(2*margin+1) square around (cx, cy)
 * lies strictly inside the reachable region and contains only diggable terrain (no Empty / HiddenArt).
 */
export function isReachableTerrainSquare(
  cells: Uint8Array,
  reachable: Uint8Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  margin: number
): boolean {
  if (cx - margin < 3 || cx + margin >= width - 3 || cy - margin < 3 || cy + margin >= height - 3) {
    return false;
  }
  for (let dy = -margin; dy <= margin; dy++) {
    const row = (cy + dy) * width;
    for (let dx = -margin; dx <= margin; dx++) {
      const idx = row + (cx + dx);
      if (reachable[idx] !== 1) return false;
      const c = cells[idx] as CellType;
      if (c === CellType.HiddenArt || c === CellType.Empty || c === CellType.Sugar) {
        return false;
      }
    }
  }
  return true;
}
