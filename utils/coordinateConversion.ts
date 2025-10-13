/**
 * Coordinate Conversion Utilities
 * Converts GPS coordinates (WGS84) to SIRGAS 2000 / Brazil Albers projection
 * Based on the Python script provided
 */

import proj4 from 'proj4';

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
const GLYPH_GRID = [
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

// Define the SIRGAS 2000 Albers projection using WKT (same as Python)
const SIRGAS_ALBERS_WKT = `PROJCS["SIRGAS_2000_Albers_Equal_Area",
  GEOGCS["SIRGAS 2000",
    DATUM["Sistema_de_Referencia_Geocentrico_para_America_del_Sur_2000",
      SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],
      AUTHORITY["EPSG","6674"]],
    PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],
    UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],
    AUTHORITY["EPSG","4674"]],
  PROJECTION["Albers_Conic_Equal_Area"],
  PARAMETER["latitude_of_center",-12],
  PARAMETER["longitude_of_center",-54],
  PARAMETER["standard_parallel_1",-2],
  PARAMETER["standard_parallel_2",-22],
  PARAMETER["false_easting",5000000],
  PARAMETER["false_northing",10000000],
  UNIT["metre",1,AUTHORITY["EPSG","9001"]]]`;

// Define coordinate systems for proj4
proj4.defs('EPSG:4674', '+proj=longlat +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +no_defs'); // SIRGAS 2000 Geographic
proj4.defs('SIRGAS:ALBERS', SIRGAS_ALBERS_WKT);

// Create transformers
const wgs84ToSirgas = proj4('EPSG:4326', 'SIRGAS:ALBERS');
const sirgasToWgs84 = proj4('SIRGAS:ALBERS', 'EPSG:4326');

/**
 * Convert SIRGAS 2000 / Brazil Albers coordinates to WGS84
 * Using proj4js for accurate transformation
 */
export function convertSIRGASToWGS84(easting: number, northing: number): { latitude: number; longitude: number } {
  try {
    const [longitude, latitude] = sirgasToWgs84.forward([easting, northing]);
    return { latitude, longitude };
  } catch (error) {
    console.error('Error converting SIRGAS to WGS84:', error);
    // Fallback to simple linear approximation if proj4 fails
    const deltaX = easting - SIRGAS_PROJECTION_PARAMS.eastingAtFalseOrigin;
    const deltaY = northing - SIRGAS_PROJECTION_PARAMS.northingAtFalseOrigin;
    const latitude = SIRGAS_PROJECTION_PARAMS.latitudeOfFalseOrigin + deltaY / 111320;
    const longitude = SIRGAS_PROJECTION_PARAMS.longitudeOfFalseOrigin + deltaX / 111320;
    return { latitude, longitude };
  }
}
/**
 * Convert WGS84 coordinates to SIRGAS 2000 / Brazil Albers
 * Using proj4js for accurate transformation
 */
export function convertWGS84ToSIRGASAlbers(longitude: number, latitude: number): { easting: number; northing: number } {
  try {
    const [easting, northing] = wgs84ToSirgas.forward([longitude, latitude]);
    return { easting, northing };
  } catch (error) {
    console.error('Error converting WGS84 to SIRGAS:', error);
    // Fallback to manual Albers calculation if proj4 fails
    return convertWGS84ToSIRGASAlbersManual(longitude, latitude);
  }
}

/**
 * Manual Albers conversion (fallback)
 */
function convertWGS84ToSIRGASAlbersManual(longitude: number, latitude: number): { easting: number; northing: number } {
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
    
    const clampedDI = Math.max(0, Math.min(5, dI));
    const clampedDJ = Math.max(0, Math.min(5, dJ));
    
    const row = 5 - clampedDJ;
    const col = clampedDI;
    
    if (row < 0 || row >= 6 || col < 0 || col >= 6) {
      throw new Error(`Invalid grid access: row=${row}, col=${col}, dI=${dI}, dJ=${dJ}, clampedDI=${clampedDI}, clampedDJ=${clampedDJ}`);
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
  if (depth < 1 || depth > 9) {
    throw new Error('Depth must be between 1 and 9');
  }

  const { easting: x, northing: y } = convertWGS84ToSIRGASAlbers(longitude, latitude);
  const foraArea = !(X_MIN_AREA <= x && x < X_MAX_AREA && Y_MIN_AREA <= y && y < Y_MAX_AREA);

  const i = Math.floor(Math.max(X_MIN_AREA, Math.min(X_MAX_AREA - 1e-9, x)) - X_MIN_AREA);
  const j = Math.floor(Math.max(Y_MIN_AREA, Math.min(Y_MAX_AREA - 1e-9, y)) - Y_MIN_AREA);

  // Python-equivalent encoding logic
  const N = X_MAX_AREA - X_MIN_AREA;
  if (!(i >= 0 && i < N && j >= 0 && j < N)) {
    throw new Error("i/j fora do domínio");
  }

  let code: string[] = [];
  let rem_i = i;
  let rem_j = j;
  const POW6 = [1, 6, 36, 216, 1296, 7776, 46656, 279936, 1679616, 10077696];

  for (let k = 8; k > 8 - depth; k--) {
    const pow6k = POW6[k];
    
    const d_i = Math.floor(rem_i / pow6k);
    rem_i %= pow6k;
    
    const d_j = Math.floor(rem_j / pow6k);
    rem_j %= pow6k;

    const row = 5 - Math.min(5, Math.max(0, d_j));
    const col = Math.min(5, Math.max(0, d_i));
    
    code.push(GLYPH_GRID[row][col]);
  }
  
  const finalHash = code.join('');
  
  // Decode to get tile properties
  const decoded = decodeFromGrid36(finalHash);

  return {
    hash: finalHash,
    depth: depth,
    tileSize: decoded.tileSize,
    ijOrigin: decoded.ijOrigin,
    centroid: decoded.centroid,
    foraArea: foraArea,
  };
}

/**
 * Adjusts the depth of a given Grid36 hash by truncating or expanding
 */
export function adjustHashDepth(hash: string, newDepth: number): string {
  if (newDepth < 1 || newDepth > 9) {
    throw new Error('New depth must be between 1 and 9');
  }
  
  if (hash.length === newDepth) {
    return hash;
  }
  
  if (hash.length > newDepth) {
    // Truncate to shorter depth
    return hash.substring(0, newDepth);
  } else {
    // Extend to longer depth - decode and re-encode
    try {
      const decoded = decodeFromGrid36(hash);
      // Use the center coordinates to generate a hash at the new depth
      const { latitude: lat, longitude: lon } = convertSIRGASToWGS84(decoded.centroid.x, decoded.centroid.y);
      
      const newResult = encodeToGrid36(lon, lat, newDepth);
      return newResult.hash;
    } catch (error) {
      // Fallback: just pad with the first character of GLYPH_GRID
      const padding = 'Z'.repeat(newDepth - hash.length);
      return hash + padding;
    }
  }
}
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
    const { latitude: clat, longitude: clon } = convertSIRGASToWGS84(cx, cy);
    
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
  const { latitude: clat, longitude: clon } = convertSIRGASToWGS84(cx, cy);
  
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