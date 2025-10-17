/**
 * Search Screen - Busca por ID de tile
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { useStorage } from '@/hooks/useStorage';
import { searchTileById, isValidTileId, TileSearchResult } from '@/utils/tileSearch';
import { StoredQuery } from '@/types';

export default function SearchScreen() {
  const { theme } = useTheme();
  const { saveQuery } = useStorage();

  const [searchTileId, setSearchTileId] = useState('');
  const [searchResult, setSearchResult] = useState<TileSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (searchResult) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [fadeAnim, searchResult]);

  const handleSearch = async () => {
    const normalizedTileId = searchTileId.trim().toUpperCase();

    if (!normalizedTileId) {
      Alert.alert('Erro', 'Por favor, insira um ID de tile para buscar');
      return;
    }

    if (!isValidTileId(normalizedTileId)) {
      Alert.alert('Erro', 'ID de tile inválido. Use apenas caracteres do Grid36 (ex: Z, G, H, I, J, K, Y, F, 4, 5, 6, L, etc.)');
      return;
    }

    Keyboard.dismiss();
    setIsSearching(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const result = searchTileById(normalizedTileId);
      setSearchResult(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao buscar tile';
      setSearchError(errorMessage);
      setSearchResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveToHistory = async () => {
    if (!searchResult) return;

    try {
      const storedQuery: StoredQuery = {
        id: `search_${Date.now()}_${searchResult.tileId}`,
        gps: {
          latitude: searchResult.gps.latitude,
          longitude: searchResult.gps.longitude,
          timestamp: Date.now(),
        },
        sirgas: {
          easting: searchResult.sirgas.easting,
          northing: searchResult.sirgas.northing,
        },
        tileId: searchResult.tileId,
        level: searchResult.depth, // Use depth instead of level
        tileSize: searchResult.tileSize,
        timestamp: Date.now(),
        locationName: `Busca: ${searchResult.tileId}`,
      };

      await saveQuery(storedQuery);
      Alert.alert('Sucesso', 'Tile salvo no histórico');
    } catch (error) {
      console.error('Falha ao salvar tile pesquisado no histórico', error);
      Alert.alert('Erro', 'Falha ao salvar no histórico');
    }
  };

  const handleResetSearch = () => {
    setSearchResult(null);
    setSearchTileId('');
    setSearchError(null);
    fadeAnim.setValue(0);
  };

  const formatCoordinate = (value: number, decimals = 6) => {
    return value.toFixed(decimals);
  };

  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters.toFixed(0)} m`;
  };

  const renderSearchForm = () => (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.cardTitle, { color: theme.text }]}>Buscar por ID do Tile</Text>

      {/* Input do ID */}
      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, { color: theme.secondary }]}>ID do Tile (Grid36)</Text>
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          value={searchTileId}
          onChangeText={value => setSearchTileId(value.toUpperCase())}
          placeholder="Digite o ID Grid36 (ex: ZGHIJK)"
          placeholderTextColor={theme.secondary}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
      </View>

      {/* Botão de Busca */}
      <TouchableOpacity
        style={[
          styles.searchButton,
          { backgroundColor: theme.primary },
          isSearching && styles.disabledButton,
        ]}
        onPress={handleSearch}
        disabled={isSearching}
        accessibilityRole="button"
      >
        {isSearching ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <MaterialIcons name="search" size={24} color="white" />
        )}
        <Text style={styles.searchButtonText} numberOfLines={1} adjustsFontSizeToFit>
          {isSearching ? 'Buscando...' : 'Buscar'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderSearchResult = () => {
    if (!searchResult) return null;

    return (
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border, opacity: fadeAnim },
        ]}
      >
        <View style={styles.resultHeader}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Resultado da Busca</Text>

          {/* Badge de Profundidade */}
          <View style={[styles.levelBadge, { backgroundColor: theme.primary + '22' }]}>
            <MaterialIcons name="layers" size={14} color={theme.primary} />
            <Text style={[styles.levelBadgeText, { color: theme.primary }]}>
              Profundidade {searchResult.depth} • {formatDistance(searchResult.tileSize)}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.success }]}
            onPress={handleSaveToHistory}
          >
            <MaterialIcons name="save" size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Tile ID */}
        <View style={[styles.tileIdContainer, { backgroundColor: theme.surface }]}>
          <Text style={[styles.tileIdLabel, { color: theme.secondary }]}>ID do Tile</Text>
          <Text style={[styles.tileIdValue, { color: theme.primary }]}>{searchResult.tileId}</Text>
        </View>

        {/* Origem GPS */}
        <View style={[styles.coordinateSection, { backgroundColor: theme.surface }]}>
          <View style={styles.tileTitleContainer}>
            <MaterialIcons name="gps-fixed" size={16} color={theme.primary} />
            <Text style={[styles.sectionLabel, { color: theme.secondary }]}>Origem (WGS84)</Text>
          </View>
          <View style={styles.coordinateRow}>
            <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>Latitude:</Text>
            <Text style={[styles.coordinateValue, { color: theme.text }]}>
              {formatCoordinate(searchResult.gps.latitude)}°
            </Text>
          </View>
          <View style={styles.coordinateRow}>
            <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>Longitude:</Text>
            <Text style={[styles.coordinateValue, { color: theme.text }]}>
              {formatCoordinate(searchResult.gps.longitude)}°
            </Text>
          </View>
        </View>

        {/* Centro GPS */}
        <View style={[styles.coordinateSection, { backgroundColor: theme.surface }]}>
          <View style={styles.tileTitleContainer}>
            <MaterialIcons name="center-focus-strong" size={16} color={theme.primary} />
            <Text style={[styles.sectionLabel, { color: theme.secondary }]}>Centro (WGS84)</Text>
          </View>
          <View style={styles.coordinateRow}>
            <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>Latitude:</Text>
            <Text style={[styles.coordinateValue, { color: theme.text }]}>
              {formatCoordinate(searchResult.gps.centerLatitude)}°
            </Text>
          </View>
          <View style={styles.coordinateRow}>
            <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>Longitude:</Text>
            <Text style={[styles.coordinateValue, { color: theme.text }]}>
              {formatCoordinate(searchResult.gps.centerLongitude)}°
            </Text>
          </View>
        </View>

        {/* Origem SIRGAS */}
        <View style={[styles.coordinateSection, { backgroundColor: theme.surface }]}>
          <View style={styles.tileTitleContainer}>
            <MaterialIcons name="straighten" size={16} color={theme.secondary} />
            <Text style={[styles.sectionLabel, { color: theme.secondary }]}>Origem (SIRGAS Albers)</Text>
          </View>
          <View style={styles.coordinateRow}>
            <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>Easting (X):</Text>
            <Text style={[styles.coordinateValue, { color: theme.text }]}>
              {formatCoordinate(searchResult.sirgas.easting, 2)} m
            </Text>
          </View>
          <View style={styles.coordinateRow}>
            <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>Northing (Y):</Text>
            <Text style={[styles.coordinateValue, { color: theme.text }]}>
              {formatCoordinate(searchResult.sirgas.northing, 2)} m
            </Text>
          </View>
        </View>

        {/* Centro SIRGAS */}
        <View style={[styles.coordinateSection, { backgroundColor: theme.surface }]}>
          <View style={styles.tileTitleContainer}>
            <MaterialIcons name="center-focus-strong" size={16} color={theme.secondary} />
            <Text style={[styles.sectionLabel, { color: theme.secondary }]}>Centro (SIRGAS Albers)</Text>
          </View>
          <View style={styles.coordinateRow}>
            <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>Easting (X):</Text>
            <Text style={[styles.coordinateValue, { color: theme.text }]}>
              {formatCoordinate(searchResult.sirgas.centerEasting, 2)} m
            </Text>
          </View>
          <View style={styles.coordinateRow}>
            <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>Northing (Y):</Text>
            <Text style={[styles.coordinateValue, { color: theme.text }]}>
              {formatCoordinate(searchResult.sirgas.centerNorthing, 2)} m
            </Text>
          </View>
        </View>

        {/* Limites */}
        <View style={[styles.coordinateSection, { backgroundColor: theme.surface }]}>
          <View style={styles.tileTitleContainer}>
            <MaterialIcons name="crop-free" size={16} color={theme.success} />
            <Text style={[styles.sectionLabel, { color: theme.secondary }]}>Limites (SIRGAS Albers)</Text>
          </View>
          {[
            ['Min Easting', searchResult.bounds.minEasting],
            ['Max Easting', searchResult.bounds.maxEasting],
            ['Min Northing', searchResult.bounds.minNorthing],
            ['Max Northing', searchResult.bounds.maxNorthing],
          ].map(([label, value]) => (
            <View style={styles.coordinateRow} key={label}>
              <Text style={[styles.coordinateLabel, { color: theme.secondary }]}>{label}:</Text>
              <Text style={[styles.coordinateValue, { color: theme.text }]}>
                {formatCoordinate(Number(value), 2)} m
              </Text>
            </View>
          ))}
        </View>

        {/* Botão flutuante */}
        <TouchableOpacity
          style={[styles.refreshButton, { backgroundColor: theme.primary }]}
          onPress={handleResetSearch}
          accessibilityRole="button"
        >
          <MaterialIcons name="refresh" size={22} color="white" />
        </TouchableOpacity>
      </Animated.View>
    );
  };


  const renderError = () => {
    if (!searchError) return null;

    return (
      <View style={[styles.errorContainer, { borderColor: theme.error }]}>
        <MaterialIcons name="error" size={20} color={theme.error} />
        <Text style={[styles.errorText, { color: theme.error }]}>{searchError}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>Buscar Tile por ID</Text>
            <Text style={[styles.subtitle, { color: theme.secondary }]}>
              Encontre informações detalhadas sobre qualquer tile
            </Text>
          </View>

          {/* Theme Toggle removido - usando botão flutuante global */}

          {/* Search Form */}
          {renderSearchForm()}

          {/* Error */}
          {renderError()}

          {/* Search Result */}
          {renderSearchResult()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  refreshButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
  disabledButton: {
    opacity: 0.5,
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
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    gap: 8,
    minHeight: 50,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  saveButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIdContainer: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  tileIdLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  tileIdValue: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  coordinateSection: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  tileTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  coordinateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#fef2f2',
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
});
