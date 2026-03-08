import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import client from '../api/client'; // Raw client or explicit API call
import { takeReminder, snoozeReminder } from '../api/reminders';
import notifee from '@notifee/react-native';
import { useNotificationContext } from '../context/NotificationContext';

const NotificationsScreen = ({ route, navigation }) => {
  const { token, userId } = route.params || {};
  const { colors, isDark } = useTheme();
  const { clearUnread, notifications, removeNotification } = useNotificationContext();
  
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    clearUnread();
    notifee.cancelAllNotifications();
  }, []);

  const handleTake = async (id) => {
    if (!id) return;
    try {
       setProcessingId(id);
       // Optimistically remove from UI
       removeNotification(id);
       await takeReminder(token, id);
    } catch (e) {
       console.error("Error taking reminder from list", e);
    } finally {
       setProcessingId(null);
    }
  };

  const renderItem = ({ item }) => {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={styles.iconContainer}>
              <MaterialIcons name="notifications-active" size={24} color={colors.primary} />
          </View>
          <View style={styles.cardContent}>
              <View style={styles.titleRow}>
                 <Text style={[styles.title, { color: colors.text }]}>
                    Reminder to take {item.medicineName}
                 </Text>
                 <View style={styles.missedBadge}>
                    <Text style={styles.missedText}>Missed</Text>
                 </View>
              </View>
              <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                 Missed {item.timeSinceMissedMinutes} minutes ago
              </Text>
              <Text style={[styles.scheduleText, { color: colors.textSecondary }]}>
                 Scheduled for: {new Date(item.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
          </View>
        </View>
        <View style={styles.actionButtons}>
             <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: colors.primary }]}
                onPress={() => handleTake(item.reminderId)}
                disabled={processingId === item.reminderId}
             >
                {processingId === item.reminderId ? (
                   <ActivityIndicator size="small" color="#fff" />
                ) : (
                   <Text style={styles.actionButtonText}>Taken</Text>
                )}
             </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <FlatList
        data={notifications}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="notifications-none" size={64} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No new notifications</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 40 },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 68, 68, 0.1)', // Light error tint
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: 'bold', flex: 1 },
  missedBadge: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  missedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  timeText: { fontSize: 13, marginBottom: 2 },
  scheduleText: { fontSize: 12, marginBottom: 12 },
  actionButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snoozeButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, marginTop: 16 },
});

export default NotificationsScreen;
