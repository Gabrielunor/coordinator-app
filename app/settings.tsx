/**
 * Settings Screen - Configuration and Preferences with Hidden Developer Mode
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import ThemeToggle from '@/components/ThemeToggle';
import { useStorage } from '@/hooks/useStorage';
import { format } from 'date-fns';

export default function SettingsScreen() {
  const { theme, themeMode } = useTheme();
  const { clearHistory, exportHistory, importHistory, queryHistory } = useStorage();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const tapCount = useRef(0);
  const [showDevMode, setShowDevMode] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  // Easter egg handler
  const handleDevTap = () => {
    tapCount.current += 1;
    if (tapCount.current >= 5) {
      setShowDevMode(true);
      tapCount.current = 0;
      Alert.alert('🔧 Modo Desenvolvedor', 'Você desbloqueou o modo desenvolvedor!');
    }
    setTimeout(() => {
      tapCount.current = 0;
    }, 2000);
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Limpar Histórico',
      'Tem certeza que deseja excluir todas as consultas salvas? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Apagar Tudo',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearHistory();
              Alert.alert('Sucesso', 'Histórico limpo com sucesso.');
            } catch {
              Alert.alert('Erro', 'Falha ao limpar o histórico.');
            }
          },
        },
      ]
    );
  };

  const handleExportHistory = async () => {
    try {
      const data = exportHistory();
      await Share.share({
        message: data,
        title: 'Histórico GPS Converter',
      });
    } catch {
      Alert.alert('Erro', 'Falha ao exportar histórico.');
    }
  };

  const handleImportHistory = () => {
    Alert.prompt(
      'Importar Histórico',
      'Cole os dados exportados anteriormente:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar',
          onPress: async (data) => {
            if (!data) return;
            const success = await importHistory(data);
            Alert.alert(success ? 'Sucesso' : 'Erro', success ? 'Histórico importado.' : 'Dados inválidos.');
          },
        },
      ],
      'plain-text'
    );
  };

  // Simulação de tamanho aproximado do histórico
  const estimateHistorySize = () => {
    const json = JSON.stringify(queryHistory);
    return (json.length / 1024).toFixed(1) + ' KB';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.background, theme.card]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleDevTap} activeOpacity={0.8}>
            <MaterialIcons name="settings" size={40} color={theme.primary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: theme.text }]}>Configurações</Text>
          <Text style={[styles.subtitle, { color: theme.secondary }]}>
            Personalize o aplicativo e gerencie seus dados locais
          </Text>
        </View>

        {/* Theme Selection (única caixa agora) */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Tema</Text>
          <ThemeToggle />
        </View>

        {/* Data Management */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Histórico</Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={handleExportHistory}
          >
            <MaterialIcons name="share" size={20} color="white" />
            <Text style={styles.buttonText}>Exportar Histórico</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.success }]}
            onPress={handleImportHistory}
          >
            <MaterialIcons name="file-download" size={20} color="white" />
            <Text style={styles.buttonText}>Importar Histórico</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.error }]}
            onPress={handleClearHistory}
          >
            <MaterialIcons name="delete" size={20} color="white" />
            <Text style={styles.buttonText}>Limpar Histórico</Text>
          </TouchableOpacity>
        </View>

        {/* Developer Mode (hidden until unlocked) */}
        {showDevMode && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Modo Desenvolvedor</Text>

            <Text style={[styles.devText, { color: theme.secondary }]}>
              Versão do App: <Text style={{ color: theme.text }}>1.0.0</Text>
            </Text>
            <Text style={[styles.devText, { color: theme.secondary }]}>
              Data Atual: <Text style={{ color: theme.text }}>{format(new Date(), 'dd/MM/yyyy HH:mm')}</Text>
            </Text>
            <Text style={[styles.devText, { color: theme.secondary }]}>
              Itens no Histórico: <Text style={{ color: theme.text }}>{queryHistory.length}</Text>
            </Text>
            <Text style={[styles.devText, { color: theme.secondary }]}>
              Tamanho Estimado: <Text style={{ color: theme.text }}>{estimateHistorySize()}</Text>
            </Text>
            <Text style={[styles.devText, { color: theme.secondary }]}>
              Tema Atual: <Text style={{ color: theme.text }}>{themeMode}</Text>
            </Text>
          </View>
        )}

        {/* About Section */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Sobre</Text>
          <Text style={[styles.aboutText, { color: theme.secondary }]}>
            GPS Converter App v1.0.0{'\n'}
            Desenvolvido com 💙 em React Native.
          </Text>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, gap: 20, paddingBottom: 80 },
  header: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    elevation: 2,
  },
  buttonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  aboutText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  devText: {
    fontSize: 13,
    marginTop: 4,
  },
});
