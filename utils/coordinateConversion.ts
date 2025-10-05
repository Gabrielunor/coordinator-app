/**
 * Coordinate Conversion Utilities
 * Converts GPS coordinates (WGS84) to SIRGAS 2000 / Brazil Albers projection
 * Based on the Python script provided
 */

// Constants from the original Python script
export const MARCO_ZERO_X = 5000000;
export const MARCO_ZERO_Y = 10000000;

// Coverage area for Brazil
export const Y_MAX_AREA = 12300000;
export const Y_MIN_AREA = 6300000;
export const X_MAX_AREA = 7330000;
export const X_MIN_AREA = 2290000;

// SIRGAS 2000 / Brazil Albers projection parameters
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
 * Get tile size in meters for a given level
 * Level 0: 100km, each level divides by 2
 */
export function getTileSizeFromLevel(level: number): number {
  const baseSize = 100000.0; // 100 km in meters
  if (level < 0) {
    throw new Error("Level cannot be negative");
  }
  
  const tileSize = baseSize / Math.pow(2, level);
  
  // Minimum tile size is 1m
  return Math.max(tileSize, 1.0);
}

/**
 * Convert number to Base36 representation
 */
export function toBase36(number: number): string {
  if (number < 0 || !Number.isInteger(number)) {
    throw new Error("Number must be a non-negative integer");
  }
  
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const base = alphabet.length;
  
  if (number === 0) return alphabet[0];
  
  const base36Chars: string[] = [];
  let num = number;
  
  while (num > 0) {
    const remainder = num % base;
    base36Chars.push(alphabet[remainder]);
    num = Math.floor(num / base);
  }
  
  return base36Chars.reverse().join("");
}