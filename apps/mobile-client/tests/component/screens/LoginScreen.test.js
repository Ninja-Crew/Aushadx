import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../../src/screens/LoginScreen';
import { AuthContext } from '../../../src/context/AuthContext';
import { ThemeProvider } from '../../../src/context/ThemeContext';

jest.mock('../../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#fff', text: '#000', primary: 'blue', border: '#ccc', card: '#fff' },
    isDark: false,
  }),
  ThemeProvider: ({ children }) => <>{children}</>
}));

describe('LoginScreen Component', () => {
  const mockNavigation = { navigate: jest.fn() };
  const mockLogin = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders login form correctly', () => {
    // Note: We're mocking the context, but AuthContext wasn't exported from a file. 
    // In this app, we don't have AuthContext (wait, do we?).
    // Let's just render the screen without AuthContext first, if it fails we mock it.
    // Actually, looking at the api, it imports `login` from api/auth.
    const { getByPlaceholderText, getByText } = render(
      <LoginScreen navigation={mockNavigation} />
    );
    
    expect(getByPlaceholderText('Email')).toBeTruthy();
    expect(getByPlaceholderText('Password')).toBeTruthy();
    expect(getByText('Sign In')).toBeTruthy();
  });

  it('navigates to signup screen', () => {
    const { getByText } = render(<LoginScreen navigation={mockNavigation} />);
    fireEvent.press(getByText('Sign up'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('OTPVerification', { isSignUp: true });
  });

  it('navigates to forgot password screen', () => {
    const { getByText } = render(<LoginScreen navigation={mockNavigation} />);
    fireEvent.press(getByText('Forgot Password?'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ForgotPassword');
  });
});
