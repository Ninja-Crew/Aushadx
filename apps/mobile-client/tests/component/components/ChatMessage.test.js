import React from 'react';
import { render } from '@testing-library/react-native';
import ChatMessage from '../../../src/components/ChatMessage';

describe('ChatMessage Component', () => {
  it('renders user message correctly', () => {
    const { getByText } = render(<ChatMessage message="Hello Agent" isUser={true} />);
    expect(getByText('Hello Agent')).toBeTruthy();
  });

  it('renders bold text correctly', () => {
    // We pass "**Bold** text"
    const { getByText } = render(<ChatMessage message="This is **Bold** text" isUser={false} />);
    expect(getByText('This is ')).toBeTruthy();
    expect(getByText('Bold')).toBeTruthy();
    expect(getByText(' text')).toBeTruthy();
  });

  it('renders status message correctly', () => {
    const { getByText } = render(<ChatMessage message="System update" isStatus={true} />);
    expect(getByText('System update')).toBeTruthy();
  });

  it('renders queued status correctly', () => {
    const { getByText } = render(<ChatMessage status="queued" />);
    expect(getByText('Next in line...')).toBeTruthy();
  });

  it('renders tool label correctly', () => {
    const { getByText } = render(<ChatMessage toolLabel="Fetching data..." />);
    expect(getByText('Fetching data...')).toBeTruthy();
  });
});
