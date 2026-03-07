import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, FlatList, StyleSheet, Platform, Keyboard, KeyboardAvoidingView } from 'react-native';
import ChatMessage from '../components/ChatMessage';
import { useTheme } from '../context/ThemeContext';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AgentScreen = ({ route }) => {
  const { token } = route.params || {};
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const ws = useRef(null);

  // Keyboard height tracking — precise alternative to KeyboardAvoidingView on Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      });
      const hideSub = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardHeight(0);
      });
      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }
  }, []);

  useEffect(() => {
    const BASE_HOST = process.env.EXPO_PUBLIC_BASE_HOST || '127.0.0.1';
    const NETWORK_HOST = process.env.EXPO_PUBLIC_NETWORK_HOST || '192.168.0.107';
    const PORT = process.env.EXPO_PUBLIC_PORT || '30000';
    
    const host = Platform.OS === 'android' && (BASE_HOST.includes('localhost') || BASE_HOST === '127.0.0.1') ? NETWORK_HOST : BASE_HOST;
    const wsUrl = `ws://${host}:${PORT}/ws?token=${token}`;

    console.log("Connecting to WS:", wsUrl);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket Connected');
      setMessages(prev => [...prev, { id: Math.random().toString(), text: 'Connected to Agent', isUser: false }]);
    };

    ws.current.onmessage = (e) => {
      const text = e.data;
      setMessages(prev => {
        const newMessages = [...prev];
        if (newMessages.length > 0 && !newMessages[newMessages.length - 1].isUser) {
          const lastIndex = newMessages.length - 1;
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            text: newMessages[lastIndex].text + text
          };
        } else {
          newMessages.push({ id: Math.random().toString(), text, isUser: false });
        }
        return newMessages;
      });
    };

    ws.current.onerror = (e) => {
      console.log('WebSocket Error:', e.message);
      setMessages(prev => [...prev, { id: Math.random().toString(), text: 'Error connecting to agent', isUser: false }]);
    };

    ws.current.onclose = (e) => {
      console.log('WebSocket Closed:', e.code, e.reason);
      setMessages(prev => [...prev, { id: Math.random().toString(), text: 'Disconnected', isUser: false }]);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [token]);

  const sendMessage = () => {
    if (!input.trim()) return;

    const msg = input.trim();
    setMessages(prev => [...prev, { id: Math.random().toString(), text: msg, isUser: true }]);

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ message: msg }));
    } else {
      console.log("WS not open");
    }
    setInput('');
  };

  // Android: we manually track keyboard height and push the whole layout up
  // iOS: standard KeyboardAvoidingView with 'padding' is reliable
  if (Platform.OS === 'android') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: keyboardHeight===0?0:keyboardHeight+16 }]}>
        <FlatList
          data={messages}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <ChatMessage message={item.text} isUser={item.isUser} />
          )}
          contentContainerStyle={styles.list}
          style={{ flex: 1 }}
        />
        <View style={[
          styles.inputContainer,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingBottom: keyboardHeight > 0 ? 8 : insets.bottom + 8
          }
        ]}>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
          />
          <TouchableOpacity onPress={sendMessage} style={[styles.sendBtn, { backgroundColor: colors.primary }]}>
            <MaterialIcons name="send" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <ChatMessage message={item.text} isUser={item.isUser} />
        )}
        contentContainerStyle={styles.list}
        style={{ flex: 1 }}
      />
      <View style={[
        styles.inputContainer,
        { borderColor: colors.border, backgroundColor: colors.card, paddingBottom: insets.bottom + 8 }
      ]}>
        <TextInput
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text }]}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
        />
        <TouchableOpacity onPress={sendMessage} style={[styles.sendBtn, { backgroundColor: colors.primary }]}>
          <MaterialIcons name="send" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 10 },
  inputContainer: { flexDirection: 'row', padding: 10, borderTopWidth: 1, alignItems: 'center' },
  input: {
    flex: 1, borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 15, paddingVertical: 8, marginRight: 10,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
});

export default AgentScreen;
