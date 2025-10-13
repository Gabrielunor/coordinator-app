/**
 * Gilbert Curve Implementation for Grid36 System
 * JavaScript implementation of the Gilbert curve for spatial indexing (6x6 grid)
 */

export type GilbertPoint = [number, number];

/**
 * Generate Gilbert curve order for a 6x6 grid
 * This creates the spatial ordering used in the Grid36 system
 */
export function gilbertOrder(width: number, height: number): GilbertPoint[] {
  const path: GilbertPoint[] = [];
  
  function recurse(
    x: number, 
    y: number, 
    ax: number, 
    ay: number, 
    bx: number, 
    by: number, 
    w: number, 
    h: number
  ): void {
    if (w === 1) {
      for (let i = 0; i < h; i++) {
        path.push([x, y + (by > 0 ? i : (h - 1 - i))]);
      }
      return;
    }
    
    if (h === 1) {
      for (let i = 0; i < w; i++) {
        path.push([x + (ax > 0 ? i : (w - 1 - i)), y]);
      }
      return;
    }
    
    const w2 = Math.floor(w / 2);
    const h2 = Math.floor(h / 2);
    
    if (w > h) {
      recurse(x, y, ax, ay, bx, by, w2, h);
      recurse(x + w2, y, ax, ay, bx, by, w - w2, h);
    } else {
      recurse(x, y, ax, ay, bx, by, w, h2);
      recurse(x, y + h2, ax, ay, bx, by, w, h - h2);
    }
  }
  
  recurse(0, 0, 1, 0, 0, 1, width, height);
  return path;
}

/**
 * Pre-computed Gilbert curve order for 6x6 grid
 * This matches the GILBERT_6x6 from the Python implementation
 */
export const GILBERT_6x6: GilbertPoint[] = gilbertOrder(6, 6);

/**
 * Gilbert Curve class for Grid36 system
 */
export class GilbertCurve {
  private base: number;
  private maxDepth: number;
  private order: GilbertPoint[];
  private indexToCell: Record<number, GilbertPoint>;
  private cellToIndex: Record<string, number>;

  constructor(base: number = 6, maxDepth: number = 9) {
    this.base = base;
    this.maxDepth = maxDepth;
    this.order = gilbertOrder(base, base);
    
    // Build lookup tables
    this.indexToCell = {};
    this.cellToIndex = {};
    
    this.order.forEach((cell, index) => {
      this.indexToCell[index] = cell;
      this.cellToIndex[`${cell[0]},${cell[1]}`] = index;
    });
  }

  /**
   * Convert 2D grid coordinates to Gilbert curve index
   */
  pointToIndex(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.base || y >= this.base) {
      throw new Error(`Coordinates must be within bounds [0, ${this.base - 1}]`);
    }
    
    const key = `${x},${y}`;
    const index = this.cellToIndex[key];
    
    if (index === undefined) {
      throw new Error(`Invalid coordinates: (${x}, ${y})`);
    }
    
    return index;
  }

  /**
   * Convert Gilbert curve index to 2D grid coordinates
   */
  indexToPoint(index: number): GilbertPoint {
    if (index < 0 || index >= this.order.length) {
      throw new Error(`Index must be between 0 and ${this.order.length - 1}`);
    }
    
    const point = this.indexToCell[index];
    if (!point) {
      throw new Error(`Invalid index: ${index}`);
    }
    
    return point;
  }

  /**
   * Get the total number of cells in the curve
   */
  get length(): number {
    return this.order.length;
  }

  /**
   * Get the Gilbert curve order
   */
  get curveOrder(): GilbertPoint[] {
    return [...this.order];
  }
}

/**
 * Default Gilbert curve instance for Grid36 (6x6)
 */
export const defaultGilbertCurve = new GilbertCurve(6, 9);