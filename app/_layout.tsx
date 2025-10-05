import React from 'react';
import { Tabs } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

function TabLayoutContent() {
  const { theme, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} translucent />
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: theme.tint,
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            paddingBottom: 5,
            height: 60,
            elevation: 8,
            shadowColor: theme.shadow,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          tabBarInactiveTintColor: theme.tabIconDefault,
        }}>
        <Tabs.Screen
          name="converter"
          options={{
            title: 'Converter',
            tabBarIcon: ({ color, focused }) => (
              <MaterialIcons 
                name="gps-fixed" 
                size={24} 
                color={color}
                style={{ opacity: focused ? 1 : 0.6 }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="map"
          options={{
            title: 'Mapa',
            tabBarIcon: ({ color, focused }) => (
              <MaterialIcons 
                name="map" 
                size={24} 
                color={color}
                style={{ opacity: focused ? 1 : 0.6 }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'Histórico',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons 
                name="time-outline" 
                size={24} 
                color={color}
                style={{ opacity: focused ? 1 : 0.6 }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Buscar',
            tabBarIcon: ({ color, focused }) => (
              <MaterialIcons 
                name="search" 
                size={24} 
                color={color}
                style={{ opacity: focused ? 1 : 0.6 }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Configurações',
            tabBarIcon: ({ color, focused }) => (
              <MaterialIcons 
                name="settings" 
                size={24} 
                color={color}
                style={{ opacity: focused ? 1 : 0.6 }}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="index"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}

export default function TabLayout() {
  return (
    <ThemeProvider>
      <TabLayoutContent />
    </ThemeProvider>
  );
}