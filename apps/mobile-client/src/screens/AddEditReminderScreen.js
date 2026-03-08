import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { createReminder, updateReminder, deleteReminder } from '../api/reminders';
import { spacing } from '../styles/theme';
import { useTheme } from '../context/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const FREQUENCY_TYPES = [
  { label: 'Once', value: 'ONCE' },
  { label: 'Daily', value: 'DAILY' },
  { label: 'X Times Daily', value: 'X_TIMES_DAILY' },
  { label: 'Every X Hours', value: 'EVERY_X_HOURS' },
  { label: 'Every X Minutes', value: 'EVERY_X_MINUTES' },
  { label: 'Specific Days of Week', value: 'SPECIFIC_WEEK_DAYS' },
  { label: 'Specific Day of Month', value: 'SPECIFIC_DAY_OF_MONTH' },
];

const DURATION_TYPES = [
  { label: 'Single Day (One-time)', value: 'SINGLE_DAY' },
  { label: 'Continuous', value: 'CONTINUOUS' },
  { label: 'For X Days', value: 'FOR_X_DAYS' },
  { label: 'For X Weeks', value: 'FOR_X_WEEKS' },
  { label: 'For X Months', value: 'FOR_X_MONTHS' },
  { label: 'Until Date', value: 'UNTIL_DATE' },
];

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const AddEditReminderScreen = ({ route, navigation }) => {
  const { token, reminderData } = route.params || {};
  const { colors } = useTheme();
  const isEditMode = !!(reminderData && reminderData._id);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Track whether user has touched the date/time fields (so we don't
  // flag the original time as "in the past" before any edits)
  const [dateTimeModified, setDateTimeModified] = useState(false);

  // Date picker state
  const [showOnceDatePicker, setShowOnceDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getCurrentTimeStr = () => {
    const d = new Date();
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getCurrentDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    medicineName: '',
    dosage: '',
    frequency: 'ONCE',
    frequencyValue: '',
    specificWeekDays: [], // Array of numbers 0-6
    specificDayOfMonth: '',
    specificTimes: [getCurrentTimeStr()], // Default one time
    onceDate: getCurrentDateStr(), // For ONCE — today's date YYYY-MM-DD
    duration: 'SINGLE_DAY', // Matches ONCE default frequency
    durationValue: '',
    endDate: '', // For UNTIL_DATE, format YYYY-MM-DD
  });

  useEffect(() => {
    if (reminderData) {
      setDateTimeModified(false); // reset on load so original values aren't flagged
      setFormData({
        medicineName: reminderData.medicineName || '',
        dosage: reminderData.dosage || '',
        frequency: reminderData.frequency || 'ONCE',
        frequencyValue: reminderData.frequencyValue ? String(reminderData.frequencyValue) : '',
        specificWeekDays: reminderData.specificWeekDays || [],
        specificDayOfMonth: reminderData.specificDayOfMonth ? String(reminderData.specificDayOfMonth) : '',
        // Edit mode: keep original times as-is — never replace with current clock
        specificTimes: reminderData.specificTimes?.length > 0
          ? reminderData.specificTimes
          : reminderData.time
            ? [new Date(reminderData.time).toTimeString().slice(0, 5)]  // extract HH:MM from ISO
            : [getCurrentTimeStr()],  // new reminder default only
        // Edit mode: use original startDate; fall back to original `time` field; never replace with today
        onceDate: reminderData.startDate
          ? new Date(reminderData.startDate).toISOString().split('T')[0]
          : (reminderData.time
              ? new Date(reminderData.time).toISOString().split('T')[0]
              : ''),
        duration: reminderData.duration || 'CONTINUOUS',
        durationValue: reminderData.durationValue ? String(reminderData.durationValue) : '',
        endDate: reminderData.endDate ? new Date(reminderData.endDate).toISOString().split('T')[0] : '',
      });
    }
  }, [isEditMode, reminderData]);

  useEffect(() => {
    if (formData.frequency === 'X_TIMES_DAILY') {
      const count = parseInt(formData.frequencyValue, 10);
      if (!isNaN(count) && count > 0 && count <= 24) {
        setFormData(prev => {
          let newTimes = [...prev.specificTimes];
          if (newTimes.length < count) {
            const toAdd = count - newTimes.length;
            const extra = Array(toAdd).fill('08:00');
            newTimes = newTimes.concat(extra);
          } else if (newTimes.length > count) {
            newTimes = newTimes.slice(0, count);
          }
          if (newTimes.length !== prev.specificTimes.length) {
            return { ...prev, specificTimes: newTimes };
          }
          return prev;
        });
      }
    }
  }, [formData.frequency, formData.frequencyValue]);

  const toggleWeekDay = (dayIndex) => {
    setFormData((prev) => {
      const days = [...prev.specificWeekDays];
      if (days.includes(dayIndex)) {
        return { ...prev, specificWeekDays: days.filter(d => d !== dayIndex) };
      } else {
        return { ...prev, specificWeekDays: [...days, dayIndex].sort() };
      }
    });
  };

  const updateTime = (index, value) => {
    setDateTimeModified(true);
    const times = [...formData.specificTimes];
    times[index] = value;
    setFormData({ ...formData, specificTimes: times });
  };

  const addTime = () => {
    setFormData({ ...formData, specificTimes: [...formData.specificTimes, '12:00'] });
  };

  const removeTime = (index) => {
    if (formData.specificTimes.length <= 1) return; // keep at least one
    const times = [...formData.specificTimes];
    times.splice(index, 1);
    setFormData({ ...formData, specificTimes: times });
  };

  const getErrors = () => {
    const errors = {};
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    
    if (formData.frequency === 'X_TIMES_DAILY') {
      if (!formData.specificTimes || formData.specificTimes.length === 0) {
        errors.time_0 = 'Please provide valid time(s)';
      } else {
        formData.specificTimes.forEach((time, index) => {
          if (!timeRegex.test(time)) errors[`time_${index}`] = 'Invalid time format (HH:MM)';
        });
      }
    } else {
      if (!timeRegex.test(formData.specificTimes[0] || '')) {
        errors.time_0 = 'Invalid time format (HH:MM)';
      }
    }

    if (formData.frequency === 'ONCE') {
      if (!formData.onceDate && !isEditMode) {
        errors.dateTime = 'Date is required';
      } else if (formData.onceDate && !errors.time_0) {
        // Only check past-date if:
        // - creating a new reminder, OR
        // - user has explicitly modified the date or time in edit mode
        if (!isEditMode || dateTimeModified) {
          const now = new Date();
          now.setSeconds(0, 0);
          const [year, month, day] = formData.onceDate.split('-');
          const selectedDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
          const [hour, minute] = (formData.specificTimes[0] || '00:00').split(':');
          selectedDate.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
          if (selectedDate < now) {
            errors.dateTime = 'Date and time cannot be in the past';
          }
        }
      }
    }
    return errors;
  };

  const currentErrors = getErrors();
  const hasLiveErrors = Object.keys(currentErrors).length > 0;

  const validateForm = () => {
    if (!formData.medicineName.trim()) return 'Medicine Name is required';
    if (!formData.dosage.trim()) return 'Dosage is required';
    
    if (['EVERY_X_HOURS', 'EVERY_X_MINUTES', 'X_TIMES_DAILY'].includes(formData.frequency) && !formData.frequencyValue) {
      return `Frequency value is required for ${formData.frequency}`;
    }
    if (formData.frequency === 'SPECIFIC_WEEK_DAYS' && formData.specificWeekDays.length === 0) {
      return 'Please select at least one day of the week';
    }
    if (formData.frequency === 'SPECIFIC_DAY_OF_MONTH' && !formData.specificDayOfMonth) {
      return 'Please enter a day of the month';
    }

    if (hasLiveErrors) {
      return Object.values(currentErrors)[0];
    }

    if (['FOR_X_DAYS', 'FOR_X_WEEKS', 'FOR_X_MONTHS'].includes(formData.duration) && !formData.durationValue) {
      return `Duration value is required for ${formData.duration}`;
    }
    if (formData.duration === 'UNTIL_DATE' && !formData.endDate) {
      return 'End date is required';
    }

    return null; // Valid
  };

  const handleSave = async () => {
    const errorMsg = validateForm();
    if (errorMsg) {
      Alert.alert('Validation Error', errorMsg);
      return;
    }

    setSaving(true);
    try {
      // Prepare payload
      const payload = {
        medicineName: formData.medicineName,
        dosage: formData.dosage,
        frequency: formData.frequency,
        duration: formData.duration,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      };

      if (formData.frequency === 'X_TIMES_DAILY') {
        payload.specificTimes = formData.specificTimes;
        payload.frequencyValue = parseInt(formData.frequencyValue, 10);
      } else {
        payload.specificTimes = [formData.specificTimes[0]];

        if (formData.frequency === 'ONCE') {
          // Combine date + time into a full ISO startDate for precision scheduling
          const [hour, minute] = formData.specificTimes[0].split(':');
          const dt = new Date(formData.onceDate);
          dt.setHours(parseInt(hour, 10), parseInt(minute, 10), 0, 0);
          payload.startDate = dt.toISOString();
        }

        if (['EVERY_X_HOURS', 'EVERY_X_MINUTES'].includes(formData.frequency)) {
          payload.frequencyValue = parseInt(formData.frequencyValue, 10);
        }
        if (formData.frequency === 'SPECIFIC_WEEK_DAYS') {
          payload.specificWeekDays = formData.specificWeekDays;
        }
        if (formData.frequency === 'SPECIFIC_DAY_OF_MONTH') {
          payload.specificDayOfMonth = parseInt(formData.specificDayOfMonth, 10);
        }
      }

      if (['FOR_X_DAYS', 'FOR_X_WEEKS', 'FOR_X_MONTHS'].includes(formData.duration)) {
        payload.durationValue = parseInt(formData.durationValue, 10);
      }
      if (formData.duration === 'UNTIL_DATE') {
        payload.endDate = new Date(formData.endDate).toISOString();
      }

      if (isEditMode) {
        await updateReminder(token, reminderData._id, payload);
        Alert.alert('Success', 'Reminder updated successfully!');
      } else {
        await createReminder(token, payload);
        Alert.alert('Success', 'Reminder created successfully!');
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save reminder');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      'Delete Reminder',
      'Are you sure you want to delete this reminder?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteReminder(token, reminderData._id);
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to delete reminder');
            } finally {
              setDeleting(false);
            }
          }
        }
      ]
    );
  };

  const styles = makeStyles(colors);
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : null}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Reminder' : 'New Reminder'}</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Medicine Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.medicineName}
              onChangeText={(text) => setFormData({...formData, medicineName: text})}
              placeholder="e.g. Paracetamol"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dosage *</Text>
            <TextInput
              style={styles.input}
              value={formData.dosage}
              onChangeText={(text) => setFormData({...formData, dosage: text})}
              placeholder="e.g. 1 Tablet (500mg)"
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Schedule</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.frequency}
                onValueChange={(itemValue) => setFormData(prev => ({
                  ...prev,
                  frequency: itemValue,
                  // Auto-lock duration to SINGLE_DAY when ONCE is selected
                  duration: itemValue === 'ONCE' ? 'SINGLE_DAY' : (prev.duration === 'SINGLE_DAY' ? 'CONTINUOUS' : prev.duration),
                }))}
                style={styles.picker}
              >
                {FREQUENCY_TYPES.map(f => <Picker.Item key={f.value} label={f.label} value={f.value} />)}
              </Picker>
            </View>
          </View>

          {['EVERY_X_HOURS', 'EVERY_X_MINUTES', 'X_TIMES_DAILY'].includes(formData.frequency) && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Frequency Value (X) *</Text>
              <TextInput
                style={styles.input}
                value={formData.frequencyValue}
                onChangeText={(text) => setFormData({...formData, frequencyValue: text})}
                placeholder="e.g. 2"
                keyboardType="numeric"
              />
            </View>
          )}

          {formData.frequency === 'SPECIFIC_WEEK_DAYS' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Days of Week *</Text>
              <View style={styles.weekDaysContainer}>
                {WEEK_DAYS.map((day, index) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      formData.specificWeekDays.includes(index) && styles.dayButtonSelected
                    ]}
                    onPress={() => toggleWeekDay(index)}
                  >
                    <Text style={[
                      styles.dayButtonText,
                      formData.specificWeekDays.includes(index) && styles.dayButtonTextSelected
                    ]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {formData.frequency === 'SPECIFIC_DAY_OF_MONTH' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Day of Month (1-31) *</Text>
              <TextInput
                style={styles.input}
                value={formData.specificDayOfMonth}
                onChangeText={(text) => setFormData({...formData, specificDayOfMonth: text})}
                placeholder="e.g. 15"
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
          )}

          {formData.frequency === 'ONCE' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Time to Take (HH:MM) *</Text>
              <TextInput
                style={[styles.input, (currentErrors.time_0 || currentErrors.dateTime) && { borderColor: colors.error }]}
                value={formData.specificTimes[0]}
                onChangeText={(text) => updateTime(0, text)}
                placeholder="08:00"
                maxLength={5}
              />
              {currentErrors.time_0 ? (
                <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{currentErrors.time_0}</Text>
              ) : null}

              <Text style={[styles.label, { marginTop: spacing.m }]}>Date to Take *</Text>
              <TouchableOpacity
                style={[styles.input, styles.dateButton, currentErrors.dateTime && { borderColor: colors.error }]}
                onPress={() => setShowOnceDatePicker(true)}
              >
                <Text style={{ color: colors.text }}>{formData.onceDate}</Text>
                <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
              </TouchableOpacity>
              {currentErrors.dateTime ? (
                <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{currentErrors.dateTime}</Text>
              ) : null}
              {showOnceDatePicker && (
                <DateTimePicker
                  value={new Date(formData.onceDate)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={today}
                  onChange={(event, selectedDate) => {
                    setShowOnceDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setDateTimeModified(true);
                      const year = selectedDate.getFullYear();
                      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
                      const day = String(selectedDate.getDate()).padStart(2, '0');
                      setFormData({ ...formData, onceDate: `${year}-${month}-${day}` });
                    }
                  }}
                />
              )}
            </View>
          )}

          {formData.frequency === 'X_TIMES_DAILY' &&
           parseInt(formData.frequencyValue, 10) > 0 && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Times of Day (HH:MM) *</Text>
              {formData.specificTimes.map((time, index) => (
                <View key={index} style={{ marginBottom: spacing.m }}>
                  <View style={styles.timeRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }, currentErrors[`time_${index}`] && { borderColor: colors.error }]}
                      value={time}
                      onChangeText={(text) => updateTime(index, text)}
                      placeholder="08:00"
                      maxLength={5}
                    />
                  </View>
                  {currentErrors[`time_${index}`] ? (
                    <Text style={{ color: colors.error, fontSize: 12, marginTop: -4 }}>{currentErrors[`time_${index}`]}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {formData.frequency !== 'ONCE' && formData.frequency !== 'X_TIMES_DAILY' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Start Time (HH:MM) *</Text>
              <TextInput
                style={[styles.input, currentErrors.time_0 && { borderColor: colors.error }]}
                value={formData.specificTimes[0]}
                onChangeText={(text) => updateTime(0, text)}
                placeholder="08:00"
                maxLength={5}
              />
              {currentErrors.time_0 ? (
                <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{currentErrors.time_0}</Text>
              ) : null}
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Duration</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Duration Type</Text>
            <View style={[styles.pickerContainer, formData.frequency === 'ONCE' && { opacity: 0.6 }]}>
              <Picker
                selectedValue={formData.frequency === 'ONCE' ? 'SINGLE_DAY' : formData.duration}
                onValueChange={(itemValue) => setFormData({ ...formData, duration: itemValue })}
                enabled={formData.frequency !== 'ONCE'}
                style={styles.picker}
              >
                {formData.frequency === 'ONCE'
                  ? <Picker.Item label="Single Day (One-time)" value="SINGLE_DAY" />
                  : DURATION_TYPES.filter(d => d.value !== 'SINGLE_DAY').map(d =>
                      <Picker.Item key={d.value} label={d.label} value={d.value} />
                    )
                }
              </Picker>
            </View>
            {formData.frequency === 'ONCE' && (
              <Text style={[styles.label, { marginTop: 4, fontStyle: 'italic' }]}>
                Duration is fixed for one-time reminders
              </Text>
            )}
          </View>

          {['FOR_X_DAYS', 'FOR_X_WEEKS', 'FOR_X_MONTHS'].includes(formData.duration) && (
             <View style={styles.inputGroup}>
              <Text style={styles.label}>Duration Value (X) *</Text>
              <TextInput
                style={styles.input}
                value={formData.durationValue}
                onChangeText={(text) => setFormData({...formData, durationValue: text})}
                placeholder="e.g. 7"
                keyboardType="numeric"
              />
            </View>
          )}

          {formData.duration === 'UNTIL_DATE' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>End Date *</Text>
              <TouchableOpacity
                style={[styles.input, styles.dateButton]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text style={{ color: formData.endDate ? colors.text : colors.textSecondary }}>
                  {formData.endDate || 'Select end date'}
                </Text>
                <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
              </TouchableOpacity>
              {showEndDatePicker && (
                <DateTimePicker
                  value={formData.endDate ? new Date(formData.endDate) : today}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={today}
                  onChange={(event, selectedDate) => {
                    setShowEndDatePicker(Platform.OS === 'ios');
                    if (selectedDate) {
                      setFormData({ ...formData, endDate: selectedDate.toISOString().split('T')[0] });
                    }
                  }}
                />
              )}
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity 
              style={[
                styles.actionBtn, 
                styles.saveBtn,
                (saving || hasLiveErrors) && { opacity: 0.6 }
              ]}
              onPress={handleSave}
              disabled={saving || hasLiveErrors}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Reminder'}</Text>
            </TouchableOpacity>

            {isEditMode && (
              <TouchableOpacity 
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={handleDelete}
                disabled={deleting}
              >
                <Text style={styles.deleteBtnText}>{deleting ? 'Deleting...' : 'Delete Reminder'}</Text>
              </TouchableOpacity>
            )}
          </View>
          
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: 80 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: colors.primary, marginBottom: spacing.l },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginTop: spacing.m, marginBottom: spacing.m, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.l },
  inputGroup: { marginBottom: spacing.m },
  label: { fontSize: 13, marginBottom: 6, color: colors.textSecondary },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.m, fontSize: 16, color: colors.text },
  dateButton: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pickerContainer: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.card },
  picker: { height: 50, width: '100%', color: colors.text },
  weekDaysContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dayButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card },
  dayButtonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayButtonText: { fontSize: 13, color: colors.text },
  dayButtonTextSelected: { color: '#FFF', fontWeight: 'bold' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.s },
  iconButton: { padding: 4, marginLeft: spacing.s },
  addTimeBtn: { flexDirection: 'row', alignItems: 'center', padding: 4 },
  addTimeText: { color: colors.primary, marginLeft: 4, fontWeight: 'bold' },
  actions: { marginTop: spacing.l, gap: spacing.m },
  actionBtn: { padding: spacing.m, borderRadius: 12, alignItems: 'center' },
  saveBtn: { backgroundColor: colors.primary },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  deleteBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.error },
  deleteBtnText: { color: colors.error, fontSize: 16, fontWeight: '700' },
});

export default AddEditReminderScreen;
