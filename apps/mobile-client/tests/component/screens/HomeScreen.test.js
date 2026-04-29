import React from 'react';
import { render } from '@testing-library/react-native';
import HomeScreen from '../../../src/screens/HomeScreen';

jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', text: '#000', primary: 'blue', border: '#ccc', card: '#fff', chip: '#eee' },
    isDark: false,
  }),
}));

jest.mock('../../../src/context/NotificationContext', () => ({
  useNotificationContext: () => ({ unreadCount: 0 })
}));

jest.mock('../../../src/components/CustomHeader', () => 'CustomHeader');
jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

// Mock API and Location
jest.mock('../../../src/api/profile', () => ({
  getProfile: jest.fn().mockResolvedValue({ name: 'Test User' }),
  registerFCMToken: jest.fn(),
}));

jest.mock('../../../src/api/reminders', () => ({
  getReminders: jest.fn().mockResolvedValue([]),
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 0, longitude: 0 } }),
}));

describe('HomeScreen Component', () => {
  const mockNavigation = { navigate: jest.fn(), addListener: jest.fn() };
  const mockRoute = { params: { token: 'mockToken' } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly', () => {
    // We mock useFocusEffect which relies on navigation.addListener
    jest.spyOn(React, 'useEffect').mockImplementation(f => f());
    
    const { getByText } = render(
      <HomeScreen navigation={mockNavigation} route={mockRoute} />
    );
    
    // It should render greeting
    expect(getByText('Quick Actions')).toBeTruthy();
  });
});
