/**
 * Tile Search Utilities for Grid36 System
 * Funcionalidades para busca reversa de tiles por ID usando Grid36
 */

import { decodeFromGrid36, GLYPH_GRID } from './coordinateConversion';

// Constantes do sistema Grid36
const MARCO_ZERO_X = 5646767.0;
const MARCO_ZERO_Y = 9567023.0;
const X_MIN_AREA = 607919;
const Y_MIN_AREA = 4528175;
const X_MAX_AREA = 10685615;
const Y_MAX_AREA = 14605871;

export interface TileSearchResult {
  tileId: string;
  depth: number;
  tileSize: number;
  sirgas: {
    easting: number;
    northing: number;
    centerEasting: number;
    centerNorthing: number;
  };
  gps: {
    latitude: number;
    longitude: number;
    centerLatitude: number;
    centerLongitude: number;
  };
  bounds: {
    minEasting: number;
    maxEasting: number;
    minNorthing: number;
    maxNorthing: number;
  };
}

/**
 * Busca informações de um tile pelo seu ID usando Grid36
 */
export function searchTileById(tileId: string, depth: number): TileSearchResult {
  try {
    // Use the Grid36 decoding system
    const decoded = decodeFromGrid36(tileId);
    
    // Usar a mesma conversão inversa da função encodeToGrid36
    const convertSIRGASToWGS84 = (easting: number, northing: number) => {
      // Esta é a mesma conversão inversa simplificada usada no encode
      const deltaX = easting - 5000000; // SIRGAS_PROJECTION_PARAMS.eastingAtFalseOrigin
      const deltaY = northing - 10000000; // SIRGAS_PROJECTION_PARAMS.northingAtFalseOrigin
      const longitude = -54 + (deltaX / 111320); // longitudeOfFalseOrigin
      const latitude = -12 + (deltaY / 111320); // latitudeOfFalseOrigin
      return { latitude, longitude };
    };
    
    // Converter os cantos e centro usando a mesma lógica
    const bottomLeft = convertSIRGASToWGS84(decoded.bounds.xmin, decoded.bounds.ymin);
    const center = convertSIRGASToWGS84(decoded.centroid.x, decoded.centroid.y);
    
    return {
      tileId: decoded.hash,
      depth: decoded.depth,
      tileSize: decoded.tileSize,
      sirgas: {
        easting: decoded.bounds.xmin,
        northing: decoded.bounds.ymin,
        centerEasting: decoded.centroid.x,
        centerNorthing: decoded.centroid.y,
      },
      gps: {
        latitude: bottomLeft.latitude,
        longitude: bottomLeft.longitude,
        centerLatitude: center.latitude,
        centerLongitude: center.longitude,
      },
      bounds: {
        minEasting: decoded.bounds.xmin,
        maxEasting: decoded.bounds.xmax,
        minNorthing: decoded.bounds.ymin,
        maxNorthing: decoded.bounds.ymax,
      },
    };
  } catch (error) {
    throw new Error(`Erro ao buscar tile ID "${tileId}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Valida se um ID de tile está no formato Grid36 correto
 */
export function isValidTileId(tileId: string): boolean {
  if (!tileId || typeof tileId !== 'string') {
    return false;
  }
  
  // Check length (1-9 characters for depth 1-9)
  if (tileId.length < 1 || tileId.length > 9) {
    return false;
  }
  
  // Special case for reference tile
  if (tileId === "000000000") {
    return true;
  }
  
  // Extract valid characters from GLYPH_GRID
  const validChars = new Set<string>();
  for (const row of GLYPH_GRID) {
    for (const char of row) {
      validChars.add(char);
    }
  }
  
  // Check if all characters are valid Grid36 symbols
  for (const char of tileId.toUpperCase()) {
    if (!validChars.has(char)) {
      return false;
    }
  }
  
  return true;
}