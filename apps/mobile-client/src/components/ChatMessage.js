import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const ChatMessage = ({ message, isUser }) => {
  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.agentContainer
    ]}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
    maxWidth: '80%',
  },
  userContainer: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF', // Blue for user
  },
  agentContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA', // Grey for agent
  },
  text: {
    color: '#000', // Adjust for verified contrast usually, but keep simple
  },
});

export default ChatMessage;
