import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { resetPassword } from "../api/auth";
import { spacing } from "../styles/theme";
import { useTheme } from "../context/ThemeContext";

const ResetPasswordScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  // We expect email and resetSessionToken from the OTP verification success
  const { email, resetSessionToken } = route.params || {};

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);

  const styles = makeStyles(colors);

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "Please enter and confirm your new password");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    if (!resetSessionToken) {
      Alert.alert("Error", "Missing secure session token. Please try the reset flow again.");
      navigation.replace("Login");
      return;
    }

    setLoading(true);

    try {
      // Complete the reset password process using the authorized session token
      await resetPassword(email, newPassword, resetSessionToken);
      
      Alert.alert("Success", "Password reset successfully", [
        {
          text: "Login",
          onPress: () => navigation.replace("Login"),
        },
      ]);
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to reset password", [
        {
          text: "OK",
          onPress: () => {
             // If the 10m JWT token expired, send them back to the start of the flow
             if (error.message?.includes("expired")) {
               navigation.replace("ForgotPassword");
             }
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.container, { flex: 1 }]}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          <Text style={styles.header}>Create New Password</Text>
          <Text style={styles.subHeader}>
            Enter a new password for {email}
          </Text>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="New password"
              value={newPassword}
              onChangeText={(text) => {
                setNewPassword(text);
                if (confirmPassword && text !== confirmPassword) {
                  setConfirmPasswordError(true);
                } else {
                  setConfirmPasswordError(false);
                }
              }}
              secureTextEntry={!showPassword}
              placeholderTextColor={colors.textSecondary}
              editable={!loading}
            />
            <TouchableOpacity 
              style={styles.eyeIcon} 
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={{color: colors.primary}}>{showPassword ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.passwordContainer, confirmPasswordError && styles.errorBorder]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setConfirmPasswordError(newPassword !== text);
              }}
              onBlur={() => {
                if (confirmPassword && newPassword !== confirmPassword) {
                  setConfirmPasswordError(true);
                }
              }}
              secureTextEntry={!showConfirmPassword}
              placeholderTextColor={colors.textSecondary}
              editable={!loading}
            />
            <TouchableOpacity 
              style={styles.eyeIcon} 
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Text style={{color: colors.primary}}>{showConfirmPassword ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>

          {confirmPasswordError && (
             <Text style={styles.errorText}>Passwords do not match</Text>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Reset Password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.replace("Login")}
            disabled={loading}
          >
            <Text style={[styles.link, loading && styles.linkDisabled]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      padding: spacing.l,
    },
    formContainer: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: spacing.l,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    header: {
      fontSize: 24,
      fontWeight: "bold",
      marginBottom: spacing.s,
      textAlign: "center",
      color: colors.primary,
    },
    subHeader: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.l,
      textAlign: "center",
    },
    passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      marginBottom: spacing.m,
    },
    errorBorder: {
      borderColor: 'red',
    },
    errorText: {
      color: 'red',
      fontSize: 12,
      marginTop: -spacing.m,
      marginBottom: spacing.m,
      marginLeft: spacing.s,
    },
    passwordInput: {
      flex: 1,
      padding: spacing.m,
      fontSize: 16,
      color: colors.text,
    },
    eyeIcon: {
      padding: spacing.m,
    },
    button: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      padding: spacing.m,
      alignItems: "center",
      marginTop: spacing.s,
      marginBottom: spacing.m,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "bold",
    },
    link: {
      color: colors.primary,
      fontSize: 14,
      textAlign: "center",
      fontWeight: "bold",
    },
    linkDisabled: {
      opacity: 0.5,
    },
  });

export default ResetPasswordScreen;
