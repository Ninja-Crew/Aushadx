import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { analyzeMedicine } from '../api/analyzer';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import AnalysisResultModal from '../components/AnalysisResultModal';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const AnalyzerScreen = ({ route, navigation }) => {
  const { token } = route.params || {};
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [unclearImage, setUnclearImage] = useState(false);

  // Load persisted last result on mount
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
        setUnclearImage(false);
        setText('');
        performOCR(uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const performOCR = async (uri) => {
    setLoading(true);
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
    setLoading(true);
    setUnclearImage(false);
    try {
      const data = await analyzeMedicine(token, { text });
      setResult(data);
      setShowResult(true);
      AsyncStorage.setItem('@lastAnalysisResult', JSON.stringify(data)).catch(() => {});
    } catch (error) {
      const isUnclearLabel =
        error?.error === 'NOT_MEDICINE_LABEL' ||
        error?.status === 422 ||
        (typeof error?.message === 'string' && error.message.toLowerCase().includes('medicine label'));

      console.log('[Analyzer] caught error:', JSON.stringify(error), 'isUnclear:', isUnclearLabel);

      if (isUnclearLabel) {
        setUnclearImage(true);
      } else {
        Alert.alert('Error', error.message || 'Analysis failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTryAgain = () => {
    setUnclearImage(false);
    setImageUri(null);
    setText('');
    navigation.navigate('MainTabs', { token });
  };

  const s = makeStyles(colors);

  // ── Unclear image state: fullscreen blurred overlay ───────────────────────
  if (unclearImage && imageUri) {
    return (
      <View style={s.unclearContainer}>
        <Image source={{ uri: imageUri }} style={s.unclearBg} blurRadius={12} />
        <View style={s.unclearDimmer} />
        <View style={s.unclearContent}>
          <MaterialIcons name="warning-amber" size={56} color="#FFD600" />
          <Text style={s.unclearTitle}>Unclear medicine image</Text>
          <Text style={s.unclearSubtitle}>
            We couldn't identify this as a medicine label.{'\n'}Please try again with a clearer photo.
          </Text>
          <TouchableOpacity style={s.tryAgainBtn} onPress={handleTryAgain}>
            <MaterialIcons name="refresh" size={20} color="#fff" />
            <Text style={s.tryAgainText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Normal state ──────────────────────────────────────────────────────────
  return (
    <ScrollView contentContainerStyle={s.container} style={{ backgroundColor: colors.background }}>
      <Text style={s.label}>Scan your medicine label:</Text>

      <View style={s.buttonRow}>
        <TouchableOpacity style={s.actionButton} onPress={() => pickImage(true)}>
          <MaterialIcons name="camera-alt" size={20} color="#fff" />
          <Text style={s.buttonText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.actionButton, { backgroundColor: colors.secondary }]} onPress={() => pickImage(false)}>
          <MaterialIcons name="photo-library" size={20} color="#fff" />
          <Text style={s.buttonText}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {imageUri && (
        <Image source={{ uri: imageUri }} style={s.imagePreview} />
      )}

      <Text style={s.label}>Extracted Text (Edit if needed):</Text>
      <TextInput
        style={s.input}
        multiline
        numberOfLines={5}
        value={text}
        onChangeText={setText}
        placeholder="e.g. Paracetamol 500mg twice daily..."
        placeholderTextColor={colors.textSecondary}
      />

      <TouchableOpacity style={[s.analyzeButton, (!text.trim() || loading) && { opacity: 0.5 }]} onPress={handleAnalyze} disabled={!text.trim() || loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.analyzeButtonText}>Analyze Text</Text>
        }
      </TouchableOpacity>

      {result && (
        <TouchableOpacity style={s.viewResult} onPress={() => setShowResult(true)}>
          <MaterialIcons name="science" size={20} color={colors.primary} />
          <Text style={[s.viewResultText, { color: colors.primary }]}>View Last Result: {result.analysis?.drug_name}</Text>
        </TouchableOpacity>
      )}

      <AnalysisResultModal visible={showResult} result={result} onClose={() => setShowResult(false)} />
    </ScrollView>
  );
};

const makeStyles = (colors) => StyleSheet.create({
  // ── unclear image (fullscreen) ────────────────────────────────────────────
  unclearContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  unclearBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  unclearDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.60)',
  },
  unclearContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
  },
  unclearTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  unclearSubtitle: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  tryAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 10,
  },
  tryAgainText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  // ── normal state ─────────────────────────────────────────────────────────
  container: { padding: 20 },
  label: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
    borderRadius: 12,
    minHeight: 110,
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  buttonRow: { flexDirection: 'row', marginBottom: 16, gap: 10 },
  actionButton: {
    flex: 1,
    backgroundColor: colors.primary,
    padding: 13,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  imagePreview: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: colors.chip,
  },
  analyzeButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  analyzeButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  viewResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
  },
  viewResultText: { fontWeight: '700', fontSize: 15 },
});

export default AnalyzerScreen;
