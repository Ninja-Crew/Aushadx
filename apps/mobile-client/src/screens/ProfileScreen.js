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
  Platform
} from 'react-native';
import { getProfile, updateProfile } from '../api/profile';
import { colors, spacing, typography } from '../styles/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const ProfileScreen = ({ route, navigation }) => {
  const { token } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    bloodType: '',
    height: '',
    weight: '',
    allergies: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const profile = await getProfile(token);
      if (profile) {
        setFormData({
          name: profile.name || '',
          email: profile.email || '',
          phone: profile.phone || '',
          dateOfBirth: profile.dateOfBirth ? (new Date(profile.dateOfBirth)).toISOString().split('T')[0] : '', // simple YYYY-MM-DD
          gender: profile.gender || '',
          address: profile.address || '',
          bloodType: profile.medicalInfo?.bloodType || '',
          height: profile.medicalInfo?.height || '',
          weight: profile.medicalInfo?.weight || '',
          allergies: (profile.medicalInfo?.allergies || []).join(', '),
        });
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const updatePayload = {
        name: formData.name,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth || null,
        gender: formData.gender,
        address: formData.address,
        medicalInfo: {
          bloodType: formData.bloodType,
          height: formData.height,
          weight: formData.weight,
          allergies: formData.allergies ? formData.allergies.split(',').map(a => a.trim()) : [],
        }
      };

      await updateProfile(token, updatePayload);
      Alert.alert('Success', 'Profile updated successfully!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Loading Profile...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : null}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({...formData, name: text})}
              placeholder="Full Name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#f0f0f0' }]}
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
              onChangeText={(text) => setFormData({...formData, phone: text})}
              placeholder="Phone Number"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={formData.dateOfBirth}
              onChangeText={(text) => setFormData({...formData, dateOfBirth: text})}
              placeholder="1990-01-01"
            />
          </View>
          
          <Text style={styles.sectionTitle}>Medical Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Blood Type</Text>
            <TextInput
              style={styles.input}
              value={formData.bloodType}
              onChangeText={(text) => setFormData({...formData, bloodType: text})}
              placeholder="O+, A-, etc."
            />
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.m }}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                value={String(formData.height)}
                onChangeText={(text) => setFormData({...formData, height: text})}
                placeholder="175"
                keyboardType="numeric"
              />
            </View>

            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput
                style={styles.input}
                value={String(formData.weight)}
                onChangeText={(text) => setFormData({...formData, weight: text})}
                placeholder="70"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Allergies (comma separated)</Text>
            <TextInput
              style={styles.input}
              value={formData.allergies}
              onChangeText={(text) => setFormData({...formData, allergies: text})}
              placeholder="Peanuts, Penicillin"
            />
          </View>

          <TouchableOpacity 
            style={styles.saveButton}
            onPress={handleUpdate}
            disabled={saving}
          >
            <MaterialIcons name="save" size={24} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.l,
    paddingBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.subheader,
    marginTop: spacing.m,
    marginBottom: spacing.m,
    color: colors.primary,
  },
  inputGroup: {
    marginBottom: spacing.m,
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.xs,
    color: colors.textSecondary,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.m,
    ...typography.body,
  },
  saveButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.m,
    borderRadius: 12,
    marginTop: spacing.l,
  },
  saveButtonText: {
    color: '#FFFFFF',
    ...typography.button,
  }
});

export default ProfileScreen;
