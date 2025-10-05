/**
 * Hilbert Curve Implementation
 * JavaScript implementation of the Hilbert curve for spatial indexing
 */

export class HilbertCurve {
  private order: number;
  private dimension: number;
  private maxH: number;

  constructor(order: number, dimension: number = 2) {
    if (order < 1) {
      throw new Error("Order must be at least 1");
    }
    if (dimension !== 2) {
      throw new Error("Only 2D Hilbert curves are supported");
    }
    
    this.order = order;
    this.dimension = dimension;
    this.maxH = Math.pow(2, order * dimension) - 1;
  }

  /**
   * Convert 2D coordinates to Hilbert distance
   */
  pointToDistance(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= Math.pow(2, this.order) || y >= Math.pow(2, this.order)) {
      throw new Error(`Coordinates must be within bounds [0, ${Math.pow(2, this.order) - 1}]`);
    }

    let d = 0;
    let n = Math.pow(2, this.order);
    
    for (let s = n / 2; s >= 1; s /= 2) {
      let rx = (x & s) > 0 ? 1 : 0;
      let ry = (y & s) > 0 ? 1 : 0;
      d += s * s * ((3 * rx) ^ ry);
      const rotated = this.rotate(n, x, y, rx, ry);
      x = rotated.x;
      y = rotated.y;
    }
    
    return d;
  }

  /**
   * Convert Hilbert distance to 2D coordinates
   */
  distanceToPoint(d: number): { x: number; y: number } {
    if (d < 0 || d > this.maxH) {
      throw new Error(`Distance must be between 0 and ${this.maxH}`);
    }

    let x = 0, y = 0;
    let n = Math.pow(2, this.order);
    
    for (let s = 1; s < n; s *= 2) {
      let rx = 1 & (d / 2);
      let ry = 1 & (d ^ rx);
      const rotated = this.rotate(s, x, y, rx, ry);
      x = rotated.x + s * rx;
      y = rotated.y + s * ry;
      d /= 4;
    }
    
    return { x, y };
  }

  /**
   * Get distances for multiple points
   */
  distancesFromPoints(points: number[][]): number[] {
    return points.map(point => {
      if (point.length !== 2) {
        throw new Error("Each point must have exactly 2 coordinates");
      }
      return this.pointToDistance(point[0], point[1]);
    });
  }

  private rotate(n: number, x: number, y: number, rx: number, ry: number): { x: number; y: number } {
    if (ry === 0) {
      if (rx === 1) {
        x = n - 1 - x;
        y = n - 1 - y;
      }
      // Swap x and y
      return { x: y, y: x };
    }
    return { x, y };
  }
}

/**
 * Get tile ID from coordinates using Hilbert curve
 */
export function getTileIdFromCoordinates(
  easting: number, 
  northing: number, 
  targetLevel: number
): string {
  const getTileSizeFromLevel = (level: number): number => {
    const baseSize = 100000.0; // 100 km in meters
    return Math.max(baseSize / Math.pow(2, level), 1.0);
  };

  const toBase36 = (number: number): string => {
    const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (number === 0) return alphabet[0];
    
    const base36Chars: string[] = [];
    let num = number;
    
    while (num > 0) {
      const remainder = num % alphabet.length;
      base36Chars.push(alphabet[remainder]);
      num = Math.floor(num / alphabet.length);
    }
    
    return base36Chars.reverse().join("");
  };

  // Constants from coordinate conversion
  const MARCO_ZERO_X = 5000000;
  const MARCO_ZERO_Y = 10000000;
  const Y_MAX_AREA = 12300000;
  const Y_MIN_AREA = 6300000;
  const X_MAX_AREA = 7330000;
  const X_MIN_AREA = 2290000;

  const tileSize = getTileSizeFromLevel(targetLevel);

  // Calculate tile indices
  const originXCentralTile = MARCO_ZERO_X - tileSize / 2;
  const originYCentralTile = MARCO_ZERO_Y - tileSize / 2;

  const iIdx = Math.floor((easting - originXCentralTile) / tileSize);
  const jIdx = Math.floor((northing - originYCentralTile) / tileSize);

  // Calculate normalization offsets for the target level
  const minTileXIdxForLevel = Math.floor((X_MIN_AREA - (MARCO_ZERO_X - tileSize / 2)) / tileSize);
  const minTileYIdxForLevel = Math.floor((Y_MIN_AREA - (MARCO_ZERO_Y - tileSize / 2)) / tileSize);

  const normalizedI = iIdx - minTileXIdxForLevel;
  const normalizedJ = jIdx - minTileYIdxForLevel;

  // Calculate Hilbert curve parameters
  const widthArea = X_MAX_AREA - X_MIN_AREA;
  const heightArea = Y_MAX_AREA - Y_MIN_AREA;

  const numTilesXTotal = Math.ceil(widthArea / tileSize);
  const numTilesYTotal = Math.ceil(heightArea / tileSize);

  const maxDim = Math.max(numTilesXTotal, numTilesYTotal);
  const p = maxDim > 0 ? Math.ceil(Math.log2(maxDim)) : 1;

  const hilbertCurve = new HilbertCurve(Math.max(p, 1));

  // Ensure coordinates are within bounds
  const boundedI = Math.max(0, Math.min(normalizedI, Math.pow(2, Math.max(p, 1)) - 1));
  const boundedJ = Math.max(0, Math.min(normalizedJ, Math.pow(2, Math.max(p, 1)) - 1));

  const hilbertDistance = hilbertCurve.pointToDistance(boundedI, boundedJ);
  
  return toBase36(hilbertDistance);
}