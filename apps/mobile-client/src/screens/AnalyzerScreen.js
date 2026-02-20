import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView } from 'react-native';
import { analyzeMedicine } from '../api/analyzer';

const AnalyzerScreen = ({ route }) => {
  const { token } = route.params || {};
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      // Assuming backend accepts { text: ... } or similar
      const data = await analyzeMedicine(token, { text });
      setResult(data);
    } catch (error) {
      Alert.alert('Error', error.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Enter Medicine Text / OCR Content:</Text>
      <TextInput
        style={styles.input}
        multiline
        numberOfLines={4}
        value={text}
        onChangeText={setText}
        placeholder="e.g. Paracetamol 500mg twice daily..."
      />
      <Button title="Analyze" onPress={handleAnalyze} disabled={loading} />
      
      {loading && <Text style={styles.mt}>Analyzing...</Text>}
      
      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>Result:</Text>
          <Text>{JSON.stringify(result, null, 2)}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginBottom: 20,
    borderRadius: 5,
    minHeight: 100,
  },
  mt: {
    marginTop: 20,
  },
  resultContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
  },
  resultLabel: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
});

export default AnalyzerScreen;
