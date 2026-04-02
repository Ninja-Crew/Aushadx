import React, { useState, useEffect } from "react";
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
import {
  verifyOTP,
  verifyResetOTP,
  requestOTP,
  forgotPassword,
} from "../api/auth";
import { removeToken } from "../utils/storage";
import { spacing } from "../styles/theme";
import { useTheme } from "../context/ThemeContext";

const OTPVerificationScreen = ({ route, navigation }) => {
  const { colors } = useTheme();
  const { email, otpToken, isPasswordReset } = route.params || {};

  const [otp, setOtp] = useState("");
  const [otpTokenState, setOtpTokenState] = useState(otpToken || "");
  const [loading, setLoading] = useState(false);
  const [otpExpirationTimer, setOtpExpirationTimer] = useState(600); // 10 minutes fixed for OTP validity
  const [resendTimer, setResendTimer] = useState(60); // Initial 1 minute timer for resend
  const [canResend, setCanResend] = useState(false);
  const [resendAttempts, setResendAttempts] = useState(0);

  const styles = makeStyles(colors);

  // Expiration timer countdown
  useEffect(() => {
    if (otpExpirationTimer <= 0) return;
    const timer = setTimeout(() => setOtpExpirationTimer(otpExpirationTimer - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpExpirationTimer]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendTimer]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleVerifyOTP = async () => {
    if (!otpTokenState) {
      Alert.alert("Error", "OTP session expired. Please request a new OTP.");
      return;
    }

    if (!otp || otp.length !== 6) {
      Alert.alert("Error", "Please enter a valid 6-digit OTP");
      return;
    }

    setLoading(true);

    try {
      if (isPasswordReset) {
        // Exchange the unverified OTP for a 10m authorized session token
        const result = await verifyResetOTP(email, otpTokenState, otp);

        navigation.replace("ResetPassword", {
          email,
          resetSessionToken: result.resetSessionToken,
        });
        return;
      }

      // Normal registration verification
      await verifyOTP(
        email,
        route.params?.password,
        route.params?.name,
        otpTokenState,
        otp,
      );

      Alert.alert(
        "Success",
        "Email verified successfully",
        [
          {
            text: "OK",
            onPress: () => {
              navigation.replace("Login");
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert("Error", error.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    setCanResend(false);

    // Calculate next timeout duration based on attempts
    const nextAttemptCount = resendAttempts + 1;
    let newTimeout = 60; // default 1st retry: 1 min
    if (nextAttemptCount === 1) {
      newTimeout = 120; // 2nd wait: 2 mins
    } else if (nextAttemptCount >= 2) {
      newTimeout = 300; // 3rd+ wait: 5 mins
    }
    
    setResendAttempts(nextAttemptCount);
    setResendTimer(newTimeout);
    setOtpExpirationTimer(600); // Reset the overall OTP validity when a new one is sent

    try {
      let data;
      if (isPasswordReset) {
        data = await forgotPassword(email);
      } else {
        data = await requestOTP(
          email,
          route.params?.password,
          route.params?.name,
        );
      }

      Alert.alert("Success", "OTP resent to your email");
      // Keep OTP token only in memory state (never persistent storage)
      if (data?.otpToken) {
        setOtpTokenState(data.otpToken);
      }
    } catch (error) {
      Alert.alert("Error", error.message || "Failed to resend OTP");
      setCanResend(true);
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
          <Text style={styles.header}>Verify OTP</Text>
          <Text style={styles.subHeader}>Enter the 6-digit code sent to</Text>
          <Text
            style={[
              styles.subHeader,
              { fontWeight: "bold", marginBottom: spacing.l },
            ]}
          >
            {email}
          </Text>

          <TextInput
            style={styles.input}
            placeholder="000000"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            placeholderTextColor={colors.textSecondary}
            editable={!loading}
          />

          <View style={styles.timerContainer}>
            <Text
              style={[
                styles.timerText,
                { color: otpExpirationTimer < 60 ? colors.error : colors.textSecondary },
              ]}
            >
              {otpExpirationTimer > 0
                ? `OTP Valid For: ${formatTime(otpExpirationTimer)}`
                : "OTP EXPIRED"}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.button, (loading || otpExpirationTimer <= 0) && styles.buttonDisabled]}
            onPress={handleVerifyOTP}
            disabled={loading || otpExpirationTimer <= 0}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.resendButton,
              (!canResend || loading) && styles.resendButtonDisabled,
            ]}
            onPress={handleResendOTP}
            disabled={!canResend || loading}
          >
            <Text
              style={[
                styles.resendText,
                (!canResend || loading) && styles.resendTextDisabled,
              ]}
            >
              {canResend
                ? "Didn't receive code? Resend"
                : `Resend available in ${formatTime(resendTimer)}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={[styles.link, loading && styles.linkDisabled]}>
              Go Back
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
      fontSize: 24,
      fontWeight: "bold",
      letterSpacing: 8,
      textAlign: "center",
      color: colors.text,
    },
    timerContainer: {
      marginBottom: spacing.m,
      alignItems: "center",
    },
    timerText: {
      fontSize: 14,
      fontWeight: "500",
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
    resendButton: {
      padding: spacing.m,
      alignItems: "center",
      marginBottom: spacing.m,
    },
    resendButtonDisabled: {
      opacity: 0.5,
    },
    resendText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "500",
    },
    resendTextDisabled: {
      color: colors.textSecondary,
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

export default OTPVerificationScreen;
