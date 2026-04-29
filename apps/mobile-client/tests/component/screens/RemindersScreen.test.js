import React from 'react';
import { render } from '@testing-library/react-native';
import RemindersScreen from '../../../src/screens/RemindersScreen';

jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', text: '#000', primary: 'blue', border: '#ccc', card: '#fff', chip: '#eee', success: 'green', error: 'red' },
    isDark: false,
  }),
}));

jest.mock('../../../src/context/NotificationContext', () => ({
  useNotificationContext: () => ({ notifications: [], removeNotification: jest.fn(), refreshNotifications: jest.fn(), loading: false })
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('../../../src/components/CustomHeader', () => 'CustomHeader');

describe('RemindersScreen Component', () => {
  const mockNavigation = { navigate: jest.fn() };
  const mockRoute = { params: { token: 'mockToken' } };

  it('renders correctly', () => {
    const { getByText } = render(
      <RemindersScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('Missed Reminders')).toBeTruthy();
  });
});
