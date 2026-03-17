import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

const ChatMessage = ({ message, isUser, status, toolLabel, isStatus }) => {
  if (isStatus) {
    return (
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{message}</Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.agentContainer
    ]}>
      {/* If it's queued */}
      {status === 'queued' && (
        <View style={styles.row}>
           <Text style={styles.queuedText}>Next in line...</Text>
        </View>
      )}

      {/* If a tool is running */}
      {!!toolLabel && (
        <View style={[styles.toolContainer, message ? { marginBottom: 6 } : {}]}>
          <ActivityIndicator size="small" color="#666" style={{marginRight: 6}} />
          <Text style={styles.toolText}>{toolLabel}</Text>
        </View>
      )}

      {/* The actual text message */}
      {!!message && <Text style={[styles.text, isUser && styles.userText]}>{message}</Text>}

      {/* If it's processing but no tool label and message is empty */}
      {status === 'processing' && !toolLabel && !message && (
        <View style={styles.row}>
          <ActivityIndicator size="small" color={isUser ? "#fff" : "#666"} />
        </View>
      )}
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
  statusContainer: {
    alignSelf: 'center',
    marginVertical: 4,
    padding: 4,
  },
  statusText: {
    color: '#888',
    fontSize: 12,
  },
  text: {
    color: '#000',
  },
  userText: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  queuedText: {
    fontStyle: 'italic',
    color: '#888',
    fontSize: 13,
  },
  toolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
  },
  toolText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '500'
  }
});

export default ChatMessage;
