import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator, TextInput, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyzeMedicine } from '../api/analyzer';
import { useTheme } from '../context/ThemeContext';
import AnalysisResultModal from '../components/AnalysisResultModal';

const SCANNER_GIF_URL = 'https://i.pinimg.com/originals/c8/f5/61/c8f561917f22684ab9f72dbbb8c16053.gif'; 
const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation, route }) => {
  const { token, user } = route.params || {};
  const { colors, isDark } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [unclearImage, setUnclearImage] = useState(false);

  // Determine greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good Morning');
    else if (hour < 18) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('@lastAnalysisResult')
      .then(stored => {
        if (stored) setResult(JSON.parse(stored));
      })
      .catch(() => {});
  }, []);

  const pickImage = async (useCamera = false) => {
    try {
      let res;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required.');
          return;
        }
        res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      } else {
        res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
      }
      if (!res.canceled && res.assets?.length > 0) {
        const uri = res.assets[0].uri;
        setImageUri(uri);
        setUnclearImage(false); // reset on new image
        performOCR(uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const performOCR = async (uri) => {
    setLoading(true);
    setText('');
    try {
      const res = await TextRecognition.recognize(uri);
      if (res?.text) {
        setText(res.text);
      } else {
        Alert.alert('OCR Result', 'No text found in the image.');
      }
    } catch (err) {
      Alert.alert('OCR Error', 'Failed to extract text from image.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setAnalyzing(true);
    setUnclearImage(false);
    try {
      const data = await analyzeMedicine(token, { text });
      setResult(data);
      setShowResult(true);
      setText(''); // clear text after successful analyze
      setImageUri(null); // clear image
      AsyncStorage.setItem('@lastAnalysisResult', JSON.stringify(data)).catch(() => {});
    } catch (error) {
      const isUnclearLabel =
        error?.error === 'NOT_MEDICINE_LABEL' ||
        error?.status === 422 ||
        (typeof error?.message === 'string' && error.message.toLowerCase().includes('medicine label'));
      if (isUnclearLabel) {
        setUnclearImage(true);
      } else {
        Alert.alert('Error', error.message || 'Analysis failed');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSchedule = (medicineDetails) => {
    setShowResult(false);
    navigation.navigate('AddEditReminder', { 
      token, 
      reminderData: { 
        medicineName: medicineDetails.medicineName,
        dosage: medicineDetails.dosage,
        frequency: 'DAILY' // default
      }
    });
  };

  const s = makeStyles(colors);
  const userName = user?.name ? user.name.split(' ')[0] : 'User';

  // ── Unclear image fullscreen overlay ──────────────────────────────────────
  if (unclearImage && imageUri) {
    return (
      <View style={s.unclearContainer}>
        <Image source={{ uri: imageUri }} style={s.unclearBg} blurRadius={12} />
        <View style={s.unclearDimmer} />
        <View style={s.unclearContent}>
          <MaterialIcons name="warning-amber" size={56} color="#FFD600" />
          <Text style={s.unclearTitle}>Unclear medicine image</Text>
          <Text style={s.unclearSubtitle}>
            We couldn't identify this as a medicine label.{"\n"}Please try again with a clearer photo.
          </Text>
          <TouchableOpacity
            style={s.tryAgainBtn}
            onPress={() => { setUnclearImage(false); setImageUri(null); setText(''); }}
          >
            <MaterialIcons name="refresh" size={20} color="#fff" />
            <Text style={s.tryAgainText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={s.bodyContainer} showsVerticalScrollIndicator={false}>
        
        {/* Hero Greeting Section */}
        <View style={s.headerSection}>
          <View style={s.pillIcon}>
             <Text style={s.pillText}>aushad<Text style={{color: '#fff', fontWeight: 'bold'}}>X</Text></Text>
          </View>
          <Text style={s.greetingText}>{greeting},</Text>
          <Text style={s.nameText}>{userName} 👋</Text>
        </View>

        <Text style={s.subtitle}>What would you like to analyze today?</Text>

        {/* Action Cards Grid */}
        {!text && !loading && !analyzing && (
          <View style={s.actionGrid}>
            <TouchableOpacity 
              style={[s.actionCard, { backgroundColor: isDark ? '#1C2C4A' : '#E3F2FD' }]} 
              onPress={() => pickImage(true)}
              activeOpacity={0.8}
            >
              <View style={[s.iconCircle, { backgroundColor: colors.primary }]}>
                <MaterialIcons name="document-scanner" size={32} color="#FFF" />
              </View>
              <Text style={s.actionCardTitle}>Scan Label</Text>
              <Text style={s.actionCardSubtitle}>Use camera</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[s.actionCard, { backgroundColor: isDark ? '#311F38' : '#F3E5F5' }]} 
              onPress={() => pickImage(false)}
              activeOpacity={0.8}
            >
              <View style={[s.iconCircle, { backgroundColor: '#9C27B0' }]}>
                <MaterialIcons name="photo-library" size={32} color="#FFF" />
              </View>
              <Text style={s.actionCardTitle}>Upload</Text>
              <Text style={s.actionCardSubtitle}>From gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dynamic Scanner / Analysis Area */}
        {(text || loading || analyzing) && (
          <View style={s.analysisContainer}>
            <View style={s.viewfinderContainer}>
              <Image 
                source={{ uri: imageUri || SCANNER_GIF_URL }} 
                style={s.scannerGif} 
                resizeMode="cover" 
              />
              {analyzing ? (
                <View style={s.analyzingOverlay}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[s.analyzingText, { color: colors.primary }]}>Analyzing Formulation...</Text>
                </View>
              ) : loading ? (
                <View style={s.analyzingOverlay}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[s.analyzingText, { color: colors.primary }]}>Extracting Text...</Text>
                </View>
              ) : null}
            </View>

            {text && !analyzing && !loading && (
              <View style={s.ocrContainer}>
                <View style={s.ocrHeader}>
                  <MaterialIcons name="edit-note" size={24} color={colors.primary} />
                  <Text style={s.ocrLabel}>Verify Extracted Text</Text>
                </View>
                <TextInput
                  style={[s.input, isInputFocused ? s.inputFocused : s.inputBlurred]}
                  multiline
                  value={text}
                  onChangeText={setText}
                  placeholderTextColor={colors.textSecondary}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                />
                <View style={s.ocrButtons}>
                  <TouchableOpacity style={s.cancelButton} onPress={() => { setText(''); setImageUri(null); }}>
                    <Text style={s.cancelButtonText}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.analyzeButton} onPress={handleAnalyze}>
                    <Text style={s.analyzeButtonText}>Analyze</Text>
                    <MaterialIcons name="auto-awesome" size={18} color="#FFF" style={{marginLeft: 4}}/>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Recent Result Section */}
        {result && !text && !loading && !analyzing && (
           <View style={s.recentSection}>
             <Text style={s.sectionTitle}>Recent Analysis</Text>
             <TouchableOpacity 
               style={[s.recentCard, { backgroundColor: colors.card, borderColor: colors.border }]} 
               onPress={() => setShowResult(true)}
               activeOpacity={0.7}
             >
               <View style={[s.recentIconBox, { backgroundColor: colors.primary + '15' }]}>
                 <MaterialIcons name="medication" size={28} color={colors.primary} />
               </View>
               <View style={s.recentDetails}>
                 <Text style={[s.recentName, { color: colors.text }]} numberOfLines={1}>
                   {result.analysis?.drug_name || 'Unknown Medicine'}
                 </Text>
                 <Text style={[s.recentSub, { color: colors.textSecondary }]} numberOfLines={1}>
                   {result.analysis?.primary_category || 'Medical Product'}
                 </Text>
               </View>
               <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
             </TouchableOpacity>
           </View>
        )}
        
        <View style={{ height: 40 }} />
      </ScrollView>

      <AnalysisResultModal 
        visible={showResult} 
        result={result} 
        onClose={() => setShowResult(false)} 
        onSchedule={handleSchedule}
      />
    </SafeAreaView>
  );
};

const makeStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bodyContainer: { paddingHorizontal: 20, paddingTop: 10 },

  // ── Unclear image (fullscreen) ────────────────────────────────────────────
  unclearContainer: { flex: 1, backgroundColor: '#000' },
  unclearBg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', resizeMode: 'cover' },
  unclearDimmer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.58)' },
  unclearContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  unclearTitle: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  unclearSubtitle: { color: 'rgba(255,255,255,0.80)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  tryAgainBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14,
    borderRadius: 14, marginTop: 10,
  },
  tryAgainText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  // ─────────────────────────────────────────────────────────────────────────
  
  // Hero Section
  headerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 10,
  },
  greetingText: { fontSize: 18, color: colors.textSecondary, fontWeight: '500', marginTop: 16 },
  nameText: { fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 4 },
  subtitle: { fontSize: 16, color: colors.textSecondary, marginBottom: 28, textAlign: 'center' },
  
  pillIcon: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#ff4444',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }
  },
  pillText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Action Cards Grid
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 30,
  },
  actionCard: {
    flex: 1,
    padding: 20,
    borderRadius: 24,
    minHeight: 140,
    alignItems: 'center', // Centered content inside cards
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionCardTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
    textAlign: 'center'
  },
  actionCardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center'
  },

  // Interactive Analysis Area
  analysisContainer: {
    alignItems: 'center',
    width: '100%',
    marginVertical: 10,
  },
  viewfinderContainer: {
    width: width - 40,
    height: 200,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.chip,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 15,
  },
  scannerGif: { width: '100%', height: '100%', opacity: 0.8 },
  analyzingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.card + 'E6', 
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  analyzingText: { marginTop: 12, fontSize: 16, fontWeight: 'bold' },

  // OCR Form
  ocrContainer: {
    width: '100%',
    backgroundColor: colors.card,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  ocrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  ocrLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: 15,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  inputBlurred: {
    minHeight: 80,
    maxHeight: 120,
  },
  inputFocused: {
    minHeight: 180,
  },
  ocrButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
  },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 16 },
  cancelButtonText: { color: colors.textSecondary, fontWeight: '600', fontSize: 15 },
  analyzeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
  },
  analyzeButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  // Recent Section
  recentSection: { width: '100%', marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  recentIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  recentDetails: { flex: 1, justifyContent: 'center' },
  recentName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  recentSub: { fontSize: 13 },
});

export default HomeScreen;
