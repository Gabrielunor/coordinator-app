/**
 * Map Screen - Exibe mapa, localização GPS e informações do tile
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import MapView, { Marker } from 'react-native-maps';

import { useLocation } from '@/hooks/useLocation';
import { useStorage } from '@/hooks/useStorage';
import { convertWGS84ToSIRGASAlbers, getTileSizeFromLevel } from '@/utils/coordinateConversion';
import { getTileIdFromCoordinates } from '@/utils/hilbertCurve';
import { useTheme } from '@/contexts/ThemeContext';
import { ConversionResult } from '@/types';

const formatCoordinate = (value: number, decimals = 6) => value.toFixed(decimals);
const formatDistance = (meters: number): string =>
  meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters.toFixed(0)} m`;

export default function MapScreen() {
  const { theme } = useTheme();
  const {
    currentLocation,
    hasPermission,
    requestPermission,
    getCurrentLocation,
    isWatching,
    startWatching,
    stopWatching,
  } = useLocation();

  const { selectedLevel, queryHistory } = useStorage();

  const [currentTileInfo, setCurrentTileInfo] = useState<ConversionResult | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const mapRef = useRef<MapView | null>(null);

  // --- Obtém localização imediatamente ao abrir ---
  useEffect(() => {
    const initLocation = async () => {
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) return;
      }
      await getCurrentLocation();
    };
    initLocation();
  }, [getCurrentLocation, hasPermission, requestPermission]);

  const calculateTileInfo = useCallback(async () => {
    if (!currentLocation) return;
    setIsConverting(true);

    try {
      const sirgas = convertWGS84ToSIRGASAlbers(
        currentLocation.longitude,
        currentLocation.latitude
      );

      const tileId = getTileIdFromCoordinates(
        sirgas.easting,
        sirgas.northing,
        selectedLevel
      );

      const tileSize = getTileSizeFromLevel(selectedLevel);

      const result: ConversionResult = {
        gps: currentLocation,
        sirgas,
        tileId,
        level: selectedLevel,
        tileSize,
        timestamp: Date.now(),
      };

      setCurrentTileInfo(result);
    } catch (error) {
      console.error('Error calculating tile info:', error);
    } finally {
      setIsConverting(false);
    }
  }, [currentLocation, selectedLevel]);

  useEffect(() => {
    if (currentLocation) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Centraliza o mapa na nova localização
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          800
        );
      }

      calculateTileInfo();
    } else {
      fadeAnim.setValue(0);
    }
  }, [calculateTileInfo, currentLocation, fadeAnim]);

  const handleGetLocation = useCallback(async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    await getCurrentLocation();
  }, [getCurrentLocation, hasPermission, requestPermission]);

  const handleToggleTracking = useCallback(() => {
    if (isWatching) stopWatching();
    else startWatching();
  }, [isWatching, startWatching, stopWatching]);

  const handleRefresh = useCallback(async () => {
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => rotateAnim.setValue(0));
    await handleGetLocation();
  }, [handleGetLocation, rotateAnim]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const recentQueries = useMemo(() => queryHistory.slice(0, 5), [queryHistory]);

  const renderMapView = () => (
    <View style={styles.mapWrapper}>
      <LinearGradient
        colors={[theme.background, theme.card]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      {currentLocation ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
          showsMyLocationButton={false}
        >
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title="Você está aqui"
          />
        </MapView>
      ) : (
        <View style={[styles.mapPlaceholder, { backgroundColor: theme.card }]}>
          <MaterialIcons name="map" size={64} color={theme.secondary} />
          <Text style={[styles.mapPlaceholderTitle, { color: theme.text }]}>
            Nenhuma localização disponível
          </Text>
        </View>
      )}
    </View>
  );

  const renderLocationCard = () => (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <MaterialIcons name="my-location" size={22} color={theme.primary} />
        <Text style={[styles.cardTitle, { color: theme.text }]}>Localização atual</Text>
      </View>
      {currentLocation ? (
        <View style={styles.locationInfo}>
          <Text style={[styles.coordinateValue, { color: theme.text }]}>
            📍 {formatCoordinate(currentLocation.latitude)}, {formatCoordinate(currentLocation.longitude)}
          </Text>
          {currentLocation.accuracy && (
            <Text style={[styles.metaInfo, { color: theme.secondary }]}>
              Precisão: ±{formatDistance(currentLocation.accuracy)}
            </Text>
          )}
          <Text style={[styles.metaInfo, { color: theme.secondary }]}>
            Atualizado: {format(new Date(currentLocation.timestamp || Date.now()), 'HH:mm:ss')}
          </Text>
        </View>
      ) : (
        <Text style={[styles.noLocationText, { color: theme.secondary }]}>
          {hasPermission ? 'Sem localização disponível' : 'Permissão de localização necessária'}
        </Text>
      )}
    </View>
  );

  const renderTileInfoCard = () =>
    currentTileInfo && (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <MaterialIcons name="grid-on" size={22} color={theme.success} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Tile Atual</Text>
        </View>
        {isConverting ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.secondary }]}>Calculando...</Text>
          </View>
        ) : (
          <View>
            <View style={styles.tileIdContainer}>
              <Text style={[styles.tileIdLabel, { color: theme.secondary }]}>Tile ID</Text>
              <Text style={[styles.tileIdValue, { color: theme.primary }]}>
                {currentTileInfo.tileId}
              </Text>
            </View>
            <View style={styles.coordinateSection}>
              <Text style={[styles.sectionLabel, { color: theme.secondary }]}>
                SIRGAS 2000 / Brazil Albers
              </Text>
              <Text style={[styles.coordinateValue, { color: theme.text }]}>
                X: {formatCoordinate(currentTileInfo.sirgas.easting, 2)} m
              </Text>
              <Text style={[styles.coordinateValue, { color: theme.text }]}>
                Y: {formatCoordinate(currentTileInfo.sirgas.northing, 2)} m
              </Text>
              <Text style={[styles.metaInfo, { color: theme.secondary }]}>
                Nível {currentTileInfo.level} • {formatDistance(currentTileInfo.tileSize)}
              </Text>
            </View>
          </View>
        )}
      </View>
    );

  const renderHistoryCard = () => {
    return (
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="time-outline" size={22} color={theme.secondary} />
          <Text style={[styles.cardTitle, { color: theme.text }]}>Consultas Recentes</Text>
        </View>
        {recentQueries.length > 0 ? (
          recentQueries.map((query) => (
            <View key={query.id} style={styles.historyItem}>
              <Text style={[styles.historyTileId, { color: theme.primary }]}>{query.tileId}</Text>
              <Text style={[styles.historyTimestamp, { color: theme.secondary }]}>
                {format(new Date(query.timestamp), 'dd/MM HH:mm')}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[styles.noHistoryText, { color: theme.secondary }]}>Nenhuma consulta</Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderMapView()}
        {renderLocationCard()}
        {renderTileInfoCard()}
        {renderHistoryCard()}
      </Animated.ScrollView>

      {/* Botões flutuantes modernos */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: theme.primary }]}
          onPress={handleGetLocation}
        >
          <MaterialIcons name="my-location" size={22} color="white" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: isWatching ? theme.error : theme.success }]}
          onPress={handleToggleTracking}
        >
          <MaterialIcons
            name={isWatching ? 'location-off' : 'location-on'}
            size={22}
            color="white"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.fabButton, { backgroundColor: theme.primary }]}
          onPress={handleRefresh}
        >
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <MaterialIcons name="refresh" size={22} color="white" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, gap: 20, paddingBottom: 120 },
  mapWrapper: {
    height: 340,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  map: { flex: 1 },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  mapPlaceholderTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  coordinateValue: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tileIdContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  tileIdLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  tileIdValue: { fontSize: 20, fontWeight: 'bold', fontFamily: 'monospace' },
  coordinateSection: { gap: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  metaInfo: { fontSize: 12, fontWeight: '500' },
  noLocationText: { fontSize: 13, textAlign: 'center', fontStyle: 'italic' },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  historyTileId: { fontSize: 14, fontWeight: '600', fontFamily: 'monospace' },
  historyTimestamp: { fontSize: 11 },
  noHistoryText: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  loadingText: { fontSize: 14, fontWeight: '500' },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  fabButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
});
