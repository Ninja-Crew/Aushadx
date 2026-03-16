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
import { login, requestOTP } from "../api/auth";
import { spacing } from "../styles/theme";
import { saveToken } from "../utils/storage";
import { useTheme } from "../context/ThemeContext";
import { registerFCMToken } from "../api/profile";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LoginScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);
  const [loading, setLoading] = useState(false);
  const styles = makeStyles(colors);

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && (!name || !confirmPassword))) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setConfirmPasswordError(true);
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      let data;
      if (isLogin) {
        data = await login(email, password);
        await saveToken(data.tokens.access, data.tokens.refresh);

        // Register Push Token immediately after login
        registerFCMToken(data.tokens.access).catch((err) =>
          console.warn("[Login] Soft-failure registering FCM:", err.message),
        );

        // Check if a session route was saved before the token expired
        const pendingRouteRaw = await AsyncStorage.getItem("@pendingRoute");
        if (pendingRouteRaw) {
          try {
            const { name, params } = JSON.parse(pendingRouteRaw);
            await AsyncStorage.removeItem("@pendingRoute");
            navigation.replace(name, { ...params, token: data.tokens.access });
          } catch {
            navigation.replace("MainTabs", {
              token: data.tokens.access,
              user: data.user,
            });
          }
        } else {
          navigation.replace("MainTabs", {
            token: data.tokens.access,
            user: data.user,
          });
        }
      } else {
        // New OTP-based registration flow
        // Step 1: Request OTP
        const data = await requestOTP(email, password, name);

        // Step 2: Navigate to OTP verification screen
        navigation.navigate("OTPVerification", {
          email,
          password,
          name,
          otpToken: data.otpToken,
          isPasswordReset: false,
        });
      }
    } catch (error) {
      const msg =
        error.message || (isLogin ? "Login failed" : "Registration failed");
      Alert.alert("Error", msg);
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
          <Text style={styles.header}>
            {isLogin ? "Welcome Back" : "Create Account"}
          </Text>
          <Text style={styles.subHeader}>
            {isLogin ? "Sign in to continue" : "Sign up to get started"}
          </Text>

          {!isLogin && (
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholderTextColor={colors.textSecondary}
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={colors.textSecondary}
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (!isLogin && confirmPassword && text !== confirmPassword) {
                  setConfirmPasswordError(true);
                } else {
                  setConfirmPasswordError(false);
                }
              }}
              secureTextEntry={!showPassword}
              placeholderTextColor={colors.textSecondary}
            />
            <TouchableOpacity 
              style={styles.eyeIcon} 
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={{color: colors.primary}}>{showPassword ? "Hide" : "Show"}</Text>
            </TouchableOpacity>
          </View>

          {!isLogin && (
            <View style={[styles.passwordContainer, confirmPasswordError && styles.errorBorder]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  setConfirmPasswordError(password !== text);
                }}
                onBlur={() => {
                  if (confirmPassword && password !== confirmPassword) {
                    setConfirmPasswordError(true);
                  }
                }}
                secureTextEntry={!showConfirmPassword}
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity 
                style={styles.eyeIcon} 
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Text style={{color: colors.primary}}>{showConfirmPassword ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isLogin && confirmPasswordError && (
             <Text style={styles.errorText}>Passwords do not match</Text>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {isLogin ? "Login" : "Sign Up"}
              </Text>
            )}
          </TouchableOpacity>

          {isLogin && (
            <TouchableOpacity
              onPress={() => navigation.navigate("ForgotPassword")}
              style={styles.forgotPasswordContainer}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setIsLogin(!isLogin)}
            style={styles.switchContainer}
          >
            <Text style={styles.switchText}>
              {isLogin
                ? "Don't have an account? "
                : "Already have an account? "}
              <Text style={styles.linkText}>
                {isLogin ? "Sign Up" : "Login"}
              </Text>
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
      borderRadius: 8,
      padding: spacing.m,
      marginBottom: spacing.m,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border,
      color: colors.text,
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
    },
    buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
    forgotPasswordContainer: {
      marginTop: spacing.m,
      alignItems: "center",
    },
    forgotPasswordText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: "500",
    },
    switchContainer: { marginTop: spacing.l, alignItems: "center" },
    switchText: { fontSize: 14, color: colors.text },
    linkText: { color: colors.primary, fontWeight: "bold" },
  });

export default LoginScreen;
