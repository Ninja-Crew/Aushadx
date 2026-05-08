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
  Platform,
  ScrollView,
} from "react-native";
import { forgotPassword } from "../api/auth";
import { spacing } from "../styles/theme";
import { useTheme } from "../context/ThemeContext";

const ForgotPasswordScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const styles = makeStyles(colors);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleRequestPasswordReset = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email");
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert("Error", "Please enter a valid email");
      return;
    }

    setLoading(true);

    try {
      const data = await forgotPassword(email);
      Alert.alert("Success", "OTP sent to your email");
      // Navigate straight to OTP screen with just the token and email
      navigation.replace("OTPVerification", {
        email,
        otpToken: data?.otpToken || "",
        isPasswordReset: true,
      });
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to request password reset");
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
          <Text style={styles.header}>Forgot Password</Text>
          <Text style={styles.subHeader}>
            Enter your email to receive a reset code
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.textSecondary}
            editable={!loading}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRequestPasswordReset}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Send Reset Code</Text>
            )}
          </TouchableOpacity>


          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={[styles.link, loading && styles.linkDisabled]}>
              Back to Login
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
    input: {
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: spacing.m,
      marginBottom: spacing.m,
      fontSize: 16,
      color: colors.text,
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
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.primary,
      padding: spacing.m,
      borderRadius: 8,
      alignItems: "center",
      marginBottom: spacing.m,
    },
    secondaryButtonText: {
      color: colors.primary,
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

export default ForgotPasswordScreen;
