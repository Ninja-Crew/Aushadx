import React from 'react';
import { render } from '@testing-library/react-native';
import ProfileScreen from '../../../src/screens/ProfileScreen';

jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', text: '#000', primary: 'blue', border: '#ccc', card: '#fff', chip: '#eee', success: 'green', error: 'red' },
    isDark: false,
  }),
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('../../../src/components/CustomHeader', () => 'CustomHeader');

jest.mock('../../../src/api/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({ name: 'Test User', email: 'test@example.com' }),
  getMedicalInfo: jest.fn().mockResolvedValue({ bloodType: 'O+' }),
}));

describe('ProfileScreen Component', () => {
  const mockNavigation = { navigate: jest.fn() };
  const mockRoute = { params: { token: 'mockToken' } };

  it('renders correctly without crashing', () => {
    const { toJSON } = render(
      <ProfileScreen navigation={mockNavigation} route={mockRoute} />
    );
    expect(toJSON()).toBeTruthy();
  });
});
