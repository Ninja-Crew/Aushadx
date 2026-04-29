import React from 'react';
import { render } from '@testing-library/react-native';
import AddEditReminderScreen from '../../../src/screens/AddEditReminderScreen';

jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', text: '#000', primary: 'blue', border: '#ccc', card: '#fff', chip: '#eee', success: 'green', error: 'red', textSecondary: '#666', icon: '#000' },
    isDark: false,
  }),
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../../src/components/CustomHeader', () => 'CustomHeader');
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

describe('AddEditReminderScreen Component', () => {
  const mockNavigation = { navigate: jest.fn(), goBack: jest.fn() };
  const mockRoute = { params: { token: 'mockToken' } };

  it('renders correctly for adding', () => {
    const { getByText, getByPlaceholderText } = render(
      <AddEditReminderScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('Medicine Name *')).toBeTruthy();
    expect(getByPlaceholderText('e.g. Paracetamol')).toBeTruthy();
  });
});
