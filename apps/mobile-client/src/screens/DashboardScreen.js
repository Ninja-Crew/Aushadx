import React from 'react';
import { View, Text, TouchableOpacity,  StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, typography } from '../styles/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { removeToken } from '../utils/storage';

const DashboardScreen = ({ navigation, route }) => {
  const { token, user } = route.params || {};

  const features = [
    {
      id: 'profile',
      title: 'Profile Manager',
      icon: 'person',
      screen: 'Profile',
      color: '#9C27B0', // Purple
      description: 'Manage your personal & medical details'
    },
    {
      id: 'reminders',
      title: 'Valid Reminders',
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

  return (
    <SafeAreaView style={styles.container}>
        <View style={styles.header}>
            <View>
                <Text style={styles.greeting}>Hello,</Text>
                <Text style={styles.username}>{user ? user.name : 'User'}</Text>
            </View>

            <TouchableOpacity 
                onPress={async () => {
                    await removeToken();
                    navigation.replace('Login');
                }} 
                style={styles.logoutButton}
            >
                <MaterialIcons name="logout" size={24} color={colors.error} />
            </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.sectionTitle}>Your Health Tools</Text>
            <View style={styles.grid}>
                {features.map((feature) => (
                    <TouchableOpacity 
                        key={feature.id}
                        style={styles.card}
                        onPress={() => navigation.navigate(feature.screen, { token })}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: feature.color + '20' }]}>
                             <MaterialIcons name={feature.icon} size={32} color={feature.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{feature.title}</Text>
                            <Text style={styles.cardDesc}>{feature.description}</Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.l,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  greeting: {
    ...typography.caption,
    fontSize: 16,
  },
  username: {
    ...typography.header,
    color: colors.primary,
  },
  logoutButton: {
    padding: spacing.s,
  },
  content: {
    padding: spacing.l,
  },
  sectionTitle: {
    ...typography.subheader,
    marginBottom: spacing.m,
  },
  grid: {
    gap: spacing.m,
  },
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
  iconContainer: {
      width: 60,
      height: 60,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.m,
  },
  cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4
  },
  cardDesc: {
      fontSize: 14,
      color: colors.textSecondary,
      flex: 1, // Allow text to wrap if needed but row layout limits this. Adjusting layout.
      flexWrap: 'wrap'
  }
});

export default DashboardScreen;
