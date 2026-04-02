import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import client from '../api/client'; // Raw client or explicit API call
import { getMissedReminders, takeReminder, snoozeReminder, clearAllReminders } from '../api/reminders';
import notifee from '@notifee/react-native';
import { useNotificationContext } from '../context/NotificationContext';

const getMinutesAgo = (scheduledTime, fallback) => {
  if (!scheduledTime) return fallback ?? '?';
  const diffMs = Date.now() - new Date(scheduledTime).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  return mins;
};

const RemindersScreen = ({ route, navigation }) => {
  const { token, userId } = route.params || {};
  const { colors, isDark } = useTheme();
  const { refreshNotifications, removeNotification, setNotifications: setContextNotifications } = useNotificationContext();
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const fetchNotifications = async (isRefreshing = false, isLoadMore = false) => {
    if (isRefreshing) setRefreshing(true);
    else if (isLoadMore) setLoadingMore(true);
    else setLoading(true);
    
    try {
      const currentPage = isRefreshing ? 1 : (isLoadMore ? page + 1 : 1);
      const data = await getMissedReminders(token, currentPage);
      
      if (isRefreshing || !isLoadMore) {
        setNotifications(data.notifications);
        setPage(1);
      } else {
        setNotifications(prev => [...prev, ...data.notifications]);
        setPage(currentPage);
      }
      setHasMore(data.pagination.hasMore);
    } catch (e) {
      console.error("Error fetching missed reminders", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    notifee.cancelAllNotifications();

    const unsubscribe = navigation.addListener('focus', () => {
      fetchNotifications(true);
      refreshNotifications(); // Updates unread badge elsewhere
    });
    return unsubscribe;
  }, [navigation, refreshNotifications]);

  const handleRefresh = () => fetchNotifications(true);
  
  const handleLoadMore = () => {
    if (!loading && !loadingMore && !refreshing && hasMore) {
      fetchNotifications(false, true);
    }
  };

  const handleTake = async (item) => {
    if (!item?.reminderId) return;
    try {
       setProcessingId(item.historyId);
       
       // Optimistic update
       setNotifications(prev => prev.filter(n => n.historyId !== item.historyId));
       removeNotification(item.reminderId); // Context handles badge decrement and its own list
       
       await takeReminder(token, item.reminderId, item.scheduledTime);
    } catch (e) {
       console.error("Error taking reminder from list", e);
       fetchNotifications(true);
    } finally {
       setProcessingId(null);
    }
  };
  
  const handleClearAll = async () => {
    Alert.alert(
      "Clear Missed Reminders",
      "Are you sure you want to clear all missed reminders?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear Missed", 
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await clearAllReminders(token);
              fetchNotifications(true); // Refresh to show remaining pending reminders
              refreshNotifications(); // Updates badge count elsewhere
            } catch (e) {
              console.error("Error clearing all reminders", e);
              Alert.alert("Error", "Failed to clear reminders");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }) => {
    const isMissed = item.status === 'missed';
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={[
            styles.iconContainer, 
            isMissed ? { backgroundColor: 'rgba(255, 68, 68, 0.1)' } : { backgroundColor: 'rgba(52, 199, 89, 0.1)' }
          ]}>
              <MaterialIcons 
                name={isMissed ? "error-outline" : "access-time"} 
                size={24} 
                color={isMissed ? "#ff4444" : "#FFB300"} 
              />
          </View>
          <View style={styles.cardContent}>
              <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: colors.text }]}>
                    {item.medicineName}
                  </Text>
                  <View style={[
                    styles.statusBadge, 
                    isMissed ? styles.missedBadge : styles.pendingBadge
                  ]}>
                      <Text style={[
                        styles.statusBadgeText, 
                        { color: isMissed ? '#ff4444' : '#FFB300' }
                      ]}>
                        {isMissed ? "Missed" : "Pending"}
                      </Text>
                  </View>
              </View>
              <Text style={[styles.timeText, { color: colors.textSecondary }]}>
                 {isMissed ? "Safety threshold reached" : `Due ${getMinutesAgo(item.scheduledTime)} minutes ago`}
              </Text>
              {!isMissed && (
                <View style={styles.pendingMsgRow}>
                  <MaterialIcons name="report-problem" size={14} color="#FFB300" />
                  <Text style={styles.pendingMsgText}>Pending intake - Action required</Text>
                </View>
              )}
              <Text style={[styles.scheduleText, { color: colors.textSecondary }]}>
                 Scheduled for: {new Date(item.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
          </View>
        </View>
        <View style={styles.actionButtons}>
             <TouchableOpacity
                style={[
                  styles.actionButton, 
                  { backgroundColor: isMissed ? colors.border : colors.primary }
                ]}
                onPress={() => !isMissed && handleTake(item)}
                disabled={processingId === item.historyId || isMissed}
             >
                {processingId === item.historyId ? (
                   <ActivityIndicator size="small" color="#fff" />
                ) : (
                   <Text style={[styles.actionButtonText, isMissed && { color: colors.textSecondary }]}>
                     {isMissed ? "Missed" : "Take Now"}
                   </Text>
                )}
             </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <View style={[styles.headerActions, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Daily Activity</Text>
          {notifications.length > 0 && (
            <TouchableOpacity onPress={handleClearAll} style={styles.clearAllBtn}>
              <MaterialIcons name="done-all" size={20} color={colors.primary} />
              <Text style={[styles.clearAllText, { color: colors.primary }]}>Clear All</Text>
            </TouchableOpacity>
          )}
      </View>
      {loading && !refreshing ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item, index) => `${item.historyId || item.reminderId}-${index}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="notifications-none" size={64} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>All caught up!</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  clearAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearAllText: { fontSize: 14, fontWeight: '600' },
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
  title: { fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 8 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pendingBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: '#34C759',
  },
  missedBadge: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeText: { fontSize: 13, marginBottom: 2 },
  scheduleText: { fontSize: 12, marginBottom: 8 },
  pendingMsgRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    marginBottom: 8,
    backgroundColor: 'rgba(255, 179, 0, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  pendingMsgText: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: '#FFB300' 
  },
  actionButtons: { flexDirection: 'row', gap: 8, marginTop: 4 },
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
  footerLoader: { paddingVertical: 20, alignItems: 'center' },
});

export default RemindersScreen;

