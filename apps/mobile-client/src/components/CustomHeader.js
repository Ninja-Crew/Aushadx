import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Switch, Linking, Alert } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { removeToken } from '../utils/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CustomHeader = ({ title, navigation, token }) => {
  const { colors, isDark, toggleTheme } = useTheme();
  const [isOptionsVisible, setIsOptionsVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const handleSos = () => {
    // 112 is a common emergency number, or change as needed
    Linking.openURL('tel:112').catch(() => {
      Alert.alert('Error', 'Unable to open dialer.');
    });
  };

  return (
    <>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border, paddingTop: Math.max(insets.top, 15) + 10 }]}>
        <View style={styles.headerSide}>
          <TouchableOpacity style={styles.sosButton} onPress={handleSos}>
             <MaterialIcons name="adjust" size={16} color="#fff" />
             <Text style={styles.sosText}>SOS</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{title}</Text>
        </View>

        <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setIsOptionsVisible(true)}>
            <MaterialIcons name="menu" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={isOptionsVisible} transparent animationType="fade" onRequestClose={() => setIsOptionsVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsOptionsVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Options</Text>

            <TouchableOpacity style={styles.modalOption} onPress={() => { setIsOptionsVisible(false); navigation.navigate('Profile', { token }); }}>
              <MaterialIcons name="person" size={24} color={colors.text} />
              <Text style={[styles.modalOptionText, { color: colors.text }]}>View Profile</Text>
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: colors.border + '60' }]} />

            <View style={styles.modalOption}>
              <MaterialIcons name={isDark ? 'dark-mode' : 'light-mode'} size={24} color={colors.text} />
              <Text style={[styles.modalOptionText, { color: colors.text }]}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={isDark ? '#fff' : '#f4f3f4'}
                style={{ marginLeft: 'auto' }}
              />
            </View>

            <View style={[styles.separator, { backgroundColor: colors.border + '60' }]} />

            <TouchableOpacity
              style={styles.modalOption}
              onPress={async () => {
                setIsOptionsVisible(false);
                await removeToken();
                navigation.replace('Login');
              }}
            >
              <MaterialIcons name="logout" size={24} color={colors.error} />
              <Text style={[styles.modalOptionText, { color: colors.error }]}>Log Out</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  headerSide: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center'
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sosButton: {
    backgroundColor: '#ff4444',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4
  },
  sosText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  headerTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  headerIcon: { padding: 4 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: {
    borderRadius: 24,
    padding: 24,
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalTitle: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  modalOptionText: { fontSize: 18, fontWeight: '600', marginLeft: 16 },
  separator: { height: 1, marginVertical: 4 },
});

export default CustomHeader;
