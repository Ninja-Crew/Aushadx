import React from 'react';
import { render } from '@testing-library/react-native';
import AgentScreen from '../../../src/screens/AgentScreen';

jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', text: '#000', primary: 'blue', border: '#ccc', card: '#fff', chip: '#eee', success: 'green', error: 'red' },
    isDark: false,
  }),
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('../../../src/components/CustomHeader', () => 'CustomHeader');
jest.mock('../../../src/components/ChatMessage', () => {
  const React = require('react');
  const { View } = require('react-native');
  return (props) => <View testID="chat-message" />;
});

describe('AgentScreen Component', () => {
  const mockNavigation = { navigate: jest.fn() };
  const mockRoute = { params: { token: 'mockToken' } };

  it('renders correctly', () => {
    const { getByPlaceholderText } = render(
      <AgentScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByPlaceholderText('Ask about your medicines...')).toBeTruthy();
  });
});
