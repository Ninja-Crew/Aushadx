import React from 'react';
import { render } from '@testing-library/react-native';
import ScheduleScreen from '../../../src/screens/ScheduleScreen';

jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', text: '#000', primary: 'blue', border: '#ccc', card: '#fff', chip: '#eee', success: 'green', error: 'red', textSecondary: '#666' },
    isDark: false,
  }),
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('../../../src/components/CustomHeader', () => 'CustomHeader');

describe('ScheduleScreen Component', () => {
  const mockNavigation = { navigate: jest.fn() };
  const mockRoute = { params: { token: 'mockToken' } };

  it('renders correctly', () => {
    const { getByText } = render(
      <ScheduleScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(getByText('Coming Soon!')).toBeTruthy();
  });
});
