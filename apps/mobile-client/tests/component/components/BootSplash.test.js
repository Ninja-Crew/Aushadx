import React from 'react';
import { render } from '@testing-library/react-native';
import BootSplash from '../../../src/components/BootSplash';

jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#000', textSecondary: '#ccc' },
    isDark: true,
  }),
}));

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn().mockResolvedValue(true),
}));

describe('BootSplash Component', () => {
  it('renders correctly', () => {
    const { getByText } = render(<BootSplash />);
    expect(getByText('Aushad')).toBeTruthy();
    expect(getByText('X')).toBeTruthy();
    expect(getByText('Your Smart Medicine Companion')).toBeTruthy();
  });
});
