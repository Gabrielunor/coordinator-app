/**
 * Tile Search Utilities
 * Funcionalidades para busca reversa de tiles por ID
 */

import { HilbertCurve } from './hilbertCurve';
import { convertWGS84ToSIRGASAlbers, getTileSizeFromLevel } from './coordinateConversion';

// Constantes do sistema SIRGAS
const MARCO_ZERO_X = 5000000;
const MARCO_ZERO_Y = 10000000;
const Y_MAX_AREA = 12300000;
const Y_MIN_AREA = 6300000;
const X_MAX_AREA = 7330000;
const X_MIN_AREA = 2290000;

export interface TileSearchResult {
  tileId: string;
  level: number;
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
 * Converte Base36 para número
 */
function fromBase36(base36String: string): number {
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const base = alphabet.length;
  let result = 0;
  
  for (let i = 0; i < base36String.length; i++) {
    const char = base36String[i].toUpperCase();
    const value = alphabet.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid Base36 character: ${char}`);
    }
    result = result * base + value;
  }
  
  return result;
}

/**
 * Conversão aproximada de SIRGAS para WGS84 (inversa simplificada)
 */
function convertSIRGASToWGS84Approximate(easting: number, northing: number): { latitude: number; longitude: number } {
  // Esta é uma conversão aproximada para visualização
  // Para precisão real, seria necessário implementar a conversão inversa completa
  
  const SIRGAS_PROJECTION_PARAMS = {
    latitudeOfFalseOrigin: -12,
    longitudeOfFalseOrigin: -54,
    firstStandardParallel: -2,
    secondStandardParallel: -22,
    eastingAtFalseOrigin: 5000000,
    northingAtFalseOrigin: 10000000,
    semiMajorAxis: 6378137,
    flattening: 1 / 298.257222101
  };

  // Conversão simplificada baseada nas constantes da projeção
  const deltaX = easting - SIRGAS_PROJECTION_PARAMS.eastingAtFalseOrigin;
  const deltaY = northing - SIRGAS_PROJECTION_PARAMS.northingAtFalseOrigin;
  
  // Aproximação linear para a região do Brasil
  const longitude = SIRGAS_PROJECTION_PARAMS.longitudeOfFalseOrigin + (deltaX / 111320);
  const latitude = SIRGAS_PROJECTION_PARAMS.latitudeOfFalseOrigin + (deltaY / 111320);
  
  return { latitude, longitude };
}

/**
 * Busca informações de um tile pelo seu ID
 */
export function searchTileById(tileId: string, level: number): TileSearchResult {
  try {
    // Converte o ID Base36 para distância Hilbert
    const hilbertDistance = fromBase36(tileId);
    
    // Calcula o tamanho do tile
    const tileSize = getTileSizeFromLevel(level);
    
    // Calcula as dimensões do grid
    const widthArea = X_MAX_AREA - X_MIN_AREA;
    const heightArea = Y_MAX_AREA - Y_MIN_AREA;
    const numTilesXTotal = Math.ceil(widthArea / tileSize);
    const numTilesYTotal = Math.ceil(heightArea / tileSize);
    const maxDim = Math.max(numTilesXTotal, numTilesYTotal);
    const p = maxDim > 0 ? Math.ceil(Math.log2(maxDim)) : 1;
    
    // Cria a curva de Hilbert
    const hilbertCurve = new HilbertCurve(Math.max(p, 1));
    
    // Converte distância Hilbert para coordenadas normalizadas
    const { x: normalizedI, y: normalizedJ } = hilbertCurve.distanceToPoint(hilbertDistance);
    
    // Calcula os offsets de normalização
    const minTileXIdxForLevel = Math.floor((X_MIN_AREA - (MARCO_ZERO_X - tileSize / 2)) / tileSize);
    const minTileYIdxForLevel = Math.floor((Y_MIN_AREA - (MARCO_ZERO_Y - tileSize / 2)) / tileSize);
    
    // Converte para índices absolutos do tile
    const iIdx = normalizedI + minTileXIdxForLevel;
    const jIdx = normalizedJ + minTileYIdxForLevel;
    
    // Calcula as coordenadas SIRGAS do tile
    const originXCentralTile = MARCO_ZERO_X - tileSize / 2;
    const originYCentralTile = MARCO_ZERO_Y - tileSize / 2;
    
    const minEasting = originXCentralTile + iIdx * tileSize;
    const minNorthing = originYCentralTile + jIdx * tileSize;
    const maxEasting = minEasting + tileSize;
    const maxNorthing = minNorthing + tileSize;
    
    // Centro do tile
    const centerEasting = minEasting + (tileSize / 2);
    const centerNorthing = minNorthing + (tileSize / 2);
    
    // Converte para WGS84 aproximado
    const bottomLeftGPS = convertSIRGASToWGS84Approximate(minEasting, minNorthing);
    const topRightGPS = convertSIRGASToWGS84Approximate(maxEasting, maxNorthing);
    const centerGPS = convertSIRGASToWGS84Approximate(centerEasting, centerNorthing);
    
    return {
      tileId,
      level,
      tileSize,
      sirgas: {
        easting: minEasting,
        northing: minNorthing,
        centerEasting,
        centerNorthing,
      },
      gps: {
        latitude: bottomLeftGPS.latitude,
        longitude: bottomLeftGPS.longitude,
        centerLatitude: centerGPS.latitude,
        centerLongitude: centerGPS.longitude,
      },
      bounds: {
        minEasting,
        maxEasting,
        minNorthing,
        maxNorthing,
      },
    };
  } catch (error) {
    throw new Error(`Erro ao buscar tile ID "${tileId}": ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Valida se um ID de tile está no formato correto (Base36)
 */
export function isValidTileId(tileId: string): boolean {
  if (!tileId || typeof tileId !== 'string') {
    return false;
  }
  
  const base36Pattern = /^[0-9A-Z]+$/i;
  return base36Pattern.test(tileId);
}