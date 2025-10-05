/**
 * Theme Context - Gerencia o tema dark/light da aplicação
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface Theme {
  text: string;
  background: string;
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;
  border: string;
  card: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  surface: string;
  surfaceVariant: string;
  outline: string;
  shadow: string;
}

const lightTheme: Theme = {
  text: '#000000',
  background: '#ffffff',
  tint: '#2563eb',
  tabIconDefault: '#6b7280',
  tabIconSelected: '#2563eb',
  border: '#e5e7eb',
  card: '#f8fafc',
  primary: '#2563eb',
  secondary: '#64748b',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  surface: '#ffffff',
  surfaceVariant: '#f1f5f9',
  outline: '#d1d5db',
  shadow: 'rgba(0, 0, 0, 0.1)',
};

const darkTheme: Theme = {
  text: '#ffffff',
  background: '#0f172a',
  tint: '#3b82f6',
  tabIconDefault: '#6b7280',
  tabIconSelected: '#3b82f6',
  border: '#374151',
  card: '#1e293b',
  primary: '#3b82f6',
  secondary: '#94a3b8',
  success: '#059669',
  warning: '#d97706',
  error: '#dc2626',
  surface: '#1e293b',
  surfaceVariant: '#334155',
  outline: '#4b5563',
  shadow: 'rgba(0, 0, 0, 0.3)',
};

interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

const THEME_STORAGE_KEY = '@gps_converter_theme_mode';

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('auto');
  
  // Determina se deve usar tema escuro
  const isDark = themeMode === 'dark' || (themeMode === 'auto' && systemColorScheme === 'dark');
  
  // Seleciona o tema baseado na preferência
  const theme = isDark ? darkTheme : lightTheme;

  // Carrega o tema salvo na inicialização
  useEffect(() => {
    loadSavedTheme();
  }, []);

  const loadSavedTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch (error) {
      console.error('Erro ao carregar tema:', error);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Erro ao salvar tema:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, themeMode, isDark, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export { lightTheme, darkTheme };