/**
 * Theme Toggle Component - Seletor de tema dark/light/auto
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '@/contexts/ThemeContext';

export default function ThemeToggle() {
  const { theme, themeMode, setThemeMode } = useTheme();

  const themeOptions: { mode: ThemeMode; icon: string; label: string }[] = [
    { mode: 'light', icon: 'light-mode', label: 'Claro' },
    { mode: 'dark', icon: 'dark-mode', label: 'Escuro' },
    { mode: 'auto', icon: 'brightness-auto', label: 'Auto' },
  ];

  return (

    <View style={styles.optionsContainer}>
      {themeOptions.map((option) => (
        <TouchableOpacity
          key={option.mode}
          style={[
            styles.option,
            {
              backgroundColor: themeMode === option.mode ? theme.primary : theme.surface,
              borderColor: themeMode === option.mode ? theme.primary : theme.border,
            }
          ]}
          onPress={() => setThemeMode(option.mode)}
        >
          <MaterialIcons
            name={option.icon as any}
            size={20}
            color={themeMode === option.mode ? 'white' : theme.secondary}
          />
          <Text
            style={[
              styles.optionText,
              {
                color: themeMode === option.mode ? 'white' : theme.secondary,
              }
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});