/**
 * Tile Search Utilities for Grid36 System
 * Funcionalidades para busca reversa de tiles por ID usando Grid36
 */

import { decodeFromGrid36, getTileSizeFromLevel, convertSIRGASToWGS84 } from './coordinateConversion';

const GLYPH_GRID = [
  ["Z","G","H","I","J","K"],
  ["Y","F","4","5","6","L"],
  ["X","E","3","0","7","M"],
  ["W","D","2","1","8","N"],
  ["V","C","B","A","9","O"],
  ["U","T","S","R","Q","P"],
];

const VALID_CHARS = new Set(GLYPH_GRID.flat());

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
export function searchTileById(tileId: string): TileSearchResult {
  if (!isValidTileId(tileId)) {
    throw new Error(`ID de tile inválido: ${tileId}`);
  }
  try {
    // Use the Grid36 decoding system
    const decoded = decodeFromGrid36(tileId);
    
    // Converter os cantos e centro usando a conversão precisa
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
  for (const char of tileId) {
    if (!VALID_CHARS.has(char)) {
      return false;
    }
  }
  return true;
}