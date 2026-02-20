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
import { Picker } from '@react-native-picker/picker';
import { createReminder, updateReminder, deleteReminder } from '../api/reminders';
import { colors, spacing, typography } from '../styles/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const FREQUENCY_TYPES = [
  { label: 'Once', value: 'ONCE' },
  { label: 'X Times Daily', value: 'X_TIMES_DAILY' },
  { label: 'Every X Hours', value: 'EVERY_X_HOURS' },
  { label: 'Every X Minutes', value: 'EVERY_X_MINUTES' },
  { label: 'Specific Days of Week', value: 'SPECIFIC_WEEK_DAYS' },
  { label: 'Specific Day of Month', value: 'SPECIFIC_DAY_OF_MONTH' },
];

const DURATION_TYPES = [
  { label: 'Continuous', value: 'CONTINUOUS' },
  { label: 'For X Days', value: 'FOR_X_DAYS' },
  { label: 'For X Weeks', value: 'FOR_X_WEEKS' },
  { label: 'For X Months', value: 'FOR_X_MONTHS' },
  { label: 'Until Date', value: 'UNTIL_DATE' },
];

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const AddEditReminderScreen = ({ route, navigation }) => {
  const { token, reminderData } = route.params || {};
  const isEditMode = !!reminderData;

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    medicineName: '',
    dosage: '',
    frequency: 'ONCE',
    frequencyValue: '',
    specificWeekDays: [], // Array of numbers 0-6
    specificDayOfMonth: '',
    specificTimes: ['08:00'], // Default one time
    duration: 'CONTINUOUS',
    durationValue: '',
    endDate: '', // For UNTIL_DATE, format YYYY-MM-DD
  });

  useEffect(() => {
    if (isEditMode && reminderData) {
      setFormData({
        medicineName: reminderData.medicineName || '',
        dosage: reminderData.dosage || '',
        frequency: reminderData.frequency || 'ONCE',
        frequencyValue: reminderData.frequencyValue ? String(reminderData.frequencyValue) : '',
        specificWeekDays: reminderData.specificWeekDays || [],
        specificDayOfMonth: reminderData.specificDayOfMonth ? String(reminderData.specificDayOfMonth) : '',
        specificTimes: reminderData.specificTimes && reminderData.specificTimes.length > 0 ? reminderData.specificTimes : ['08:00'],
        duration: reminderData.duration || 'CONTINUOUS',
        durationValue: reminderData.durationValue ? String(reminderData.durationValue) : '',
        endDate: reminderData.endDate ? new Date(reminderData.endDate).toISOString().split('T')[0] : '',
      });
    }
  }, [isEditMode, reminderData]);

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

  const validateForm = () => {
    if (!formData.medicineName.trim()) return 'Medicine Name is required';
    if (!formData.dosage.trim()) return 'Dosage is required';
    
    if (['X_TIMES_DAILY', 'EVERY_X_HOURS', 'EVERY_X_MINUTES'].includes(formData.frequency) && !formData.frequencyValue) {
      return `Frequency value is required for ${formData.frequency}`;
    }
    if (formData.frequency === 'SPECIFIC_WEEK_DAYS' && formData.specificWeekDays.length === 0) {
      return 'Please select at least one day of the week';
    }
    if (formData.frequency === 'SPECIFIC_DAY_OF_MONTH' && !formData.specificDayOfMonth) {
      return 'Please enter a day of the month';
    }

    if (['FOR_X_DAYS', 'FOR_X_WEEKS', 'FOR_X_MONTHS'].includes(formData.duration) && !formData.durationValue) {
      return `Duration value is required for ${formData.duration}`;
    }
    if (formData.duration === 'UNTIL_DATE' && !formData.endDate) {
      return 'End date is required';
    }

    if (formData.specificTimes.length === 0 || formData.specificTimes.some(t => !t.trim())) {
      return 'Please provide valid time(s) (format HH:MM)';
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
        specificTimes: formData.specificTimes,
      };

      if (['X_TIMES_DAILY', 'EVERY_X_HOURS', 'EVERY_X_MINUTES'].includes(formData.frequency)) {
        payload.frequencyValue = parseInt(formData.frequencyValue, 10);
      }
      if (formData.frequency === 'SPECIFIC_WEEK_DAYS') {
        payload.specificWeekDays = formData.specificWeekDays;
      }
      if (formData.frequency === 'SPECIFIC_DAY_OF_MONTH') {
        payload.specificDayOfMonth = parseInt(formData.specificDayOfMonth, 10);
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
                onValueChange={(itemValue) => setFormData({...formData, frequency: itemValue})}
                style={styles.picker}
              >
                {FREQUENCY_TYPES.map(f => <Picker.Item key={f.value} label={f.label} value={f.value} />)}
              </Picker>
            </View>
          </View>

          {['X_TIMES_DAILY', 'EVERY_X_HOURS', 'EVERY_X_MINUTES'].includes(formData.frequency) && (
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

          <View style={styles.inputGroup}>
             <Text style={styles.label}>Times of Day (HH:MM) *</Text>
             {formData.specificTimes.map((time, index) => (
                <View key={index} style={styles.timeRow}>
                    <TextInput
                      style={[styles.input, {flex: 1}]}
                      value={time}
                      onChangeText={(text) => updateTime(index, text)}
                      placeholder="08:00"
                      maxLength={5}
                    />
                    {formData.specificTimes.length > 1 && (
                      <TouchableOpacity onPress={() => removeTime(index)} style={styles.iconButton}>
                        <MaterialIcons name="remove-circle-outline" size={24} color={colors.error} />
                      </TouchableOpacity>
                    )}
                </View>
             ))}
             <TouchableOpacity style={styles.addTimeBtn} onPress={addTime}>
                <MaterialIcons name="add" size={20} color={colors.primary} />
                <Text style={styles.addTimeText}>Add Time</Text>
             </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Duration</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Duration Type</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.duration}
                onValueChange={(itemValue) => setFormData({...formData, duration: itemValue})}
                style={styles.picker}
              >
                {DURATION_TYPES.map(d => <Picker.Item key={d.value} label={d.label} value={d.value} />)}
              </Picker>
            </View>
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
              <Text style={styles.label}>End Date (YYYY-MM-DD) *</Text>
              <TextInput
                style={styles.input}
                value={formData.endDate}
                onChangeText={(text) => setFormData({...formData, endDate: text})}
                placeholder="2025-12-31"
              />
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.saveBtn]}
              onPress={handleSave}
              disabled={saving}
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

// ... styling missing here on purpose, will add below inline or separate file ...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: spacing.xxl },
  headerTitle: { ...typography.header, color: colors.primary, marginBottom: spacing.l },
  sectionTitle: { ...typography.subheader, marginTop: spacing.m, marginBottom: spacing.m, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.l },
  inputGroup: { marginBottom: spacing.m },
  label: { ...typography.caption, marginBottom: spacing.xs, color: colors.textSecondary },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.m, ...typography.body },
  pickerContainer: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.card },
  picker: { height: 50, width: '100%' },
  weekDaysContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  dayButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.card },
  dayButtonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayButtonText: { fontSize: 13, color: colors.text },
  dayButtonTextSelected: { color: '#FFF', fontWeight: 'bold' },
  timeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.s },
  iconButton: { padding: spacing.xs, marginLeft: spacing.s },
  addTimeBtn: { flexDirection: 'row', alignItems: 'center', padding: spacing.xs },
  addTimeText: { color: colors.primary, marginLeft: 4, fontWeight: 'bold' },
  actions: { marginTop: spacing.xl, gap: spacing.m },
  actionBtn: { padding: spacing.m, borderRadius: 12, alignItems: 'center' },
  saveBtn: { backgroundColor: colors.primary },
  saveBtnText: { color: '#FFF', ...typography.button },
  deleteBtn: { backgroundColor: '#FFF', borderWidth: 1, borderColor: colors.error },
  deleteBtnText: { color: colors.error, ...typography.button },
});

export default AddEditReminderScreen;
