import React, { useState, useEffect } from "react";
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
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import {
  createReminder,
  updateReminder,
  deleteReminder,
} from "../api/reminders";
import { spacing } from "../styles/theme";
import { useTheme } from "../context/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const FREQUENCY_TYPES = [
  { label: "Once", value: "ONCE" },
  { label: "Daily", value: "DAILY" },
  { label: "X Times Daily", value: "X_TIMES_DAILY" },
  { label: "Every X Hours", value: "EVERY_X_HOURS" },
  { label: "Every X Minutes", value: "EVERY_X_MINUTES" },
  { label: "Specific Days of Week", value: "SPECIFIC_WEEK_DAYS" },
  { label: "Specific Day of Month", value: "SPECIFIC_DAYS_OF_MONTH" },
];

const DURATION_TYPES = [
  { label: "Single Day (One-time)", value: "SINGLE_DAY" },
  { label: "Continuous", value: "CONTINUOUS" },
  { label: "For X Days", value: "FOR_X_DAYS" },
  { label: "For X Weeks", value: "FOR_X_WEEKS" },
  { label: "For X Months", value: "FOR_X_MONTHS" },
  { label: "Until Date", value: "UNTIL_DATE" },
];

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const getCurrentTimeStr = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

const formatLocalDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getCurrentDateStr = () => {
  return formatLocalDate(new Date());
};

const parseLocalDate = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const combineLocalDateAndTime = (dateStr, timeStr = "00:00") => {
  const date = parseLocalDate(dateStr);
  if (!date) return null;

  const [hour, minute] = timeStr.split(":").map(Number);
  date.setHours(hour || 0, minute || 0, 0, 0);
  return date;
};

const convertLocalToUTC = (timeStr) => {
  if (!timeStr) return "08:00";
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
};

const convertUTCToLocal = (utcStr) => {
  if (!utcStr) return "08:00";
  const [h, m] = utcStr.split(":").map(Number);
  const d = new Date();
  d.setUTCHours(h, m, 0, 0);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

const createDefaultForm = (data = {}) => {
  return {
    id: data._id || Math.random().toString(36).substring(7),
    isEdit: !!data._id,
    status: 'draft', // 'draft', 'submitting', 'success', 'error'
    submitError: null,
    showSubmitValidation: false,
    dateTimeModified: false,
    
    // Core Data
    medicineName: data.medicineName || "",
    dosage: data.dosage || "",
    frequency: data.frequency || "ONCE",
    frequencyValue: data.frequencyValue ? String(data.frequencyValue) : "",
    specificWeekDays: data.specificWeekDays || [],
    specificDaysOfMonth: Array.isArray(data.specificDaysOfMonth) ? data.specificDaysOfMonth : data.specificDayOfMonth ? [data.specificDayOfMonth] : [],
    specificTimes: data.specificTimes?.length > 0 ? data.specificTimes.map(convertUTCToLocal) : data.time ? [convertUTCToLocal(new Date(data.time).toISOString().split("T")[1].slice(0, 5))] : [getCurrentTimeStr()],
    onceDate: data.startDate ? formatLocalDate(new Date(data.startDate)) : data.time ? formatLocalDate(new Date(data.time)) : getCurrentDateStr(),
    duration: data.duration || "SINGLE_DAY",
    durationValue: data.durationValue ? String(data.durationValue) : "",
    endDate: data.endDate ? formatLocalDate(new Date(data.endDate)) : "",
    
    // UI state
    showOnceDatePicker: false,
    showEndDatePicker: false,
    expanded: true
  };
};

const AddEditReminderScreen = ({ route, navigation }) => {
  const { token, reminderData } = route.params || {};
  const { colors } = useTheme();

  const [forms, setForms] = useState([]);
  const [globalSaving, setGlobalSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (reminderData) {
      const dataArray = Array.isArray(reminderData) ? reminderData : [reminderData];
      setForms(dataArray.map(d => createDefaultForm(d)));
    } else {
      setForms([createDefaultForm()]);
    }
  }, [reminderData]);

  const updateForm = (id, updates) => {
    setForms(prev => prev.map(f => {
      if (f.id === id) {
        const updatedForm = { ...f, ...updates };
        
        // Auto-handle specific times based on frequency value
        const multiTimeFrequencies = ["X_TIMES_DAILY", "DAILY", "SPECIFIC_WEEK_DAYS", "SPECIFIC_DAYS_OF_MONTH"];
        if (updates.frequencyValue !== undefined || updates.frequency !== undefined) {
          if (multiTimeFrequencies.includes(updatedForm.frequency)) {
            const count = parseInt(updatedForm.frequencyValue, 10);
            if (!isNaN(count) && count > 0 && count <= 24) {
              let newTimes = [...updatedForm.specificTimes];
              if (newTimes.length < count) {
                const toAdd = count - newTimes.length;
                const extra = Array(toAdd).fill(getCurrentTimeStr());
                newTimes = newTimes.concat(extra);
              } else if (newTimes.length > count) {
                newTimes = newTimes.slice(0, count);
              }
              updatedForm.specificTimes = newTimes;
            }
          }
        }
        
        // Duration auto-lock for ONCE
        if (updates.frequency === "ONCE") {
          updatedForm.duration = "SINGLE_DAY";
        } else if (updates.frequency !== undefined && f.frequency === "ONCE") {
          if (updatedForm.duration === "SINGLE_DAY") {
            updatedForm.duration = "CONTINUOUS";
          }
        }
        
        return updatedForm;
      }
      return f;
    }));
  };

  const addSchedule = () => {
    setForms(prev => [...prev, createDefaultForm()]);
  };

  const removeSchedule = (id) => {
    setForms(prev => prev.filter(f => f.id !== id));
  };

  const toggleWeekDay = (form, dayIndex) => {
    const days = [...form.specificWeekDays];
    if (days.includes(dayIndex)) {
      updateForm(form.id, { specificWeekDays: days.filter((d) => d !== dayIndex) });
    } else {
      updateForm(form.id, { specificWeekDays: [...days, dayIndex].sort((a, b) => a - b) });
    }
  };

  const toggleDayOfMonth = (form, day) => {
    const days = [...form.specificDaysOfMonth];
    if (days.includes(day)) {
      updateForm(form.id, { specificDaysOfMonth: days.filter((d) => d !== day) });
    } else {
      updateForm(form.id, { specificDaysOfMonth: [...days, day].sort((a, b) => a - b) });
    }
  };

  const updateTime = (form, index, value) => {
    const times = [...form.specificTimes];
    times[index] = value;
    updateForm(form.id, { specificTimes: times, dateTimeModified: true });
  };

  const getErrors = (form) => {
    const errors = {};
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (form.showSubmitValidation) {
      if (!form.medicineName.trim()) {
        errors.medicineName = "Medicine Name is required";
      }
      if (!form.dosage.trim()) {
        errors.dosage = "Dosage is required";
      }
    }

    const multiTimeFrequencies = ["X_TIMES_DAILY", "DAILY", "SPECIFIC_WEEK_DAYS", "SPECIFIC_DAYS_OF_MONTH"];
    if (multiTimeFrequencies.includes(form.frequency)) {
      if (!form.specificTimes || form.specificTimes.length === 0) {
        errors.time_0 = "Please provide valid time(s)";
      } else {
        form.specificTimes.forEach((time, index) => {
          if (!timeRegex.test(time))
            errors[`time_${index}`] = "Invalid time format (HH:MM)";
        });
      }
    } else {
      if (!timeRegex.test(form.specificTimes[0] || "")) {
        errors.time_0 = "Invalid time format (HH:MM)";
      }
    }

    if (!form.onceDate && !form.isEdit) {
      errors.dateTime = "Start Date is required";
    } else if (form.onceDate && !errors.time_0) {
      if (!form.isEdit || form.dateTimeModified || form.showSubmitValidation) {
        const now = new Date();
        now.setSeconds(0, 0);
        const todayDate = parseLocalDate(formatLocalDate(now));
        const selectedDay = parseLocalDate(form.onceDate);
        const selectedDate = combineLocalDateAndTime(form.onceDate, form.specificTimes[0] || "00:00");
        
        if (!selectedDate) {
          errors.dateTime = "Start Date is invalid";
        } else if (!form.isEdit && selectedDate < now) {
          errors.dateTime = "Start Date and time cannot be in the past";
        } else if (form.isEdit && selectedDay && todayDate && selectedDay >= todayDate && selectedDate < now) {
          errors.dateTime = "Start Date and time cannot be in the past";
        }
      }
    }

    if (form.duration === "UNTIL_DATE" && form.endDate) {
      const startDate = parseLocalDate(form.onceDate);
      const endDate = parseLocalDate(form.endDate);
      if (startDate && endDate && endDate < startDate) {
        errors.endDate = "End date cannot be before start date";
      }
    }

    if (form.showSubmitValidation && ["EVERY_X_HOURS", "EVERY_X_MINUTES", "X_TIMES_DAILY", "DAILY", "SPECIFIC_WEEK_DAYS", "SPECIFIC_DAYS_OF_MONTH"].includes(form.frequency)) {
      if (!form.frequencyValue) {
        errors.frequencyValue = `Required for ${form.frequency}`;
      } else {
        const val = parseInt(form.frequencyValue, 10);
        if (isNaN(val) || val < 1) {
          errors.frequencyValue = "Must be at least 1";
        } else if (form.frequency === "EVERY_X_HOURS" && val > 24) {
          errors.frequencyValue = "Max 24";
        } else if (form.frequency === "EVERY_X_MINUTES" && val > 60) {
          errors.frequencyValue = "Max 60";
        } else if (["X_TIMES_DAILY", "DAILY", "SPECIFIC_WEEK_DAYS", "SPECIFIC_DAYS_OF_MONTH"].includes(form.frequency) && val > 24) {
          errors.frequencyValue = "Max 24";
        }
      }
    }

    if (form.showSubmitValidation && form.frequency === "SPECIFIC_WEEK_DAYS" && form.specificWeekDays.length === 0) {
      errors.specificWeekDays = "Select at least one day";
    }

    if (form.showSubmitValidation && form.frequency === "SPECIFIC_DAYS_OF_MONTH" && form.specificDaysOfMonth.length === 0) {
      errors.specificDaysOfMonth = "Select at least one day";
    }

    if (form.showSubmitValidation && ["FOR_X_DAYS", "FOR_X_WEEKS", "FOR_X_MONTHS"].includes(form.duration) && !form.durationValue) {
      errors.durationValue = "Required";
    }

    if (form.showSubmitValidation && form.duration === "UNTIL_DATE" && !form.endDate) {
      errors.endDate = "Required";
    }

    return errors;
  };

  const handleSaveAll = async () => {
    // 1. Mark all draft/error forms with showSubmitValidation = true
    const formsToSubmit = forms.filter(f => f.status === 'draft' || f.status === 'error');
    
    // Sort failed ones to top (not strictly sorted array, but we can do that)
    const sortedForms = [...forms].sort((a, b) => {
      if (a.status === 'error' && b.status !== 'error') return -1;
      if (b.status === 'error' && a.status !== 'error') return 1;
      return 0;
    });

    const updatedValidationForms = sortedForms.map(f => {
      if (f.status === 'draft' || f.status === 'error') {
        return { ...f, showSubmitValidation: true, submitError: null };
      }
      return f;
    });
    setForms(updatedValidationForms);

    // 2. Validate all
    let hasValidationError = false;
    for (const f of updatedValidationForms) {
      if (f.status === 'success') continue;
      const errors = getErrors(f);
      if (Object.keys(errors).length > 0) {
        hasValidationError = true;
      }
    }

    if (hasValidationError) {
      Alert.alert("Validation Error", "Please correct the highlighted errors before submitting.");
      return;
    }

    // 3. Submit individually
    setGlobalSaving(true);
    let allSuccess = true;
    
    // We update state individually as we go
    const processForms = async () => {
      for (const form of updatedValidationForms) {
        if (form.status === 'success') continue;
        
        updateForm(form.id, { status: 'submitting' });
        
        try {
          const payload = {
            medicineName: form.medicineName,
            dosage: form.dosage,
            frequency: form.frequency,
            duration: form.duration,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          };

          const dt = combineLocalDateAndTime(form.onceDate, form.specificTimes[0] || "08:00");
          payload.startDate = dt.toISOString();

          const multiTimeFrequencies = ["X_TIMES_DAILY", "DAILY", "SPECIFIC_WEEK_DAYS", "SPECIFIC_DAYS_OF_MONTH"];
          if (multiTimeFrequencies.includes(form.frequency)) {
            payload.specificTimes = form.specificTimes.map(convertLocalToUTC);
            payload.frequencyValue = parseInt(form.frequencyValue, 10);
            if (form.frequency === "SPECIFIC_WEEK_DAYS") payload.specificWeekDays = form.specificWeekDays;
            if (form.frequency === "SPECIFIC_DAYS_OF_MONTH") payload.specificDaysOfMonth = form.specificDaysOfMonth;
          } else {
            payload.specificTimes = [convertLocalToUTC(form.specificTimes[0])];
            if (["EVERY_X_HOURS", "EVERY_X_MINUTES"].includes(form.frequency)) {
              payload.frequencyValue = parseInt(form.frequencyValue, 10);
            }
          }

          if (["FOR_X_DAYS", "FOR_X_WEEKS", "FOR_X_MONTHS"].includes(form.duration)) {
            payload.durationValue = parseInt(form.durationValue, 10);
          }
          if (form.duration === "UNTIL_DATE") {
            const localEndDate = parseLocalDate(form.endDate);
            payload.endDate = localEndDate.toISOString();
          }

          if (form.isEdit) {
            await updateReminder(token, form.id, payload);
          } else {
            await createReminder(token, payload);
          }
          
          updateForm(form.id, { status: 'success', expanded: false });
        } catch (error) {
          updateForm(form.id, { status: 'error', submitError: error.message || "Failed to save" });
          allSuccess = false;
        }
      }
    };

    await processForms();
    setGlobalSaving(false);

    if (allSuccess) {
      Alert.alert("Success", "All schedules have been saved.");
      navigation.goBack();
    }
  };

  const handleDelete = async (form) => {
    if (!form.isEdit) {
      removeSchedule(form.id);
      return;
    }

    Alert.alert(
      "Delete Reminder",
      "Are you sure you want to delete this reminder?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(form.id);
            try {
              await deleteReminder(token, form.id);
              removeSchedule(form.id);
              if (forms.length === 1) {
                navigation.goBack();
              }
            } catch (error) {
              Alert.alert("Error", error.message || "Failed to delete reminder");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const styles = makeStyles(colors);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isAllSuccess = forms.length > 0 && forms.every(f => f.status === 'success');

  const renderForm = (form, index, isEditMode) => {
    const isSuccess = form.status === 'success';
    const currentErrors = getErrors(form);
    
    return (
      <View key={form.id} style={[styles.formCard, form.status === 'error' && { borderColor: colors.error, borderWidth: 1 }]}>
        <TouchableOpacity 
          style={styles.formHeader} 
          onPress={() => updateForm(form.id, { expanded: !form.expanded })}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            {form.status === 'error' && <MaterialIcons name="error" size={20} color={colors.error} style={{marginRight: 8}} />}
            {isSuccess && <MaterialIcons name="check-circle" size={20} color={colors.success} style={{marginRight: 8}} />}
            <Text style={styles.formTitle} numberOfLines={1}>
              {form.medicineName || `Schedule ${index + 1}`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: isSuccess ? colors.success : (form.status === 'error' ? colors.error : colors.textSecondary), marginRight: 8, fontSize: 13, fontWeight: 'bold' }}>
              {isSuccess ? 'SUBMITTED' : (form.status === 'error' ? 'FAILED' : '')}
            </Text>
            <MaterialIcons name={form.expanded ? "expand-less" : "expand-more"} size={24} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>

        {form.expanded && (
          <View style={[styles.formBody, isSuccess && { opacity: 0.6 }]} pointerEvents={isSuccess ? "none" : "auto"}>
            {form.submitError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{form.submitError}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Medicine Name *</Text>
              <TextInput
                style={[styles.input, currentErrors.medicineName && { borderColor: colors.error }]}
                value={form.medicineName}
                onChangeText={(text) => updateForm(form.id, { medicineName: text })}
                placeholder="e.g. Paracetamol"
                placeholderTextColor={colors.textSecondary}
              />
              {currentErrors.medicineName && <Text style={styles.validationText}>{currentErrors.medicineName}</Text>}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Dosage *</Text>
              <TextInput
                style={[styles.input, currentErrors.dosage && { borderColor: colors.error }]}
                value={form.dosage}
                onChangeText={(text) => updateForm(form.id, { dosage: text })}
                placeholder="e.g. 1 Tablet (500mg)"
                placeholderTextColor={colors.textSecondary}
              />
              {currentErrors.dosage && <Text style={styles.validationText}>{currentErrors.dosage}</Text>}
            </View>

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Schedule</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Frequency</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={form.frequency}
                  onValueChange={(itemValue) => updateForm(form.id, { frequency: itemValue })}
                  style={styles.picker}
                  dropdownIconColor={colors.text}
                >
                  {FREQUENCY_TYPES.map((f) => <Picker.Item key={f.value} label={f.label} value={f.value} />)}
                </Picker>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Start Date *</Text>
              <TouchableOpacity
                style={[styles.input, styles.dateButton, currentErrors.dateTime && { borderColor: colors.error }]}
                onPress={() => updateForm(form.id, { showOnceDatePicker: true })}
              >
                <Text style={{ color: colors.text }}>{form.onceDate}</Text>
                <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
              </TouchableOpacity>
              {currentErrors.dateTime && <Text style={styles.validationText}>{currentErrors.dateTime}</Text>}
              {form.showOnceDatePicker && (
                <DateTimePicker
                  value={parseLocalDate(form.onceDate) || today}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={today}
                  onChange={(event, selectedDate) => {
                    updateForm(form.id, { showOnceDatePicker: Platform.OS === "ios" });
                    if (selectedDate) updateForm(form.id, { onceDate: formatLocalDate(selectedDate), dateTimeModified: true });
                  }}
                />
              )}
            </View>

            {["EVERY_X_HOURS", "EVERY_X_MINUTES", "X_TIMES_DAILY", "DAILY", "SPECIFIC_WEEK_DAYS", "SPECIFIC_DAYS_OF_MONTH"].includes(form.frequency) && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Frequency Value (X) *</Text>
                <TextInput
                  style={[styles.input, currentErrors.frequencyValue && { borderColor: colors.error }]}
                  value={form.frequencyValue}
                  onChangeText={(text) => updateForm(form.id, { frequencyValue: text })}
                  placeholder="e.g. 2"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  maxLength={2}
                />
                {currentErrors.frequencyValue && <Text style={styles.validationText}>{currentErrors.frequencyValue}</Text>}
              </View>
            )}

            {form.frequency === "SPECIFIC_WEEK_DAYS" && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Days of Week *</Text>
                <View style={styles.weekDaysContainer}>
                  {WEEK_DAYS.map((day, dIdx) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.dayButton, form.specificWeekDays.includes(dIdx) && styles.dayButtonSelected]}
                      onPress={() => toggleWeekDay(form, dIdx)}
                    >
                      <Text style={[styles.dayButtonText, form.specificWeekDays.includes(dIdx) && styles.dayButtonTextSelected]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {currentErrors.specificWeekDays && <Text style={styles.validationText}>{currentErrors.specificWeekDays}</Text>}
              </View>
            )}

            {form.frequency === "SPECIFIC_DAYS_OF_MONTH" && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Days of Month *</Text>
                <View style={styles.monthDaysGrid}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.monthDayButton, form.specificDaysOfMonth.includes(day) && styles.dayButtonSelected]}
                      onPress={() => toggleDayOfMonth(form, day)}
                    >
                      <Text style={[styles.monthDayText, form.specificDaysOfMonth.includes(day) && styles.dayButtonTextSelected]}>{day}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {currentErrors.specificDaysOfMonth && <Text style={styles.validationText}>{currentErrors.specificDaysOfMonth}</Text>}
              </View>
            )}

            {form.frequency === "ONCE" ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Time to Take (HH:MM) *</Text>
                <TextInput
                  style={[styles.input, (currentErrors.time_0 || currentErrors.dateTime) && { borderColor: colors.error }]}
                  value={form.specificTimes[0]}
                  onChangeText={(text) => updateTime(form, 0, text)}
                  placeholder="08:00"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={5}
                />
                {currentErrors.time_0 && <Text style={styles.validationText}>{currentErrors.time_0}</Text>}
              </View>
            ) : null}

            {["X_TIMES_DAILY", "DAILY", "SPECIFIC_WEEK_DAYS", "SPECIFIC_DAYS_OF_MONTH"].includes(form.frequency) && parseInt(form.frequencyValue, 10) > 0 && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Times of Day (HH:MM) *</Text>
                {form.specificTimes.map((time, tIdx) => (
                  <View key={tIdx} style={{ marginBottom: spacing.m }}>
                    <TextInput
                      style={[styles.input, currentErrors[`time_${tIdx}`] && { borderColor: colors.error }]}
                      value={time}
                      onChangeText={(text) => updateTime(form, tIdx, text)}
                      placeholder="08:00"
                      placeholderTextColor={colors.textSecondary}
                      maxLength={5}
                    />
                    {currentErrors[`time_${tIdx}`] && <Text style={[styles.validationText, { marginTop: 4 }]}>{currentErrors[`time_${tIdx}`]}</Text>}
                  </View>
                ))}
              </View>
            )}

            {form.frequency !== "ONCE" && !["X_TIMES_DAILY", "DAILY", "SPECIFIC_WEEK_DAYS", "SPECIFIC_DAYS_OF_MONTH"].includes(form.frequency) && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Start Time (HH:MM) *</Text>
                <TextInput
                  style={[styles.input, currentErrors.time_0 && { borderColor: colors.error }]}
                  value={form.specificTimes[0]}
                  onChangeText={(text) => updateTime(form, 0, text)}
                  placeholder="08:00"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={5}
                />
                {currentErrors.time_0 && <Text style={styles.validationText}>{currentErrors.time_0}</Text>}
              </View>
            )}

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Duration</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Duration Type</Text>
              <View style={[styles.pickerContainer, form.frequency === "ONCE" && { opacity: 0.6 }]}>
                <Picker
                  selectedValue={form.frequency === "ONCE" ? "SINGLE_DAY" : form.duration}
                  onValueChange={(itemValue) => updateForm(form.id, { duration: itemValue })}
                  enabled={form.frequency !== "ONCE"}
                  style={styles.picker}
                  dropdownIconColor={colors.text}
                >
                  {form.frequency === "ONCE" ? (
                    <Picker.Item label="Single Day (One-time)" value="SINGLE_DAY" />
                  ) : (
                    DURATION_TYPES.filter((d) => d.value !== "SINGLE_DAY").map((d) => (
                      <Picker.Item key={d.value} label={d.label} value={d.value} />
                    ))
                  )}
                </Picker>
              </View>
            </View>

            {["FOR_X_DAYS", "FOR_X_WEEKS", "FOR_X_MONTHS"].includes(form.duration) && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Duration Value (X) *</Text>
                <TextInput
                  style={[styles.input, currentErrors.durationValue && { borderColor: colors.error }]}
                  value={form.durationValue}
                  onChangeText={(text) => updateForm(form.id, { durationValue: text })}
                  placeholder="e.g. 7"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                />
                {currentErrors.durationValue && <Text style={styles.validationText}>{currentErrors.durationValue}</Text>}
              </View>
            )}

            {form.duration === "UNTIL_DATE" && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>End Date *</Text>
                <TouchableOpacity
                  style={[styles.input, styles.dateButton, currentErrors.endDate && { borderColor: colors.error }]}
                  onPress={() => updateForm(form.id, { showEndDatePicker: true })}
                >
                  <Text style={{ color: form.endDate ? colors.text : colors.textSecondary }}>
                    {form.endDate || "Select end date"}
                  </Text>
                  <MaterialIcons name="calendar-today" size={18} color={colors.primary} />
                </TouchableOpacity>
                {currentErrors.endDate && <Text style={styles.validationText}>{currentErrors.endDate}</Text>}
                {form.showEndDatePicker && (
                  <DateTimePicker
                    value={parseLocalDate(form.endDate) || today}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    minimumDate={today}
                    onChange={(event, selectedDate) => {
                      updateForm(form.id, { showEndDatePicker: Platform.OS === "ios" });
                      if (selectedDate) updateForm(form.id, { endDate: formatLocalDate(selectedDate) });
                    }}
                  />
                )}
              </View>
            )}

            {!isEditMode && (
              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleDelete(form)}
                  disabled={deletingId === form.id || form.status === 'submitting'}
                >
                  <MaterialIcons name="delete-outline" size={20} color={colors.error} />
                  <Text style={[styles.removeBtnText, { color: colors.error }]}>
                    {deletingId === form.id ? "Deleting..." : "Remove"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const isEditMode = forms.length === 1 && forms[0].isEdit;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : null}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.headerTitle}>{isEditMode ? "Manage Reminder" : "Schedules"}</Text>

          {forms.map((form, index) => renderForm(form, index, isEditMode))}

          {!isEditMode && !isAllSuccess && (
            <TouchableOpacity style={styles.addMoreBtn} onPress={addSchedule}>
              <MaterialIcons name="add-circle-outline" size={24} color={colors.primary} />
              <Text style={styles.addMoreBtnText}>Add Another Medicine</Text>
            </TouchableOpacity>
          )}

          {!isAllSuccess && (
            <View style={styles.actions}>
              {isEditMode && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.error, marginRight: 8 }]}
                  onPress={() => handleDelete(forms[0])}
                  disabled={globalSaving || deletingId === forms[0].id}
                >
                  <Text style={[styles.cancelBtnText, { color: colors.error }]}>
                    {deletingId === forms[0].id ? "Deleting..." : "Delete"}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionBtn, styles.saveBtn, globalSaving && { opacity: 0.6 }]}
                onPress={handleSaveAll}
                disabled={globalSaving}
              >
                <Text style={styles.saveBtnText}>
                  {globalSaving ? "Saving..." : (isEditMode ? "Update" : "Submit")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn, { marginLeft: 8 }]}
                onPress={() => navigation.goBack()}
                disabled={globalSaving}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.l, paddingBottom: 80 },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: colors.text, marginBottom: spacing.l },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginBottom: spacing.l,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.m,
    backgroundColor: colors.chip,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  formTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  formBody: { padding: spacing.m },
  errorBox: {
    backgroundColor: colors.error + '20',
    padding: spacing.s,
    borderRadius: 8,
    marginBottom: spacing.m,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: { color: colors.error, fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: "600", marginTop: spacing.s, marginBottom: spacing.m, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.m },
  inputGroup: { marginBottom: spacing.m },
  label: { fontSize: 13, marginBottom: 6, color: colors.textSecondary },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.m,
    fontSize: 16,
    color: colors.text,
  },
  validationText: { color: colors.error, fontSize: 12, marginTop: 4 },
  dateButton: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pickerContainer: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  picker: { height: 50, width: "100%", color: colors.text },
  weekDaysContainer: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  dayButton: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    justifyContent: "center", alignItems: "center", backgroundColor: colors.background,
  },
  dayButtonSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayButtonText: { fontSize: 13, color: colors.text },
  dayButtonTextSelected: { color: "#FFF", fontWeight: "bold" },
  monthDaysGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", gap: 8, marginTop: 6 },
  monthDayButton: {
    width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    justifyContent: "center", alignItems: "center", backgroundColor: colors.background,
  },
  monthDayText: { fontSize: 13, color: colors.text },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.m },
  removeBtn: { flexDirection: 'row', alignItems: 'center', padding: spacing.s },
  removeBtnText: { marginLeft: 4, fontWeight: '600' },
  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: spacing.m, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary,
    borderRadius: 12, marginBottom: spacing.xl,
  },
  addMoreBtnText: { color: colors.primary, fontSize: 16, fontWeight: '600', marginLeft: 8 },
  actions: { gap: spacing.m },
  actionBtn: { padding: 18, borderRadius: 12, alignItems: "center" },
  saveBtn: { backgroundColor: colors.primary },
  saveBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  cancelBtn: { backgroundColor: 'transparent' },
  cancelBtnText: { color: colors.textSecondary, fontSize: 16, fontWeight: "700" },
});

export default AddEditReminderScreen;
