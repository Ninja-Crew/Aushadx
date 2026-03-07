import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Button, FlatList, StyleSheet, Platform } from 'react-native';
import ChatMessage from '../components/ChatMessage';

const AgentScreen = ({ route }) => {
  const { token } = route.params || {}; // Assuming token is passed via navigation
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const ws = useRef(null);

  useEffect(() => {
    // Determine WS URL
    const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
    const port = 3001; // Gateway port
    // Gateway app.js expects token in header or query param. 
    // Standard WebSocket() in browser/RN doesn't support headers easily on all platforms?
    // React Native's WebSocket supports headers as 2nd arg (protocols) or options?
    // Actually, RN standard WebSocket constructor: WebSocket(url, protocols)
    // To pass headers, some libraries needed, or use query param.
    // Gateway app.js logic:
    // const url = new URL(req.url, `http://${req.headers.host}`);
    // token = url.searchParams.get("token");
    // So query param is supported.
    
    // Also userId is needed? app.js extracts it from token.
    
    const wsUrl = `ws://${host}:${port}/ws?token=${token}`;
    
    console.log("Connecting to WS:", wsUrl);
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      console.log('WebSocket Connected');
      setMessages(prev => [...prev, { id: Date.now(), text: 'Connected to Agent', isUser: false }]);
    };

    ws.current.onmessage = (e) => {
      console.log('Received:', e.data);
      // Ensure e.data is string. If binary, need handling.
      // Agent service likely sends JSON or text.
      const text = e.data;
      setMessages(prev => [...prev, { id: Date.now(), text, isUser: false }]);
    };

    ws.current.onerror = (e) => {
      console.log('WebSocket Error:', e.message);
      setMessages(prev => [...prev, { id: Date.now(), text: 'Error connecting to agent', isUser: false }]);
    };

    ws.current.onclose = (e) => {
      console.log('WebSocket Closed:', e.code, e.reason);
      setMessages(prev => [...prev, { id: Date.now(), text: 'Disconnected', isUser: false }]);
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
    setMessages(prev => [...prev, { id: Date.now(), text: msg, isUser: true }]);
    
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ message: msg })); // Adjust payload format based on Agent service expectation
    } else {
        console.log("WS not open");
    }
    setInput('');
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => <ChatMessage message={item.text} isUser={item.isUser} />}
        contentContainerStyle={styles.list}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
        />
        <Button title="Send" onPress={sendMessage} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  list: {
    padding: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 5,
    marginRight: 10,
  },
});

export default AgentScreen;
