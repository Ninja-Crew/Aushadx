import React, { useState } from 'react';
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
  ScrollView
} from 'react-native';
import { login, register } from '../api/auth';
import { spacing } from '../styles/theme';
import { saveToken } from '../utils/storage';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const styles = makeStyles(colors);

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      let data;
      if (isLogin) {
        data = await login(email, password);
        await saveToken(data.tokens.access, data.tokens.refresh);

        // Check if a session route was saved before the token expired
        const pendingRouteRaw = await AsyncStorage.getItem('@pendingRoute');
        if (pendingRouteRaw) {
          try {
            const { name, params } = JSON.parse(pendingRouteRaw);
            await AsyncStorage.removeItem('@pendingRoute');
            navigation.replace(name, { ...params, token: data.tokens.access });
          } catch {
            navigation.replace('MainTabs', { token: data.tokens.access, user: data.user });
          }
        } else {
          navigation.replace('MainTabs', { token: data.tokens.access, user: data.user });
        }
      } else {
        // Prepare signup data
        // Profile service expects: { name, email, password, role: 'patient' }
        data = await register({ name, email, password, role: 'patient' });
        // Optional: Auto login after register or just alert
        Alert.alert('Success', 'Account created! Please login.', [
            { text: 'OK', onPress: () => setIsLogin(true) }
        ]);
        // Don't navigate automatically on register, let them login or auto-login if desired.
        // For better UX, we could auto-login. But for now, switch to login.
      }
    } catch (error) {
      const msg = error.message || (isLogin ? 'Login failed' : 'Registration failed');
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior="padding"
      style={[styles.container, { flex: 1 }]}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
        <View style={styles.formContainer}>
          <Text style={styles.header}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
          <Text style={styles.subHeader}>
            {isLogin ? 'Sign in to continue' : 'Sign up to get started'}
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

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={colors.textSecondary}
          />

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{isLogin ? 'Login' : 'Sign Up'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.switchContainer}>
            <Text style={styles.switchText}>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <Text style={styles.linkText}>{isLogin ? 'Sign Up' : 'Login'}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.l,
  },
  formContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.l,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    fontSize: 24, fontWeight: 'bold',
    marginBottom: spacing.s,
    textAlign: 'center',
    color: colors.primary,
  },
  subHeader: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.l,
    textAlign: 'center',
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
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.m,
    alignItems: 'center',
    marginTop: spacing.s,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  switchContainer: { marginTop: spacing.l, alignItems: 'center' },
  switchText: { fontSize: 14, color: colors.text },
  linkText: { color: colors.primary, fontWeight: 'bold' },
});

export default LoginScreen;
