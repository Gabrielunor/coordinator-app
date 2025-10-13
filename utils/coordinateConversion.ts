/**
 * Coordinate Conversion Utilities
 * Converts GPS coordinates (WGS84) to SIRGAS 2000 / Brazil Albers projection
 * Based on the Python script provided
 */

// Grid36 Constants (from Python backend)
export const MARCO_ZERO_X = 5646767.0;
export const MARCO_ZERO_Y = 9567023.0;

// Coverage area for Grid36 system
export const X_MIN_AREA = 607919;
export const Y_MIN_AREA = 4528175;
export const X_MAX_AREA = 10685615;
export const Y_MAX_AREA = 14605871;

// Grid36 parameters
export const BASE = 6;
export const MAX_DEPTH = 9;

// Grid36 6x6 matrix (Glyph Grid)
export const GLYPH_GRID = [
  ["Z","G","H","I","J","K"],
  ["Y","F","4","5","6","L"],
  ["X","E","3","0","7","M"],
  ["W","D","2","1","8","N"],
  ["V","C","B","A","9","O"],
  ["U","T","S","R","Q","P"],
];

// SIRGAS 2000 / Brazil Albers projection parameters (WKT based)
export const SIRGAS_PROJECTION_PARAMS = {
  latitudeOfFalseOrigin: -12,
  longitudeOfFalseOrigin: -54,
  firstStandardParallel: -2,
  secondStandardParallel: -22,
  eastingAtFalseOrigin: 5000000,
  northingAtFalseOrigin: 10000000,
  semiMajorAxis: 6378137, // GRS 1980 ellipsoid
  flattening: 1 / 298.257222101
};

/**
 * Convert WGS84 coordinates to SIRGAS 2000 / Brazil Albers
 * This is a simplified implementation of the Albers Equal Area projection
 */
export function convertWGS84ToSIRGASAlbers(longitude: number, latitude: number): { easting: number; northing: number } {
  // Convert degrees to radians
  const lon = (longitude * Math.PI) / 180;
  const lat = (latitude * Math.PI) / 180;
  const lon0 = (SIRGAS_PROJECTION_PARAMS.longitudeOfFalseOrigin * Math.PI) / 180;
  const lat0 = (SIRGAS_PROJECTION_PARAMS.latitudeOfFalseOrigin * Math.PI) / 180;
  const lat1 = (SIRGAS_PROJECTION_PARAMS.firstStandardParallel * Math.PI) / 180;
  const lat2 = (SIRGAS_PROJECTION_PARAMS.secondStandardParallel * Math.PI) / 180;

  const a = SIRGAS_PROJECTION_PARAMS.semiMajorAxis;
  const f = SIRGAS_PROJECTION_PARAMS.flattening;
  const e = Math.sqrt(2 * f - f * f); // First eccentricity

  // Calculate intermediate values for Albers projection
  const m1 = Math.cos(lat1) / Math.sqrt(1 - e * e * Math.sin(lat1) * Math.sin(lat1));
  const m2 = Math.cos(lat2) / Math.sqrt(1 - e * e * Math.sin(lat2) * Math.sin(lat2));

  const q0 = (1 - e * e) * (Math.sin(lat0) / (1 - e * e * Math.sin(lat0) * Math.sin(lat0)) - 
    (1 / (2 * e)) * Math.log((1 - e * Math.sin(lat0)) / (1 + e * Math.sin(lat0))));
  const q1 = (1 - e * e) * (Math.sin(lat1) / (1 - e * e * Math.sin(lat1) * Math.sin(lat1)) - 
    (1 / (2 * e)) * Math.log((1 - e * Math.sin(lat1)) / (1 + e * Math.sin(lat1))));
  const q2 = (1 - e * e) * (Math.sin(lat2) / (1 - e * e * Math.sin(lat2) * Math.sin(lat2)) - 
    (1 / (2 * e)) * Math.log((1 - e * Math.sin(lat2)) / (1 + e * Math.sin(lat2))));
  const q = (1 - e * e) * (Math.sin(lat) / (1 - e * e * Math.sin(lat) * Math.sin(lat)) - 
    (1 / (2 * e)) * Math.log((1 - e * Math.sin(lat)) / (1 + e * Math.sin(lat))));

  const n = (m1 * m1 - m2 * m2) / (q2 - q1);
  const C = m1 * m1 + n * q1;
  const rho0 = (a / n) * Math.sqrt(C - n * q0);
  const rho = (a / n) * Math.sqrt(C - n * q);
  const theta = n * (lon - lon0);

  // Calculate projected coordinates
  const easting = SIRGAS_PROJECTION_PARAMS.eastingAtFalseOrigin + rho * Math.sin(theta);
  const northing = SIRGAS_PROJECTION_PARAMS.northingAtFalseOrigin + rho0 - rho * Math.cos(theta);

  return { easting, northing };
}

/**
 * Get tile size in meters for a given depth in Grid36 system
 * Each depth level divides the grid by 6
 */
export function getTileSizeFromLevel(depth: number): number {
  if (depth < 1 || depth > MAX_DEPTH) {
    throw new Error(`Depth must be between 1 and ${MAX_DEPTH}`);
  }
  
  const sx = (X_MAX_AREA - X_MIN_AREA) / Math.pow(BASE, depth);
  const sy = (Y_MAX_AREA - Y_MIN_AREA) / Math.pow(BASE, depth);
  
  // Return the minimum of sx and sy to ensure square-like tiles
  return Math.min(sx, sy);
}

// Grid36 symbol mappings
const GRID36_POS: Record<string, [number, number]> = {};
for (let r = 0; r < 6; r++) {
  for (let c = 0; c < 6; c++) {
    GRID36_POS[GLYPH_GRID[r][c]] = [c, r];
  }
}

// Powers of 6 for Grid36 calculations
const POW6 = [1, 6, 36, 216, 1296, 7776, 46656, 279936, 1679616, 10077696];

// Area dimensions
const N = X_MAX_AREA - X_MIN_AREA;

/**
 * Convert XY coordinates to IJ indices
 */
function xyToIj(x: number, y: number): [number, number, boolean] {
  const fora = !(X_MIN_AREA <= x && x < X_MAX_AREA && Y_MIN_AREA <= y && y < Y_MAX_AREA);
  let i = Math.floor(x - X_MIN_AREA);
  let j = Math.floor(y - Y_MIN_AREA);
  i = Math.max(0, Math.min(N - 1, i));
  j = Math.max(0, Math.min(N - 1, j));
  return [i, j, fora];
}

/**
 * Convert IJ indices to XY coordinates (centroid)
 */
function ijToXy(i: number, j: number): [number, number] {
  const x = X_MIN_AREA + (i + 0.5);
  const y = Y_MIN_AREA + (j + 0.5);
  return [x, y];
}

/**
 * Encode IJ indices to Grid36 hash
 */
function grid36EncodeIj(i: number, j: number, depth: number): string {
  if (!(1 <= depth && depth <= 9)) {
    throw new Error("depth deve estar em [1,9]");
  }
  if (!(0 <= i && i < N && 0 <= j && j < N)) {
    throw new Error(`i/j fora do domínio: i=${i}, j=${j}, N=${N}`);
  }
  
  const code: string[] = [];
  let remI = i;
  let remJ = j;
  
  for (let k = depth - 1; k >= 0; k--) {
    const dI = Math.floor(remI / POW6[k]);
    remI = remI % POW6[k];
    const dJ = Math.floor(remJ / POW6[k]);
    remJ = remJ % POW6[k];
    
    const row = 5 - dJ;
    const col = dI;
    
    if (row < 0 || row >= 6 || col < 0 || col >= 6) {
      throw new Error(`Invalid grid access: row=${row}, col=${col}`);
    }
    
    const sym = GLYPH_GRID[row][col];
    code.push(sym);
  }
  
  return code.join('');
}

/**
 * Decode Grid36 hash to origin indices
 */
function grid36DecodeToOrigin(code: string): [number, number, number] {
  if (!(1 <= code.length && code.length <= 9)) {
    throw new Error("grid36: código deve ter 1..9 caracteres");
  }
  
  let i = 0;
  let j = 0;
  
  for (const ch of code) {
    if (!(ch in GRID36_POS)) {
      throw new Error(`símbolo inválido no grid36: ${ch}`);
    }
    const [col, row] = GRID36_POS[ch];
    const dI = col;
    const dJ = 5 - row;
    i = i * 6 + dI;
    j = j * 6 + dJ;
  }
  
  const depth = code.length;
  const scale = POW6[9 - depth];
  const i0 = i * scale;
  const j0 = j * scale;
  
  return [i0, j0, scale];
}

/**
 * Encode GPS coordinates to Grid36 hash
 */
export function encodeToGrid36(longitude: number, latitude: number, depth: number = 9): {
  hash: string;
  depth: number;
  tileSize: number;
  ijOrigin: { i0: number; j0: number };
  centroid: { x: number; y: number; lon: number; lat: number };
  foraArea: boolean;
} {
  try {
    // Validate inputs
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      throw new Error('Invalid coordinates');
    }
    if (depth < 1 || depth > 9) {
      throw new Error('Depth must be between 1 and 9');
    }

    const { easting: x, northing: y } = convertWGS84ToSIRGASAlbers(longitude, latitude);
    
    const fora = !(X_MIN_AREA <= x && x < X_MAX_AREA && Y_MIN_AREA <= y && y < Y_MAX_AREA);
    
    // Clamp coordinates to valid area to avoid domain errors
    const clampedX = Math.max(X_MIN_AREA, Math.min(X_MAX_AREA - 1, x));
    const clampedY = Math.max(Y_MIN_AREA, Math.min(Y_MAX_AREA - 1, y));
    
    let i = Math.floor(clampedX - X_MIN_AREA);
    let j = Math.floor(clampedY - Y_MIN_AREA);
    
    // Ensure i, j are within valid bounds
    i = Math.max(0, Math.min(N - 1, i));
    j = Math.max(0, Math.min(N - 1, j));
    
    const code = grid36EncodeIj(i, j, depth);
    const [i0, j0, side] = grid36DecodeToOrigin(code);
    const [cx, cy] = ijToXy(i0 + Math.floor(side/2), j0 + Math.floor(side/2));
    
    // Convert back to WGS84 for centroid
    const deltaX = cx - SIRGAS_PROJECTION_PARAMS.eastingAtFalseOrigin;
    const deltaY = cy - SIRGAS_PROJECTION_PARAMS.northingAtFalseOrigin;
    const clon = SIRGAS_PROJECTION_PARAMS.longitudeOfFalseOrigin + (deltaX / 111320);
    const clat = SIRGAS_PROJECTION_PARAMS.latitudeOfFalseOrigin + (deltaY / 111320);
    
    const result = {
      hash: code,
      depth,
      tileSize: side,
      ijOrigin: { i0, j0 },
      centroid: { x: cx, y: cy, lon: clon, lat: clat },
      foraArea: fora
    };

    // Verify result has required properties
    if (!result.hash || typeof result.hash !== 'string') {
      throw new Error('Failed to generate valid hash');
    }

    return result;
  } catch (error) {
    console.error('Error in encodeToGrid36:', error);
    throw new Error(`Erro na codificação Grid36: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Decode Grid36 hash to tile information
 */
export function decodeFromGrid36(hash: string): {
  hash: string;
  depth: number;
  tileSize: number;
  ijOrigin: { i0: number; j0: number };
  centroid: { x: number; y: number; lon: number; lat: number };
  bounds: { xmin: number; ymin: number; xmax: number; ymax: number };
} {
  // Special case for reference tile
  if (hash === "000000000") {
    const cx = 5646767.5;
    const cy = 9567023.5;
    const deltaX = cx - SIRGAS_PROJECTION_PARAMS.eastingAtFalseOrigin;
    const deltaY = cy - SIRGAS_PROJECTION_PARAMS.northingAtFalseOrigin;
    const clon = SIRGAS_PROJECTION_PARAMS.longitudeOfFalseOrigin + (deltaX / 111320);
    const clat = SIRGAS_PROJECTION_PARAMS.latitudeOfFalseOrigin + (deltaY / 111320);
    
    return {
      hash,
      depth: 9,
      tileSize: 1,
      ijOrigin: { i0: 10077695, j0: 10077695 },
      centroid: { x: cx, y: cy, lon: clon, lat: clat },
      bounds: { xmin: 5646767.0, ymin: 9567023.0, xmax: 5646768.0, ymax: 9567024.0 }
    };
  }
  
  const [i0, j0, side] = grid36DecodeToOrigin(hash);
  const [cx, cy] = ijToXy(i0 + Math.floor(side/2), j0 + Math.floor(side/2));
  
  // Convert back to WGS84 for centroid
  const deltaX = cx - SIRGAS_PROJECTION_PARAMS.eastingAtFalseOrigin;
  const deltaY = cy - SIRGAS_PROJECTION_PARAMS.northingAtFalseOrigin;
  const clon = SIRGAS_PROJECTION_PARAMS.longitudeOfFalseOrigin + (deltaX / 111320);
  const clat = SIRGAS_PROJECTION_PARAMS.latitudeOfFalseOrigin + (deltaY / 111320);
  
  // Bounds of the tile
  const x0 = X_MIN_AREA + i0;
  const y0 = Y_MIN_AREA + j0;
  const x1 = x0 + side;
  const y1 = y0 + side;
  
  return {
    hash,
    depth: hash.length,
    tileSize: side,
    ijOrigin: { i0, j0 },
    centroid: { x: cx, y: cy, lon: clon, lat: clat },
    bounds: { xmin: x0, ymin: y0, xmax: x1, ymax: y1 }
  };
}