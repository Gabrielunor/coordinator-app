/**
 * Type definitions for the GPS Tile Converter app
 */

export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: number;
}

export interface SIRGASCoordinates {
  easting: number;
  northing: number;
}

export interface TileInfo {
  id: string;
  level: number;
  size: number; // in meters
  coordinates: {
    gps: GPSCoordinates;
    sirgas: SIRGASCoordinates;
  };
  timestamp: number;
  accuracy?: number;
  locationName?: string;
}

export interface ConversionResult {
  gps: GPSCoordinates;
  sirgas: SIRGASCoordinates;
  tileId: string;
  level: number;
  tileSize: number;
  timestamp: number;
}

export interface StoredQuery {
  id: string;
  gps: GPSCoordinates;
  sirgas: SIRGASCoordinates;
  tileId: string;
  level: number;
  tileSize: number;
  timestamp: number;
  accuracy?: number;
  locationName?: string;
}

export interface AppState {
  currentLocation: GPSCoordinates | null;
  selectedLevel: number;
  conversionResult: ConversionResult | null;
  queryHistory: StoredQuery[];
  isLoadingLocation: boolean;
  locationPermission: boolean;
  error: string | null;
}