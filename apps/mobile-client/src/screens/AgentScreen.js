import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Text, FlatList, StyleSheet, Platform, Keyboard, KeyboardAvoidingView, Modal, ActivityIndicator } from 'react-native';
import Constants from 'expo-constants';
import ChatMessage from '../components/ChatMessage';
import { useTheme } from '../context/ThemeContext';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { refreshTokenCall } from '../api/auth';
import { getToken, getRefreshToken, saveToken } from '../utils/storage';
import { fetchChats, fetchChatMessages, deleteChat } from '../api/agent';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
  });
};

const AgentScreen = ({ route, navigation }) => {
  const { token } = route.params || {};
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [currentChatId, setCurrentChatId] = useState(generateUUID());
  const [messages, setMessages] = useState([
    { id: '__status__', text: '● Connecting...', isUser: false, isStatus: true }
  ]);
  const [input, setInput] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isHistoryVisible, setHistoryVisible] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const ws = useRef(null);
  const reconnectTimeout = useRef(null);

  // Set up header - AgentScreen is embedded via CustomHeader now
  // We can listen to openHistory param to toggle modal
  useEffect(() => {
    if (route.params?.openHistory) {
      loadAndShowHistory();
      // Reset param so it doesn't trigger on every render if navigating back
      navigation.setParams({ openHistory: undefined });
    }
  }, [route.params?.openHistory]);

  const loadAndShowHistory = async () => {
    setHistoryVisible(true);
    setLoadingHistory(true);
    try {
      const jwtToken = await getToken();
      const data = await fetchChats(jwtToken);
      setChatHistory(data || []);
    } catch (e) {
      console.log("Failed to load history", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const selectChat = async (chatId) => {
    setHistoryVisible(false);
    if (chatId === currentChatId) return;
    
    // Switch chat
    setMessages([{ id: '__status__', text: '● Loading messages...', isUser: false, isStatus: true }]);
    setCurrentChatId(chatId);
    
    try {
      const jwtToken = await getToken();
      const historyMessages = await fetchChatMessages(jwtToken, chatId);
      const formattedMsgs = historyMessages.map((m, i) => ({
        id: 'hist_' + i, text: m.text, isUser: m.isUser
      }));
      formattedMsgs.push({ id: '__status__', text: '● Connecting...', isUser: false, isStatus: true });
      setMessages(formattedMsgs);
    } catch (e) {
      console.log("Failed to load chat messages", e);
      setMessages([{ id: '__status__', text: '● Connecting...', isUser: false, isStatus: true }]);
    }
  };

  const startNewChat = () => {
    setHistoryVisible(false);
    setMessages([{ id: '__status__', text: '● Connecting...', isUser: false, isStatus: true }]);
    setCurrentChatId(generateUUID());
  };

  const handleDeleteChat = async (chatId) => {
    try {
      const jwtToken = await getToken();
      await deleteChat(jwtToken, chatId);
      setChatHistory(prev => prev.filter(c => c.chat_id !== chatId));
      if (chatId === currentChatId) {
        startNewChat();
      }
    } catch (e) {
      console.log("Failed to delete chat", e);
    }
  };

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
    const BASE_URL = Constants.expoConfig?.extra?.baseUrl || 'http://192.168.0.107:30000';
    
    let wsUrlString = BASE_URL;
    if (Platform.OS === 'android' && (BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1'))) {
      wsUrlString = BASE_URL.replace('localhost', '10.0.2.2').replace('127.0.0.1', '10.0.2.2');
    }
    
    // Convert http/https to ws/wss
    if (wsUrlString.startsWith('http://')) {
      wsUrlString = wsUrlString.replace('http://', 'ws://');
    } else if (wsUrlString.startsWith('https://')) {
      wsUrlString = wsUrlString.replace('https://', 'wss://');
    }
    
    // Build a fresh WS URL using the latest access token from storage
    const getWsUrl = async () => {
      const currentToken = await getToken();
      return `${wsUrlString.replace(/\/$/, '')}/ws?token=${currentToken}&chatId=${currentChatId}`;
    };

    // Refresh access token via stored refresh token
    const refreshAccessToken = async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token');
      const data = await refreshTokenCall(refreshToken);
      const newAccess = data?.tokens?.access || data?.accessToken;
      const newRefresh = data?.tokens?.refresh || data?.refreshToken || refreshToken;
      if (!newAccess) throw new Error('Failed to retrieve new access token');
      await saveToken(newAccess, newRefresh);
    };

    // Upserts the status message at the BOTTOM — always visible, never duplicated
    const setStatusMessage = (text) => {
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== '__status__');
        return [...filtered, { id: '__status__', text, isUser: false, isStatus: true }];
      });
    };

    let authRetryCount = 0;

    const connectWebSocket = async () => {
      const wsUrl = await getWsUrl();
      console.log('Connecting to WS:', wsUrl);
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket Connected');
        setIsConnected(true);
        authRetryCount = 0; // reset on successful connection
        if (reconnectTimeout.current) {
          clearTimeout(reconnectTimeout.current);
          reconnectTimeout.current = null;
        }
        setStatusMessage('✓ Connected to Agent');
      };

      ws.current.onmessage = (e) => {
        const text = e.data;
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIdx = newMessages.length - 1;
          if (newMessages.length > 0 && !newMessages[lastIdx].isUser && newMessages[lastIdx].id !== '__status__') {
            newMessages[lastIdx] = { ...newMessages[lastIdx], text: newMessages[lastIdx].text + text };
          } else {
            // Remove the status message if we are appending a new message and just got a reply
            const filtered = newMessages.filter(m => m.id !== '__status__');
            filtered.push({ id: Math.random().toString(), text, isUser: false });
            return filtered;
          }
          return newMessages;
        });
      };

      ws.current.onerror = (e) => {
        console.log('WebSocket Error:', e.message);
      };

      ws.current.onclose = async (e) => {
        const errorReason = e.reason || (e.message ? e.message : '');
        console.log('WebSocket Closed:', e.code, errorReason);
        setIsConnected(false);

        const reason = errorReason.toLowerCase();
        
        // Only treat as auth error if explicitly stated or code is 4001 (Unauthorized)
        // If it's a 1006 (Abnormal Closure), check if the OS actually noted a 401 handshake refusal
        const isAuthError =
          reason.includes('expired') ||
          reason.includes('jwt') ||
          reason.includes('401') ||
          reason.includes('unauthorized') ||
          e.code === 4001;

        if (isAuthError && authRetryCount < 1) {
          authRetryCount++;
          setStatusMessage('⟳ Verifying session...');
          try {
            await refreshAccessToken();
            // Automatically and immediately retry once the token is refreshed
            connectWebSocket();
            return; // stop the 3-second timeout
          } catch (err) {
            console.log('Token refresh failed:', err);
            // Don't kill the loop if offline. If actual auth rejection, err logic would not be pure Network Error.
            const isNetworkError = err.message && (err.message.includes('Network Error') || err.message.includes('fetch'));
            if (isNetworkError) {
              setStatusMessage('⟳ Network error, reconnecting...');
              authRetryCount = 0; // reset so we can try refreshing again when online if needed
            } else {
              setStatusMessage('✗ Session expired. Please log in again.');
              return; // Stop the auto-reconnect entirely
            }
          }
        } else {
          setStatusMessage('⟳ Reconnecting...');
        }

        reconnectTimeout.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [token, currentChatId]);

  const sendMessage = () => {
    if (!input.trim() || !isConnected) return;

    const msg = input.trim();
    
    // When sending a message, remove the __status__ if it is "Connected to Agent" so it doesn't clutter
    setMessages(prev => {
      const filtered = prev.filter(m => m.id !== '__status__');
      return [...filtered, { id: Math.random().toString(), text: msg, isUser: true }];
    });

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ message: msg }));
    } else {
      console.log("WS not open");
    }
    setInput('');
  };

  const renderContent = () => {
    return (
      <>
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
            paddingBottom: Platform.OS === 'android' && keyboardHeight > 0 ? 8 : insets.bottom + 8
          }
        ]}>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: isConnected ? colors.inputBg : colors.border, color: colors.text, opacity: isConnected ? 1 : 0.6 }]}
            value={input}
            onChangeText={setInput}
            placeholder={isConnected ? "Type a message..." : "Waiting for connection..."}
            placeholderTextColor={colors.textSecondary}
            editable={isConnected}
          />
          <TouchableOpacity 
             onPress={sendMessage} 
             disabled={!isConnected}
             style={[styles.sendBtn, { backgroundColor: isConnected ? colors.primary : colors.textSecondary }]}>
            <MaterialIcons name="send" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        <Modal visible={isHistoryVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setHistoryVisible(false)}>
          <View style={{flex: 1, backgroundColor: colors.background, paddingTop: Platform.OS === 'ios' ? 40 : 20, paddingHorizontal: 20}}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
              <Text style={{fontSize: 22, fontWeight: 'bold', color: colors.text}}>Chat History</Text>
              <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                <MaterialIcons name="close" size={28} color={colors.text} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.newChatBtn, {backgroundColor: colors.primary}]} onPress={startNewChat}>
              <MaterialIcons name="add" size={20} color="#fff" />
              <Text style={{color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8}}>New Chat</Text>
            </TouchableOpacity>
            {loadingHistory ? (
               <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 20}} />
            ) : (
               <FlatList
                 data={chatHistory}
                 keyExtractor={item => item.chat_id}
                 renderItem={({item}) => (
                   <View style={[styles.historyItemContainer, { borderBottomColor: colors.border }]}>
                     <TouchableOpacity style={styles.historyItem} onPress={() => selectChat(item.chat_id)}>
                       <Text style={{color: colors.text, fontSize: 16, fontWeight: item.chat_id === currentChatId ? 'bold' : 'normal'}} numberOfLines={1}>{item.title || "New Chat"}</Text>
                       <Text style={{color: colors.textSecondary, fontSize: 12, marginTop: 4}}>{new Date(item.updated_at).toLocaleString()}</Text>
                     </TouchableOpacity>
                     <TouchableOpacity onPress={() => handleDeleteChat(item.chat_id)} style={{padding: 10, paddingRight: 0}}>
                       <MaterialIcons name="delete" size={24} color={colors.error || '#ff4444'} />
                     </TouchableOpacity>
                   </View>
                 )}
                 ListEmptyComponent={<Text style={{color: colors.textSecondary, textAlign: 'center', marginTop: 20}}>No previous chats found.</Text>}
               />
            )}
          </View>
        </Modal>
      </>
    );
  };

  if (Platform.OS === 'android') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: keyboardHeight===0?0:keyboardHeight-58}]}>
        {renderContent()}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={90}
    >
      {renderContent()}
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
  newChatBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, marginBottom: 15 },
  historyItemContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  historyItem: { flex: 1, paddingVertical: 15 }
});

export default AgentScreen;
