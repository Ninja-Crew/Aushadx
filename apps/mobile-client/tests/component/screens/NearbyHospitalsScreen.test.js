import React from 'react';
import { render } from '@testing-library/react-native';
import NearbyHospitalsScreen from '../../../src/screens/NearbyHospitalsScreen';

jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', text: '#000', primary: 'blue', border: '#ccc', card: '#fff', chip: '#eee', success: 'green', error: 'red', textSecondary: '#666' },
    isDark: false,
  }),
}));

jest.mock('@expo/vector-icons/MaterialIcons', () => 'MaterialIcons');
jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../../src/components/CustomHeader', () => 'CustomHeader');
jest.mock('react-native-maps', () => {
  const React = require('react');
  const MapView = (props) => <div testID="map-view">{props.children}</div>;
  MapView.Marker = (props) => <div testID="map-marker">{props.children}</div>;
  return MapView;
});

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 0, longitude: 0 } }),
}));

describe('NearbyHospitalsScreen Component', () => {
  const mockNavigation = { navigate: jest.fn() };

  it('renders loading initially', () => {
    const { getByText } = render(
      <NearbyHospitalsScreen navigation={mockNavigation} />
    );
    expect(getByText('Finding nearby medical facilities...')).toBeTruthy();
  });
});
