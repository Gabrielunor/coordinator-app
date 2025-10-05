/**
 * Custom hook for managing AsyncStorage operations with real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eventBus } from '@/utils/EventBus';
import { StoredQuery } from '@/types';

const STORAGE_KEYS = {
  QUERY_HISTORY: '@gps_converter_query_history',
  SELECTED_LEVEL: '@gps_converter_selected_level',
} as const;

export const storageEvents = eventBus;

interface UseStorageReturn {
  queryHistory: StoredQuery[];
  selectedLevel: number;
  isLoading: boolean;
  error: string | null;
  saveQuery: (query: StoredQuery) => Promise<void>;
  deleteQuery: (queryId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  setSelectedLevel: (level: number) => Promise<void>;
  exportHistory: () => string;
  importHistory: (data: string) => Promise<boolean>;
  reloadHistory: () => Promise<void>;
}

export function useStorage(): UseStorageReturn {
  const [queryHistory, setQueryHistory] = useState<StoredQuery[]>([]);
  const [selectedLevel, setSelectedLevelState] = useState<number>(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    const listener = () => loadData();
    storageEvents.on('historyUpdated', listener);

    return () => {
      storageEvents.off('historyUpdated', listener);
    };
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [historyData, levelData] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.QUERY_HISTORY),
        AsyncStorage.getItem(STORAGE_KEYS.SELECTED_LEVEL),
      ]);

      const parsedHistory = historyData ? JSON.parse(historyData) as StoredQuery[] : [];
      parsedHistory.sort((a, b) => b.timestamp - a.timestamp);
      setQueryHistory(parsedHistory);

      if (levelData) {
        const parsedLevel = parseInt(levelData, 10);
        if (!isNaN(parsedLevel) && parsedLevel >= 0 && parsedLevel <= 17) {
          setSelectedLevelState(parsedLevel);
        }
      }
    } catch (err) {
      console.error('Error loading data from storage:', err);
      setError('Erro ao carregar dados salvos');
    } finally {
      setIsLoading(false);
    }
  };

  const saveQuery = useCallback(async (query: StoredQuery) => {
    try {
      setError(null);

      const current = await AsyncStorage.getItem(STORAGE_KEYS.QUERY_HISTORY);
      const existing = current ? JSON.parse(current) as StoredQuery[] : [];

      const updated = [query, ...existing.filter(q => q.id !== query.id)].slice(0, 100);

      await AsyncStorage.setItem(STORAGE_KEYS.QUERY_HISTORY, JSON.stringify(updated));
      setQueryHistory(updated);

      storageEvents.emit('historyUpdated');
    } catch (err) {
      console.error('Error saving query:', err);
      setError('Erro ao salvar consulta');
      throw err;
    }
  }, []);

  const deleteQuery = useCallback(async (queryId: string) => {
    try {
      const updated = queryHistory.filter(q => q.id !== queryId);
      await AsyncStorage.setItem(STORAGE_KEYS.QUERY_HISTORY, JSON.stringify(updated));
      setQueryHistory(updated);
      storageEvents.emit('historyUpdated');
    } catch (err) {
      console.error('Error deleting query:', err);
      setError('Erro ao excluir consulta');
      throw err;
    }
  }, [queryHistory]);

  const clearHistory = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.QUERY_HISTORY);
      setQueryHistory([]);
      storageEvents.emit('historyUpdated');
    } catch (err) {
      console.error('Error clearing history:', err);
      setError('Erro ao limpar histórico');
      throw err;
    }
  }, []);

  const setSelectedLevel = useCallback(async (level: number) => {
    if (level < 0 || level > 17) throw new Error('Nível deve estar entre 0 e 17');
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_LEVEL, level.toString());
      setSelectedLevelState(level);
    } catch (err) {
      console.error('Error saving selected level:', err);
      setError('Erro ao salvar nível selecionado');
    }
  }, []);

  const exportHistory = useCallback((): string => {
    const exportData = {
      version: '1.1',
      timestamp: Date.now(),
      queryHistory,
      selectedLevel,
    };
    return JSON.stringify(exportData, null, 2);
  }, [queryHistory, selectedLevel]);

  const importHistory = useCallback(async (data: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed.queryHistory)) throw new Error('Formato inválido');

      const sorted = parsed.queryHistory.sort((a: StoredQuery, b: StoredQuery) => b.timestamp - a.timestamp);
      await AsyncStorage.setItem(STORAGE_KEYS.QUERY_HISTORY, JSON.stringify(sorted));
      if (parsed.selectedLevel !== undefined) {
        await AsyncStorage.setItem(STORAGE_KEYS.SELECTED_LEVEL, parsed.selectedLevel.toString());
        setSelectedLevelState(parsed.selectedLevel);
      }

      setQueryHistory(sorted);
      storageEvents.emit('historyUpdated');
      return true;
    } catch (err) {
      console.error('Error importing history:', err);
      setError('Erro ao importar histórico');
      return false;
    }
  }, []);

  return {
    queryHistory,
    selectedLevel,
    isLoading,
    error,
    saveQuery,
    deleteQuery,
    clearHistory,
    setSelectedLevel,
    exportHistory,
    importHistory,
    reloadHistory: loadData,
  };
}
