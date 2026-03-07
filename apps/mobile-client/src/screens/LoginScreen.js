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
  Platform
} from 'react-native';
import { login, register } from '../api/auth';
import { colors, spacing, typography } from '../styles/theme';

import { saveToken } from '../utils/storage';

const LoginScreen = ({ navigation }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
        // data structure: { user: {...}, tokens: { accessToken: "...", refreshToken: "..." } }
        await saveToken(data.tokens.access, data.tokens.refresh);
        // Navigate on success
        navigation.replace('Dashboard', { token: data.tokens.accessToken, user: data.user });
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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
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
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
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
        
        <TouchableOpacity 
            style={styles.skipButton}
            onPress={() => navigation.navigate('Agent', { token: 'mock-token' })}
        >
             <Text style={styles.skipText}>Skip (Test Agent)</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
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
    ...typography.header,
    marginBottom: spacing.s,
    textAlign: 'center',
    color: colors.primary,
  },
  subHeader: {
    ...typography.caption,
    marginBottom: spacing.l,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: spacing.m,
    marginBottom: spacing.m,
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: spacing.m,
    alignItems: 'center',
    marginTop: spacing.s,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchContainer: {
    marginTop: spacing.l,
    alignItems: 'center',
  },
  switchText: {
    ...typography.body,
    fontSize: 14,
  },
  linkText: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  skipButton: {
      marginTop: spacing.xl,
      alignSelf: 'center',
  },
  skipText: {
      color: colors.textSecondary,
      fontSize: 12
  }
});

export default LoginScreen;
