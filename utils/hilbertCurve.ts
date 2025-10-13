/**
 * Grid36 Tile ID Generation
 * Uses Gilbert curve and the new Grid36 hierarchical system
 */

import { encodeToGrid36 } from './coordinateConversion';

/**
 * Get tile ID from coordinates using Grid36 system
 * This replaces the old Hilbert-based implementation
 */
export function getTileIdFromCoordinates(
  easting: number, 
  northing: number, 
  depth: number
): string {
  // Convert SIRGAS coordinates to WGS84 for encoding
  // Simplified inverse transformation
  const SIRGAS_PARAMS = {
    eastingAtFalseOrigin: 5000000,
    northingAtFalseOrigin: 10000000,
    longitudeOfFalseOrigin: -54,
    latitudeOfFalseOrigin: -12
  };
  
  const deltaX = easting - SIRGAS_PARAMS.eastingAtFalseOrigin;
  const deltaY = northing - SIRGAS_PARAMS.northingAtFalseOrigin;
  const longitude = SIRGAS_PARAMS.longitudeOfFalseOrigin + (deltaX / 111320);
  const latitude = SIRGAS_PARAMS.latitudeOfFalseOrigin + (deltaY / 111320);
  
  // Use the new Grid36 encoding
  const result = encodeToGrid36(longitude, latitude, depth);
  return result.hash;
}