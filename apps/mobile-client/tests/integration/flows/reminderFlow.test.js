import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AddEditReminderScreen from '../../../src/screens/AddEditReminderScreen';

jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', text: '#000', primary: 'blue', border: '#ccc', card: '#fff', textSecondary: '#666', icon: '#000' },
    isDark: false,
  }),
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../../src/components/CustomHeader', () => 'CustomHeader');
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('../../../src/api/reminders', () => ({
  createReminder: jest.fn(),
}));

describe('Reminder Flow Integration', () => {
  const mockNavigation = { goBack: jest.fn() };
  const mockRoute = { params: { token: 'token123' } };
  const remindersApi = require('../../../src/api/reminders');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows user to enter reminder details and save', async () => {
    remindersApi.createReminder.mockResolvedValueOnce({ success: true });

    const { getByPlaceholderText, getByText } = render(
      <AddEditReminderScreen navigation={mockNavigation} route={mockRoute} />
    );

    fireEvent.changeText(getByPlaceholderText('e.g. Paracetamol'), 'Ibuprofen');
    fireEvent.changeText(getByPlaceholderText('e.g. 1 Tablet (500mg)'), '200mg');

    fireEvent.press(getByText('Save Reminder'));

    await waitFor(() => {
      expect(remindersApi.createReminder).toHaveBeenCalled();
      expect(mockNavigation.goBack).toHaveBeenCalled();
    });
  });
});
