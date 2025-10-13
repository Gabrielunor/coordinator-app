/**
 * Converter Screen - Interface principal para conversão GPS para SIRGAS
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

import { useLocation } from '@/hooks/useLocation';
import { useStorage } from '@/hooks/useStorage';
import { convertWGS84ToSIRGASAlbers, getTileSizeFromLevel, encodeToGrid36, adjustHashDepth, decodeFromGrid36 } from '@/utils/coordinateConversion';
import { useTheme } from '@/contexts/ThemeContext';
import { StoredQuery, ConversionResult } from '@/types';
import { format } from 'date-fns';

async function getAddressFromCoordinates(lat: number, lon: number): Promise<string> {
  try {
    const response = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'LabubuInc/1.0 (contact: seuemail@dominio.com)',
        },
      },
      8000
    );
    const data = await response.json();
    if (data?.address) {
      const { road, suburb, city, town, state, country } = data.address;
      const parts = [road, suburb || city || town, state, country].filter(Boolean);
      return parts.length ? parts.join(', ') : 'Endereço não encontrado';
    }
    return 'Endereço não encontrado';
  } catch {
    return 'Erro ao obter endereço';
  }
}

/**
 * Wraps fetch with an AbortController so we never wait indefinitely for a
 * reverse-geocoding response.
 */
async function fetchWithTimeout(
  resource: RequestInfo | URL,
  options: RequestInit = {},
  timeout = 8000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...options, signal: controller.signal });
    return response;
  } catch {
    throw new Error('Timeout ou falha na conexão');
  } finally {
    clearTimeout(id);
  }
}

export default function ConverterScreen() {
  const [address, setAddress] = useState<string | null>(null);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const { theme } = useTheme();
  const {
    currentLocation,
    isLoading: locationLoading,
    error: locationError,
    hasPermission,
    requestPermission,
    getCurrentLocation,
    startWatching,
    stopWatching,
    isWatching,
  } = useLocation();

  const {
    selectedLevel,
    setSelectedLevel,
    saveQuery,
    error: storageError,
  } = useStorage();

  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const requestIdRef = useRef(0);

  // ─── Derived Data ────────────────────────────────────────────────────────
  const presetLevels = useMemo(() => [1, 3, 5, 7, 9], []);
  const tileSizeMeters = useMemo(() => getTileSizeFromLevel(selectedLevel), [selectedLevel]);
  const isDecreaseDisabled = selectedLevel === 1;
  const isIncreaseDisabled = selectedLevel === 9;
  const trackingLabel = isWatching ? 'Parar' : 'Rastrear';
  const locationStatus = isWatching ? 'Rastreando' : 'Estático';

  // ─── Helper Formatters ───────────────────────────────────────────────────
  const formatCoordinate = useCallback((value: number, decimals = 6) => {
    return value.toFixed(decimals);
  }, []);

  const formatDistance = useCallback((meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters.toFixed(0)} m`;
  }, []);

  // ─── Core Conversion Routine ─────────────────────────────────────────────
  const performConversion = useCallback(
    async (depthOverride?: number, forceRecalculate = false) => {
      if (!currentLocation) return;

      const depth = depthOverride ?? selectedLevel;
      const requestId = ++requestIdRef.current;

      setIsConverting(true);
      setIsFetchingAddress(true);
      setAddress(null);

      try {
        let grid36Result;
        
        // If we have existing conversion result and just changing depth, try to adjust hash
        if (conversionResult && !forceRecalculate && depthOverride !== undefined) {
          try {
            const adjustedHash = adjustHashDepth(conversionResult.tileId, depth);
            // Verify the adjusted hash is valid by decoding it
            const decoded = decodeFromGrid36(adjustedHash);
            
            grid36Result = {
              hash: adjustedHash,
              depth: depth,
              tileSize: getTileSizeFromLevel(depth),
              ijOrigin: decoded.ijOrigin,
              centroid: decoded.centroid,
              foraArea: false
            };
          } catch (error) {
            // Fallback to full recalculation
            console.warn('Hash adjustment failed, falling back to full recalculation:', error);
            grid36Result = encodeToGrid36(
              currentLocation.longitude,
              currentLocation.latitude,
              depth
            );
          }
        } else {
          // Full calculation from GPS coordinates
          grid36Result = encodeToGrid36(
            currentLocation.longitude,
            currentLocation.latitude,
            depth
          );
        }

        const result: ConversionResult = {
          gps: currentLocation,
          sirgas: {
            easting: grid36Result.centroid.x,
            northing: grid36Result.centroid.y,
          },
          tileId: grid36Result.hash,
          level: depth,
          tileSize: grid36Result.tileSize,
          timestamp: Date.now(),
        };

        if (requestId !== requestIdRef.current) {
          return;
        }

        setConversionResult(result);

        const storedQuery: StoredQuery = {
          id: `${Date.now()}_${result.tileId}`,
          ...result,
          accuracy: currentLocation.accuracy,
          locationName: `Lat: ${currentLocation.latitude.toFixed(6)}, Lon: ${currentLocation.longitude.toFixed(6)}`,
        };

        await saveQuery(storedQuery);

        if (requestId !== requestIdRef.current) {
          return;
        }

        const foundAddress = await getAddressFromCoordinates(
          currentLocation.latitude,
          currentLocation.longitude
        );
        if (requestId === requestIdRef.current) {
          setAddress(foundAddress);
        }
      } catch (error) {
        console.error('Conversion error:', error);
        Alert.alert('Erro', 'Falha ao converter coordenadas. Tente novamente.');
      } finally {
        if (requestId === requestIdRef.current) {
          setIsConverting(false);
          setIsFetchingAddress(false);
        }
      }
    },
    [currentLocation, selectedLevel, saveQuery]
  );

  // ─── Side Effects ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    if (currentLocation && hasPermission) {
      performConversion();
    }
  }, [currentLocation, hasPermission, performConversion]);

  // ─── Event Handlers ──────────────────────────────────────────────────────
  const handleGetLocation = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    await getCurrentLocation();
  }, [getCurrentLocation, hasPermission, requestPermission]);

  const handleToggleTracking = useCallback(() => {
    if (isWatching) {
      stopWatching();
    } else {
      startWatching();
    }
  }, [isWatching, startWatching, stopWatching]);

  const handleLevelChange = useCallback(async (value: number) => {
    const depth = Math.max(1, Math.min(9, Math.round(value)));
    await setSelectedLevel(depth);
    await performConversion(depth);
  }, [performConversion, setSelectedLevel]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* ─── Header ─────────────────────────────────────────── */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Labubu Inc</Text>
            <Text style={[styles.subtitle, { color: theme.secondary }]}>Converte coordenadas GPS para tiles SIRGAS</Text>
          </View>

          {/* ─── Theme Toggle handled by global floating button ─── */}

          {/* ─── Permission Request ─────────────────────────────── */}
          {!hasPermission && (
            <View style={[styles.permissionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <MaterialIcons name="location-off" size={48} color={theme.warning} />
              <Text style={[styles.permissionTitle, { color: theme.text }]}>Permissão de Localização Necessária</Text>
              <Text style={[styles.permissionText, { color: theme.secondary }]}>
                Este app precisa acessar sua localização para realizar a conversão de coordenadas GPS.
              </Text>
              <TouchableOpacity style={[styles.permissionButton, { backgroundColor: theme.primary }]} onPress={requestPermission}>
                <Text style={styles.permissionButtonText}>Conceder Permissão</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ─── Location Controls ──────────────────────────────── */}
          {hasPermission && (
            <View style={[styles.controlsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Controles de Localização</Text>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    { backgroundColor: theme.primary },
                    locationLoading && { backgroundColor: theme.secondary, opacity: 0.7 }
                  ]}
                  onPress={handleGetLocation}
                  disabled={locationLoading}
                >
                  {locationLoading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <MaterialIcons name="my-location" size={24} color="white" />
                  )}
                  <Text style={styles.controlButtonText} numberOfLines={1} adjustsFontSizeToFit>
                    {locationLoading ? 'Obtendo...' : 'Localizar'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    { backgroundColor: isWatching ? theme.error : theme.success }
                  ]}
                  onPress={handleToggleTracking}
                >
                  <MaterialIcons
                    name={isWatching ? "location-off" : "location-on"}
                    size={24}
                    color="white"
                  />
                  <Text style={styles.controlButtonText} numberOfLines={1} adjustsFontSizeToFit>
                    {trackingLabel}
                  </Text>
                </TouchableOpacity>
              </View>

              {locationError && (
                <View style={[styles.errorContainer, { backgroundColor: '#fef2f2', borderColor: theme.error }]}>
                  <MaterialIcons name="error" size={20} color={theme.error} />
                  <Text style={[styles.errorText, { color: theme.error }]}>{locationError}</Text>
                </View>
              )}
            </View>
          )}

          {/* ─── Tile Level Selector ────────────────────────────── */}
          <View style={[styles.levelCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Profundidade do Tile: {selectedLevel}</Text>
            <Text style={[styles.levelDescription, { color: theme.secondary }]}>
              Tamanho do tile: {formatDistance(tileSizeMeters)}
            </Text>

            <View style={styles.levelButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.levelButton,
                  { backgroundColor: isDecreaseDisabled ? theme.secondary : theme.primary },
                ]}
                onPress={() => handleLevelChange(selectedLevel - 1)}
                disabled={isDecreaseDisabled}
              >
                <MaterialIcons name="remove" size={24} color="white" />
              </TouchableOpacity>

              <View style={[styles.levelDisplay, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.levelDisplayText, { color: theme.primary }]}>{selectedLevel}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.levelButton,
                  { backgroundColor: isIncreaseDisabled ? theme.secondary : theme.primary },
                ]}
                onPress={() => handleLevelChange(selectedLevel + 1)}
                disabled={isIncreaseDisabled}
              >
                <MaterialIcons name="add" size={24} color="white" />
              </TouchableOpacity>
            </View>

            <View style={styles.presetLevels}>
              {presetLevels.map(level => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.presetButton,
                    {
                      backgroundColor: selectedLevel === level ? theme.primary : theme.surface,
                      borderColor: selectedLevel === level ? theme.primary : theme.border,
                    }
                  ]}
                  onPress={() => handleLevelChange(level)}
                >
                  <Text
                    style={[
                      styles.presetButtonText,
                      {
                        color: selectedLevel === level ? 'white' : theme.secondary,
                      }
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.levelHint, { color: theme.secondary }]}>
              Depth 1: ~1600km • Depth 9: ~1m
            </Text>
          </View>

          {/* ─── Conversion Results ─────────────────────────────── */}
          {conversionResult && (
            <View style={[styles.resultsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Resultados da Conversão</Text>

              {isConverting && (
                <View style={[styles.loadingOverlay, { backgroundColor: theme.background + '90' }]}>
                  <ActivityIndicator color={theme.primary} size="large" />
                  <Text style={[styles.loadingText, { color: theme.primary }]}>Convertendo coordenadas...</Text>
                </View>
              )}

              {/* GPS Coordinates */}
              <View style={[styles.coordinateSection, { backgroundColor: theme.surface }]}>
                <View style={styles.tileTitleContainer}>
                  <MaterialIcons name="gps-fixed" size={16} color={theme.primary} />
                  <Text style={[styles.coordinateTitle, { color: theme.text }]}>Coordenadas GPS (WGS84)</Text>
                </View>
                <View style={styles.coordinateRow}>
                  <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>Latitude:</Text>
                  <Text style={[styles.coordinateValue, { color: theme.text }]}>
                    {formatCoordinate(conversionResult.gps.latitude)}°
                  </Text>
                </View>
                <View style={styles.coordinateRow}>
                  <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>Longitude:</Text>
                  <Text style={[styles.coordinateValue, { color: theme.text }]}>
                    {formatCoordinate(conversionResult.gps.longitude)}°
                  </Text>
                </View>
                {conversionResult.gps.accuracy && (
                  <View style={styles.coordinateRow}>
                    <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>Precisão:</Text>
                    <Text style={[styles.coordinateValue, { color: theme.text }]}>
                      ±{formatDistance(conversionResult.gps.accuracy)}
                    </Text>
                  </View>
                )}
              </View>

              {/* SIRGAS Coordinates */}
              <View style={[styles.coordinateSection, { backgroundColor: theme.surface }]}>
                <View style={styles.tileTitleContainer}>
                  <MaterialIcons name="straighten" size={16} color={theme.secondary} />
                  <Text style={[styles.coordinateTitle, { color: theme.text }]}>SIRGAS 2000 / Brazil Albers</Text>
                </View>
                <View style={styles.coordinateRow}>
                  <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>Easting (X):</Text>
                  <Text style={[styles.coordinateValue, { color: theme.text }]}>
                    {formatCoordinate(conversionResult.sirgas.easting, 2)} m
                  </Text>
                </View>
                <View style={styles.coordinateRow}>
                  <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>Northing (Y):</Text>
                  <Text style={[styles.coordinateValue, { color: theme.text }]}>
                    {formatCoordinate(conversionResult.sirgas.northing, 2)} m
                  </Text>
                </View>
              </View>

              {/* Tile Information */}
              <View style={styles.tileSection}>
                <View style={styles.tileTitleContainer}>
                  <MaterialIcons name="grid-on" size={16} color={theme.success} />
                  <Text style={[styles.tileTitle, { color: theme.text }]}>Informações do Tile</Text>
                </View>
                <View style={styles.tileInfoContainer}>
                  <View style={[styles.tileIdContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.tileIdLabel, { color: theme.secondary }]}>ID do Tile:</Text>
                    <Text style={[styles.tileIdValue, { color: theme.primary }]}>{conversionResult.tileId}</Text>
                  </View>
                  <View style={styles.tileRow}>
                    <Text style={[styles.tileLabel, { color: theme.secondary }]}>Nível:</Text>
                    <Text style={[styles.tileValue, { color: theme.text }]}>{conversionResult.level}</Text>
                  </View>
                  <View style={styles.tileRow}>
                    <Text style={[styles.tileLabel, { color: theme.secondary }]}>Tamanho:</Text>
                    <Text style={[styles.tileValue, { color: theme.text }]}>
                      {formatDistance(conversionResult.tileSize)}
                    </Text>
                  </View>
                </View>
              </View>
              {/* Estimated Address */}
              {(isFetchingAddress || address) && (
                <View style={[styles.addressSection, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <View style={styles.tileTitleContainer}>
                    <MaterialIcons name="place" size={16} color={theme.primary} />
                    <Text style={[styles.coordinateTitle, { color: theme.text }]}>
                      Endereço Estimado
                    </Text>
                  </View>
                  {isFetchingAddress ? (
                    <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 8 }} />
                  ) : (
                    <Text style={[styles.addressText, { color: theme.secondary }]}>{address}</Text>
                  )}
                </View>
              )}
              {/* Timestamp */}
              <View style={[styles.timestampContainer, { borderTopColor: theme.border }]}>
                <Ionicons name="time-outline" size={14} color={theme.secondary} />
                <Text style={[styles.timestampText, { color: theme.secondary }]}>
                  {format(new Date(conversionResult.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                </Text>
              </View>
            </View>
          )}

          {/* ─── Status Indicator ───────────────────────────────── */}
          {currentLocation && (
            <View style={[styles.statusContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.statusIndicator, { backgroundColor: theme.success }]} />
              <Text style={[styles.statusText, { color: theme.secondary }]}>
                Localização ativa • {locationStatus}
              </Text>
            </View>
          )}

          {storageError && (
            <View style={[styles.errorContainer, { backgroundColor: '#fef2f2', borderColor: theme.error }]}>
              <MaterialIcons name="error" size={20} color={theme.error} />
              <Text style={[styles.errorText, { color: theme.error }]}>{storageError}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// dentro do seu ConverterScreen, troque apenas os styles abaixo
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  addressSection: {
    marginTop: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  addressText: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 18,
  },
  permissionCard: {
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 6,
  },
  permissionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  permissionButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 24,
    minWidth: 140,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  controlsCard: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
    minHeight: 48,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  levelCard: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  levelDescription: {
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  levelButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 16,
  },
  levelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelDisplay: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    minWidth: 60,
    alignItems: 'center',
  },
  levelDisplayText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  presetLevels: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  presetButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 34,
    alignItems: 'center',
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  levelHint: {
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  resultsCard: {
    marginHorizontal: 20,
    marginTop: 10,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    position: 'relative',
    gap: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  coordinateSection: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
  },
  coordinateTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  coordinateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  coordinateLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  coordinateValue: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tileSection: {
    padding: 14,
    borderRadius: 12,
  },
  tileTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  tileTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tileInfoContainer: {
    gap: 6,
  },
  tileIdContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  tileIdLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  tileIdValue: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tileLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  tileValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  timestampText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginVertical: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
});
