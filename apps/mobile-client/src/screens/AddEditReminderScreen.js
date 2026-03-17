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
  Switch,
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

const AddEditReminderScreen = ({ route, navigation }) => {
  const { token, reminderData } = route.params || {};
  const { colors } = useTheme();
  const isEditMode = !!(reminderData && reminderData._id);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showSubmitValidation, setShowSubmitValidation] = useState(false);
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
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const getCurrentDateStr = () => {
    return formatLocalDate(new Date());
  };

  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
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

  const [formData, setFormData] = useState({
    medicineName: "",
    dosage: "",
    frequency: "ONCE",
    frequencyValue: "",
    specificWeekDays: [], // Array of numbers 0-6
    specificDaysOfMonth: [], // Array of numbers 1-31
    specificTimes: [getCurrentTimeStr()], // Default one time
    onceDate: getCurrentDateStr(), // Base date for all reminders YYYY-MM-DD
    duration: "SINGLE_DAY", // Matches ONCE default frequency
    durationValue: "",
    endDate: "", // For UNTIL_DATE, format YYYY-MM-DD
  });

  useEffect(() => {
    if (reminderData) {
      setShowSubmitValidation(false);
      setDateTimeModified(false); // reset on load so original values aren't flagged
      setFormData({
        medicineName: reminderData.medicineName || "",
        dosage: reminderData.dosage || "",
        frequency: reminderData.frequency || "ONCE",
        frequencyValue: reminderData.frequencyValue
          ? String(reminderData.frequencyValue)
          : "",
        specificWeekDays: reminderData.specificWeekDays || [],
        // Ensure specificDaysOfMonth is always an array
        specificDaysOfMonth: Array.isArray(reminderData.specificDaysOfMonth)
          ? reminderData.specificDaysOfMonth
          : reminderData.specificDayOfMonth
            ? [reminderData.specificDayOfMonth]
            : [],
        // Initialize times: convert UTC stored values back to local display
        specificTimes:
          reminderData.specificTimes?.length > 0
            ? reminderData.specificTimes.map(convertUTCToLocal)
            : reminderData.time
              ? [
                  convertUTCToLocal(
                    new Date(reminderData.time)
                      .toISOString()
                      .split("T")[1]
                      .slice(0, 5),
                  ),
                ]
              : [getCurrentTimeStr()],
        // Initialize date: ensure we use the LOCAL date from the ISO startDate
        onceDate: reminderData.startDate
          ? formatLocalDate(new Date(reminderData.startDate))
          : reminderData.time
            ? formatLocalDate(new Date(reminderData.time))
            : "",
        duration: reminderData.duration || "CONTINUOUS",
        durationValue: reminderData.durationValue
          ? String(reminderData.durationValue)
          : "",
        endDate: reminderData.endDate
          ? formatLocalDate(new Date(reminderData.endDate))
          : "",
      });
    }
  }, [isEditMode, reminderData]);

  useEffect(() => {
    const multiTimeFrequencies = [
      "X_TIMES_DAILY",
      "DAILY",
      "SPECIFIC_WEEK_DAYS",
      "SPECIFIC_DAYS_OF_MONTH",
    ];
    if (multiTimeFrequencies.includes(formData.frequency)) {
      const count = parseInt(formData.frequencyValue, 10);
      if (!isNaN(count) && count > 0 && count <= 24) {
        setFormData((prev) => {
          let newTimes = [...prev.specificTimes];
          if (newTimes.length < count) {
            const toAdd = count - newTimes.length;
            const extra = Array(toAdd).fill(getCurrentTimeStr());
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
        return {
          ...prev,
          specificWeekDays: days.filter((d) => d !== dayIndex),
        };
      } else {
        return {
          ...prev,
          specificWeekDays: [...days, dayIndex].sort((a, b) => a - b),
        };
      }
    });
  };

  const toggleDayOfMonth = (day) => {
    setFormData((prev) => {
      const days = [...prev.specificDaysOfMonth];
      if (days.includes(day)) {
        return { ...prev, specificDaysOfMonth: days.filter((d) => d !== day) };
      } else {
        return {
          ...prev,
          specificDaysOfMonth: [...days, day].sort((a, b) => a - b),
        };
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
    setFormData({
      ...formData,
      specificTimes: [...formData.specificTimes, "12:00"],
    });
  };

  const removeTime = (index) => {
    if (formData.specificTimes.length <= 1) return; // keep at least one
    const times = [...formData.specificTimes];
    times.splice(index, 1);
    setFormData({ ...formData, specificTimes: times });
  };

  const getErrors = ({
    forceDateTimeValidation = false,
    includeSubmitOnlyErrors = false,
  } = {}) => {
    const errors = {};
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (includeSubmitOnlyErrors) {
      if (!formData.medicineName.trim()) {
        errors.medicineName = "Medicine Name is required";
      }
      if (!formData.dosage.trim()) {
        errors.dosage = "Dosage is required";
      }
    }

    const multiTimeFrequencies = [
      "X_TIMES_DAILY",
      "DAILY",
      "SPECIFIC_WEEK_DAYS",
      "SPECIFIC_DAYS_OF_MONTH",
    ];
    if (multiTimeFrequencies.includes(formData.frequency)) {
      if (!formData.specificTimes || formData.specificTimes.length === 0) {
        errors.time_0 = "Please provide valid time(s)";
      } else {
        formData.specificTimes.forEach((time, index) => {
          if (!timeRegex.test(time))
            errors[`time_${index}`] = "Invalid time format (HH:MM)";
        });
      }
    } else {
      if (!timeRegex.test(formData.specificTimes[0] || "")) {
        errors.time_0 = "Invalid time format (HH:MM)";
      }
    }

    if (!formData.onceDate && !isEditMode) {
      errors.dateTime = "Start Date is required";
    } else if (formData.onceDate && !errors.time_0) {
      // Only check past-date if:
      // - creating a new reminder, OR
      // - user has explicitly modified the date or time in edit mode
      if (!isEditMode || dateTimeModified || forceDateTimeValidation) {
        const now = new Date();
        now.setSeconds(0, 0);
        const todayDate = parseLocalDate(formatLocalDate(now));
        const selectedDay = parseLocalDate(formData.onceDate);
        const selectedDate = combineLocalDateAndTime(
          formData.onceDate,
          formData.specificTimes[0] || "00:00",
        );
        if (!selectedDate) {
          errors.dateTime = "Start Date is invalid";
        } else if (!isEditMode && selectedDate < now) {
          errors.dateTime = "Start Date and time cannot be in the past";
        } else if (
          isEditMode &&
          selectedDay &&
          todayDate &&
          selectedDay >= todayDate &&
          selectedDate < now
        ) {
          errors.dateTime = "Start Date and time cannot be in the past";
        }
      }
    }

    if (formData.duration === "UNTIL_DATE" && formData.endDate) {
      const startDate = parseLocalDate(formData.onceDate);
      const endDate = parseLocalDate(formData.endDate);

      if (startDate && endDate && endDate < startDate) {
        errors.endDate = "End date cannot be before start date";
      }
    }

    if (
      includeSubmitOnlyErrors &&
      [
        "EVERY_X_HOURS",
        "EVERY_X_MINUTES",
        "X_TIMES_DAILY",
        "DAILY",
        "SPECIFIC_WEEK_DAYS",
        "SPECIFIC_DAYS_OF_MONTH",
      ].includes(formData.frequency)
    ) {
      if (!formData.frequencyValue) {
        errors.frequencyValue = `Frequency value is required for ${formData.frequency}`;
      } else {
        const val = parseInt(formData.frequencyValue, 10);
        if (isNaN(val) || val < 1) {
          errors.frequencyValue = "Frequency value must be at least 1";
        } else if (formData.frequency === "EVERY_X_HOURS" && val > 24) {
          errors.frequencyValue = "Maximum is 24 hours";
        } else if (formData.frequency === "EVERY_X_MINUTES" && val > 60) {
          errors.frequencyValue = "Maximum is 60 minutes";
        } else if (
          [
            "X_TIMES_DAILY",
            "DAILY",
            "SPECIFIC_WEEK_DAYS",
            "SPECIFIC_DAYS_OF_MONTH",
          ].includes(formData.frequency) &&
          val > 24
        ) {
          errors.frequencyValue = "Maximum is 24 times per day";
        }
      }
    }

    if (
      includeSubmitOnlyErrors &&
      formData.frequency === "SPECIFIC_WEEK_DAYS" &&
      formData.specificWeekDays.length === 0
    ) {
      errors.specificWeekDays = "Please select at least one day of the week";
    }

    if (
      includeSubmitOnlyErrors &&
      formData.frequency === "SPECIFIC_DAYS_OF_MONTH" &&
      formData.specificDaysOfMonth.length === 0
    ) {
      errors.specificDaysOfMonth =
        "Please select at least one day of the month";
    }

    if (
      includeSubmitOnlyErrors &&
      ["FOR_X_DAYS", "FOR_X_WEEKS", "FOR_X_MONTHS"].includes(
        formData.duration,
      ) &&
      !formData.durationValue
    ) {
      errors.durationValue = `Duration value is required for ${formData.duration}`;
    }

    if (
      includeSubmitOnlyErrors &&
      formData.duration === "UNTIL_DATE" &&
      !formData.endDate
    ) {
      errors.endDate = "End date is required";
    }

    return errors;
  };

  const currentErrors = getErrors({
    forceDateTimeValidation: showSubmitValidation,
    includeSubmitOnlyErrors: showSubmitValidation,
  });
  const hasLiveErrors = Object.keys(currentErrors).length > 0;

  const validateForm = () => {
    const validationErrors = getErrors({
      forceDateTimeValidation: showSubmitValidation,
      includeSubmitOnlyErrors: true,
    });

    if (Object.keys(validationErrors).length > 0) {
      return Object.values(validationErrors)[0];
    }

    return null; // Valid
  };

  const handleSave = async () => {
    setShowSubmitValidation(true);
    const errorMsg = validateForm();
    if (errorMsg) {
      Alert.alert("Validation Error", errorMsg);
      return;
    }

    const submissionErrors = getErrors({ forceDateTimeValidation: true });
    if (Object.keys(submissionErrors).length > 0) {
      Alert.alert("Validation Error", Object.values(submissionErrors)[0]);
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
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      };

      // Always combine date + time into a full ISO startDate for precision scheduling
      const dt = combineLocalDateAndTime(
        formData.onceDate,
        formData.specificTimes[0] || "08:00",
      );
      if (!dt) {
        throw new Error("Start Date is invalid");
      }
      payload.startDate = dt.toISOString();

      const multiTimeFrequencies = [
        "X_TIMES_DAILY",
        "DAILY",
        "SPECIFIC_WEEK_DAYS",
        "SPECIFIC_DAYS_OF_MONTH",
      ];

      if (multiTimeFrequencies.includes(formData.frequency)) {
        payload.specificTimes = formData.specificTimes.map(convertLocalToUTC);
        payload.frequencyValue = parseInt(formData.frequencyValue, 10);

        if (formData.frequency === "SPECIFIC_WEEK_DAYS") {
          payload.specificWeekDays = formData.specificWeekDays;
        }
        if (formData.frequency === "SPECIFIC_DAYS_OF_MONTH") {
          payload.specificDaysOfMonth = formData.specificDaysOfMonth;
        }
      } else {
        payload.specificTimes = [convertLocalToUTC(formData.specificTimes[0])];

        if (["EVERY_X_HOURS", "EVERY_X_MINUTES"].includes(formData.frequency)) {
          payload.frequencyValue = parseInt(formData.frequencyValue, 10);
        }
      }

      if (
        ["FOR_X_DAYS", "FOR_X_WEEKS", "FOR_X_MONTHS"].includes(
          formData.duration,
        )
      ) {
        payload.durationValue = parseInt(formData.durationValue, 10);
      }
      if (formData.duration === "UNTIL_DATE") {
        const localEndDate = parseLocalDate(formData.endDate);
        if (!localEndDate) {
          throw new Error("End Date is invalid");
        }
        payload.endDate = localEndDate.toISOString();
      }

      if (isEditMode) {
        console.log(
          "[AddEditReminder] Submitting EDIT payload:",
          JSON.stringify(payload, null, 2),
        );
        await updateReminder(token, reminderData._id, payload);
        Alert.alert("Success", "Reminder updated successfully!");
      } else {
        console.log(
          "[AddEditReminder] Submitting ADD payload:",
          JSON.stringify(payload, null, 2),
        );
        await createReminder(token, payload);
        Alert.alert("Success", "Reminder created successfully!");
      }
      setShowSubmitValidation(false);
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to save reminder");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Delete Reminder",
      "Are you sure you want to delete this reminder?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteReminder(token, reminderData._id);
              navigation.goBack();
            } catch (error) {
              Alert.alert(
                "Error",
                error.message || "Failed to delete reminder",
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const styles = makeStyles(colors);
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : null}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.headerTitle}>
            {isEditMode ? "Edit Reminder" : "New Reminder"}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Medicine Name *</Text>
            <TextInput
              style={[
                styles.input,
                currentErrors.medicineName && { borderColor: colors.error },
              ]}
              value={formData.medicineName}
              onChangeText={(text) =>
                setFormData({ ...formData, medicineName: text })
              }
              placeholder="e.g. Paracetamol"
              placeholderTextColor={colors.textSecondary}
            />
            {currentErrors.medicineName ? (
              <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
                {currentErrors.medicineName}
              </Text>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Dosage *</Text>
            <TextInput
              style={[
                styles.input,
                currentErrors.dosage && { borderColor: colors.error },
              ]}
              value={formData.dosage}
              onChangeText={(text) =>
                setFormData({ ...formData, dosage: text })
              }
              placeholder="e.g. 1 Tablet (500mg)"
              placeholderTextColor={colors.textSecondary}
            />
            {currentErrors.dosage ? (
              <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
                {currentErrors.dosage}
              </Text>
            ) : null}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Schedule</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Frequency</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={formData.frequency}
                onValueChange={(itemValue) =>
                  setFormData((prev) => ({
                    ...prev,
                    frequency: itemValue,
                    // Auto-lock duration to SINGLE_DAY when ONCE is selected
                    duration:
                      itemValue === "ONCE"
                        ? "SINGLE_DAY"
                        : prev.duration === "SINGLE_DAY"
                          ? "CONTINUOUS"
                          : prev.duration,
                  }))
                }
                style={styles.picker}
                dropdownIconColor={colors.text}
              >
                {FREQUENCY_TYPES.map((f) => (
                  <Picker.Item key={f.value} label={f.label} value={f.value} />
                ))}
              </Picker>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Start Date *</Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.dateButton,
                currentErrors.dateTime && { borderColor: colors.error },
              ]}
              onPress={() => setShowOnceDatePicker(true)}
            >
              <Text style={{ color: colors.text }}>{formData.onceDate}</Text>
              <MaterialIcons
                name="calendar-today"
                size={18}
                color={colors.primary}
              />
            </TouchableOpacity>
            {currentErrors.dateTime ? (
              <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>
                {currentErrors.dateTime}
              </Text>
            ) : null}
            {showOnceDatePicker && (
              <DateTimePicker
                value={parseLocalDate(formData.onceDate) || today}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={today}
                onChange={(event, selectedDate) => {
                  setShowOnceDatePicker(Platform.OS === "ios");
                  if (selectedDate) {
                    setDateTimeModified(true);
                    setFormData({
                      ...formData,
                      onceDate: formatLocalDate(selectedDate),
                    });
                  }
                }}
              />
            )}
          </View>

          {["EVERY_X_HOURS", "EVERY_X_MINUTES"].includes(
            formData.frequency,
          ) && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Frequency Value (X) *</Text>
              <TextInput
                style={[
                  styles.input,
                  currentErrors.frequencyValue && { borderColor: colors.error },
                ]}
                value={formData.frequencyValue}
                onChangeText={(text) =>
                  setFormData({ ...formData, frequencyValue: text })
                }
                placeholder="e.g. 2"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
              {currentErrors.frequencyValue ? (
                <Text
                  style={{ color: colors.error, fontSize: 12, marginTop: 4 }}
                >
                  {currentErrors.frequencyValue}
                </Text>
              ) : null}
            </View>
          )}

          {[
            "X_TIMES_DAILY",
            "DAILY",
            "SPECIFIC_WEEK_DAYS",
            "SPECIFIC_DAYS_OF_MONTH",
          ].includes(formData.frequency) && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>No of Times per Day (X) *</Text>
              <TextInput
                style={[
                  styles.input,
                  currentErrors.frequencyValue && { borderColor: colors.error },
                ]}
                value={formData.frequencyValue}
                onChangeText={(text) =>
                  setFormData({ ...formData, frequencyValue: text })
                }
                placeholder="e.g. 1"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                maxLength={2}
              />
              {currentErrors.frequencyValue ? (
                <Text
                  style={{ color: colors.error, fontSize: 12, marginTop: 4 }}
                >
                  {currentErrors.frequencyValue}
                </Text>
              ) : null}
            </View>
          )}

          {formData.frequency === "SPECIFIC_WEEK_DAYS" && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Days of Week *</Text>
              <View style={styles.weekDaysContainer}>
                {WEEK_DAYS.map((day, index) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayButton,
                      formData.specificWeekDays.includes(index) &&
                        styles.dayButtonSelected,
                    ]}
                    onPress={() => toggleWeekDay(index)}
                  >
                    <Text
                      style={[
                        styles.dayButtonText,
                        formData.specificWeekDays.includes(index) &&
                          styles.dayButtonTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {currentErrors.specificWeekDays ? (
                <Text
                  style={{ color: colors.error, fontSize: 12, marginTop: 4 }}
                >
                  {currentErrors.specificWeekDays}
                </Text>
              ) : null}
            </View>
          )}

          {formData.frequency === "SPECIFIC_DAYS_OF_MONTH" && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Days of Month *</Text>
              <View style={styles.monthDaysGrid}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.monthDayButton,
                      formData.specificDaysOfMonth.includes(day) &&
                        styles.dayButtonSelected,
                    ]}
                    onPress={() => toggleDayOfMonth(day)}
                  >
                    <Text
                      style={[
                        styles.monthDayText,
                        formData.specificDaysOfMonth.includes(day) &&
                          styles.dayButtonTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {currentErrors.specificDaysOfMonth ? (
                <Text
                  style={{ color: colors.error, fontSize: 12, marginTop: 4 }}
                >
                  {currentErrors.specificDaysOfMonth}
                </Text>
              ) : null}
            </View>
          )}

          {formData.frequency === "ONCE" ? (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Time to Take (HH:MM) *</Text>
              <TextInput
                style={[
                  styles.input,
                  (currentErrors.time_0 || currentErrors.dateTime) && {
                    borderColor: colors.error,
                  },
                ]}
                value={formData.specificTimes[0]}
                onChangeText={(text) => updateTime(0, text)}
                placeholder="08:00"
                placeholderTextColor={colors.textSecondary}
                maxLength={5}
              />
              {currentErrors.time_0 ? (
                <Text
                  style={{ color: colors.error, fontSize: 12, marginTop: 4 }}
                >
                  {currentErrors.time_0}
                </Text>
              ) : null}
            </View>
          ) : null}

          {[
            "X_TIMES_DAILY",
            "DAILY",
            "SPECIFIC_WEEK_DAYS",
            "SPECIFIC_DAYS_OF_MONTH",
          ].includes(formData.frequency) &&
            parseInt(formData.frequencyValue, 10) > 0 && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Times of Day (HH:MM) *</Text>
                {formData.specificTimes.map((time, index) => (
                  <View key={index} style={{ marginBottom: spacing.m }}>
                    <View style={styles.timeRow}>
                      <TextInput
                        style={[
                          styles.input,
                          { flex: 1 },
                          currentErrors[`time_${index}`] && {
                            borderColor: colors.error,
                          },
                        ]}
                        value={time}
                        onChangeText={(text) => updateTime(index, text)}
                        placeholder="08:00"
                        placeholderTextColor={colors.textSecondary}
                        maxLength={5}
                      />
                    </View>
                    {currentErrors[`time_${index}`] ? (
                      <Text
                        style={{
                          color: colors.error,
                          fontSize: 12,
                          marginTop: -4,
                        }}
                      >
                        {currentErrors[`time_${index}`]}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

          {formData.frequency !== "ONCE" &&
            ![
              "X_TIMES_DAILY",
              "DAILY",
              "SPECIFIC_WEEK_DAYS",
              "SPECIFIC_DAYS_OF_MONTH",
            ].includes(formData.frequency) && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Start Time (HH:MM) *</Text>
                <TextInput
                  style={[
                    styles.input,
                    currentErrors.time_0 && { borderColor: colors.error },
                  ]}
                  value={formData.specificTimes[0]}
                  onChangeText={(text) => updateTime(0, text)}
                  placeholder="08:00"
                  placeholderTextColor={colors.textSecondary}
                  maxLength={5}
                />
                {currentErrors.time_0 ? (
                  <Text
                    style={{ color: colors.error, fontSize: 12, marginTop: 4 }}
                  >
                    {currentErrors.time_0}
                  </Text>
                ) : null}
              </View>
            )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Duration</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Duration Type</Text>
            <View
              style={[
                styles.pickerContainer,
                formData.frequency === "ONCE" && { opacity: 0.6 },
              ]}
            >
              <Picker
                selectedValue={
                  formData.frequency === "ONCE"
                    ? "SINGLE_DAY"
                    : formData.duration
                }
                onValueChange={(itemValue) =>
                  setFormData({ ...formData, duration: itemValue })
                }
                enabled={formData.frequency !== "ONCE"}
                style={styles.picker}
                dropdownIconColor={colors.text}
              >
                {formData.frequency === "ONCE" ? (
                  <Picker.Item
                    label="Single Day (One-time)"
                    value="SINGLE_DAY"
                  />
                ) : (
                  DURATION_TYPES.filter((d) => d.value !== "SINGLE_DAY").map(
                    (d) => (
                      <Picker.Item
                        key={d.value}
                        label={d.label}
                        value={d.value}
                      />
                    ),
                  )
                )}
              </Picker>
            </View>
            {formData.frequency === "ONCE" && (
              <Text
                style={[styles.label, { marginTop: 4, fontStyle: "italic" }]}
              >
                Duration is fixed for one-time reminders
              </Text>
            )}
          </View>

          {["FOR_X_DAYS", "FOR_X_WEEKS", "FOR_X_MONTHS"].includes(
            formData.duration,
          ) && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Duration Value (X) *</Text>
              <TextInput
                style={[
                  styles.input,
                  currentErrors.durationValue && { borderColor: colors.error },
                ]}
                value={formData.durationValue}
                onChangeText={(text) =>
                  setFormData({ ...formData, durationValue: text })
                }
                placeholder="e.g. 7"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
              />
              {currentErrors.durationValue ? (
                <Text
                  style={{ color: colors.error, fontSize: 12, marginTop: 4 }}
                >
                  {currentErrors.durationValue}
                </Text>
              ) : null}
            </View>
          )}

          {formData.duration === "UNTIL_DATE" && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>End Date *</Text>
              <TouchableOpacity
                style={[
                  styles.input,
                  styles.dateButton,
                  currentErrors.endDate && { borderColor: colors.error },
                ]}
                onPress={() => setShowEndDatePicker(true)}
              >
                <Text
                  style={{
                    color: formData.endDate
                      ? colors.text
                      : colors.textSecondary,
                  }}
                >
                  {formData.endDate || "Select end date"}
                </Text>
                <MaterialIcons
                  name="calendar-today"
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>
              {currentErrors.endDate ? (
                <Text
                  style={{ color: colors.error, fontSize: 12, marginTop: 4 }}
                >
                  {currentErrors.endDate}
                </Text>
              ) : null}
              {showEndDatePicker && (
                <DateTimePicker
                  value={parseLocalDate(formData.endDate) || today}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  minimumDate={today}
                  onChange={(event, selectedDate) => {
                    setShowEndDatePicker(Platform.OS === "ios");
                    if (selectedDate) {
                      setFormData({
                        ...formData,
                        endDate: formatLocalDate(selectedDate),
                      });
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
                (saving || hasLiveErrors) && { opacity: 0.6 },
              ]}
              onPress={handleSave}
              disabled={saving || hasLiveErrors}
            >
              <Text style={styles.saveBtnText}>
                {saving ? "Saving..." : "Save Reminder"}
              </Text>
            </TouchableOpacity>

            {isEditMode && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={handleDelete}
                disabled={deleting}
              >
                <Text style={styles.deleteBtnText}>
                  {deleting ? "Deleting..." : "Delete Reminder"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.l, paddingBottom: 80 },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.primary,
      marginBottom: spacing.l,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      marginTop: spacing.m,
      marginBottom: spacing.m,
      color: colors.text,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.l,
    },
    inputGroup: { marginBottom: spacing.m },
    label: { fontSize: 13, marginBottom: 6, color: colors.textSecondary },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: spacing.m,
      fontSize: 16,
      color: colors.text,
    },
    dateButton: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    pickerContainer: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: colors.card,
    },
    picker: { height: 50, width: "100%", color: colors.text },
    weekDaysContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 6,
    },
    dayButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.card,
    },
    dayButtonSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dayButtonText: { fontSize: 13, color: colors.text },
    dayButtonTextSelected: { color: "#FFF", fontWeight: "bold" },
    monthDaysGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      gap: 8,
      marginTop: 6,
    },
    monthDayButton: {
      width: 40,
      height: 40,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.card,
    },
    monthDayText: { fontSize: 13, color: colors.text },
    timeRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.s,
    },
    iconButton: { padding: 4, marginLeft: spacing.s },
    addTimeBtn: { flexDirection: "row", alignItems: "center", padding: 4 },
    addTimeText: { color: colors.primary, marginLeft: 4, fontWeight: "bold" },
    actions: { marginTop: spacing.l, gap: spacing.m },
    actionBtn: { padding: spacing.m, borderRadius: 12, alignItems: "center" },
    saveBtn: { backgroundColor: colors.primary },
    saveBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
    deleteBtn: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.error,
    },
    deleteBtnText: { color: colors.error, fontSize: 16, fontWeight: "700" },
  });

export default AddEditReminderScreen;
