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
  ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import {
  getProfile,
  updateProfile,
  deleteProfile,
  deleteFCMToken,
} from "../api/profile";
import { deleteAllReminders } from "../api/reminders";
import { removeToken } from "../utils/storage";
import { spacing } from "../styles/theme";
import { useTheme } from "../context/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

const ProfileScreen = ({ route, navigation }) => {
  const { token } = route.params || {};
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [newHistoryItem, setNewHistoryItem] = useState("");

  const [profileData, setProfileData] = useState(null);

  // Form state for edit mode
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    date_of_birth: "",
    gender: "",
    bloodType: "",
    height: "",
    weight: "",
    allergies: "",
    medical_history: [],
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const profile = await getProfile(token);
      if (profile) {
        setProfileData(profile);
        populateForm(profile);
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (data) => {
    const dobRaw = data.dateOfBirth || data.date_of_birth;

    setFormData({
      name: data.name || "",
      email: data.email || "",
      phone: data.phone || "",
      address: data.address || "",
      date_of_birth: dobRaw ? new Date(dobRaw).toISOString().split("T")[0] : "", // YYYY-MM-DD
      gender: data.gender || "unknown",
      bloodType: data.medicalInfo?.bloodType || "unknown",
      height: data.medicalInfo?.height ? String(data.medicalInfo.height) : "",
      weight: data.medicalInfo?.weight ? String(data.medicalInfo.weight) : "",
      allergies: Array.isArray(data.medicalInfo?.allergies)
        ? data.medicalInfo.allergies.join(", ")
        : "",
      medical_history: Array.isArray(data.medicalInfo?.medical_history)
        ? data.medicalInfo.medical_history
        : [],
    });
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const updatePayload = {
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        dateOfBirth: formData.date_of_birth || null,
        gender: formData.gender,
        medicalInfo: {
          bloodType: formData.bloodType,
          medical_history: formData.medical_history,
          height: formData.height ? Number(formData.height) : null,
          weight: formData.weight ? Number(formData.weight) : null,
          allergies: formData.allergies
            ? formData.allergies
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            : [],
        },
      };

      const updated = await updateProfile(token, updatePayload);
      setProfileData(updated);
      populateForm(updated);
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    populateForm(profileData); // Reset form back to original fetched data
    setIsEditing(false);
    setShowDatePicker(false);
    setNewHistoryItem("");
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to permanently delete your account? All your medical history and AI chats will be completely wiped. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true); // show loader during delete
              // Delete FCM token from server first
              await deleteFCMToken(token);
              // Delete all medicines and reminders for this user
              await deleteAllReminders(token);
              // Delete the account
              await deleteProfile(token);
              // Remove local token
              await removeToken();
              Alert.alert(
                "Account Deleted",
                "Your account has been successfully removed.",
              );
              navigation.replace("Login");
            } catch (error) {
              setLoading(false);
              Alert.alert(
                "Error",
                error.message || "Failed to delete account.",
              );
            }
          },
        },
      ],
    );
  };

  const handleDateChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setFormData({
        ...formData,
        date_of_birth: selectedDate.toISOString().split("T")[0],
      });
    }
  };

  const styles = makeStyles(colors);

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>
          Loading Profile...
        </Text>
      </View>
    );
  }

  // View Mode UI Component
  const renderViewMode = () => (
    <View style={styles.viewContainer}>
      <View style={styles.headerRow}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {profileData?.name?.charAt(0)?.toUpperCase() || "U"}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: spacing.m }}>
          <Text style={styles.viewName}>{profileData?.name || "User"}</Text>
          <Text style={styles.viewEmail}>{profileData?.email || ""}</Text>
        </View>
        <TouchableOpacity
          style={styles.editActionBtn}
          onPress={() => setIsEditing(true)}
        >
          <MaterialIcons name="edit" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <MaterialIcons name="phone" size={20} color={colors.textSecondary} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>
              {formData.phone || "Not specified"}
            </Text>
          </View>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <MaterialIcons
            name="location-pin"
            size={20}
            color={colors.textSecondary}
          />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoValue}>
              {formData.address || "Not specified"}
            </Text>
          </View>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <MaterialIcons name="cake" size={20} color={colors.textSecondary} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Date of Birth</Text>
            <Text style={styles.infoValue}>
              {formData.date_of_birth || "Not specified"}
            </Text>
          </View>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <MaterialIcons name="person" size={20} color={colors.textSecondary} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Gender</Text>
            <Text style={[styles.infoValue, { textTransform: "capitalize" }]}>
              {formData.gender.replace(/_/g, " ") || "Not specified"}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Medical Information</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <MaterialIcons
            name="bloodtype"
            size={20}
            color={colors.textSecondary}
          />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Blood Type</Text>
            <Text style={styles.infoValue}>
              {formData.bloodType || "Not specified"}
            </Text>
          </View>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <MaterialIcons name="height" size={20} color={colors.textSecondary} />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Height</Text>
            <Text style={styles.infoValue}>
              {formData.height ? formData.height + " cm" : "Not specified"}
            </Text>
          </View>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <MaterialIcons
            name="monitor-weight"
            size={20}
            color={colors.textSecondary}
          />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Weight</Text>
            <Text style={styles.infoValue}>
              {formData.weight ? formData.weight + " kg" : "Not specified"}
            </Text>
          </View>
        </View>
        <View style={styles.infoDivider} />
        <View style={styles.infoRow}>
          <MaterialIcons
            name="medical-information"
            size={20}
            color={colors.textSecondary}
          />
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoLabel}>Allergies</Text>
            <Text style={styles.infoValue}>
              {formData.allergies
                ? formData.allergies
                : "No allergies reported."}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Medical History</Text>
      <View style={styles.infoCard}>
        {formData.medical_history && formData.medical_history.length > 0 ? (
          formData.medical_history.map((item, index) => (
            <View key={index}>
              <View style={styles.infoRow}>
                <MaterialIcons
                  name="history"
                  size={20}
                  color={colors.textSecondary}
                />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoValue}>{item}</Text>
                </View>
              </View>
              {index < formData.medical_history.length - 1 && (
                <View style={styles.infoDivider} />
              )}
            </View>
          ))
        ) : (
          <View style={styles.infoRow}>
            <MaterialIcons
              name="info-outline"
              size={20}
              color={colors.textSecondary}
            />
            <View style={styles.infoTextContainer}>
              <Text style={[styles.infoValue, { color: colors.textSecondary }]}>
                No medical history reported.
              </Text>
            </View>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={handleDeleteAccount}
      >
        <MaterialIcons
          name="delete-forever"
          size={24}
          color={colors.error}
          style={{ marginRight: 8 }}
        />
        <Text style={[styles.deleteButtonText, { color: colors.error }]}>
          Delete Account
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Edit Mode UI Component
  const renderEditMode = () => (
    <View style={styles.editContainer}>
      <Text style={styles.sectionTitle}>Edit Basic Info</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="Full Name"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email (Cannot be changed)</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.border + "40",
              color: colors.textSecondary,
            },
          ]}
          value={formData.email}
          editable={false}
          placeholder="Email"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Phone</Text>
        <TextInput
          style={styles.input}
          value={formData.phone}
          onChangeText={(text) => setFormData({ ...formData, phone: text })}
          placeholder="Phone Number"
          placeholderTextColor={colors.textSecondary}
          keyboardType="phone-pad"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Address</Text>
        <TextInput
          style={styles.input}
          value={formData.address}
          onChangeText={(text) => setFormData({ ...formData, address: text })}
          placeholder="Street Address"
          placeholderTextColor={colors.textSecondary}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Date of Birth</Text>
        {Platform.OS === "android" ? (
          <TouchableOpacity
            style={[styles.input, { justifyContent: "center" }]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text
              style={{
                color: formData.date_of_birth
                  ? colors.text
                  : colors.textSecondary,
              }}
            >
              {formData.date_of_birth || "Select Date"}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <DateTimePicker
              value={
                formData.date_of_birth
                  ? new Date(formData.date_of_birth)
                  : new Date()
              }
              mode="date"
              display="default"
              onChange={handleDateChange}
              themeVariant={isDark ? "dark" : "light"}
            />
          </View>
        )}

        {showDatePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={
              formData.date_of_birth
                ? new Date(formData.date_of_birth)
                : new Date()
            }
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.m }}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.gender}
              onValueChange={(itemValue) =>
                setFormData({ ...formData, gender: itemValue })
              }
              style={styles.picker}
              dropdownIconColor={colors.textSecondary}
            >
              <Picker.Item
                label="Select..."
                value=""
                color={colors.textSecondary}
              />
              <Picker.Item label="Male" value="male" color={colors.text} />
              <Picker.Item label="Female" value="female" color={colors.text} />
              <Picker.Item label="Other" value="other" color={colors.text} />
              <Picker.Item
                label="Prefer Not to Say"
                value="prefer_not_to_say"
                color={colors.text}
              />
              <Picker.Item
                label="Unknown"
                value="unknown"
                color={colors.text}
              />
            </Picker>
          </View>
        </View>

        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Blood Type</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.bloodType}
              onValueChange={(itemValue) =>
                setFormData({ ...formData, bloodType: itemValue })
              }
              style={styles.picker}
              dropdownIconColor={colors.textSecondary}
            >
              <Picker.Item
                label="Select..."
                value=""
                color={colors.textSecondary}
              />
              <Picker.Item label="A+" value="A+" color={colors.text} />
              <Picker.Item label="A-" value="A-" color={colors.text} />
              <Picker.Item label="B+" value="B+" color={colors.text} />
              <Picker.Item label="B-" value="B-" color={colors.text} />
              <Picker.Item label="AB+" value="AB+" color={colors.text} />
              <Picker.Item label="AB-" value="AB-" color={colors.text} />
              <Picker.Item label="O+" value="O+" color={colors.text} />
              <Picker.Item label="O-" value="O-" color={colors.text} />
              <Picker.Item
                label="Unknown"
                value="unknown"
                color={colors.text}
              />
            </Picker>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Edit Medical Info</Text>

      <View style={{ flexDirection: "row", gap: spacing.m }}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Height (cm)</Text>
          <TextInput
            style={styles.input}
            value={formData.height}
            onChangeText={(text) => setFormData({ ...formData, height: text })}
            placeholder="175"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
          />
        </View>

        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Weight (kg)</Text>
          <TextInput
            style={styles.input}
            value={formData.weight}
            onChangeText={(text) => setFormData({ ...formData, weight: text })}
            placeholder="70"
            placeholderTextColor={colors.textSecondary}
            keyboardType="numeric"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Allergies (comma separated)</Text>
        <TextInput
          style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
          value={formData.allergies}
          onChangeText={(text) => setFormData({ ...formData, allergies: text })}
          placeholder="Peanuts, Penicillin..."
          placeholderTextColor={colors.textSecondary}
          multiline
        />
      </View>

      <Text style={styles.sectionTitle}>Medical History List</Text>

      {formData.medical_history &&
        formData.medical_history.map((item, index) => (
          <View
            key={`hist-${index}`}
            style={[
              styles.inputGroup,
              { flexDirection: "row", alignItems: "center" },
            ]}
          >
            <Text
              style={[
                styles.input,
                {
                  flex: 1,
                  marginRight: spacing.s,
                  backgroundColor: colors.border + "40",
                  color: colors.textSecondary,
                },
              ]}
            >
              {item}
            </Text>
            <TouchableOpacity
              onPress={() => {
                const updated = [...formData.medical_history];
                updated.splice(index, 1);
                setFormData({ ...formData, medical_history: updated });
              }}
              style={{ padding: spacing.s }}
            >
              <MaterialIcons name="delete" size={24} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}

      <View
        style={[
          styles.inputGroup,
          { flexDirection: "row", alignItems: "center" },
        ]}
      >
        <TextInput
          style={[styles.input, { flex: 1, marginRight: spacing.s }]}
          value={newHistoryItem}
          onChangeText={setNewHistoryItem}
          placeholder="Add history record (e.g. Asthma)"
          placeholderTextColor={colors.textSecondary}
        />
        <TouchableOpacity
          onPress={() => {
            if (newHistoryItem.trim()) {
              setFormData({
                ...formData,
                medical_history: [
                  ...formData.medical_history,
                  newHistoryItem.trim(),
                ],
              });
              setNewHistoryItem("");
            }
          }}
          style={{
            padding: spacing.m,
            backgroundColor: colors.primary,
            borderRadius: 12,
            justifyContent: "center",
          }}
        >
          <MaterialIcons name="add" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.btn, styles.cancelBtn]}
          onPress={cancelEdit}
          disabled={saving}
        >
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.saveButton]}
          onPress={handleUpdate}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <MaterialIcons
                name="save"
                size={20}
                color="#FFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.saveButtonText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {isEditing ? renderEditMode() : renderViewMode()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.l, paddingBottom: 60 },

    // View Mode Styles
    viewContainer: { marginTop: spacing.s },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: spacing.xl,
    },
    avatarCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary + "20",
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: { fontSize: 24, fontWeight: "bold", color: colors.primary },
    viewName: {
      fontSize: 24,
      fontWeight: "bold",
      color: colors.text,
      marginBottom: 2,
    },
    viewEmail: { fontSize: 14, color: colors.textSecondary },
    editActionBtn: {
      padding: spacing.s,
      backgroundColor: colors.card,
      borderRadius: 20,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },

    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: spacing.m,
      marginBottom: spacing.l,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 1,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: spacing.s,
    },
    infoTextContainer: { marginLeft: spacing.m, flex: 1 },
    infoLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
    infoValue: { fontSize: 15, color: colors.text, fontWeight: "500" },
    infoDivider: {
      height: 1,
      backgroundColor: colors.border + "50",
      marginVertical: spacing.xs,
      marginLeft: 36,
    },

    // Shared/Edit Mode
    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      marginTop: spacing.m,
      marginBottom: spacing.m,
      color: colors.text,
    },
    editContainer: {},
    inputGroup: { marginBottom: spacing.m },
    label: {
      fontSize: 13,
      marginBottom: 6,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: spacing.m,
      fontSize: 15,
      color: colors.text,
    },

    // Actions
    actionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: spacing.l,
      gap: spacing.m,
    },
    btn: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.m,
      borderRadius: 12,
    },
    cancelBtn: { backgroundColor: colors.chip },
    cancelBtnText: { color: colors.text, fontSize: 16, fontWeight: "600" },
    saveButton: { backgroundColor: colors.primary },
    saveButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
    deleteButton: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      padding: spacing.m,
      borderRadius: 12,
      marginTop: spacing.xl,
      backgroundColor: colors.error + "15",
      borderWidth: 1,
      borderColor: colors.error + "40",
    },
    deleteButtonText: { fontSize: 16, fontWeight: "700" },
  });

export default ProfileScreen;
