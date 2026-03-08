import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Switch } from 'react-native';
import { spacing } from '../styles/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { removeToken } from '../utils/storage';
import { useTheme } from '../context/ThemeContext';

const DashboardScreen = ({ navigation, route }) => {
  const { token, user } = route.params || {};
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);
  const { colors, isDark, toggleTheme } = useTheme();

  const features = [
    {
      id: 'reminders',
      title: 'Medicine Reminders',
      icon: 'alarm',
      screen: 'Reminders',
      color: colors.primary,
      description: 'Manage your medicine schedule'
    },
    {
      id: 'analyzer',
      title: 'Medicine Analyzer',
      icon: 'medical-services',
      screen: 'Analyzer',
      color: colors.secondary,
      description: 'Identify pills and prescriptions'
    },
    {
      id: 'agent',
      title: 'AI Assistant',
      icon: 'chat',
      screen: 'Agent',
      color: colors.success,
      description: 'Chat with your health companion'
    },
  ];

  const displayName = user?.name || 'Jay Majors';
  const nameParts = displayName.split(' ');
  const formattedName = nameParts.length > 1 ? `${nameParts[0]}\n${nameParts.slice(1).join(' ')}` : displayName;

  const s = makeStyles(colors);

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.username}>{formattedName}</Text>
        </View>
        <TouchableOpacity onPress={() =>  setIsOptionsVisible(true)} style={s.settingsButton}>
          <MaterialIcons name="menu" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <Modal visible={isOptionsVisible} transparent animationType="fade" onRequestClose={() => setIsOptionsVisible(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setIsOptionsVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={s.modalContent}>
            <Text style={s.modalTitle}>Options</Text>

            <TouchableOpacity style={s.modalOption} onPress={() => { setIsOptionsVisible(false); navigation.navigate('Profile', { token }); }}>
              <MaterialIcons name="person" size={24} color={colors.text} />
              <Text style={s.modalOptionText}>View Profile</Text>
            </TouchableOpacity>

            <View style={s.separator} />

            {/* Dark / Light Mode Toggle */}
            <View style={s.modalOption}>
              <MaterialIcons name={isDark ? 'dark-mode' : 'light-mode'} size={24} color={colors.text} />
              <Text style={s.modalOptionText}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={isDark ? '#fff' : '#f4f3f4'}
                style={{ marginLeft: 'auto' }}
              />
            </View>

            <View style={s.separator} />

            <TouchableOpacity
              style={s.modalOption}
              onPress={async () => {
                setIsOptionsVisible(false);
                await removeToken();
                navigation.replace('Login');
              }}
            >
              <MaterialIcons name="logout" size={24} color={colors.error} />
              <Text style={[s.modalOptionText, { color: colors.error }]}>Log Out</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ScrollView contentContainerStyle={s.content} style={{ backgroundColor: colors.background }}>
        <Text style={s.sectionTitle}>Your Health Tools</Text>
        <View style={s.grid}>
          {features.map((feature) => (
            <TouchableOpacity
              key={feature.id}
              style={s.card}
              onPress={() => navigation.navigate(feature.screen, { token })}
            >
              <View style={[s.iconContainer, { backgroundColor: feature.color + '20' }]}>
                <MaterialIcons name={feature.icon} size={32} color={feature.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{feature.title}</Text>
                <Text style={s.cardDesc}>{feature.description}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: spacing.l,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  username: { fontSize: 28, fontWeight: '800', color: colors.text, lineHeight: 32 },
  settingsButton: { padding: spacing.s, backgroundColor: colors.chip, borderRadius: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: spacing.l,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: spacing.m, color: colors.text },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.m },
  modalOptionText: { fontSize: 18, fontWeight: '600', color: colors.text, marginLeft: spacing.m },
  separator: { height: 1, backgroundColor: colors.border + '60', marginVertical: 4 },
  content: { padding: spacing.l },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: spacing.m },
  grid: { gap: spacing.m },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.l,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: { width: 60, height: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: spacing.m },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
  cardDesc: { fontSize: 14, color: colors.textSecondary, flexWrap: 'wrap' },
});

export default DashboardScreen;
