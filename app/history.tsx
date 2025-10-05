/**
 * History Screen - Fade Animation (Fixed Hook Call)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Share,
  TextInput,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { useStorage } from '@/hooks/useStorage';
import { useTheme } from '@/contexts/ThemeContext';
import { StoredQuery } from '@/types';

function QueryItem({
  item,
  isSelectionMode,
  selected,
  onSelect,
  onDelete,
}: {
  item: StoredQuery;
  isSelectionMode: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  const fadeOutAndDelete = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onDelete(item.id));
  };

  const formatCoordinate = (v: number, d = 6) => v.toFixed(d);
  const formatDistance = (m: number) =>
    m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m.toFixed(0)} m`;

  return (
    <Animated.View style={{ opacity }}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.card,
          {
            backgroundColor: selected ? theme.primary + '15' : theme.card,
            borderColor: selected ? theme.primary : theme.border,
          },
        ]}
        onLongPress={() => onSelect(item.id)}
        onPress={() => isSelectionMode && onSelect(item.id)}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.tileId, { color: theme.primary }]}>{item.tileId}</Text>

          <View style={styles.headerRight}>
            <Text style={[styles.timestamp, { color: theme.secondary }]}>
              {format(new Date(item.timestamp), 'dd/MM HH:mm')}
            </Text>

            {!isSelectionMode && (
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: theme.surface }]}
                onPress={fadeOutAndDelete}
              >
                <MaterialIcons name="delete-outline" size={18} color={theme.error} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.coordSection}>
          <Text style={[styles.label, { color: theme.secondary }]}>GPS (WGS84)</Text>
          <Text style={[styles.coordText, { color: theme.text }]}>
            {formatCoordinate(item.gps.latitude)}°, {formatCoordinate(item.gps.longitude)}°
          </Text>
        </View>

        <View style={styles.coordSection}>
          <Text style={[styles.label, { color: theme.secondary }]}>SIRGAS 2000 / Albers</Text>
          <Text style={[styles.coordText, { color: theme.text }]}>
            {formatCoordinate(item.sirgas.easting, 2)} , {formatCoordinate(item.sirgas.northing, 2)} m
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <MaterialIcons name="layers" size={14} color={theme.secondary} />
            <Text style={[styles.metaText, { color: theme.secondary }]}>Nível {item.level}</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialIcons name="straighten" size={14} color={theme.secondary} />
            <Text style={[styles.metaText, { color: theme.secondary }]}>{formatDistance(item.tileSize)}</Text>
          </View>
          {item.accuracy && (
            <View style={styles.metaItem}>
              <MaterialIcons name="gps-fixed" size={14} color={theme.secondary} />
              <Text style={[styles.metaText, { color: theme.secondary }]}>
                ±{formatDistance(item.accuracy)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* ------------------ Tela principal ------------------ */
export default function HistoryScreen() {
  const { theme } = useTheme();
  const {
    queryHistory,
    isLoading,
    error,
    deleteQuery,
    clearHistory,
    exportHistory,
    importHistory,
  } = useStorage();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [listKey, setListKey] = useState(Date.now());

  useEffect(() => {
    if (queryHistory.length === 0) {
      setTimeout(() => setListKey(Date.now()), 50);
    }
  }, [queryHistory.length]);

  const filteredHistory = queryHistory.filter(query => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      query.tileId.toLowerCase().includes(q) ||
      query.gps.latitude.toString().includes(q) ||
      query.gps.longitude.toString().includes(q) ||
      (query.locationName && query.locationName.toLowerCase().includes(q))
    );
  });

  const handleClearHistory = () => {
    Alert.alert('Limpar Histórico', 'Remover todas as consultas salvas?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpar', style: 'destructive', onPress: () => clearHistory() },
    ]);
  };

  const handleExportHistory = async () => {
    try {
      const data = exportHistory();
      await Share.share({ message: data, title: 'Histórico GPS Converter' });
    } catch {
      Alert.alert('Erro', 'Falha ao exportar histórico');
    }
  };

  const handleImportHistory = () => {
    Alert.prompt(
      'Importar Histórico',
      'Cole aqui os dados exportados:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          onPress: async (data) => {
            if (!data) return;
            const ok = await importHistory(data);
            Alert.alert(ok ? 'Sucesso' : 'Erro', ok ? 'Histórico importado' : 'Dados inválidos');
          },
        },
      ],
      'plain-text'
    );
  };

  const toggleSelection = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const renderQueryItem = ({ item }: { item: StoredQuery }) => (
    <QueryItem
      item={item}
      isSelectionMode={isSelectionMode}
      selected={selectedItems.includes(item.id)}
      onSelect={(id) => {
        if (!isSelectionMode) setIsSelectionMode(true);
        toggleSelection(id);
      }}
      onDelete={deleteQuery}
    />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="history" size={64} color={theme.secondary} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>Nenhum histórico</Text>
      <Text style={[styles.emptyText, { color: theme.secondary }]}>
        As consultas aparecerão aqui após a conversão de coordenadas.
      </Text>
    </View>
  );

  if (isLoading)
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.secondary, marginTop: 16 }}>
            Carregando histórico...
          </Text>
        </View>
      </SafeAreaView>
    );

  const hasData = filteredHistory.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header fixo */}
      <View style={styles.fixedHeader}>
        <Text style={[styles.title, { color: theme.text }]}>Histórico de Consultas</Text>

        <View style={styles.topActions}>
          <TouchableOpacity onPress={handleExportHistory}>
            <MaterialIcons name="share" size={22} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleImportHistory}>
            <MaterialIcons name="file-download" size={22} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearHistory}>
            <MaterialIcons name="delete-sweep" size={22} color={theme.error} />
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <MaterialIcons name="search" size={20} color={theme.secondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Buscar por ID ou coordenadas..."
            placeholderTextColor={theme.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialIcons name="clear" size={20} color={theme.secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Lista rolável */}
      <FlatList
        key={listKey}
        data={filteredHistory}
        keyExtractor={item => item.id}
        renderItem={renderQueryItem}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        extraData={queryHistory.length}
        contentContainerStyle={
          hasData
            ? styles.listContainer
            : [styles.listContainerEmpty, { backgroundColor: theme.background }]
        }
        scrollEnabled={hasData}
      />
    </SafeAreaView>
  );
}

/* ------------------ Estilos ------------------ */
const styles = StyleSheet.create({
  container: { flex: 1 },
  fixedHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#00000010',
    zIndex: 10,
  },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 12 },
  topActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16 },
  listContainer: { padding: 20, paddingBottom: 40 },
  listContainerEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileId: { fontSize: 18, fontWeight: '700', fontFamily: 'monospace' },
  timestamp: { fontSize: 12 },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordSection: { marginBottom: 10 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  coordText: { fontSize: 13, fontFamily: 'monospace' },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  emptyContainer: { alignItems: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '600', marginTop: 16 },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
