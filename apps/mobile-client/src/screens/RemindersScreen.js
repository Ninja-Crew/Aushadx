import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { getReminders } from '../api/reminders';
import { colors, spacing, typography } from '../styles/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

const RemindersScreen = ({ route, navigation }) => {
  const { token } = route.params || {};
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Re-fetch when returning to this screen
    const unsubscribe = navigation.addListener('focus', () => {
      fetchReminders();
    });
    return unsubscribe;
  }, [navigation]);

  const fetchReminders = async () => {
    setLoading(true);
    try {
      const data = await getReminders(token);
      setReminders(data);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to fetch reminders');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading Reminders...</Text>
        </View>
      ) : reminders.length === 0 ? (
        <View style={styles.centerContainer}>
          <MaterialIcons name="alarm-off" size={64} color={colors.border} />
          <Text style={styles.emptyText}>No reminders scheduled yet.</Text>
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(item) => item._id || item.id}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.card}
              onPress={() => navigation.navigate('AddEditReminder', { token, reminderData: item })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.medicineName}>{item.medicineName}</Text>
                <View style={[styles.statusBadge, item.status === 'active' ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, item.status === 'active' ? styles.statusTextActive : styles.statusTextInactive]}>
                    {item.status || 'Active'}
                  </Text>
                </View>
              </View>
              <Text style={styles.dosage}>{item.dosage}</Text>
              
              <View style={styles.detailsRow}>
                <MaterialIcons name="schedule" size={16} color={colors.textSecondary} />
                <Text style={styles.detailsText}>
                  {item.frequency} 
                  {['X_TIMES_DAILY', 'EVERY_X_HOURS', 'EVERY_X_MINUTES'].includes(item.frequency) ? ` (${item.frequencyValue})` : ''}
                </Text>
              </View>

              <View style={styles.detailsRow}>
                <MaterialIcons name="date-range" size={16} color={colors.textSecondary} />
                <Text style={styles.detailsText}>Duration: {item.duration}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('AddEditReminder', { token })}
      >
        <MaterialIcons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.m,
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.s,
    color: colors.textSecondary,
    ...typography.caption,
  },
  emptyText: {
    marginTop: spacing.m,
    color: colors.textSecondary,
    ...typography.body,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.l,
    marginBottom: spacing.m,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border + '40'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  medicineName: {
    ...typography.subheader,
    color: colors.primary,
    flex: 1,
  },
  dosage: {
    ...typography.body,
    marginBottom: spacing.m,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  detailsText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: { backgroundColor: colors.success + '20' },
  statusInactive: { backgroundColor: colors.border },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  statusTextActive: { color: colors.success },
  statusTextInactive: { color: colors.textSecondary },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  }
});

export default RemindersScreen;
